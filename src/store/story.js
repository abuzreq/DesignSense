/*
 * Presenting what was found: the one-image summary's dialog, and the story,
 * views captured along the way with a note each, to step through in a
 * meeting or make into a PDF report. Spread into the store like goals.js.
 *
 * The story is saved per dataset in localStorage, like the saved work in
 * session.js:
 *   { version: 1, counter, captures: [{ id, title, note, snapshot, createdAt, focus? }] }
 * focus is what its summary image features (see story/focus.js).
 * A snapshot is story/snapshot.js's.
 */

import { takeSnapshot, SNAPSHOT_VERSION } from "@/story/snapshot.js";
import { summarize } from "@/story/narrate.js";
import { loadSummarySettings, saveSummarySettings } from "@/story/summarySettings.js";

export const STORY_PREFIX = "designsense-story-v1:";
const STORY_VERSION = 1;
const SAVE_DELAY = 400;
// Mutations that change what is saved.
const SAVED_MUTATIONS = ["addCapture", "updateCapture", "removeCapture", "moveCapture", "clearStory"];

function browserStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch (e) {
    return null;
  }
}

function isCapture(capture) {
  return (
    !!capture &&
    typeof capture.id === "string" &&
    !!capture.snapshot &&
    capture.snapshot.v === SNAPSHOT_VERSION
  );
}

function isFocus(focus) {
  return !!focus && typeof focus.kind === "string";
}

/** The saved story, or an empty one when the text is missing, malformed or from another version. */
export function parseStory(text) {
  let empty = { captures: [], counter: 0 };
  if (typeof text !== "string" || text === "") return empty;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return empty;
  }
  if (!parsed || parsed.version !== STORY_VERSION || !Array.isArray(parsed.captures)) return empty;
  let captures = parsed.captures.filter(isCapture).map((c) => ({
    id: c.id,
    title: typeof c.title === "string" ? c.title : "",
    note: typeof c.note === "string" ? c.note : "",
    // Frozen, so Vue doesn't walk the ids it lists.
    snapshot: Object.freeze(c.snapshot),
    createdAt: typeof c.createdAt === "number" ? c.createdAt : 0,
    focus: isFocus(c.focus) ? c.focus : null,
  }));
  return {
    captures: captures,
    counter: Math.max(typeof parsed.counter === "number" ? parsed.counter : 0, captures.length),
  };
}

/**
 * The axes the parallel coordinates panel shows, in its order, or null when
 * it isn't open. They live in the panel's chart rather than the store.
 */
function parallelAxes(state) {
  let view = Object.values(state.viewsMap || {}).find(
    (v) => v && v.$options && v.$options.name === "ParCoordsView"
  );
  if (!view || !view.chart) return null;
  try {
    let hidden = typeof view.hiddenAxes === "function" ? view.hiddenAxes() : [];
    return Object.keys(view.chart.dimensions() || {}).filter(
      (dim) => hidden.indexOf(dim) === -1 && state.numericDimensions.indexOf(dim) !== -1
    );
  } catch (e) {
    return null;
  }
}

/** A snapshot of the screen now, with the parallel coordinates' axes. */
function snapshotNow(context) {
  let snapshot = takeSnapshot(context.state, context.getters);
  snapshot.view.pcpDims = parallelAxes(context.state);
  return snapshot;
}

/** A capture's first note: what narrowed the view, and what stands out in it. */
function firstNote(snapshot, state) {
  let summary = summarize(snapshot, state.rawData, state.numericDimensions);
  return summary.sentences
    .filter((s) => s.id === "narrowing" || s.id === "front")
    .map((s) => s.text)
    .join(" ");
}

export function createStoryStore(options) {
  const storage = options && options.datasetKey ? browserStorage() : null;
  const key = storage ? STORY_PREFIX + options.datasetKey : null;
  let saved = { captures: [], counter: 0 };
  if (storage) {
    try {
      saved = parseStory(storage.getItem(key));
    } catch (e) {
      saved = { captures: [], counter: 0 };
    }
  }

  let timer = null;
  let warned = false;
  function write(store) {
    timer = null;
    if (!storage) return;
    let story = store.state.story;
    try {
      if (story.captures.length === 0) storage.removeItem(key);
      else {
        storage.setItem(
          key,
          JSON.stringify({ version: STORY_VERSION, counter: story.counter, captures: story.captures })
        );
      }
    } catch (e) {
      if (warned) return;
      warned = true;
      store.commit("showNotice", {
        text: "The story couldn't be saved in this browser, so it lasts until the page is reloaded.",
      });
    }
  }

  return {
    state: {
      // The summary dialog, and the snapshot it was opened on (see
      // story/snapshot.js), so what it shows doesn't move while it is open.
      // captureId names the capture it was opened on, which keeps its focus.
      summaryDialog: { open: false, snapshot: null, title: null, note: null, focus: null, captureId: null },
      // The set the shortlist was last saved as, this visit: with the
      // shortlist emptied, it is what a summary image features.
      lastShortlistSet: null,
      // What every summary image and report page shows (see summarySettings.js).
      summarySettings: loadSummarySettings(),
      story: saved,
      // The story's panel at the workspace's right edge.
      storyPanel: { open: false },
      // The capture on screen while presenting, or null when not presenting.
      presenting: null,
      // The dialog that makes the whole story into a PDF report.
      storyReportDialog: { open: false },
    },
    getters: {
      captureCount: (state) => state.story.captures.length,
    },
    mutations: {
      setSummaryDialog(state, payload) {
        state.summaryDialog = Object.assign({}, state.summaryDialog, payload);
      },
      /** Some of the summary settings, e.g. `{ parallel: true }`. */
      setSummarySettings(state, payload) {
        state.summarySettings = Object.assign({}, state.summarySettings, payload);
      },
      setStoryReportDialog(state, payload) {
        state.storyReportDialog = Object.assign({}, state.storyReportDialog, payload);
      },
      setStoryPanel(state, payload) {
        state.storyPanel = Object.assign({}, state.storyPanel, payload);
      },
      rememberShortlistSet(state, payload) {
        state.lastShortlistSet = payload.setID || null;
      },
      setPresenting(state, payload) {
        state.presenting = payload.index === null || payload.index === undefined ? null : payload.index;
      },
      addCapture(state, payload) {
        state.story = {
          counter: state.story.counter + 1,
          captures: state.story.captures.concat([payload.capture]),
        };
      },
      /** `{ id, title?, note?, focus? }`. */
      updateCapture(state, payload) {
        state.story = Object.assign({}, state.story, {
          captures: state.story.captures.map((c) => {
            if (c.id !== payload.id) return c;
            let next = Object.assign({}, c);
            if (typeof payload.title === "string") next.title = payload.title;
            if (typeof payload.note === "string") next.note = payload.note;
            if (payload.focus !== undefined) next.focus = payload.focus;
            return next;
          }),
        });
      },
      removeCapture(state, payload) {
        state.story = Object.assign({}, state.story, {
          captures: state.story.captures.filter((c) => c.id !== payload.id),
        });
      },
      /** `{ id, delta }`: moves a capture earlier (-1) or later (+1). */
      moveCapture(state, payload) {
        let list = state.story.captures.slice();
        let from = list.findIndex((c) => c.id === payload.id);
        let to = from + payload.delta;
        if (from < 0 || to < 0 || to >= list.length) return;
        let moved = list.splice(from, 1)[0];
        list.splice(to, 0, moved);
        state.story = Object.assign({}, state.story, { captures: list });
      },
      clearStory(state) {
        state.story = { captures: [], counter: 0 };
      },
    },
    actions: {
      /**
       * Opens the summary of `{ snapshot, title, note, focus, captureId }`,
       * or of what is on screen now. Without a focus, the screen's summary
       * features the shortlist, or when that is empty the set it was just
       * saved as, so saving it doesn't take it off the picture.
       */
      openSummary(context, payload) {
        let state = context.state;
        let snapshot =
          (payload && payload.snapshot) || snapshotNow(context);
        let focus = (payload && payload.focus) || null;
        let saved = state.lastShortlistSet;
        if (!focus && !(payload && payload.snapshot) && state.cart.length === 0 && saved && state.setsMap[saved]) {
          focus = { kind: "set", setID: saved };
        }
        context.commit("setSummaryDialog", {
          open: true,
          snapshot: snapshot,
          title: (payload && payload.title) || null,
          note: (payload && payload.note) || null,
          focus: focus,
          captureId: (payload && payload.captureId) || null,
        });
      },
      /** Changes the summary settings and keeps them for next time. */
      changeSummarySettings(context, payload) {
        context.commit("setSummarySettings", payload);
        saveSummarySettings(context.state.summarySettings);
      },
      closeSummary(context) {
        context.commit("setSummaryDialog", { open: false });
      },
      /** Adds what is on screen to the story, with a first note from the data. */
      captureView(context) {
        let state = context.state;
        let snapshot = snapshotNow(context);
        let number = state.story.counter + 1;
        let capture = {
          id: "capture-" + Date.now().toString(36) + "-" + number,
          title: "View " + number,
          note: firstNote(snapshot, state),
          snapshot: Object.freeze(snapshot),
          createdAt: snapshot.takenAt,
        };
        context.commit("addCapture", { capture: capture });
        context.commit("setStoryPanel", { open: true });
        context.commit("showNotice", {
          text: "Captured as " + capture.title + ". Add a note to say what it shows.",
        });
        return capture;
      },
      restoreCapture(context, payload) {
        let capture = context.state.story.captures.find((c) => c.id === payload.id);
        if (!capture) return;
        context.dispatch("restoreView", { snapshot: capture.snapshot });
      },
      /** Steps through the story from `{ index }`, putting each capture on screen. */
      presentStory(context, payload) {
        let captures = context.state.story.captures;
        if (captures.length === 0) return;
        let index = Math.max(0, Math.min(captures.length - 1, (payload && payload.index) || 0));
        context.commit("setPresenting", { index: index });
        context.commit("setStoryPanel", { open: false });
        context.dispatch("restoreCapture", { id: captures[index].id });
      },
      stepStory(context, payload) {
        let index = context.state.presenting;
        if (index === null) return;
        let next = index + payload.delta;
        if (next < 0 || next >= context.state.story.captures.length) return;
        context.dispatch("presentStory", { index: next });
      },
      stopPresenting(context) {
        context.commit("setPresenting", { index: null });
      },
      openStoryReport(context) {
        if (context.state.story.captures.length === 0) return;
        context.commit("setStoryReportDialog", { open: true });
      },
      closeStoryReport(context) {
        context.commit("setStoryReportDialog", { open: false });
      },
    },
    /** Saves the story after every change to it, coalesced. */
    attach(store) {
      if (!storage) return;
      store.subscribe((mutation) => {
        if (SAVED_MUTATIONS.indexOf(mutation.type) === -1) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => write(store), SAVE_DELAY);
      });
      if (typeof window !== "undefined") {
        window.addEventListener("beforeunload", () => {
          if (timer) {
            clearTimeout(timer);
            write(store);
          }
        });
      }
    },
  };
}
