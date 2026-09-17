/*
 * Ported from eval/approaches/, which is where this parser was measured.
 * See eval/README.md: this is the A1C configuration (grammar + composition,
 * no model) with the intent-ranking seam left open for the encoder.
 *
 * The one structural change: the eval looks a dataset up by name from a table
 * of headers, while the app has whatever CSV was loaded, so everything here
 * takes a `schema` built by schema.js from the live store.
 */

const EXAMPLES = {
  "filter.range": [
    "keep rows where the measure is over a number",
    "limit to entries with a measure greater than that",
    "the measure should be below this amount",
    "restrict the measure to between two amounts",
    "only where the measure equals that number",
    "the measure must be no more than this",
    "narrow to entries whose measure exceeds it",
    "filter on that measure",
    "the measure under one number or over another",
    "measure between two amounts or between two other amounts",
    "either below this value or above that one",
  ],
  "filter.topk": [
    "keep the best few by that measure",
    "narrow to the largest handful on the measure",
    "limit to the lowest few by the measure",
    "just the ones with the biggest measure",
    "keep the leading entries on that score",
  ],
  "filter.percentile": [
    "keep the top percent on that measure",
    "limit to the bottom percent by the measure",
    "only the best percent of the measure",
    "the worst percent on that score",
    "select the highest measure",
    "keep the lowest ones on that score",
    "select the best on the measure",
  ],
  "filter.categorical": [
    "limit to rows whose category is that one",
    "keep only entries of that kind",
    "drop the ones of that kind",
    "exclude that category",
    "leave out anything of that type",
  ],
  "filter.clear": [
    "remove the filter on that measure",
    "drop all of the filters",
    "take the filters off",
    "unfilter everything",
    "get rid of that one filter",
  ],
  "scope.zoom": [
    "focus on what is picked",
    "narrow the data down to the picked ones",
    "keep only the picked ones and drop everything else",
    "work within the current picks",
  ],
  "scope.exclude": [
    "throw out the picked ones",
    "remove the picked entries from the data",
    "take the picked ones away",
  ],
  "scope.out": [
    "zoom back out",
    "go back out one step",
    "undo the zoom",
    "step back out of this",
  ],
  "set.clear": [
    "delete all the sets",
    "remove every set",
    "get rid of all my sets",
    "clear the sets",
  ],
  "scope.reset": [
    "go back to the full collection",
    "start from all of the data again",
    "restore everything",
    "back to the beginning",
  ],
  "select.invert": ["flip the picks", "pick the opposite ones", "swap picked and unpicked"],
  "select.all": ["mark everything", "pick every entry", "choose them all"],
  "ask.count": [
    "how many rows are in play",
    "what is the count right now",
    "how many entries match",
    "give me the number of entries",
  ],
  "ask.stats": [
    "what is the median of that measure",
    "give me the mean of the measure",
    "how large is the measure typically",
    "what is the standard deviation of that score",
    "what values does the measure span",
    "tell me the typical measure",
    "std of that measure",
    "standard deviation of the measure",
    "median of the score",
  ],
  "ask.extreme": [
    "which row has the biggest measure",
    "what has the smallest measure",
    "which entry scores highest on the measure",
    "which one wins on that measure",
  ],
  "ask.compare_selection": [
    "how do the picked ones differ from the others",
    "what characterises this group",
    "what stands out about the picked entries",
    "what is special about them",
  ],
  "ask.correlation": [
    "which measures move together",
    "what correlates with what",
    "does one measure track the other",
    "what is the relationship between the measures",
    "what pulls against what",
  ],
  "ask.explain_exclusion": [
    "why was this one filtered out",
    "what rules this entry out",
    "why is it missing from the results",
    "what is keeping this one hidden",
  ],
  "ask.compare_sets": [
    "how do the two saved groups differ",
    "contrast one saved group with the other",
    "what separates those two groups",
  ],
  "ask.capabilities": [
    "what commands are available",
    "list the things you can do",
    "help me use this",
    "how does this tool work",
    "how do I get my spreadsheet in",
    "where do I change that setting",
  ],
  "analysis.pareto": [
    "show the non dominated entries",
    "the efficient frontier of the two measures",
    "the trade off curve between them",
    "optimise both measures together",
    "which entries are not beaten on both",
    "minimise one and maximise the other",
  ],
  "analysis.cluster": [
    "split these into groups",
    "find the natural groupings",
    "partition them into a few groups",
    "bucket them by similarity",
  ],
  "analysis.similar": [
    "what resembles this entry",
    "nearest neighbours of this one",
    "things close to this entry",
    "others in the same vein as this",
  ],
  "analysis.representatives": [
    "give me a few typical examples",
    "a sample that covers the spread",
    "some entries that stand in for the rest",
  ],
  "view.axes": [
    "plot one measure against the other",
    "set the scatter axes to those measures",
    "use that measure for the horizontal",
    "chart the measure on the vertical",
  ],
  "view.sort": [
    "order the gallery by that measure",
    "arrange them by the measure",
    "rank the entries on that score",
    "list them from high to low on the measure",
  ],
  "view.color": [
    "shade the points by the measure",
    "use that measure for colour",
    "colour code them by the measure",
    "tint by that column",
  ],
  "view.open": [
    "show the parallel coordinates panel",
    "bring up the scatter panel",
    "display the gallery panel",
    "open that panel",
  ],
  "view.close": ["hide the gallery panel", "get rid of the clusters panel", "shut that panel"],
  "mode.set": ["turn on the advanced mode", "go to the simple mode", "use the basic interface"],
  "set.create": [
    "make a new group from the picks",
    "bookmark this group",
    "store these for later",
    "remember this batch under a name",
  ],
  "set.restore": ["load that saved group", "recall the saved group", "apply the saved search again"],
  "set.update": [
    "put the picks into that saved group",
    "take the picks out of that saved group",
    "extend the saved group with these",
  ],
  "set.delete": ["get rid of that saved group", "erase the saved group", "throw the group away"],
  "history.undo": ["step back", "revert the last change", "take that back", "roll it back"],
  "history.redo": ["do that again", "step forward", "reapply what I took back"],
  "inspect.item": [
    "look at that entry",
    "open the details for that one",
    "examine the entry with the biggest measure",
    "let me see that one up close",
  ],
  "inspect.clear": ["close the details", "unpick the inspected entry", "stop looking at it"],
  "export.csv": ["download the results", "save this to a file", "dump it to a spreadsheet"],
};

/** Flattened into the {label, text} documents bm25.buildIndex expects. */
export function documents() {
  let out = [];
  Object.keys(EXAMPLES).forEach((command) => {
    EXAMPLES[command].forEach((text) => out.push({ label: command, text: text }));
  });
  return out;
}

export default EXAMPLES;
