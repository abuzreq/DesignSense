/*
 * Feedback from inside the app. It goes to the "feedback" form Netlify reads
 * from public/index.html, and lands in the site's Netlify dashboard (which
 * can email it on). Where there is no Netlify to take it -- running locally,
 * another host, or a submission that fails -- it opens an email instead.
 *
 * What is sent is what the user typed, a few facts about the app and the
 * dataset's shape (never its rows, and never where it is kept: a user's own
 * link stays private, and only a sample dataset is named), the errors kept by
 * errors.js if they choose, and a picture of the screen if they choose.
 */

/* global __APP_VERSION__ */

import { toJpeg } from "html-to-image";
import { errorsAsText } from "@/errors.js";
import { loadState } from "@/data/loader.js";
import { presetFor } from "@/data/presets.js";

export const FEEDBACK_EMAIL = "abuzreq@gmail.com";
export const APP_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
const FORM_NAME = "feedback";
// A mailto link longer than this is cut short by some mail apps.
const MAIL_LIMIT = 1800;
// The screen is drawn at most this wide, so the picture stays a few hundred KB.
const SHOT_WIDTH = 1600;
const SHOT_TIMEOUT = 15000;

/**
 * Which dataset is open, as far as a report may say: a sample by its name and
 * link, anything else only by its kind.
 */
function datasetText() {
  let preset = presetFor(loadState.link);
  if (preset) return "sample \"" + preset.name + "\" (" + preset.url + ")";
  if (loadState.link) return "the user's own, from a link (not reported)";
  if (loadState.source === "file") return "the user's own, from a local file";
  return "unknown";
}

/**
 * The page without its query: the address bar names the dataset's link there
 * (see shareLink.js), which a report must not carry for a user's own data.
 */
function pageText() {
  let hash = window.location.hash.split("?")[0];
  return window.location.origin + window.location.pathname + hash;
}

/** Facts that help make sense of a report, as "name: value" lines. */
export function feedbackContext(store) {
  let state = store.state;
  let getters = store.getters;
  let lines = [
    ["Version", APP_VERSION],
    ["Mode", state.uiMode],
    ["Page", pageText()],
    ["Dataset", datasetText()],
    ["Options", (state.rawData || []).length + " (" + (state.data || []).length + " shown)"],
    [
      "Columns",
      (state.numericDimensions || []).length +
        " numeric, " +
        (state.nonNumericDimensions || []).length +
        " text",
    ],
    ["Selected", getters.selectionCount],
    ["Screen", window.innerWidth + "×" + window.innerHeight + " @" + (window.devicePixelRatio || 1) + "x"],
    ["Browser", navigator.userAgent],
    ["Time", new Date().toISOString()],
  ];
  return lines.map((pair) => pair[0] + ": " + pair[1]).join("\n");
}

/** Whether a Netlify form can take the report here. */
export function canPostForm() {
  let host = window.location.hostname;
  return !(host === "localhost" || host === "127.0.0.1" || host === "" || host === "[::1]");
}

function dataUrlToBlob(url) {
  let parts = url.split(",");
  let mime = (/data:([^;]+)/.exec(parts[0]) || [])[1] || "image/jpeg";
  let bytes = atob(parts[1]);
  let array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: mime });
}

// Dialogs, menus and notices float over the workspace; the picture is of
// what is under them.
function isOverlay(node) {
  let list = node.classList;
  if (!list) return true;
  return !(
    list.contains("v-dialog__content") ||
    list.contains("v-overlay") ||
    list.contains("v-menu__content") ||
    list.contains("v-tooltip__content") ||
    list.contains("v-snack")
  );
}

/**
 * A JPEG of the app as it is on screen, or null when it couldn't be drawn in
 * time. Pictures from hosts that don't allow reading them come out grey.
 */
export async function captureScreen() {
  let node = document.querySelector("#app");
  if (!node) return null;
  let width = node.offsetWidth;
  let height = node.offsetHeight;
  let options = {
    width: width,
    height: height,
    pixelRatio: Math.min(1, SHOT_WIDTH / width),
    backgroundColor: "#ffffff",
    quality: 0.8,
    filter: isOverlay,
    // Grey, for a picture whose host won't let it be copied.
    imagePlaceholder:
      "data:image/gif;base64,R0lGODlhAQABAIAAAMzMzAAAACwAAAAAAQABAAACAkQBADs=",
  };
  let timeout = new Promise((resolve) => setTimeout(() => resolve(null), SHOT_TIMEOUT));
  let draw = toJpeg(node, options)
    .catch(() => toJpeg(node, Object.assign({ skipFonts: true }, options)))
    .then(dataUrlToBlob)
    .catch(() => null);
  return Promise.race([draw, timeout]);
}

/**
 * Posts the report to the Netlify form. Resolves on success and rejects when
 * there's no form to take it, so the caller can offer email instead.
 * `report`: { kind, message, email, context, errors, screenshot (Blob|null) }.
 */
export async function postFeedback(report) {
  if (!canPostForm()) throw new Error("No form to post to here");
  let body = new FormData();
  body.append("form-name", FORM_NAME);
  body.append("kind", report.kind || "");
  body.append("message", report.message || "");
  body.append("email", report.email || "");
  body.append("context", report.context || "");
  body.append("errors", report.errors || "");
  if (report.screenshot) body.append("screenshot", report.screenshot, "screen.jpg");
  let response = await fetch("/", { method: "POST", body: body });
  if (!response.ok) throw new Error("The form answered " + response.status);
}

/** A mailto link carrying the report, cut to what mail apps accept. */
export function feedbackMailto(report) {
  let subject = "DesignSense feedback: " + (report.kind || "note");
  let body = [
    report.message || "",
    report.email ? "Reply to: " + report.email : "",
    "",
    "---",
    report.context || "",
    report.errors ? "\nErrors:\n" + report.errors : "",
  ]
    .filter((line, i) => line !== "" || i === 2)
    .join("\n");
  if (body.length > MAIL_LIMIT) body = body.slice(0, MAIL_LIMIT) + "\n…";
  return (
    "mailto:" +
    FEEDBACK_EMAIL +
    "?subject=" +
    encodeURIComponent(subject) +
    "&body=" +
    encodeURIComponent(body)
  );
}

export { errorsAsText };
