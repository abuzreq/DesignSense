/*
 * Which options a summary image pictures: the shortlist, the selected options
 * or a saved set. Kept
 * as a small spec, so a captured view can remember it and a set renamed or
 * edited since is read as it is now:
 *
 *   { kind: "auto" }         the shortlist, if it has options
 *   { kind: "shortlist" }
 *   { kind: "selected" }     what the filters or the selection leave
 *   { kind: "set", setID }   a saved set
 *
 * summarize() takes the spec resolved against the store's sets.
 */

export const AUTO_FOCUS = Object.freeze({ kind: "auto" });
const SELECTED_FOCUS = Object.freeze({ kind: "selected" });

/** The spec as summarize() reads it, or the automatic one for a set that is gone. */
export function resolveFocus(spec, state) {
  if (spec && spec.kind === "selected") return SELECTED_FOCUS;
  // Anything else but a set is the shortlist, a spec from before included.
  if (!spec || spec.kind !== "set") return AUTO_FOCUS;
  let members = state.setsMap[spec.setID];
  if (!members) return AUTO_FOCUS;
  let metadata = state.setsMetadataMap[spec.setID];
  return {
    kind: "set",
    setID: spec.setID,
    ids: members.slice(),
    name: metadata && metadata.name ? metadata.name : spec.setID,
    note: metadata && metadata.comment ? metadata.comment : "",
  };
}

/**
 * The choices for a snapshot: the shortlist it holds, what was selected in
 * it (only when something narrowed the view), and each saved set.
 * `value` is a string for a select.
 */
export function focusChoices(state, snapshot) {
  let shortlisted = snapshot && snapshot.cart ? snapshot.cart.length : 0;
  let choices = [];
  if (shortlisted > 0) {
    choices.push({ value: "shortlist", text: "The shortlist (" + shortlisted + ")", spec: { kind: "shortlist" } });
  }
  let selected = snapshot && snapshot.selected ? snapshot.selected.length : 0;
  if (selected > 0) {
    choices.push({ value: "selected", text: "Selected options (" + selected + ")", spec: { kind: "selected" } });
  }
  state.setsIDs.forEach((id) => {
    let metadata = state.setsMetadataMap[id];
    let count = (state.setsMap[id] || []).length;
    choices.push({
      value: "set:" + id,
      text: (metadata && metadata.name ? metadata.name : id) + " (" + count + ")",
      spec: { kind: "set", setID: id },
    });
  });
  return choices;
}

/** The select's value for a spec, or null when there is nothing to picture. */
export function focusValue(spec, snapshot) {
  if (spec && spec.kind === "set") return "set:" + spec.setID;
  if (spec && spec.kind === "selected") return "selected";
  let shortlisted = snapshot && snapshot.cart ? snapshot.cart.length : 0;
  return shortlisted > 0 ? "shortlist" : null;
}
