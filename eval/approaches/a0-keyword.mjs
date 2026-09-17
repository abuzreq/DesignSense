/**
 * A0 — the floor.
 *
 * What someone writes in an afternoon: a dozen keyword rules, columns matched
 * by their own words only (no aliases, no fuzz), the first number in the
 * string. It exists so that every later number has something to beat, and so
 * that "the rules approach works" is a claim about A1 rather than about rules
 * in general.
 *
 * It never declines on purpose. That is the point: it shows what the abstain
 * and clarify strata cost you when nobody thought about them.
 */

import { DATASETS } from "../schema.mjs";
import { normalizeColumn, normalizeText } from "./lexicon.mjs";

const GTE = ["above", "over", "at least", "greater than", "more than", "newer than", "taller than"];
const LTE = ["under", "below", "less than", "at most", "cheaper than", "older than"];
const EQ = ["equal to", "equals", "exactly"];

function columnsOf(dataset) {
  return (DATASETS[dataset] || []).map((c) => ({ column: c, norm: normalizeColumn(c) }));
}

/** The longest column name that appears verbatim in the utterance. */
function findColumn(text, dataset) {
  let best = null;
  for (let entry of columnsOf(dataset)) {
    if (entry.norm && text.includes(entry.norm)) {
      if (best === null || entry.norm.length > best.norm.length) best = entry;
    }
  }
  return best ? best.column : null;
}

function findOp(text) {
  for (let w of EQ) if (text.includes(w)) return "eq";
  for (let w of GTE) if (text.includes(w)) return "gte";
  for (let w of LTE) if (text.includes(w)) return "lte";
  return null;
}

function numbers(text) {
  return (text.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
}

function parse(utterance, context) {
  let text = normalizeText(utterance);
  let dataset = context.dataset;
  let nums = numbers(text);
  let column = findColumn(text, dataset);

  if (text === "undo" || text.startsWith("undo")) return { command: "history.undo", args: {} };
  if (text === "redo") return { command: "history.redo", args: {} };
  if (text === "reset") return { command: "scope.reset", args: {} };
  if (text === "select all") return { command: "select.all", args: {} };
  if (text.includes("export") || text.includes("csv")) return { command: "export.csv", args: {} };

  if (text.includes("clear")) {
    return column
      ? { command: "filter.clear", args: { dim: column } }
      : { command: "filter.clear", args: {} };
  }
  if (text.includes("invert")) return { command: "select.invert", args: {} };
  if (text.includes("zoom")) return { command: "scope.zoom", args: {} };
  if (text.includes("exclude")) return { command: "scope.exclude", args: {} };

  if (text.startsWith("sort by") && column) {
    let args = { dim: column };
    if (text.includes("descending")) args.desc = true;
    else if (text.includes("ascending")) args.desc = false;
    return { command: "view.sort", args: args };
  }
  if (text.startsWith("color by") && column) {
    return { command: "view.color", args: { dim: column } };
  }
  if (text.includes("x axis") && column) return { command: "view.axes", args: { x: column } };
  if (text.includes("y axis") && column) return { command: "view.axes", args: { y: column } };

  if (text.startsWith("how many")) return { command: "ask.count", args: {} };

  if (text.startsWith("what is the") && column) {
    let stat = null;
    if (text.includes("average")) stat = "mean";
    else if (text.includes("maximum") || text.includes("max ")) stat = "max";
    else if (text.includes("minimum") || text.includes("min ")) stat = "min";
    else if (text.includes("range")) stat = "range";
    if (stat) return { command: "ask.stats", args: { dim: column, stat: stat } };
  }

  if (text.includes("top ") && column && nums.length > 0) {
    return { command: "filter.topk", args: { dim: column, k: nums[0], direction: "max" } };
  }

  if (column && nums.length > 0) {
    if (text.includes("between") && nums.length > 1) {
      return {
        command: "filter.range",
        args: { dim: column, op: "between", range: [nums[0], nums[1]] },
      };
    }
    let op = findOp(text);
    if (op) return { command: "filter.range", args: { dim: column, op: op, value: nums[0] } };
  }

  return null;
}

export default { id: "a0", name: "keyword and regex baseline", parse: parse };
