import { LoadError } from "./errors.js";
import { looksLikeHtml } from "./table.js";
import { b64EncodeUnicode } from "./shareLink.js";

/*
 * Where datasets come from: a CSV link, a folder on a web server, a Google
 * Drive or OneDrive folder, or a file on the user's computer. Every failure is
 * a LoadError with a message for the user.
 */

const DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";
const ONEDRIVE_SHARES_API = "https://api.onedrive.com/v1.0/shares/";

/**
 * Works out what `input` is: `{ file }` for a local file, otherwise a link.
 * Returns `{ kind, ... }` with kind "file", "csv", "server", "gdrive" or
 * "onedrive". `link` is what reopens the dataset from a share link.
 */
export function resolveSource(input) {
  if (input && input.file) return { kind: "file", file: input.file };
  let url = parseHttpUrl(typeof input === "string" ? input : "");
  let host = url.hostname.toLowerCase();

  // A GitHub file page is HTML; the raw host serves the file itself.
  let blob =
    host === "github.com" &&
    url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (blob) {
    url = new URL(
      "https://raw.githubusercontent.com/" +
        blob[1] +
        "/" +
        blob[2] +
        "/" +
        blob[3]
    );
    host = url.hostname;
  }

  if (host === "drive.google.com") {
    let folder = url.pathname.match(/\/folders\/([-\w]+)/);
    let id = folder ? folder[1] : url.searchParams.get("id");
    if (!id || !/^[-\w]+$/.test(id)) {
      throw new LoadError(
        "That Google Drive link isn't a folder. Share the folder that holds data.csv and use its link."
      );
    }
    return { kind: "gdrive", folderId: id, link: url.href };
  }
  if (host === "1drv.ms" || host === "onedrive.live.com") {
    return { kind: "onedrive", link: url.href };
  }
  if (
    /\.(csv|tsv|txt)$/i.test(url.pathname) ||
    /[?&](output|format)=csv(&|$)/i.test(url.search)
  ) {
    return { kind: "csv", url: url.href, link: url.href };
  }
  // Anything else is a folder on a web server that holds data.csv.
  let folderUrl = new URL(url.href);
  folderUrl.search = "";
  folderUrl.hash = "";
  if (folderUrl.pathname.slice(-1) !== "/") folderUrl.pathname += "/";
  return {
    kind: "server",
    url: new URL("data.csv", folderUrl).href,
    link: folderUrl.href,
  };
}

function parseHttpUrl(text) {
  let url = null;
  try {
    url = new URL(text.trim());
  } catch (err) {
    url = null;
  }
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
    throw new LoadError(
      "That isn't a web address. Links should start with https://."
    );
  }
  return url;
}

/**
 * Downloads a resolved source as `{ text, baseUrl, files, link }`: the CSV
 * text, where relative file names resolve from, a folder's files by name, and
 * the link that reopens the dataset (none for local files).
 */
export function fetchSource(source, options) {
  let apiKey = options && options.apiKey;
  if (source.kind === "file") {
    return readFileText(source.file).then((text) => ({ text: text }));
  }
  if (source.kind === "csv" || source.kind === "server") {
    let notFound =
      source.kind === "server"
        ? "No data.csv was found in that folder. Check the link, or link to the CSV file itself."
        : "No file was found at that link.";
    return fetchText(source.url, notFound).then((text) => ({
      text: text,
      baseUrl: source.url,
      link: source.link,
    }));
  }
  let listing =
    source.kind === "gdrive"
      ? listGoogleDriveFolder(source.folderId, apiKey)
      : listOneDriveFolder(source.link);
  return listing.then((folder) =>
    fetchText(pickDataCsv(folder)).then((text) => ({
      text: text,
      files: Object.assign({}, folder.models, folder.images),
      link: source.link,
    }))
  );
}

/** Fetches a text file, turning each kind of failure into a LoadError. */
export function fetchText(url, notFoundMessage) {
  return fetch(url).then(
    (response) => {
      if (!response.ok) throw httpError(response, url, notFoundMessage);
      return response.text().then((text) => {
        if (looksLikeHtml(text)) {
          throw new LoadError(
            "That link opened a web page, not a CSV file." + linkHint(url)
          );
        }
        return text;
      });
    },
    (error) => {
      throw new LoadError(
        "Couldn't reach " +
          hostOf(url) +
          ". It may be offline, or it may not let other sites load its files." +
          linkHint(url),
        error
      );
    }
  );
}

function httpError(response, url, notFoundMessage) {
  let host = hostOf(url);
  if (response.status === 404 || response.status === 410) {
    return new LoadError(notFoundMessage || "No file was found at that link.");
  }
  if (response.status === 401 || response.status === 403) {
    return new LoadError(
      host + " denied access. Make sure the files are shared publicly."
    );
  }
  return new LoadError(
    host + " responded with an error (" + response.status + ")."
  );
}

function linkHint(url) {
  let host = hostOf(url);
  if (host === "github.com") return " For files on GitHub, use the Raw link.";
  if (host === "drive.google.com" || host === "docs.google.com") {
    return " For Google Drive, share the folder that holds data.csv and use the folder's link.";
  }
  return "";
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch (err) {
    return String(url);
  }
}

function fetchJson(url, service) {
  return fetch(url).then(
    (response) => {
      if (response.ok) return response.json();
      // The service explains the refusal in the body; that reason decides the
      // message, since the status alone can't tell a bad key from a bad link.
      return response.text().then((body) => {
        throw folderError(response.status, service, apiMessage(body));
      });
    },
    (error) => {
      throw new LoadError("Couldn't reach " + service + ".", error);
    }
  );
}

function apiMessage(body) {
  try {
    let parsed = JSON.parse(body);
    return (parsed.error && parsed.error.message) || "";
  } catch (err) {
    return "";
  }
}

function folderError(status, service, message) {
  if (/api key/i.test(message)) {
    return new LoadError(
      service +
        " rejected this app's key, so its folders can't be opened. Download the folder and load its data.csv from your computer, or use a direct link to a CSV file."
    );
  }
  if (status === 401 || status === 403) {
    return new LoadError(
      service +
        " denied access to that folder. Share it so anyone with the link can view it."
    );
  }
  if (status === 404) {
    return new LoadError(
      service +
        " couldn't find that folder. Check the link, and that the folder is shared publicly."
    );
  }
  return new LoadError(
    service +
      " responded with an error (" +
      status +
      ")" +
      (message ? ": " + message : "") +
      "."
  );
}

function emptyFolder() {
  return { csv: {}, images: {}, models: {} };
}

function addToFolder(folder, name, mimeType, url, imageUrl) {
  let type = mimeType || "";
  if (/\.(csv|tsv)$/i.test(name) || type === "text/csv") {
    folder.csv[name] = url;
  } else if (type.indexOf("image/") === 0) {
    folder.images[name] = imageUrl || url;
  } else if (type === "application/json" && name.indexOf("setting") !== 0) {
    // Design Explorer's setting files are not models.
    folder.models[name] = url;
  }
}

/** Lists a public Google Drive folder, following every page. */
export function listGoogleDriveFolder(folderId, apiKey) {
  let key = encodeURIComponent(apiKey || "");
  let items = [];
  function nextPage(pageToken) {
    let url =
      DRIVE_FILES_API +
      "?q=" +
      encodeURIComponent("'" + folderId + "' in parents and trashed=false") +
      "&fields=" +
      encodeURIComponent("nextPageToken,files(id,name,mimeType)") +
      "&pageSize=1000&key=" +
      key +
      (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
    return fetchJson(url, "Google Drive").then((body) => {
      items = items.concat(body.files || []);
      return body.nextPageToken ? nextPage(body.nextPageToken) : items;
    });
  }
  return nextPage(null).then((files) => {
    let folder = emptyFolder();
    files.forEach((item) => {
      addToFolder(
        folder,
        item.name,
        item.mimeType,
        DRIVE_FILES_API + "/" + item.id + "?alt=media&key=" + key,
        "https://drive.google.com/thumbnail?id=" + item.id + "&sz=w1000"
      );
    });
    return folder;
  });
}

/** The OneDrive API's id for a sharing link: "u!" and unpadded base64url. */
export function toOneDriveShareId(link) {
  return (
    "u!" +
    b64EncodeUnicode(link)
      .replace(/=+$/, "")
      .replace(/\//g, "_")
      .replace(/\+/g, "-")
  );
}

/** Lists a shared OneDrive folder, following every page and skipping subfolders. */
export function listOneDriveFolder(link) {
  let items = [];
  function nextPage(url) {
    return fetchJson(url, "OneDrive").then((body) => {
      items = items.concat(body.children || body.value || []);
      let next = body["children@odata.nextLink"] || body["@odata.nextLink"];
      return next ? nextPage(next) : items;
    });
  }
  let first =
    ONEDRIVE_SHARES_API + toOneDriveShareId(link) + "/root?expand=children";
  return nextPage(first).then((all) => {
    let folder = emptyFolder();
    all.forEach((item) => {
      if (!item.file) return;
      addToFolder(
        folder,
        item.name,
        item.file.mimeType,
        item["@content.downloadUrl"]
      );
    });
    return folder;
  });
}

/** The folder's data.csv (any case), or its only CSV file. */
export function pickDataCsv(folder) {
  let names = Object.keys(folder.csv);
  let match =
    names.filter((name) => name.toLowerCase() === "data.csv")[0] ||
    (names.length === 1 ? names[0] : null);
  if (!match) {
    throw new LoadError(
      names.length === 0
        ? "No data.csv was found in that folder. Check that it holds data.csv and is shared publicly."
        : "That folder has several CSV files (" +
          names.join(", ") +
          ") but none named data.csv."
    );
  }
  return folder.csv[match];
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new LoadError("Couldn't read " + file.name + ".", reader.error));
    reader.readAsText(file);
  });
}
