/* global __GOOGLE_API_KEY__ */
import { LoadError } from "./errors.js";
import { looksLikeHtml } from "./table.js";
import { b64EncodeUnicode } from "./shareLink.js";
import { IMAGE_WIDTH, driveThumbnail } from "./assets.js";

/*
 * Where datasets come from: a CSV link, a folder on a web server, a Google
 * Drive or OneDrive folder, or a file or a folder on the user's computer.
 * Every failure is a LoadError with a message for the user.
 */

const ONEDRIVE_SHARES_API = "https://api.onedrive.com/v1.0/shares/";

/*
 * Reading a Google Drive folder costs an API key, which a browser has to
 * carry and so cannot keep secret. Restricting it to this site's referrer in
 * the Cloud console is the mitigation, and it is a speed bump rather than a
 * lock: anything that is not a browser sends whatever referrer it likes.
 *
 * What the key buys is narrow. The listing is 100 quota units and the data
 * file 200; a folder's pictures come from the thumbnail service, which asks
 * for no key and spends nothing (see assets.js). So a visit costs 300 units
 * however many photographs the folder holds, against a free allowance of
 * 400,000,000 a day.
 *
 * With no key compiled in, a Drive folder is refused as it always was.
 */
const DRIVE_KEY =
  typeof __GOOGLE_API_KEY__ !== "undefined" ? __GOOGLE_API_KEY__ : "";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_FOLDER_PATH = /\/folders\/([A-Za-z0-9_-]{10,})/;
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;

// What to do when a shared cloud folder can't be read from the browser.
const CLOUD_HINT =
  "Download the folder and choose it under From your computer, or put the folder on a web server (a GitHub repository works) and use that link.";

/**
 * Works out what `input` is: `{ file }` for a local file, `{ folder }` for a
 * local folder (its files as `[{ path, file }]`, each path counted from the
 * folder), otherwise a link.
 * Returns `{ kind, ... }` with kind "file", "folder", "csv", "server" or "onedrive". `link` is what reopens the dataset from a share link.
 */
export function resolveSource(input) {
  if (input && input.file) return { kind: "file", file: input.file };
  if (input && input.folder) return { kind: "folder", entries: input.folder };
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
    let folderId = driveFolderId(url);
    if (folderId && DRIVE_KEY) {
      return { kind: "gdrive", folderId: folderId, link: url.href };
    }
    throw new LoadError(
      "DesignSense can't read Google Drive folders. " +
        CLOUD_HINT +
        " The pictures can stay in Drive either way: a CSV whose img column" +
        " holds Drive links is read as it should be."
    );
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
 * Downloads a resolved source as `{ text, baseUrl, files, rawFiles, link }`:
 * the CSV text, where relative file names resolve from, a folder's files by
 * name (`rawFiles` holding the originals, companions included), and the link
 * that reopens the dataset (none for local files). A local folder also comes
 * with its CSV's `name` and a `release` to call once it is off the screen.
 */
export function fetchSource(source) {
  if (source.kind === "file") {
    return readFileText(source.file).then((text) => ({ text: text }));
  }
  if (source.kind === "folder") return readLocalFolder(source.entries);
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
  if (source.kind === "gdrive") {
    return listDriveFolder(source.folderId).then((folder) =>
      fetchText(
        pickDataCsv(
          folder,
          "No data.csv was found in that Drive folder. Check that it holds one, and that the folder is shared so anyone with the link can view it."
        )
      ).then((text) => ({
        text: text,
        files: folder.files,
        rawFiles: folder.raw,
        link: source.link,
      }))
    );
  }
  return listOneDriveFolder(source.link).then((folder) =>
    fetchText(pickDataCsv(folder)).then((text) => ({
      text: text,
      files: folder.files,
      // The originals, for a model's companion .bin, .mtl and textures.
      rawFiles: folder.raw,
      link: source.link,
    }))
  );
}

/** Fetches a text file, turning each kind of failure into a LoadError. */
export function fetchText(url, notFoundMessage) {
  return fetch(url, keyedRequest(url)).then(
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
    if (/onedrive|sharepoint|microsoft/i.test(host)) {
      return new LoadError(
        "Microsoft doesn't let other sites read this shared OneDrive folder, however it is shared. " +
          CLOUD_HINT
      );
    }
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
  return "";
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch (err) {
    return String(url);
  }
}

/*
 * The page tells the browser to send no referrer (see public/index.html), so
 * that a gallery's dozens of picture requests are not counted against it and
 * a reader's address is not handed to whoever hosts their images. A
 * referrer-restricted API key wants the opposite: with no referrer there is
 * nothing for Google to match, and the key is refused. These two requests, and
 * only these, send the site's origin -- not the path, which is what carries
 * the dataset's link.
 */
function keyedRequest(url) {
  return url.indexOf(DRIVE_API) === 0 ? { referrerPolicy: "origin" } : undefined;
}

function fetchJson(url, service) {
  return fetch(url, keyedRequest(url)).then(
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
  // OneDrive turns away a signed-out request for a folder on an account that
  // has moved to SharePoint, whatever the folder is shared with, so sharing it
  // again is no help: say what does work instead.
  if (status === 401 || /unauthenticated/i.test(message)) {
    return new LoadError(
      service +
        " doesn't let other sites read this shared folder, however it is shared. " +
        CLOUD_HINT
    );
  }
  if (status === 403) {
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

// Drive reports a .glb as "model/gltf-binary" some days and
// "application/octet-stream" others, and .obj and .mtl usually as text, so the
// extension decides whenever the type doesn't.
const MODEL_FILE = /\.(glb|gltf|obj)$/i;
// A .gltf names its own buffers and textures, and a .mtl its maps, so the
// folder's other files are kept rather than sorted away.
const MODEL_ASSET = /\.(bin|mtl|ktx2|dds|tga|hdr)$/i;
const IMAGE_FILE = /\.(png|jpe?g|webp|gif|bmp|svg)$/i;

function emptyFolder() {
  // `files` is what the data's cells resolve to; `raw` is the bytes of every
  // file, which is what a 3D model and its companions have to be fetched from.
  return { csv: {}, files: {}, raw: {} };
}

function addToFolder(folder, name, mimeType, url, imageUrl) {
  let type = mimeType || "";
  folder.raw[name] = url;
  if (/\.(csv|tsv)$/i.test(name) || type === "text/csv") {
    folder.csv[name] = url;
    return;
  }
  if (type.indexOf("image/") === 0 || IMAGE_FILE.test(name)) {
    // A gallery wants the resized copy, not the original megabytes.
    folder.files[name] = imageUrl || url;
    return;
  }
  if (MODEL_FILE.test(name) || type.indexOf("model/") === 0) {
    folder.files[name] = url;
    return;
  }
  if (MODEL_ASSET.test(name)) return;
  if (type === "application/json" && name.indexOf("setting") !== 0) {
    // Design Explorer's 3D files: kept so the loader can say it can't show them.
    folder.files[name] = url;
  }
}

/** The folder id in a Drive link, from its path or its `id`, or "". */
function driveFolderId(url) {
  let inPath = DRIVE_FOLDER_PATH.exec(url.pathname);
  if (inPath) return inPath[1];
  let id = url.searchParams.get("id") || "";
  return DRIVE_ID.test(id) ? id : "";
}

/**
 * Everything in a public Drive folder, by name.
 *
 * One listing request per thousand files, and then the files themselves are
 * reached two ways: the data, the settings and the models through the API,
 * which is what the key is for, and every picture through the thumbnail
 * service, which needs none and lets the gallery ask for the size it draws.
 */
export function listDriveFolder(folderId) {
  let folder = emptyFolder();
  function page(token) {
    let url =
      DRIVE_API +
      "?q=" +
      encodeURIComponent("'" + folderId + "' in parents and trashed = false") +
      "&key=" +
      encodeURIComponent(DRIVE_KEY) +
      "&fields=" +
      encodeURIComponent("nextPageToken,files(id,name,mimeType)") +
      "&pageSize=1000" +
      (token ? "&pageToken=" + encodeURIComponent(token) : "");
    return fetchJson(url, "Google Drive").then((body) => {
      (body.files || []).forEach((item) => {
        let media =
          DRIVE_API +
          "/" +
          encodeURIComponent(item.id) +
          "?alt=media&key=" +
          encodeURIComponent(DRIVE_KEY);
        let picture =
          String(item.mimeType || "").indexOf("image/") === 0
            ? driveThumbnail(item.id, IMAGE_WIDTH.large)
            : undefined;
        addToFolder(folder, item.name, item.mimeType, media, picture);
      });
      return body.nextPageToken ? page(body.nextPageToken) : folder;
    });
  }
  return page("");
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

/**
 * Lists a shared OneDrive folder, following every page and skipping
 * subfolders. Microsoft turns the request away for an account whose OneDrive
 * has moved to SharePoint, whatever the folder is shared with, so this works
 * for some accounts and not others; a refusal says what to do instead.
 */
/**
 * The largest thumbnail OneDrive has already made of a file, or nothing.
 *
 * It is asked for with the listing rather than fetched per file. A gallery
 * wants a picture the size of a card, and `@content.downloadUrl` is the
 * original: a folder of 46 photographs sends about fifteen megabytes that way
 * and perhaps two this way.
 */
function oneDriveThumbnail(item) {
  let set = item && item.thumbnails && item.thumbnails[0];
  if (!set) return undefined;
  let pick = set.large || set.medium || set.small;
  return pick && pick.url;
}

export function listOneDriveFolder(link) {
  let items = [];
  function nextPage(url) {
    return fetchJson(url, "OneDrive").then((body) => {
      items = items.concat(body.children || body.value || []);
      let next = body["children@odata.nextLink"] || body["@odata.nextLink"];
      return next ? nextPage(next) : items;
    });
  }
  let root = ONEDRIVE_SHARES_API + toOneDriveShareId(link) + "/root";
  // Thumbnails are asked for with the children. Not every share answers with
  // them -- an older link, or a file the service has not rendered yet -- and
  // a request it will not parse fails the whole listing, so a refusal is
  // retried plainly and the gallery falls back to the download URLs, which is
  // what it used before.
  return nextPage(root + "?expand=children(expand=thumbnails)")
    .catch(() => {
      items = [];
      return nextPage(root + "?expand=children");
    })
    .then((all) => {
      let folder = emptyFolder();
      all.forEach((item) => {
        if (!item.file) return;
        addToFolder(
          folder,
          item.name,
          item.file.mimeType,
          item["@content.downloadUrl"],
          oneDriveThumbnail(item)
        );
      });
      return folder;
    });
}

/**
 * The folder's data.csv (any case), or its only CSV file. A local folder
 * names its files by path, so a data.csv one folder down is found too, when
 * it is the only one. `noCsvMessage` replaces what is said of a shared folder
 * that holds none.
 */
export function pickDataCsv(folder, noCsvMessage) {
  let names = Object.keys(folder.csv);
  let isDataCsv = (name) => name.toLowerCase() === "data.csv";
  let nested = names.filter((name) => isDataCsv(name.split("/").pop()));
  let match =
    names.filter(isDataCsv)[0] ||
    (nested.length === 1 ? nested[0] : null) ||
    (names.length === 1 ? names[0] : null);
  if (!match) {
    throw new LoadError(
      names.length === 0
        ? noCsvMessage ||
          "No data.csv was found in that folder. Check that it holds data.csv and is shared publicly."
        : "That folder has several CSV files (" +
          names.join(", ") +
          ") but none named data.csv."
    );
  }
  return folder.csv[match];
}

/**
 * A folder on the user's computer, read where it is. Each picture and model
 * gets an object URL, which is to a local file what a download link is to a
 * shared one, so the rest of the loader treats the folder as it does
 * OneDrive's. Nothing but the CSV is read until a view asks for a file.
 */
function readLocalFolder(entries) {
  let folder = emptyFolder();
  let csvFiles = {};
  let urls = [];
  let release = () => urls.forEach((url) => URL.revokeObjectURL(url));
  (entries || []).forEach((entry) => {
    let file = entry.file;
    let name = entry.path || file.name;
    if (/\.(csv|tsv)$/i.test(name) || file.type === "text/csv") {
      csvFiles[name] = file;
      folder.csv[name] = name;
      return;
    }
    let url = URL.createObjectURL(file);
    urls.push(url);
    // Windows knows a .json's type only when some program has registered it.
    let type = file.type || (/\.json$/i.test(name) ? "application/json" : "");
    addToFolder(folder, name, type, url);
  });
  return Promise.resolve()
    .then(() =>
      pickDataCsv(
        folder,
        "No CSV file was found in that folder. Choose the folder that holds data.csv."
      )
    )
    .then((name) =>
      readFileText(csvFiles[name]).then((text) => ({
        text: text,
        files: folder.files,
        rawFiles: folder.raw,
        name: name.split("/").pop(),
        release: release,
      }))
    )
    .catch((error) => {
      release();
      throw error;
    });
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
