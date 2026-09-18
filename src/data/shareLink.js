/*
 * Share links name a dataset in the page URL: `?ID=` holds its link in base64,
 * and the older `?GFOLDER=` holds a Google Drive folder id or link. The encoding
 * must not change, or links that were already shared stop working.
 */

export function encodeUrl(url) {
  return b64EncodeUnicode(url);
}

/** Decodes an `?ID=` value; "" when it isn't valid base64 text. */
export function decodeUrl(encoded) {
  let hashIndex = encoded.lastIndexOf("#/");
  if (hashIndex > 0) encoded = encoded.substring(0, hashIndex);
  try {
    return b64DecodeUnicode(encoded);
  } catch (err) {
    return "";
  }
}

export function b64EncodeUnicode(str) {
  // Percent-encoding yields UTF-8 bytes; btoa needs them as raw characters.
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
  );
}

function b64DecodeUnicode(str) {
  return decodeURIComponent(
    atob(str)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}

/**
 * The dataset link named by the page URL, or null when there is none. Names
 * must match exactly, so `?gid=` or `?sessionID=` don't count. Values are read
 * raw rather than through URLSearchParams, which turns base64's "+" into a
 * space. A value that can't be decoded gives "".
 */
export function readShareParams(location) {
  let query = location.search + "&" + location.hash;
  let folder = readParam(query, "GFOLDER");
  if (folder !== null) {
    return folder.indexOf("/") === -1
      ? "https://drive.google.com/drive/folders/" + folder
      : folder;
  }
  let id = readParam(query, "ID");
  return id === null ? null : decodeUrl(id);
}

/**
 * The page's address with its query naming `link` as a share link does, or
 * naming no dataset when `link` is null. The path, the hash route and any
 * other parameters stay as they are.
 */
export function addressFor(location, link) {
  let params = location.search
    .replace(/^\?/, "")
    .split("&")
    .filter((part) => part !== "" && !/^(ID|GFOLDER)=/.test(part));
  if (link) params.push("ID=" + encodeURIComponent(encodeUrl(link)));
  return (
    location.pathname +
    (params.length > 0 ? "?" + params.join("&") : "") +
    location.hash
  );
}

function readParam(query, name) {
  let match = query.match(new RegExp("[?&]" + name + "=([^&#]*)"));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch (err) {
    return match[1];
  }
}
