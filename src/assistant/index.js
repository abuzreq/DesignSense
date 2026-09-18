/**
 * One entry point: text in, something done and something said.
 *
 * The parser never acts on a low-confidence reading. When it cannot choose a
 * column it asks, and when the request is outside what the commands cover it
 * says so, rather than reaching for the nearest thing. That matters more than
 * accuracy here: a question costs a click, while a filter applied to the wrong
 * column changes the results silently.
 *
 * The second half of this file is the guided path: suggestions while typing,
 * ranked lexically from the first keystroke and semantically once a small
 * sentence encoder has arrived in the background. Suggestions only ever put
 * text into the box; Enter still comes through `ask`.
 */

import { parse } from "./parser.js";
import { buildSchema } from "./schema.js";
import { COMMANDS, catalogue, describeClause, runCommand } from "./commands.js";
import { suggest as engine, accept as acceptItem, vectorQueries } from "./suggest.js";
import { buildSemanticIndex } from "./semantic.js";
import { TEMPLATES, slots, render, preview } from "./templates.js";
import HEAD from "./intent-head.json";

export { catalogue };

/**
 * The supported instructions, grouped the way the registry groups commands,
 * each ready to be dropped into the bar: `insert` is the text to start
 * from, `complete` says whether it can run as it stands or needs its slots
 * filled first. The shape matches a suggestion item, so the bar treats a
 * click here exactly like a click on a suggestion.
 */
export function instructions() {
  let groups = {};
  TEMPLATES.forEach((template) => {
    let entry = COMMANDS[template.command];
    if (!entry) return;
    (groups[entry.group] = groups[entry.group] || []).push({
      label: preview(template, []),
      title: entry.title,
      insert: render(template, []),
      template: template,
      filled: [],
      complete: slots(template).length === 0,
      command: template.command,
      prefixText: "",
      why: "list",
      hint: slots(template).length === 0 ? "runs now" : "fill in " + slots(template).length,
    });
  });
  return groups;
}

const REFUSALS = {
  out_of_scope: "That is outside what I can do with this table.",
  unsupported: "I understood that, but there is no command for it yet.",
  no_such_dimension: "There is no column like that in this dataset.",
  needs_data: "I need more of the data loaded before I can answer that.",
};

function labelOf(dim) {
  return String(dim).replace(/^(in|out|custom|weighted)\s*:\s*/i, "");
}

/** A short echo of what was understood, so a misreading is visible. */
export function describe(result) {
  if (!result) return "";
  if (result.command === "sequence") {
    return result.args.steps.map(describe).join(", then ");
  }
  let args = result.args || {};
  let dim = args.dim ? labelOf(args.dim) : "";
  switch (result.command) {
    case "filter.range":
      if (args.op === "any") {
        return args.clauses.map((c) => describeClause(Object.assign({ dim: args.dim }, c))).join(" OR ");
      }
      if (args.op === "between") return dim + " " + args.range[0] + "–" + args.range[1];
      return dim + " " + { gte: "≥", lte: "≤", eq: "=", ne: "≠" }[args.op] + " " + args.value;
    case "filter.topk":
      return (args.direction === "min" ? "lowest " : "highest ") + args.k + " by " + dim;
    case "filter.percentile":
      return args.direction + " " + args.percent + "% by " + dim;
    case "filter.categorical":
      return dim + (args.op === "not_in" ? " not " : " is ") + args.values.join(" or ");
    case "filter.clear":
      return dim ? "clear the filter on " + dim : "clear the filters";
    case "ask.count":
      if (!args.where || args.where.length === 0) return "how many match";
      return "how many with " + args.where.map((w) => {
        let name = labelOf(w.dim);
        if (w.op === "in" || w.op === "not_in") return name + (w.op === "in" ? " " : " not ") + (w.values || []).join(" or ");
        if (w.op === "between") return name + " " + w.range[0] + "–" + w.range[1];
        return name + " " + ({ gte: "≥", lte: "≤", eq: "=", ne: "≠" }[w.op] || w.op) + " " + w.value;
      }).join(" and ");
    case "view.sort":
      return "sort by " + dim;
    case "view.color":
      return "colour by " + dim;
    case "view.axes":
      return "axes " + [args.x, args.y].filter(Boolean).map(labelOf).join(" / ");
    case "analysis.pareto":
      return "trade-offs of " + (args.dims || [])
        .map((d, i) => labelOf(d) + ((args.directions || [])[i] === "min" ? " ↓" : " ↑"))
        .join(" vs ");
    case "ask.stats": {
      let word = { mean: "average", median: "median", min: "minimum", max: "maximum", range: "range", std: "std", count: "count" }[args.stat] || args.stat;
      return word + " of " + dim + (args.scope === "result" ? " in the results" : "");
    }
    case "ask.extreme":
      return (args.direction === "min" ? "lowest " : "highest ") + dim + (args.n > 1 ? ", top " + args.n : "");
    case "ask.correlation":
      return args.dims && args.dims.length >= 2
        ? "how " + args.dims.map(labelOf).join(" and ") + " relate"
        : "what trades off against what";
    case "ask.compare_sets":
      return args.a + " vs " + (args.b === "rest" ? "the rest" : args.b);
    case "analysis.cluster":
      return (args.k || 4) + " clusters" + (args.dims && args.dims.length ? " on " + args.dims.map(labelOf).join(", ") : "");
    case "analysis.similar":
      return "options like this one";
    case "analysis.representatives":
      return args.n + " representative examples";
    case "set.create":
      return args.name ? "save as " + args.name : "save the results as a set";
    case "set.restore":
      return "restore " + args.set;
    case "set.delete":
      return "delete " + args.set;
    case "set.update":
      return (args.operation === "subtract" ? "remove these from " : "add these to ") + args.set;
    case "view.open":
      return "open the " + String(args.view).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
    case "view.close":
      return "close the " + String(args.view).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
    case "mode.set":
      return "switch to " + args.mode + " mode";
    case "inspect.item": {
      let item = args.item || {};
      if (item.by === "extreme") return "inspect the " + (item.direction === "min" ? "lowest " : "highest ") + labelOf(item.dim);
      if (item.by === "ordinal") return "inspect the " + (item.n < 0 ? "last" : "#" + item.n) + " one";
      if (item.by === "id") return "inspect option " + item.id;
      return "inspect this one";
    }
    default: {
      // The registry's own title, so "select.invert" reads as "Invert the
      // selection" rather than as an identifier.
      let entry = COMMANDS[result.command];
      return entry && entry.title ? entry.title : result.command.replace(/[._]/g, " ");
    }
  }
}

/**
 * `{ kind, message, understood }` where kind is "done", "answer", "clarify",
 * "refused" or "unknown".
 */
export function ask(store, utterance, options) {
  let text = String(utterance || "").trim();
  if (text === "") return { kind: "unknown", message: "" };

  // `prefer` is the column the user chose from a previous clarify, so the same
  // sentence can be re-read without them having to retype it.
  let schema = Object.assign({}, buildSchema(store.state), {
    prefer: (options && options.prefer) || null,
    sets: Object.keys(store.state.setsMap || {}),
  });
  let result;
  try {
    result = parse(text, { schema: schema, state: store.state });
  } catch (error) {
    return { kind: "unknown", message: "I could not read that." };
  }

  if (!result) {
    return {
      kind: "unknown",
      message: "I did not understand that. Try naming a column, or ask what I can do.",
    };
  }

  if (result.command === "clarify") {
    return {
      kind: "clarify",
      slot: result.args.slot,
      candidates: result.args.candidates || [],
      message:
        result.args.slot === "dim"
          ? "Which one did you mean?"
          : "I need a number for that.",
    };
  }

  if (result.command === "abstain") {
    return { kind: "refused", message: REFUSALS[result.args.reason] || REFUSALS.unsupported };
  }

  let ctx = {
    store: store,
    state: store.state,
    getters: store.getters,
    schema: schema,
  };
  let said = runCommand(ctx, result) || {};
  recordUsage(result);
  return {
    kind: said.showHelp ? "help" : said.message ? "answer" : "done",
    message: said.message || "",
    understood: describe(result),
  };
}

/* ---------------------------------------------------------------- usage -- */

const USAGE_KEY = "designsense-assistant-usage";

function readUsage() {
  try {
    return JSON.parse(localStorage.getItem(USAGE_KEY) || "{}") || {};
  } catch (e) {
    return {};
  }
}

/** Commands that ran float up the empty-box list and break ranking ties. */
export function recordUsage(result) {
  if (!result) return;
  if (result.command === "sequence") {
    (result.args.steps || []).forEach(recordUsage);
    return;
  }
  try {
    let usage = readUsage();
    usage[result.command] = (usage[result.command] || 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch (e) {
    // Private mode or a full store: usage is a convenience, not state.
  }
}

/* -------------------------------------------------------------- extents -- */

let extentsCache = null;
let extentsSignature = "";

/** `{ column: [min, median, max] }` for every numeric column, cached per dataset. */
function extentsFor(state, schema) {
  // Custom values change without the columns or row count changing.
  let signature =
    schema.columns.join("|") +
    "#" +
    (state.data ? state.data.length : 0) +
    "#" +
    (state.dimensionValuesVersion || 0);
  if (extentsCache && extentsSignature === signature) return extentsCache;
  let out = {};
  schema.numeric.forEach((dim) => {
    let values = [];
    for (let row of state.data || []) {
      let v = Number(row[dim]);
      if (Number.isFinite(v)) values.push(v);
    }
    if (values.length === 0) return;
    values.sort((a, b) => a - b);
    out[dim] = [values[0], values[Math.floor(values.length / 2)], values[values.length - 1]];
  });
  extentsCache = out;
  extentsSignature = signature;
  return out;
}

/* ------------------------------------------------------------- semantic -- */

/*
 * The encoder is not a build dependency. It is imported at runtime from a
 * CDN, through a Function so that the bundler leaves the import alone, and
 * the whole thing is optional: while it is loading, or if it never loads,
 * suggestions come from the lexical ranking and nothing in the bar changes.
 */
const TRANSFORMERS_CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0";
const ENCODER_MODEL = "Xenova/all-MiniLM-L6-v2";

let semantic = {
  status: "idle", // idle | loading | ready | failed
  encode: null,
  index: null,
  indexSignature: "",
  building: null,
  vectors: new Map(),
  pending: new Map(),
  listeners: [],
};

export function semanticStatus() {
  return semantic.status;
}

function notify() {
  semantic.listeners.forEach((fn) => {
    try { fn(semantic.status); } catch (e) { /* a listener's problem */ }
  });
}

/** Starts loading the encoder once; `onChange` hears about status changes. */
export function warmSemantic(onChange) {
  if (onChange && semantic.listeners.indexOf(onChange) < 0) semantic.listeners.push(onChange);
  if (semantic.status !== "idle") return;
  if (typeof window === "undefined") return;
  semantic.status = "loading";
  notify();

  let importer = new Function("url", "return import(url)");
  importer(TRANSFORMERS_CDN)
    .then((tf) => {
      tf.env.allowLocalModels = false;
      return tf.pipeline("feature-extraction", ENCODER_MODEL, { dtype: "q8", device: "wasm" });
    })
    .then((pipe) => {
      semantic.encode = async function (texts) {
        let out = [];
        for (let start = 0; start < texts.length; start += 16) {
          let batch = texts.slice(start, start + 16);
          let tensor = await pipe(batch, { pooling: "mean", normalize: true });
          let dims = tensor.dims[tensor.dims.length - 1];
          batch.forEach((_, i) =>
            out.push(Float32Array.from(tensor.data.slice(i * dims, (i + 1) * dims)))
          );
          // Inference runs on the main thread. A real pause between batches
          // lets clicks and keystrokes through while a long index builds.
          if (start + 16 < texts.length) await new Promise((resolve) => setTimeout(resolve, 0));
        }
        return out;
      };
      semantic.status = "ready";
      notify();
    })
    .catch((error) => {
      semantic.status = "failed";
      semantic.error = error;
      notify();
    });
}

/**
 * Builds the index for the loaded table as soon as the encoder is ready and
 * the page is idle, so the first click on the bar finds it done instead of
 * paying for three hundred encodings on the spot.
 */
export function prepareSemantic(store) {
  if (semantic.status !== "ready") return;
  let idle = typeof window !== "undefined" && window.requestIdleCallback
    ? window.requestIdleCallback
    : (fn) => setTimeout(fn, 0);
  idle(() => ensureSemanticIndex(buildSchema(store.state)));
}

/** The column index for this dataset, rebuilt in the background when the data changes. */
function ensureSemanticIndex(schema) {
  if (semantic.status !== "ready") return null;
  let signature = schema.columns.join("|");
  if (semantic.index && semantic.indexSignature === signature) return semantic.index;
  if (!semantic.building) {
    semantic.building = buildSemanticIndex(semantic.encode, schema, semantic.index)
      .then((index) => {
        semantic.index = index;
        semantic.indexSignature = signature;
        semantic.building = null;
        notify();
      })
      .catch(() => { semantic.building = null; });
  }
  return null;
}

function vectorKey(text) {
  return String(text).trim().toLowerCase();
}

/**
 * Encodes a piece of text once and caches it. Resolves when the vector is
 * available; the bar re-runs the suggestions then.
 */
export function requestVector(text) {
  let key = vectorKey(text);
  if (!key || semantic.status !== "ready") return Promise.resolve(false);
  if (semantic.vectors.has(key)) return Promise.resolve(true);
  if (semantic.pending.has(key)) return semantic.pending.get(key);
  let job = semantic.encode([key])
    .then((vecs) => {
      semantic.vectors.set(key, vecs[0]);
      semantic.pending.delete(key);
      if (semantic.vectors.size > 500) {
        // Oldest first; a Map iterates in insertion order.
        let first = semantic.vectors.keys().next().value;
        semantic.vectors.delete(first);
      }
      return true;
    })
    .catch(() => { semantic.pending.delete(key); return false; });
  semantic.pending.set(key, job);
  return job;
}

function semanticContext(schema) {
  let index = ensureSemanticIndex(schema);
  if (!index) return null;
  return {
    index: index,
    head: HEAD,
    vec: (text) => semantic.vectors.get(vectorKey(text)) || null,
  };
}

/* ------------------------------------------------------------ suggest -- */

/**
 * Suggestions for what is in the box. `active` is the instruction being
 * filled (from `acceptSuggestion`) or null. Synchronous: vectors already
 * cached are used, missing ones are requested and the caller re-asks.
 */
export function suggest(store, text, active) {
  let state = store.state;
  let schema = buildSchema(state);
  let sets = Object.keys(state.setsMap || {});
  let context = {
    schema: schema,
    extents: extentsFor(state, schema),
    sets: sets,
    usage: readUsage(),
    semantic: semanticContext(schema),
    parse: (t) => parse(t, { schema: Object.assign({}, schema, { prefer: null, sets: sets }), state: state }),
    describe: describe,
  };
  return engine(text, active, context);
}

/** Texts a suggestion round would like vectors for, so the bar can request them. */
export function wantsVector(text, active) {
  if (semantic.status !== "ready") return [];
  return vectorQueries(text, active).filter((q) => !semantic.vectors.has(vectorKey(q)));
}

export const acceptSuggestion = acceptItem;
