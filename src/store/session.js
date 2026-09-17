import { RATING_DIMENSION } from "@/ratings.js";
import { pruneCart } from "./cart.js";

/*
 * Work saved per dataset: sets (their members, the filters they were saved
 * from, their names and notes), the shortlist, and star ratings. It lives in localStorage
 * under the dataset's key (see datasetKey in customDimensions.js) and comes
 * back when that dataset opens again. Filters are not kept; they belong to
 * one visit.
 *
 *   { version: 1, sets: [{ id, members, criteria, name, comment }],
 *     setsCounter, cart: [id], ratings: { id: stars } }
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
  "rateAlt",
  "clearSets",
  "addToCart",
  "removeFromCart",
  "setCart",
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

/** What to store for the store's sets and the rows' ratings. */
export function serializeSession(state, rows) {
  let ratings = {};
  rows.forEach((row) => {
    if (row[RATING_DIMENSION] > 0) ratings[row._id] = row[RATING_DIMENSION];
  });
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
    ratings: ratings,
  };
}

/** True when a session holds nothing worth keeping. */
export function isEmptySession(session) {
  return (
    session.sets.length === 0 &&
    session.cart.length === 0 &&
    Object.keys(session.ratings).length === 0
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
  };
}

/**
 * Puts saved ratings on `rows` and returns the sets to start from. IDs that
 * are no longer in the data are dropped, so a dataset that changed still
 * opens with what fits.
 */
export function applySession(saved, rows) {
  let sets = emptySets();
  if (!saved) return sets;
  let byId = new Map(rows.map((row) => [String(row._id), row]));
  Object.keys(saved.ratings).forEach((id) => {
    let row = byId.get(id);
    let stars = saved.ratings[id];
    if (row && typeof stars === "number" && stars > 0) {
      row[RATING_DIMENSION] = stars;
    }
  });
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
 * Opens the saved work for one dataset: puts its ratings on `rows` and returns
 * `{ sets, cart, attach(store), clear() }`. `attach` saves after every change;
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
    let session = serializeSession(store.state, store.state.rawData);
    try {
      if (isEmptySession(session)) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify(session));
    } catch (e) {
      if (warned) return;
      warned = true;
      store.commit("showNotice", {
        text:
          "Your sets and ratings couldn't be saved in this browser, so they last until the page is reloaded.",
      });
    }
  }

  return {
    sets: sets,
    // Ids the collection no longer has are dropped, as they are for sets.
    cart: pruneCart(saved ? saved.cart : [], rows),
    attach(store) {
      if (!storage) return;
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
