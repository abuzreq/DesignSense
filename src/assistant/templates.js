/**
 * The pre-designed instructions the bar guides a person towards.
 *
 * Each template is one surface phrasing of one command, with typed slots.
 * The text is what gets inserted into the input as slots are filled, and it
 * is written so that the free-text parser reads it back as the same command:
 * eval/guided.mjs renders every template with sample values and checks that
 * round trip, so a template the parser cannot read fails a test rather than
 * failing a user.
 *
 * Slot syntax: {name} or {name:kind}. Slots:
 *   dim, dim:numeric, dim:categorical   a column of the loaded table
 *   op        a comparator word the parser knows (under, over, at least, ...)
 *   value     a number; hints come from the column's range in the data
 *   value2    the upper end of a between
 *   values    one or more category values of the chosen categorical column
 *   k, n      a small count       percent   a percentage
 *   order     descending / ascending        stat      average, median, ...
 *   panel     a view name          set       a saved set      mode   lite / expert
 *   name      free text (a set name)        ordinal   first, second, ...
 */

export const TEMPLATES = [
  // --- narrowing -------------------------------------------------------------
  { command: "filter.range", text: "filter {dim:numeric} {op} {value}", keywords: ["filter", "only", "limit", "keep", "narrow", "restrict"], also: ["only the ones under a number", "keep everything above a value", "narrow to a range on one measure", "limit it to less than"] },
  { command: "filter.range", text: "filter {dim:numeric} between {value} and {value2}", keywords: ["between"] },
  { command: "filter.range", text: "exclude {dim:numeric} {op} {value}", keywords: ["exclude", "get rid of", "drop", "remove", "without"], also: ["get rid of the expensive ones", "drop everything above a number", "remove the ones over a value", "throw out the pricey ones", "take out anything below"] },
  { command: "filter.range", text: "filter {dim:numeric} {op} {value} or {op2} {value2}", keywords: ["or", "either"], also: ["under one number or over another", "either below this or above that", "the cheap ones or the very expensive ones"] },
  { command: "filter.range", text: "filter {dim:numeric} between {value} and {value2} or between {value3} and {value4}", keywords: ["or"], also: ["in one range or in another range", "two separate ranges on a measure"] },
  { command: "filter.topk", text: "keep the top {k} by {dim:numeric}", keywords: ["top", "best", "highest"], also: ["the ten best", "just the biggest few", "show me the top ten"] },
  { command: "filter.topk", text: "keep the bottom {k} by {dim:numeric}", keywords: ["bottom", "lowest", "cheapest"], also: ["the ten cheapest", "the smallest few", "the lowest ten on a measure"] },
  { command: "filter.percentile", text: "keep the top {percent}% by {dim:numeric}", keywords: ["percent", "percentile"] },
  { command: "filter.percentile", text: "keep the bottom {percent}% by {dim:numeric}", keywords: [] },
  { command: "filter.percentile", text: "select the highest {dim:numeric}", keywords: ["select", "highest", "best"], also: ["select the most expensive ones", "keep the biggest", "pick the top ones on a measure"] },
  { command: "filter.percentile", text: "select the lowest {dim:numeric}", keywords: ["select", "lowest", "cheapest"], also: ["select the cheapest ones", "keep the smallest", "pick the bottom ones on a measure"] },
  { command: "filter.categorical", text: "only {dim:categorical} is {values}", keywords: ["only", "category", "is"], also: ["only toyotas", "just the automatic ones", "keep the ones that are a certain kind"] },
  { command: "filter.categorical", text: "exclude {dim:categorical} {values}", keywords: ["exclude", "without", "except"], also: ["no diesels", "anything but the manual ones", "get rid of one category"] },
  { command: "filter.clear", text: "clear the filters", keywords: ["clear", "remove", "reset", "unfilter"], also: ["start again", "remove all the filters", "show everything again", "take the filters off"] },
  { command: "filter.clear", text: "clear the filter on {dim}", keywords: ["clear"] },
  { command: "scope.zoom", text: "zoom in on the results", keywords: ["zoom", "focus"], also: ["focus on what I have selected", "hide everything else", "just show the selection"] },
  { command: "scope.exclude", text: "exclude the selection", keywords: ["exclude", "drop"] },
  { command: "scope.out", text: "zoom out", keywords: ["zoom out", "back out", "unzoom"], also: ["go back out one step", "undo the zoom"] },
  { command: "scope.reset", text: "reset to the full collection", keywords: ["reset", "start over", "everything"] },
  { command: "select.invert", text: "invert the selection", keywords: ["invert", "flip"] },
  { command: "select.all", text: "select all", keywords: ["select", "all"] },

  // --- asking ----------------------------------------------------------------
  { command: "ask.count", text: "how many match", keywords: ["how many", "count"], also: ["how many are left", "count the results", "how many are there"] },
  { command: "ask.stats", text: "what is the {stat} of {dim:numeric}", keywords: ["what is", "average", "mean", "median", "std", "statistic"], also: ["on average how much", "typical value of a measure", "what is the spread of", "std of a measure", "standard deviation of the score"] },
  { command: "ask.count", text: "how many have {dim:numeric} {op} {value}", keywords: ["how many"], also: ["how many are over a value", "count the ones under a number"] },
  { command: "ask.extreme", text: "which one has the highest {dim:numeric}", keywords: ["which", "highest", "most"], also: ["what is the most expensive one", "which is the biggest", "the one with the most"] },
  { command: "ask.extreme", text: "which one has the lowest {dim:numeric}", keywords: ["which", "lowest", "least"], also: ["what is the cheapest one", "which is the smallest", "the one with the least"] },
  { command: "ask.correlation", text: "what trades off against what", keywords: ["trade off", "correlation", "related"] },
  { command: "ask.correlation", text: "how does {dim:numeric} relate to {dim2:numeric}", keywords: ["relate", "related", "correlation"] },
  { command: "ask.compare_selection", text: "what do these have in common", keywords: ["common", "stands out", "characterise"] },
  { command: "ask.explain_exclusion", text: "why is this one not showing up", keywords: ["why", "missing", "excluded"] },
  { command: "ask.capabilities", text: "what can you do", keywords: ["help", "what can you do", "commands"] },

  // --- analysis --------------------------------------------------------------
  { command: "analysis.pareto", text: "pareto front of {dim:numeric} vs {dim2:numeric}", keywords: ["pareto", "frontier", "trade offs", "best trade"], also: ["select the best trade off between two measures", "the best compromise between two things", "the options that are not beaten on both", "show the pareto frontier", "non dominated options"] },
  { command: "analysis.cluster", text: "cluster into {k} groups", keywords: ["cluster", "group", "partition"] },
  { command: "analysis.similar", text: "similar to this one", keywords: ["similar", "like this", "nearest"] },
  { command: "analysis.representatives", text: "show {n} representative examples", keywords: ["representative", "typical", "examples"] },

  // --- the workspace ---------------------------------------------------------
  { command: "view.sort", text: "sort by {dim} {order}", keywords: ["sort", "order", "arrange", "rank"], also: ["order them by a measure", "arrange from high to low", "rank them"] },
  { command: "view.color", text: "colour by {dim}", keywords: ["colour", "color", "shade", "tint"], also: ["shade the points by a measure", "color code them", "paint by a column"] },
  { command: "view.axes", text: "x axis {dim:numeric}", keywords: ["x axis", "axis", "horizontal"] },
  { command: "view.axes", text: "y axis {dim:numeric}", keywords: ["y axis", "axis", "vertical"] },
  { command: "view.open", text: "open the {panel}", keywords: ["open", "show", "bring up"] },
  { command: "view.close", text: "close the {panel}", keywords: ["close", "hide"] },
  { command: "mode.set", text: "switch to {mode} mode", keywords: ["switch", "mode", "expert", "lite"] },

  // --- sets and session ------------------------------------------------------
  { command: "set.create", text: "save the results", keywords: ["save", "bookmark", "set"], also: ["bookmark these", "keep this selection for later", "remember these"] },
  { command: "set.create", text: "save the results as {name}", keywords: ["save as"] },
  { command: "set.restore", text: "restore {set}", keywords: ["restore", "bring back", "load", "recall"] },
  { command: "set.update", text: "add these to {set}", keywords: ["add to"] },
  { command: "set.update", text: "remove these from {set}", keywords: ["remove from"] },
  { command: "set.delete", text: "delete {set}", keywords: ["delete", "erase"] },
  { command: "set.clear", text: "delete all sets", keywords: ["delete all", "clear sets"], also: ["remove every set", "get rid of all the sets", "clear the sets"] },
  { command: "ask.compare_sets", text: "compare {set} with {set2}", keywords: ["compare", "versus", "difference"], also: ["how do two sets differ", "what is different between my sets"] },
  { command: "ask.compare_sets", text: "compare {set} with the rest", keywords: ["compare"], also: ["what makes this set different from everything else"] },
  { command: "history.undo", text: "undo", keywords: ["undo", "go back", "revert"] },
  { command: "history.redo", text: "redo", keywords: ["redo"] },
  { command: "inspect.item", text: "inspect the {ordinal} one", keywords: ["inspect", "look at", "details"] },
  { command: "inspect.item", text: "show me the one with the highest {dim:numeric}", keywords: ["show me", "inspect"] },
  { command: "inspect.item", text: "show me the one with the lowest {dim:numeric}", keywords: ["show me", "inspect"] },
  { command: "inspect.clear", text: "stop inspecting", keywords: ["stop", "close the details"] },
  { command: "export.csv", text: "download the results", keywords: ["download", "export", "csv"] },
];

/** Fixed candidate lists. Column, value and set slots are filled from the data. */
export const SLOT_OPTIONS = {
  op: ["under", "over", "at least", "at most", "equal to"],
  k: ["5", "10", "20", "50"],
  n: ["3", "5", "10"],
  percent: ["10", "25", "50"],
  order: ["descending", "ascending"],
  stat: ["average", "median", "minimum", "maximum", "range", "standard deviation"],
  panel: ["scatter", "parallel", "gallery", "sets", "clusters"],
  mode: ["expert", "lite"],
  ordinal: ["first", "second", "third", "fourth", "fifth", "last"],
};

const SLOT_RE = /\{([a-z0-9]+)(?::([a-z]+))?\}/g;

/** The template as a list of parts: `{ literal }` or `{ slot, kind, name }`. */
export function parts(template) {
  let out = [];
  let last = 0;
  let match;
  SLOT_RE.lastIndex = 0;
  while ((match = SLOT_RE.exec(template.text)) !== null) {
    if (match.index > last) out.push({ literal: template.text.slice(last, match.index) });
    let name = match[1];
    let kind = match[2] || null;
    let slot = name.replace(/\d+$/, "");
    out.push({ slot: slot, kind: kind, name: name });
    last = match.index + match[0].length;
  }
  if (last < template.text.length) out.push({ literal: template.text.slice(last) });
  return out;
}

export function slots(template) {
  return parts(template).filter((p) => p.slot);
}

/** The literal head before the first slot: what prefix prediction completes to. */
export function head(template) {
  let first = parts(template)[0];
  return first && first.literal ? first.literal.trim() : "";
}

/**
 * The text with the first `filled.length` slots substituted and the rest
 * dropped. A literal that only introduces the next slot ("... by ") stays, so
 * the candidates read as continuing the sentence.
 */
export function render(template, filled) {
  let out = "";
  let i = 0;
  for (let part of parts(template)) {
    if (part.literal) {
      out += part.literal;
      continue;
    }
    if (i >= filled.length) break;
    out += filled[i++];
  }
  return out.replace(/\s+$/, "") + (i < slots(template).length ? " " : "");
}

/** What an open slot is called where the interface shows it. */
export const SLOT_WORDS = {
  dim: "column", op: "comparison", value: "number", values: "value", k: "how many",
  n: "how many", percent: "percent", order: "order", stat: "statistic", panel: "view",
  set: "set", mode: "mode", name: "name", ordinal: "which",
};

/**
 * The preview as parts, `{ text, open }`, so that the bar can show an open
 * slot as a blank to fill rather than as template syntax: "filter price
 * between 10000 and {value}" read like a bug.
 */
export function previewParts(template, filled) {
  let i = 0;
  return parts(template).map((part) => {
    if (part.literal) return { text: part.literal };
    if (i < filled.length) return { text: filled[i++] };
    i++;
    return { text: SLOT_WORDS[part.slot] || part.slot, open: true };
  });
}

/** The preview as one line of text, open slots as ‹the word for them›. */
export function preview(template, filled) {
  return previewParts(template, filled)
    .map((part) => (part.open ? "‹" + part.text + "›" : part.text))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every distinct head word and keyword, for the prefix trie. */
export function vocabulary() {
  let words = new Set();
  TEMPLATES.forEach((t) => {
    let h = head(t);
    if (h) words.add(h.split(" ")[0]);
    (t.keywords || []).forEach((k) => words.add(k.split(" ")[0]));
  });
  return Array.from(words);
}
