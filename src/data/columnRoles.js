/*
 * Roles a user gave a dataset's columns after loading it, where the file's
 * own prefixes (see columns.js) were missing or wrong: "in", "out", or "none"
 * for a number that is neither. Kept per dataset in localStorage, and handed
 * to columns.js before the dataset's store is built, so every view reads the
 * same roles.
 *
 *   { version: 1, roles: { column: "in" | "out" | "none" }, reviewed: true,
 *     nameColumn: "Description" }
 *
 * `reviewed` records that the user has seen the columns dialog for this
 * dataset, so it doesn't open again by itself. `nameColumn` is the column
 * whose values name the options, "" for none, and absent to let the file
 * decide; it needs no version bump, since only `roles` is validated, so an
 * older build reading a newer save simply ignores it.
 */

export const ROLES_PREFIX = "designsense-columns-v1:";
const ROLES_VERSION = 1;
export const ROLE_VALUES = ["in", "out", "none"];

function browserStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch (e) {
    return null;
  }
}

/** `{ roles, reviewed, nameColumn }` from stored text; empty when malformed. */
export function parseColumnRoles(text) {
  let empty = { roles: {}, reviewed: false, nameColumn: null };
  if (typeof text !== "string" || text === "") return empty;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return empty;
  }
  if (!parsed || parsed.version !== ROLES_VERSION) return empty;
  let roles = {};
  Object.keys(parsed.roles || {}).forEach((column) => {
    if (ROLE_VALUES.indexOf(parsed.roles[column]) !== -1) roles[column] = parsed.roles[column];
  });
  return {
    roles: roles,
    reviewed: parsed.reviewed === true,
    nameColumn:
      typeof parsed.nameColumn === "string" ? parsed.nameColumn : null,
  };
}

/** What was saved for the dataset with `key`. */
export function loadColumnRoles(key) {
  let storage = key ? browserStorage() : null;
  if (!storage) return { roles: {}, reviewed: false, nameColumn: null };
  try {
    return parseColumnRoles(storage.getItem(ROLES_PREFIX + key));
  } catch (e) {
    return { roles: {}, reviewed: false, nameColumn: null };
  }
}

/** Saves `{ roles, reviewed }` for the dataset with `key`. */
export function saveColumnRoles(key, value) {
  let storage = key ? browserStorage() : null;
  if (!storage) return;
  let roles = value.roles || {};
  let named = typeof value.nameColumn === "string";
  try {
    if (Object.keys(roles).length === 0 && !value.reviewed && !named) {
      storage.removeItem(ROLES_PREFIX + key);
    } else {
      let saved = {
        version: ROLES_VERSION,
        roles: roles,
        reviewed: !!value.reviewed,
      };
      if (named) saved.nameColumn = value.nameColumn;
      storage.setItem(ROLES_PREFIX + key, JSON.stringify(saved));
    }
  } catch (e) {
    /* They last until the page is reloaded. */
  }
}
