/*
 * Errors the app didn't handle: from Vue's rendering and watchers, from any
 * script, and from promises nobody caught. Each is still written to the
 * console as before; the latest few are kept, so a feedback report can carry
 * them, and `errorState.latest` lets the workspace offer to report one.
 */

import Vue from "vue";

// How many are kept for a report.
const KEPT = 10;
// Stack lines kept per error: where it happened, not the whole framework.
const STACK_LINES = 8;
// The same message again within this long is counted, not offered again.
const REPEAT_WINDOW = 30000;

export const errorState = Vue.observable({
  // [{ message, stack, where, time, count }], newest last.
  recent: [],
  // The newest worth telling the user about, or null once they have seen it.
  latest: null,
});

/**
 * Noise a browser raises that says nothing about the app: a ResizeObserver
 * that took two frames to settle, a script from another site (its details are
 * hidden, so "Script error."), or a browser extension's own code.
 */
function isNoise(message, stack) {
  let text = String(message || "");
  if (/ResizeObserver loop/i.test(text)) return true;
  if (text === "Script error." || text === "Script error") return true;
  if (/(chrome|moz|safari(-web)?)-extension:\/\//.test(String(stack || ""))) return true;
  return false;
}

function trimStack(stack) {
  if (!stack) return "";
  return String(stack).split("\n").slice(0, STACK_LINES).join("\n");
}

/** Keeps one error. `where` says how it arrived: "vue", "script" or "promise". */
export function recordError(error, where, detail) {
  let message =
    (error && (error.message || (typeof error === "string" ? error : ""))) ||
    String(error);
  let stack = error && error.stack;
  if (isNoise(message, stack)) return;
  let now = Date.now();
  let last = errorState.recent[errorState.recent.length - 1];
  if (last && last.message === message && now - last.time < REPEAT_WINDOW) {
    last.count += 1;
    last.time = now;
    return;
  }
  let entry = {
    message: message,
    stack: trimStack(stack),
    where: where + (detail ? " (" + detail + ")" : ""),
    time: now,
    count: 1,
  };
  errorState.recent = errorState.recent.concat([entry]).slice(-KEPT);
  errorState.latest = entry;
}

/** The kept errors as plain text, for a report. */
export function errorsAsText() {
  return errorState.recent
    .map((e) => {
      let when = new Date(e.time).toISOString();
      let times = e.count > 1 ? " ×" + e.count : "";
      return "[" + when + "] " + e.where + times + ": " + e.message + (e.stack ? "\n" + e.stack : "");
    })
    .join("\n\n");
}

let installed = false;

/** Listens for unhandled errors, once. */
export function installErrorCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  // Setting a handler stops Vue writing to the console itself, so it is
  // written here as before.
  Vue.config.errorHandler = (error, vm, info) => {
    console.error(error);
    recordError(error, "vue", info);
  };
  window.addEventListener("error", (event) => {
    // A resource that failed to load (an image, say) arrives here too, with
    // no error: the views show those themselves.
    if (!event.error && !event.message) return;
    recordError(event.error || event.message, "script");
  });
  window.addEventListener("unhandledrejection", (event) => {
    recordError(event.reason, "promise");
  });
}
