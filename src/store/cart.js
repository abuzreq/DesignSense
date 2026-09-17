/*
 * The shortlist: options picked one at a time and kept aside while the user
 * keeps filtering, brushing and zooming, until they are saved as a set.
 *
 * Ids only, resolved against rawData, so narrowing the collection never drops
 * a pick. Kept free of imports so a plain Node script can test it.
 */

/** The ids of `list` plus `ids`, skipping the ones already in. */
export function addIds(list, ids) {
  let current = Array.isArray(list) ? list : [];
  let wanted = Array.isArray(ids) ? ids : [ids];
  let present = {};
  current.forEach(function(id) {
    present[id] = true;
  });
  let added = [];
  wanted.forEach(function(id) {
    let key = String(id);
    if (key === "" || present[key]) return;
    present[key] = true;
    added.push(key);
  });
  // The same array back when nothing changed, so a no-op toggle costs no render.
  return added.length === 0 ? current : current.concat(added);
}

/** The ids of `list` without `ids`. */
export function removeIds(list, ids) {
  let current = Array.isArray(list) ? list : [];
  let wanted = Array.isArray(ids) ? ids : [ids];
  let drop = {};
  wanted.forEach(function(id) {
    drop[String(id)] = true;
  });
  let next = current.filter(function(id) {
    return !drop[String(id)];
  });
  return next.length === current.length ? current : next;
}

/**
 * The saved shortlist, less the ids this dataset no longer has and without
 * repeats: a collection that changed still opens with what fits.
 */
export function pruneCart(ids, rows) {
  if (!Array.isArray(ids)) return [];
  let known = {};
  (rows || []).forEach(function(row) {
    known[String(row._id)] = true;
  });
  let seen = {};
  let next = [];
  ids.forEach(function(id) {
    let key = String(id);
    if (!known[key] || seen[key]) return;
    seen[key] = true;
    next.push(key);
  });
  return next;
}

/**
 * A set's id is its name, so saving under a name already taken would overwrite
 * that set: the second "Finalists" becomes "Finalists (2)". A blank name is
 * left blank, for the store to number.
 */
export function uniqueSetName(taken, wanted) {
  let name = typeof wanted === "string" ? wanted.trim() : "";
  if (name === "") return "";
  let used = {};
  (taken || []).forEach(function(id) {
    used[id] = true;
  });
  if (!used[name]) return name;
  let n = 2;
  while (used[name + " (" + n + ")"]) n += 1;
  return name + " (" + n + ")";
}
