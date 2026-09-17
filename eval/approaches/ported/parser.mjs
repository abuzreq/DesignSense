/* GENERATED from src/assistant/parser.js by the eval harness. Do not edit. */
/*
 * Ported from eval/approaches/, which is where this parser was measured.
 * See eval/README.md: this is the A1C configuration (grammar + composition,
 * no model) with the intent-ranking seam left open for the encoder.
 *
 * The one structural change: the eval looks a dataset up by name from a table
 * of headers, while the app has whatever CSV was loaded, so everything here
 * takes a `schema` built by schema.js from the live store.
 */

import { parseCompound } from "./composition.mjs";
import * as bm25 from "./bm25.mjs";
import { documents } from "./examples.mjs";
import {
  findComparator,
  findDirection,
  normalizeText,
  parseNumbers,
  resolveColumn,
  tokens,
} from "./lexicon.mjs";

const INDEX = bm25.buildIndex(documents());

/** The live schema for the request being parsed; set at the top of parse(). */
let SCHEMA = null;

function columnsFor() {
  return SCHEMA.index;
}

/* ------------------------------------------------------------- utilities -- */

const ORDINALS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, last: -1 };
export const STATS = [
  ["average", "mean"], ["mean", "mean"], ["median", "median"],
  ["standard deviation", "std"], ["spread", "std"],
  ["maximum", "max"], ["minimum", "min"], ["range", "range"],
  ["highest", "max"], ["lowest", "min"], ["max ", "max"], ["min ", "min"],
  ["std", "std"], ["stdev", "std"], ["variance", "std"],
];
export const PANELS = [
  ["splom", "SPLOM"], ["matrix", "SPLOM"],
  ["parallel", "ParallelCoordinatesPlot"], ["pcp", "ParallelCoordinatesPlot"],
  ["scatter", "ScatterPlot"], ["gallery", "Grid"], ["grid", "Grid"], ["sets", "Sets"],
  ["clusters", "Clusters"],
];
/** Columns that a person wants less of, when no direction is stated. */
const LOWER_IS_BETTER = /cost|price|cooling|heating|deviation|energy|odometer|emission/;

function asset(result) {
  return result && result.column ? result : null;
}

/**
 * The parts an approach can swap. Set at the top of parse(); safe because the
 * harness scores one approach at a time, on one thread.
 */
let ACTIVE = { rank: null, embedColumns: null };

/** Resolves one column, or reports the family a phrase could not choose within. */
function oneColumn(text, exclude) {
  let hit = resolveColumn(columnsFor(), tokens(text), { exclude: exclude || [] });
  // Lexical matching found nothing at all. An encoder may still know that
  // "how big" is about volume -- this is the case that has to carry a model's
  // weight, since the alias table cannot exist for a user's own CSV.
  // The user already answered this question by clicking a candidate.
  if (hit.ambiguous && hit.ambiguous.length > 1 && SCHEMA.prefer) {
    if (hit.ambiguous.indexOf(SCHEMA.prefer) >= 0) {
      return { column: SCHEMA.prefer, score: hit.score, ambiguous: [] };
    }
  }
  if (!hit.column && ACTIVE.embedColumns) {
    let guess = ACTIVE.embedColumns(SCHEMA, text, exclude || []);
    if (guess) return { column: guess, score: 60, ambiguous: [] };
  }
  return hit;
}

/** As many distinct columns as the utterance names, best first. */
function manyColumns(text, limit) {
  let found = [];
  let exclude = [];
  for (let i = 0; i < (limit || 3); i++) {
    let hit = oneColumn(text, exclude);
    if (!hit.column || hit.score < 100) break;
    found.push(hit.column);
    exclude.push(hit.column);
  }
  return found;
}

function clarifyFor(hit) {
  return { command: "clarify", args: { slot: "dim", candidates: hit.ambiguous.slice() } };
}

// Values that are ordinary English first and categories second. Matching
// these on sight turns "what is a good deal" into a filter.
const WEAK_VALUES = ["good", "new", "other", "fair", "clean", "custom", "like new", "missing"];

function categoricalValues(text) {
  let table = SCHEMA.values;
  let words = tokens(text);
  for (let dim of Object.keys(table)) {
    let hits = table[dim].filter(
      (v) => !WEAK_VALUES.includes(v) && (words.includes(v) || words.includes(v + "s"))
    );
    if (hits.length > 0) return { dim: dim, values: hits };
  }
  return null;
}

const NEGATIONS = ["not ", "anything but", "get rid of", "exclude", "drop the", "without", "except", "no "];

function isNegated(text) {
  return NEGATIONS.some((n) => text.includes(n));
}

/* ---------------------------------------------------------------- shapes -- */

/** Each returns a command, a clarify, or null when its shape does not apply. */
const SHAPES = [
  // --- history, scope and other verbs with no arguments ----------------------
  function verbs(text) {
    if (/^(undo|go back|take that back|revert)\b/.test(text)) return { command: "history.undo", args: {} };
    if (/^redo\b|do it again/.test(text)) return { command: "history.redo", args: {} };
    if (/^(reset|start over|start from the full)/.test(text) || /start from the full set/.test(text)) {
      return { command: "scope.reset", args: {} };
    }
    if (/^select all|^mark everything/.test(text)) return { command: "select.all", args: {} };
    if (/\binvert\b|flip the selection|flip the picks/.test(text)) return { command: "select.invert", args: {} };
    if (/export|csv|download the results/.test(text)) return { command: "export.csv", args: {} };
    if (/stop inspecting|close the details/.test(text)) return { command: "inspect.clear", args: {} };
    return null;
  },

  // --- zoom and exclude, before the categorical filter can claim "get rid of"
  function scope(text) {
    // One step back out of a zoom or exclude, as against resetting everything.
    if (/\bzoom (back )?out\b|\bback out\b|\bundo the zoom\b|\bstep back out\b|\bunzoom\b/.test(text)) {
      return { command: "scope.out", args: {} };
    }
    if (/hide the rest|zoom in|zoom into|get rid of everything i have not|everything i have not selected/.test(text)) {
      return { command: "scope.zoom", args: {} };
    }
    if (/^zoom\b/.test(text)) return { command: "scope.zoom", args: {} };
    if (/drop these|exclude the selection|remove these from the results|drop these from the results/.test(text)) {
      return { command: "scope.exclude", args: {} };
    }
    return null;
  },

  // --- saved sets, before numbers can read "Set #2" as a quantity ------------
  function sets(text, ctx, raw) {
    let named = raw.match(/\bas\s+([A-Za-z0-9][\w #]*?)\s*$/);
    if (/\bsave\b|\bbookmark\b/.test(text)) {
      return named
        ? { command: "set.create", args: { name: named[1].trim() } }
        : { command: "set.create", args: {} };
    }
    if (/\b(delete|remove|erase|clear|drop)\b/.test(text) && /\b(all|every)( the| of the| my)? sets?\b/.test(text)) {
      return { command: "set.clear", args: {} };
    }
    // A set the user named themselves ("Cluster 1", "Shortlist") is only
    // known from the table, so the live set list is consulted first.
    let known = (SCHEMA.sets || [])
      .slice()
      .sort((a, b) => b.length - a.length)
      .find((s) => normalizeText(s) && (" " + text + " ").includes(" " + normalizeText(s) + " "));
    let ref = known ? null : raw.match(/\b(?:set\s*#?\s*\d+|Shortlist|Candidates|Best)\b/i);
    if (!known && !ref) return null;
    let name = known ? known : /^set/i.test(ref[0]) ? "Set #" + ref[0].replace(/\D/g, "") : ref[0];
    if (/\bdelete\b|\berase\b/.test(text)) return { command: "set.delete", args: { set: name } };
    if (/\badd\b|\bput\b/.test(text)) return { command: "set.update", args: { set: name, operation: "add" } };
    if (/\bremove\b|\btake\b/.test(text)) return { command: "set.update", args: { set: name, operation: "subtract" } };
    if (/\bcompare\b|\bversus\b|\bvs\b/.test(text)) return null; // ask.compare_sets handles it
    if (/\bbring back\b|\brestore\b|\bload\b|\brecall\b/.test(text)) {
      return { command: "set.restore", args: { set: name } };
    }
    return null;
  },

  function compareSets(text, ctx, raw) {
    if (!/\bcompare\b|\bdifferent from\b|\bcontrast\b|\bversus\b|\bvs\b/.test(text)) return null;
    // Sets the user named themselves come from the live list, in the order
    // they are mentioned; "the rest" stands for everything outside the first.
    let padded = " " + text + " ";
    let known = (SCHEMA.sets || [])
      .map((s) => ({ name: s, at: padded.indexOf(" " + normalizeText(s) + " ") }))
      .filter((s) => normalizeText(s.name) && s.at >= 0)
      .sort((a, b) => a.at - b.at)
      .map((s) => s.name);
    if (known.length >= 2) return { command: "ask.compare_sets", args: { a: known[0], b: known[1] } };
    if (known.length === 1 && /\bthe rest\b|\bthe others\b|\beverything else\b/.test(text)) {
      return { command: "ask.compare_sets", args: { a: known[0], b: "rest" } };
    }
    let refs = raw.match(/\bset\s*#?\s*\d+/gi) || [];
    if (refs.length >= 2) {
      return {
        command: "ask.compare_sets",
        args: { a: "Set #" + refs[0].replace(/\D/g, ""), b: "Set #" + refs[1].replace(/\D/g, "") },
      };
    }
    if (refs.length === 1 && /\bthe rest\b|\bthe others\b|\beverything else\b/.test(text)) {
      return { command: "ask.compare_sets", args: { a: "Set #" + refs[0].replace(/\D/g, ""), b: "rest" } };
    }
    let named = raw.match(/\b(Shortlist|Candidates|Best)\b/i);
    if (named && /\bthe rest\b/.test(text)) {
      return { command: "ask.compare_sets", args: { a: named[1], b: "rest" } };
    }
    if (/\bmy shortlist\b/.test(text) && /\bthe rest\b/.test(text)) {
      return { command: "ask.compare_sets", args: { a: "Shortlist", b: "rest" } };
    }
    return null;
  },

  // --- the workspace --------------------------------------------------------
  function panels(text) {
    let panel = PANELS.find((p) => text.includes(p[0]));
    if (!panel) return null;
    if (/\bclose\b|\bhide\b/.test(text)) return { command: "view.close", args: { view: panel[1] } };
    if (/\bopen\b|\bshow the\b|\bbring up\b/.test(text)) return { command: "view.open", args: { view: panel[1] } };
    return null;
  },

  function mode(text) {
    if (!/\bmode\b|switch to/.test(text)) return null;
    if (/expert|advanced/.test(text)) return { command: "mode.set", args: { mode: "expert" } };
    if (/lite|simple|basic/.test(text)) return { command: "mode.set", args: { mode: "lite" } };
    return null;
  },

  function axes(text, ctx) {
    let wantsX = /\bx axis\b|\bon x\b|horizontal/.test(text);
    let wantsY = /\by axis\b|\bon y\b|vertical/.test(text);
    if (!wantsX && !wantsY) return null;
    let hit = oneColumn(text);
    if (!asset(hit)) return null;
    if (hit.ambiguous.length > 1) return clarifyFor(hit);
    return { command: "view.axes", args: wantsX ? { x: hit.column } : { y: hit.column } };
  },

  function sort(text, ctx) {
    if (!/\bsort\b|\border the\b|\barrange\b|\brank\b/.test(text)) return null;
    let hit = oneColumn(text);
    if (!asset(hit)) return null;
    if (hit.ambiguous.length > 1) return clarifyFor(hit);
    let args = { dim: hit.column };
    if (/descending|high to low|widest first|largest first/.test(text)) args.desc = true;
    else if (/ascending|low to high/.test(text)) args.desc = false;
    return { command: "view.sort", args: args };
  },

  function color(text, ctx) {
    if (!/\bcolor\b|\bcolour\b|\bshade\b|\btint\b/.test(text)) return null;
    let hit = oneColumn(text);
    if (!asset(hit)) return null;
    if (hit.ambiguous.length > 1) return clarifyFor(hit);
    return { command: "view.color", args: { dim: hit.column } };
  },

  // --- analysis -------------------------------------------------------------
  function pareto(text, ctx) {
    if (!/pareto|frontier|trade ?off|non dominated|minimi[sz]e|maximi[sz]e/.test(text)) return null;
    let dims = manyColumns(text, 2);
    if (dims.length < 2) return null;
    let explicitMin = /minimi[sz]e|minimi[sz]ed/.test(text);
    let explicitMax = /maximi[sz]e|maximi[sz]ed/.test(text);
    let directions = dims.map((d) => (LOWER_IS_BETTER.test(d.toLowerCase()) ? "min" : "max"));
    if (explicitMin && explicitMax) {
      // "X minimized and Y maximized" pairs by position in the sentence.
      let at = (needle) => text.indexOf(needle);
      directions = dims.map((d) => {
        let where = text.indexOf(tokens(d)[tokens(d).length - 1]);
        return Math.abs(where - at("minimi")) < Math.abs(where - at("maximi")) ? "min" : "max";
      });
    } else if (explicitMin) directions = dims.map(() => "min");
    else if (explicitMax) directions = dims.map(() => "max");
    return { command: "analysis.pareto", args: { dims: dims, directions: directions } };
  },

  function cluster(text) {
    if (!/\bcluster\b|\bgroup(s| them| these)?\b|partition/.test(text)) return null;
    if (/\bzone\b/.test(text)) return null; // "green zone number of blocks"
    let nums = parseNumbers(text).filter((n) => !n.percent);
    let args = {};
    if (nums.length > 0) args.k = nums[0].value;
    return { command: "analysis.cluster", args: args };
  },

  function similar(text) {
    if (/similar to|resembles|like this one|nearest neighbou?r/.test(text)) {
      return { command: "analysis.similar", args: { item: { by: "inspected" } } };
    }
    return null;
  },

  function representatives(text) {
    if (!/representative|typical examples|stand in for/.test(text)) return null;
    let nums = parseNumbers(text).filter((n) => !n.percent);
    if (nums.length === 0) return null;
    return { command: "analysis.representatives", args: { n: nums[0].value } };
  },

  function correlation(text, ctx) {
    if (!/\brelated\b|\brelate\b|correlat|trades? off|matters more|relationship|compare the/.test(text)) return null;
    let dims = manyColumns(text, 3);
    return dims.length >= 2
      ? { command: "ask.correlation", args: { dims: dims } }
      : { command: "ask.correlation", args: {} };
  },

  function compareSelection(text) {
    if (/have in common|different about|stands out about|characterises/.test(text)) {
      return { command: "ask.compare_selection", args: {} };
    }
    return null;
  },

  function explainExclusion(text, ctx, raw) {
    if (!/why (is|does|was|isn|doesn)/.test(text) || !/show(ing)? up|excluded|missing|filtered out|not in/.test(text)) {
      return null;
    }
    let id = raw.match(/\boption\s+(\w+)/i);
    return {
      command: "ask.explain_exclusion",
      args: { item: id ? { by: "id", id: id[1] } : { by: "inspected" } },
    };
  },

  // --- inspection, before ask.extreme can claim "the cheapest one" -----------
  function inspect(text, ctx) {
    if (!/^show me the|^inspect|^look at|^open the details/.test(text)) return null;
    let ordinal = Object.keys(ORDINALS).find((w) => text.includes(w + " one"));
    if (ordinal) {
      return { command: "inspect.item", args: { item: { by: "ordinal", n: ORDINALS[ordinal] } } };
    }
    let direction = findDirection(text);
    if (!direction || !/\bone\b|\bwith the\b/.test(text)) return null;
    let hit = oneColumn(text);
    if (!asset(hit)) return null;
    if (hit.ambiguous.length > 1) return clarifyFor(hit);
    // "most curved" is the low end of how planar something is.
    if (/curved|curvier/.test(text)) direction = "min";
    return {
      command: "inspect.item",
      args: { item: { by: "extreme", dim: hit.column, direction: direction } },
    };
  },

  function ordinalInspect(text) {
    let ordinal = Object.keys(ORDINALS).find((w) => text.includes(w + " one"));
    if (!ordinal || !/inspect|look at|open/.test(text)) return null;
    return { command: "inspect.item", args: { item: { by: "ordinal", n: ORDINALS[ordinal] } } };
  },

  // --- counting and statistics ----------------------------------------------
  function count(text, ctx) {
    if (!/^how many|what is the count/.test(text)) return null;
    let where = [];
    let comparator = findComparator(text);
    let nums = parseNumbers(text).filter((n) => !n.percent);
    let hit = oneColumn(text);
    if (comparator && nums.length > 0 && asset(hit)) {
      // A condition was stated; an ambiguous column is a question, not a
      // reason to count everything and say nothing about it.
      if (hit.ambiguous.length > 1) return clarifyFor(hit);
      where.push({ dim: hit.column, op: comparator.op, value: nums[0].value });
    } else {
      let cat = categoricalValues(text);
      if (cat) where.push({ dim: cat.dim, op: "in", values: cat.values });
    }
    return { command: "ask.count", args: where.length > 0 ? { where: where } : {} };
  },

  function extreme(text, ctx) {
    let asksForRow = /^which\b/.test(text) || /\bone\b\s*$/.test(text);
    if (!asksForRow) return null;
    let direction = findDirection(text);
    if (!direction) return null;
    // "the highest cooling and heating" names two columns: two questions,
    // answered in turn, rather than one ambiguity to ask about.
    let many = manyColumns(text, 3);
    if (many.length >= 2) {
      return {
        command: "sequence",
        args: { steps: many.map((dim) => ({ command: "ask.extreme", args: { dim: dim, direction: direction } })) },
      };
    }
    let hit = oneColumn(text);
    if (!asset(hit)) return null;
    if (hit.ambiguous.length > 1) return clarifyFor(hit);
    return { command: "ask.extreme", args: { dim: hit.column, direction: direction } };
  },

  function stats(text, ctx) {
    // A question form, or a statistic named outright ("std of price").
    let asks = /^what (is|are)|^give me|^tell me|^on average|average\b|\bstd\b|\bstdev\b|standard deviation|\bvariance\b|\bmedian\b|\bmean\b|\bspread\b/.test(text);
    if (!asks) return null;
    // A number or a comparator makes it a rank or a range, never a statistic.
    if (parseNumbers(text).length > 0 || findComparator(text)) return null;
    let padded = " " + text + " ";
    let entry = STATS.find((s) => padded.includes(" " + s[0].trim() + " "));
    if (!entry) return null;
    let scope = /\bselected\b|\bof these\b|of the ones i/.test(text) ? "result" : null;
    let many = manyColumns(text, 3);
    if (many.length >= 2) {
      return {
        command: "sequence",
        args: {
          steps: many.map((dim) => {
            let step = { dim: dim, stat: entry[1] };
            if (scope) step.scope = scope;
            return { command: "ask.stats", args: step };
          }),
        },
      };
    }
    let hit = oneColumn(text);
    if (!asset(hit)) return null;
    if (hit.ambiguous.length > 1) return clarifyFor(hit);
    let args = { dim: hit.column, stat: entry[1] };
    if (scope) args.scope = scope;
    return { command: "ask.stats", args: args };
  },

  function capabilities(text) {
    if (/^what can you do|^help\b|^how do i|^how does this|what commands/.test(text)) {
      let topic = /load|import|my own data|spreadsheet/.test(text) ? "loading data" : null;
      return { command: "ask.capabilities", args: topic ? { topic: topic } : {} };
    }
    return null;
  },

  // --- narrowing ------------------------------------------------------------
  function clearFilters(text, ctx) {
    if (!/\bclear\b|\bremove the filter\b|\bunfilter\b/.test(text)) return null;
    if (/\ball\b|\beverything\b|\bthe filters\b/.test(text)) return { command: "filter.clear", args: {} };
    let hit = oneColumn(text);
    return asset(hit) && hit.ambiguous.length <= 1
      ? { command: "filter.clear", args: { dim: hit.column } }
      : { command: "filter.clear", args: {} };
  },

  function percentile(text, ctx) {
    let percent = parseNumbers(text).find((n) => n.percent);
    if (!percent) return null;
    let direction = findDirection(text);
    if (!direction) return null;
    let hit = oneColumn(text);
    if (!asset(hit)) return null;
    if (hit.ambiguous.length > 1) return clarifyFor(hit);
    return {
      command: "filter.percentile",
      args: {
        dim: hit.column,
        percent: percent.value,
        direction: direction === "min" ? "bottom" : "top",
      },
    };
  },

  // "select the highest cooling": a direction and a column with no number is
  // a request to narrow, not to look at one option. Asking is "which" or
  // "the ... one"; those shapes ran earlier. The band is a tenth by default,
  // said in the chip so it can be changed.
  function selectExtreme(text, ctx) {
    if (/^(what|which|how)\b/.test(text) || /\bone\s*$/.test(text)) return null;
    if (/\bsort\b|\bcolou?r\b|\baxis\b|\bcompare\b|\brelate/.test(text)) return null;
    let direction = findDirection(text);
    if (!direction) return null;
    if (parseNumbers(text).length > 0 || findComparator(text)) return null;
    let hit = oneColumn(text);
    if (!asset(hit) || hit.score < 100) return null;
    if (hit.ambiguous.length > 1) return clarifyFor(hit);
    return {
      command: "filter.percentile",
      args: { dim: hit.column, percent: 10, direction: direction === "min" ? "bottom" : "top" },
    };
  },

  function topk(text, ctx) {
    let direction = findDirection(text);
    if (!direction) return null;
    if (findComparator(text)) return null; // a comparator means a range, not a rank
    let nums = parseNumbers(text).filter((n) => !n.percent);
    if (nums.length === 0) return null;
    let hit = oneColumn(text);
    if (!asset(hit)) return null;
    if (hit.ambiguous.length > 1) return clarifyFor(hit);
    return {
      command: "filter.topk",
      args: { dim: hit.column, k: nums[0].value, direction: direction },
    };
  },

  /**
   * A comparator and a number on a column, or several joined by "or" on one
   * column: "price under 5000 or over 20000". An "or" that leads nowhere
   * ("year 2000 or above", "or more") stays part of the clause.
   */
  function range(text, ctx) {
    if (!findComparator(text)) return null;
    if (parseNumbers(text).length === 0) return null;
    // "exclude the ones below X" keeps the ones at or above it, and
    // "exclude cylinders = 0" keeps the ones that are not 0. Decided once for
    // the whole clause, since the parts of an "or" no longer say it.
    let flip = /\bexclude\b|\bdrop\b|\bget rid of\b|\bremove\b|\bwithout\b/i.test(text);
    let parts = splitDisjunction(text);

    let first = rangeClause(parts[0], null);
    if (!first) return null;
    if (first.clarify) return first.clarify;
    if (parts.length === 1) {
      return { command: "filter.range", args: clauseArgs(first, flip) };
    }

    let clauses = [first];
    for (let part of parts.slice(1)) {
      let clause = rangeClause(part, first.dim);
      if (!clause) return { command: "abstain", args: { reason: "unsupported" } };
      if (clause.clarify) return clause.clarify;
      // "price under 5000 or year over 2010" is not one filter.
      if (clause.dim !== first.dim) return { command: "abstain", args: { reason: "unsupported" } };
      clauses.push(clause);
    }
    let args = clauses.map((c) => clauseArgs(c, flip));
    if (flip) {
      // Excluding "under a or over b" keeps between a and b: the negation of
      // an "or" is an "and", which is one range only when the halves meet.
      let low = args.find((a) => a.op === "gte");
      let high = args.find((a) => a.op === "lte");
      if (args.length === 2 && low && high && low.value <= high.value) {
        return { command: "filter.range", args: { dim: first.dim, op: "between", range: [low.value, high.value] } };
      }
      return { command: "abstain", args: { reason: "unsupported" } };
    }
    let distinct = [];
    args.forEach((a) => {
      let key = JSON.stringify([a.op, a.value, a.range]);
      if (!distinct.some((d) => d.key === key)) distinct.push({ key: key, args: a });
    });
    if (distinct.length === 1) return { command: "filter.range", args: distinct[0].args };
    return {
      command: "filter.range",
      args: {
        dim: first.dim,
        op: "any",
        clauses: distinct.map((d) => {
          let a = d.args;
          return a.op === "between" ? { op: "between", range: a.range } : { op: a.op, value: a.value };
        }),
      },
    };
  },

  function categorical(text, ctx) {
    let cat = categoricalValues(text);
    if (!cat) return null;
    return {
      command: "filter.categorical",
      args: { dim: cat.dim, values: cat.values, op: isNegated(text) ? "not_in" : "in" },
    };
  },
];

/**
 * One comparator clause: `{ dim, op, value }` or `{ dim, op: "between", range }`,
 * `{ clarify }` when the column is ambiguous, null when there is no clause.
 * With `inherited` set (a later part of an "or") a column is taken from the
 * text only when named outright; a stray word that merely resembles one
 * does not pull the clause onto another column.
 */
function rangeClause(text, inherited) {
  let comparator = findComparator(text);
  if (!comparator) return null;
  let nums = parseNumbers(text);
  if (nums.length === 0) return null;
  let hit = oneColumn(text);
  let dim = null;
  if (asset(hit) && (!inherited || hit.score >= 100)) {
    if (hit.ambiguous.length > 1) return { clarify: clarifyFor(hit) };
    dim = hit.column;
  } else if (!inherited && /\bgrand\b|\$/.test(text)) {
    // "five grand" names a column even though no column word was said.
    let money = oneColumn("cost");
    if (asset(money)) return { dim: money.column, op: comparator.op, value: nums[0].value };
  }
  if (!dim) dim = inherited;
  if (!dim) return null;
  if (comparator.op === "between" && nums.length >= 2) {
    return { dim: dim, op: "between", range: [nums[0].value, nums[1].value] };
  }
  let after = nums.find((n) => n.index >= comparator.index) || nums[0];
  return { dim: dim, op: comparator.op, value: after.value };
}

/** The clause as filter.range args, with the exclusion flip applied. */
function clauseArgs(clause, flip) {
  if (clause.op === "between") return { dim: clause.dim, op: "between", range: clause.range };
  let op = clause.op;
  if (flip) {
    if (op === "gte" || op === "lte") op = op === "gte" ? "lte" : "gte";
    else if (op === "eq") op = "ne";
  }
  return { dim: clause.dim, op: op, value: clause.value };
}

/**
 * Splits a clause at each "or" that starts another comparison ("or over
 * 20000"). An "or" followed by no comparator and number ("year 2000 or
 * above", "5000 or more") is left where it is.
 */
function splitDisjunction(text) {
  let pieces = text.split(/\s+or\s+/i);
  let parts = [pieces[0]];
  for (let i = 1; i < pieces.length; i++) {
    let piece = pieces[i];
    let starts = findComparator(piece) && parseNumbers(piece).length > 0 && !/^(more|less)\b/i.test(piece);
    if (starts) parts.push(piece);
    else parts[parts.length - 1] += " or " + piece;
  }
  return parts;
}


/* ------------------------------------------------------------ composition -- */

const CONNECTORS = /\s*(?:,\s*(?:and\s+|then\s+)?|\s+then\s+|\s+and\s+)\s*/i;
const AND_MARKER = "__kept_and__";

/** Hides the "and" inside "between 5 and 15" so the splitter cannot see it. */
function protectRanges(text) {
  return text.replace(/(between\s+-?\d[\d.]*)\s+and\s+(-?\d)/gi, "$1 " + AND_MARKER + " $2");
}

function restore(text) {
  return text.split(AND_MARKER).join("and");
}

/** Two axis commands from one sentence are one axis command. */
function mergeAxes(steps) {
  let out = [];
  for (let step of steps) {
    let last = out[out.length - 1];
    if (step.command === "view.axes" && last && last.command === "view.axes") {
      last.args = Object.assign({}, last.args, step.args);
    } else {
      out.push({ command: step.command, args: step.args });
    }
  }
  return out;
}

/* ----------------------------------------------------------------- guards -- */

/**
 * Adjectives that sound like a threshold but are not one. Acting on them means
 * inventing a number the user never said.
 */
const VAGUE = ["cheap", "expensive", "pricey", "affordable", "high", "low", "big",
  "small", "large", "tiny", "old", "young", "reasonable", "decent", "good", "bad",
  "too", "mostly", "fairly", "quite"];

const UNIT_FAMILIES = [
  ["ft", "feet", "foot"],
  ["m", "meter", "meters", "metre", "metres"],
  ["kwh", "kw"],
  ["m2", "sqm", "sf"],
];

function unitFamily(word) {
  return UNIT_FAMILIES.findIndex((f) => f.includes(word));
}

/** The unit a header declares in brackets, if any. */
function declaredUnit(column) {
  let match = String(column).match(/\[([^\]]+)\]|\(([^)]+)\)/);
  if (!match) return null;
  let inner = (match[1] || match[2] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return inner || null;
}

/** "height in meters" against a header that says feet: no conversion exists. */
function unitConflict(text, column) {
  let declared = declaredUnit(column);
  if (!declared) return false;
  let mine = unitFamily(declared);
  if (mine < 0) return false;
  return tokens(text).some((t) => {
    let theirs = unitFamily(t);
    return theirs >= 0 && theirs !== mine;
  });
}

function vocabulary() {
  let set = new Set();
  columnsFor().forEach((e) => e.tokens.forEach((t) => set.add(t)));
  return set;
}

/**
 * The user named a member of a family that does not exist -- massing has a
 * floor count for three zones but not the fourth. Every candidate shares the
 * family words; none carries the qualifier that was actually said.
 */
function missingFamilyMember(text, candidates) {
  if (candidates.length < 2) return false;
  let index = columnsFor();
  let sets = candidates.map((c) => {
    let entry = index.find((e) => e.column === c);
    return new Set(entry ? entry.tokens : []);
  });
  let common = new Set(Array.from(sets[0]).filter((t) => sets.every((s) => s.has(t))));
  if (common.size === 0) return false;
  let distinguishing = new Set();
  sets.forEach((s) => s.forEach((t) => !common.has(t) && distinguishing.add(t)));
  let known = vocabulary();
  return tokens(text).some((t) => known.has(t) && !common.has(t) && !distinguishing.has(t));
}

/** Commands BM25 alone may propose: those that touch no data and take no arguments. */
const INTENT_ONLY = [
  "history.undo", "history.redo", "scope.reset", "scope.zoom", "scope.exclude", "scope.out", "set.clear",
  "select.invert", "select.all", "export.csv", "inspect.clear",
  "ask.compare_selection", "ask.capabilities",
];

/* ----------------------------------------------------------------- parser -- */

function makeParser(options) {
  let settings = options || {};
  let guarded = settings.guarded;
  let rank = settings.rank || ((text) => bm25.rank(INDEX, text));
  let embedColumns = settings.embedColumns || null;
  let compose = settings.compose;

  function parseSingle(raw, ctx) {
    let text = normalizeText(raw);

    if (guarded) {
      // A vague adjective with no number anywhere is a request to invent a
      // threshold. Ask for the number instead of choosing one.
      let hasNumber = parseNumbers(text).length > 0;
      if (!hasNumber && tokens(text).some((t) => VAGUE.includes(t)) && !findDirection(text)) {
        let hit = oneColumn(text);
        let name = hit.column ? tokens(hit.column).slice(-1)[0] : "value";
        return {
          command: "clarify",
          args: {
            slot: "value",
            candidates: ["the bottom 25% by " + name, "a " + name + " you name"],
          },
        };
      }
    }

    for (let shape of SHAPES) {
      let hit = shape(text, ctx, raw);
      if (!hit) continue;
      if (guarded) {
        if (hit.command === "clarify" && missingFamilyMember(text, hit.args.candidates || [])) {
          return { command: "abstain", args: { reason: "no_such_dimension" } };
        }
        let named = hit.args && (hit.args.dim || hit.args.x || hit.args.y);
        if (named && unitConflict(text, named)) {
          return { command: "abstain", args: { reason: "unsupported" } };
        }
      }
      return hit;
    }

    // Nothing matched a shape. BM25 says what the sentence is shaped like; only
    // the commands that need no arguments can be satisfied on that alone.
    let ranked = ACTIVE.rank(text);
    let top = ranked[0];
    let pool = guarded
      ? INTENT_ONLY
      : INTENT_ONLY.concat(["ask.count", "ask.correlation", "analysis.cluster", "filter.clear", "set.create"]);
    // A clause that names a column outright ("year", the tail of "price and
    // year") is an argument to something, never an argument-free command,
    // however close its letters fall to one.
    let mention = oneColumn(text);
    let namesColumn = asset(mention) && mention.score >= 100;
    let namesSet = (SCHEMA.sets || []).some((s) => (" " + text + " ").includes(" " + normalizeText(s) + " ")) ||
      /\bset\s*#?\s*\d+\b/.test(text);
    if (top && top.score > 9 && pool.includes(top.label) && !namesColumn && !namesSet) {
      return { command: top.label, args: {} };
    }

    // No shape, no confident intent, nothing to act on: say so rather than
    // reaching for the nearest command.
    let hasColumn = asset(oneColumn(text));
    let hasNumber = parseNumbers(text).length > 0;
    if (!hasColumn && !hasNumber && (!top || top.score < 9)) {
      return { command: "abstain", args: { reason: "out_of_scope" } };
    }
    return null;
  }

  return function parse(utterance, context) {
    ACTIVE = { rank: rank, embedColumns: embedColumns };
    SCHEMA = context.schema;
    let ctx = { state: context.state || {} };

    // Predicate-level parsing gets first refusal, because it can see compound
    // requests that have no connector to split on. It returns null unless it
    // finds two or more operations, so single-operation utterances fall
    // through to the shapes untouched.
    if (compose) {
      let compound = parseCompound(utterance, SCHEMA);
      if (compound) return compound;
    }
    let parts = protectRanges(utterance)
      .split(CONNECTORS)
      .map(restore)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length > 1) {
      let parsed = parts.map((p) => parseSingle(p, ctx));
      let good = parsed.filter((p) => p !== null && p.command !== "abstain");

      // Guarded: a compound request is all or nothing. Applying three clauses
      // out of four leaves the user with results they did not ask for and no
      // sign that anything was dropped -- the expensive kind of mistake.
      if (guarded && good.length > 1 && good.length < parts.length) {
        let asking = good.find((s) => s.command === "clarify");
        return asking || { command: "abstain", args: { reason: "unsupported" } };
      }

      if (good.length >= 2) {
        let steps = mergeAxes(good);
        // A clarify anywhere in a sequence answers for the whole sentence.
        let asking = steps.find((s) => s.command === "clarify");
        if (asking) return asking;
        if (steps.length === 1) return steps[0];
        return { command: "sequence", args: { steps: steps } };
      }
    }

    return parseSingle(utterance, ctx);
  };
}

export { makeParser };

/** The configuration eval/README.md calls A1C. */
export const parse = makeParser({ guarded: true, compose: true });
