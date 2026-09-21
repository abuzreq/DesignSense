import { pruneCart } from "./cart.js";

/*
 * Work saved per dataset: sets (their members, the filters they were saved
 * from, their names and notes), the shortlist, and notes on single options.
 * Star ratings were saved here too, until the rating became a custom
 * dimension (see ratings.js): those still here are read once and handed to
 * the dimensions store, and not written again. It lives in localStorage
 * under the dataset's key (see datasetKey in customDimensions.js) and comes
 * back when that dataset opens again. Filters are not kept; they belong to
 * one visit.
 *
 *   { version: 1, sets: [{ id, members, criteria, name, comment }],
 *     setsCounter, cart: [id], notes: { id: text } }
 */

export const SESSION_PREFIX = "designsense-session-v1:";
const SESSION_VERSION = 1;
// Saves are coalesced, so typing a note doesn't write on every keystroke.
const SAVE_DELAY = 400;
// Mutations that change what is saved.
const SAVED_MUTATIONS = [
  "addSet",
  "removeSet",
  "restoreRemovedSet",
  "setSetMetadata",
  "updateSet",
  "clearSets",
  "addToCart",
  "removeFromCart",
  "setCart",
  "setOptionNote",
  "clearOptionNotes",
];

export function emptySets() {
  return {
    setsIDs: [],
    setsMap: {},
    setsCriteriaMap: {},
    setsMetadataMap: {},
    setsCounter: 0,
  };
}

/** What to store for the store's sets, shortlist and notes. */
export function serializeSession(state) {
  return {
    version: SESSION_VERSION,
    sets: state.setsIDs.map((id) => {
      let metadata = state.setsMetadataMap[id] || {};
      return {
        id: id,
        members: (state.setsMap[id] || []).slice(),
        criteria: state.setsCriteriaMap[id] || null,
        name: metadata.name || id,
        comment: metadata.comment || "",
      };
    }),
    setsCounter: state.setsCounter,
    cart: (state.cart || []).slice(),
    notes: Object.assign({}, state.optionNotes || {}),
  };
}

/** True when a session holds nothing worth keeping. */
export function isEmptySession(session) {
  return (
    session.sets.length === 0 &&
    session.cart.length === 0 &&
    Object.keys(session.notes || {}).length === 0
  );
}

function isStoredId(id) {
  return typeof id === "string" && id !== "";
}

function isStoredSet(set) {
  return (
    !!set &&
    typeof set.id === "string" &&
    Array.isArray(set.members) &&
    (set.criteria === null || Array.isArray(set.criteria))
  );
}

/** Notes kept as { id: text }, dropping anything else. */
function parseNotes(notes) {
  let out = {};
  if (!notes || typeof notes !== "object") return out;
  Object.keys(notes).forEach((id) => {
    let text = notes[id];
    if (isStoredId(id) && typeof text === "string" && text.trim() !== "") out[id] = text;
  });
  return out;
}

/** The stored session, or null when the text is missing, malformed or from another version. */
export function parseSession(text) {
  if (typeof text !== "string" || text === "") return null;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return null;
  }
  if (!parsed || parsed.version !== SESSION_VERSION) return null;
  return {
    version: SESSION_VERSION,
    sets: Array.isArray(parsed.sets) ? parsed.sets.filter(isStoredSet) : [],
    setsCounter: typeof parsed.setsCounter === "number" ? parsed.setsCounter : 0,
    cart: Array.isArray(parsed.cart) ? parsed.cart.filter(isStoredId) : [],
    ratings:
      parsed.ratings && typeof parsed.ratings === "object" ? parsed.ratings : {},
    notes: parseNotes(parsed.notes),
  };
}

/**
 * The sets to start from. IDs that are no longer in the data are dropped, so
 * a dataset that changed still opens with what fits.
 */
export function applySession(saved, rows) {
  let sets = emptySets();
  if (!saved) return sets;
  let byId = new Map(rows.map((row) => [String(row._id), row]));
  saved.sets.forEach((set) => {
    if (Object.prototype.hasOwnProperty.call(sets.setsMap, set.id)) return;
    sets.setsIDs.push(set.id);
    sets.setsMap[set.id] = set.members.filter((id) => byId.has(String(id)));
    sets.setsCriteriaMap[set.id] = set.criteria;
    sets.setsMetadataMap[set.id] = {
      name: typeof set.name === "string" && set.name ? set.name : set.id,
      comment: typeof set.comment === "string" ? set.comment : "",
    };
  });
  sets.setsCounter = Math.max(saved.setsCounter, sets.setsIDs.length);
  return sets;
}

function browserStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch (e) {
    return null;
  }
}

// A save still waiting when the page closes is written right away.
let flushPending = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (flushPending) flushPending();
  });
}

/**
 * Opens the saved work for one dataset and returns `{ sets, notes, cart,
 * legacyRatings, attach(store), clear() }`, where `legacyRatings` are
 * { id: stars } saved before ratings moved to the dimensions store. `attach` saves after every change;
 * `clear` forgets what was saved. Without a dataset key nothing is saved.
 */
export function openSession(rows, datasetKey) {
  const storage = datasetKey ? browserStorage() : null;
  const key = datasetKey ? SESSION_PREFIX + datasetKey : null;
  let saved = null;
  if (storage) {
    try {
      saved = parseSession(storage.getItem(key));
    } catch (e) {
      saved = null;
    }
  }
  const sets = applySession(saved, rows);
  let timer = null;
  let warned = false;

  function write(store) {
    timer = null;
    flushPending = null;
    if (!storage) return;
    let session = serializeSession(store.state);
    try {
      if (isEmptySession(session)) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify(session));
    } catch (e) {
      if (warned) return;
      warned = true;
      store.commit("showNotice", {
        text:
          "Your sets, shortlist and notes couldn't be saved in this browser, so they last until the page is reloaded.",
      });
    }
  }

  // Notes on options the collection no longer has are dropped too.
  let ids = new Set(rows.map((row) => String(row._id)));
  let notes = {};
  if (saved) {
    Object.keys(saved.notes).forEach((id) => {
      if (ids.has(id)) notes[id] = saved.notes[id];
    });
  }
  // Ratings for options the collection no longer has are dropped as well.
  let legacyRatings = {};
  if (saved) {
    Object.keys(saved.ratings).forEach((id) => {
      if (ids.has(id) && saved.ratings[id] > 0) legacyRatings[id] = saved.ratings[id];
    });
  }
  return {
    sets: sets,
    notes: notes,
    legacyRatings: legacyRatings,
    // Ids the collection no longer has are dropped, as they are for sets.
    cart: pruneCart(saved ? saved.cart : [], rows),
    attach(store) {
      if (!storage) return;
      // Ratings kept here from before are in the dimensions store by now
      // (the store saves them before attaching this), so they go from here:
      // left behind, they would come back after being cleared.
      if (saved && Object.keys(saved.ratings).length > 0) write(store);
      store.subscribe((mutation) => {
        if (SAVED_MUTATIONS.indexOf(mutation.type) === -1) return;
        if (timer) clearTimeout(timer);
        flushPending = () => {
          clearTimeout(timer);
          write(store);
        };
        timer = setTimeout(() => write(store), SAVE_DELAY);
      });
    },
    clear() {
      if (timer) clearTimeout(timer);
      timer = null;
      flushPending = null;
      if (!storage) return;
      try {
        storage.removeItem(key);
      } catch (e) {
        /* nothing to remove */
      }
    },
  };
}
