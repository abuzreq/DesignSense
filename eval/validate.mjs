/**
 * Checks the evaluation dataset against the label space, then prints how it is
 * distributed.
 *
 * A hand-written eval set rots quietly: a gold `dim` with a typo makes an
 * approach look wrong when the dataset is. Everything checkable is checked
 * here, and column names are checked against the real CSV headers.
 *
 *   node eval/validate.mjs
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { COMMANDS, DATASETS, ENTITY_KINDS, ITEM_FIELDS, TIERS } from "./schema.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, "dataset");

/** Argument names whose value is a column of the dataset. */
const DIM_KEYS = ["dim", "x", "y"];
const DIM_LIST_KEYS = ["dims"];

function load() {
  let items = [];
  for (let file of readdirSync(DATA_DIR).filter((f) => f.endsWith(".jsonl"))) {
    let text = readFileSync(join(DATA_DIR, file), "utf8");
    text.split("\n").forEach((line, i) => {
      if (line.trim() === "") return;
      try {
        items.push({ ...JSON.parse(line), _file: file, _line: i + 1 });
      } catch (e) {
        throw new Error(file + ":" + (i + 1) + " is not valid JSON: " + e.message);
      }
    });
  }
  return items;
}

/** Collects every column name a command refers to, including nested steps. */
function dimsUsed(node, out) {
  if (node === null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    node.forEach((n) => dimsUsed(n, out));
    return out;
  }
  for (let key of DIM_KEYS) {
    if (typeof node[key] === "string") out.push(node[key]);
  }
  for (let key of DIM_LIST_KEYS) {
    if (Array.isArray(node[key])) {
      node[key].forEach((d) => typeof d === "string" && out.push(d));
    }
  }
  // A clarify between columns lists columns; a clarify between thresholds
  // lists prose, which is not checkable.
  if (node.slot === "dim" && Array.isArray(node.candidates)) {
    node.candidates.forEach((c) => out.push(c));
  }
  Object.keys(node).forEach((k) => {
    if (k !== "candidates") dimsUsed(node[k], out);
  });
  return out;
}

function checkCommand(command, args, path, errors, push) {
  let spec = COMMANDS[command];
  if (!spec) {
    push(errors, path + ": unknown command " + JSON.stringify(command));
    return;
  }
  let given = Object.keys(args || {});
  spec.required.forEach((name) => {
    if (!(name in (args || {}))) {
      push(errors, path + ": " + command + " is missing required arg " + name);
    }
  });
  let allowed = spec.required.concat(spec.optional);
  given.forEach((name) => {
    if (!allowed.includes(name)) {
      push(errors, path + ": " + command + " has unknown arg " + name);
    }
  });
  if (command === "sequence") {
    (args.steps || []).forEach((step, i) => {
      checkCommand(step.command, step.args, path + ".steps[" + i + "]", errors, push);
    });
  }
}

function main() {
  let items = load();
  let errors = [];
  let seen = new Set();
  let push = (list, message) => list.push(message);

  for (let item of items) {
    let where = item._file + ":" + item._line + " (" + (item.id || "no id") + ")";

    ITEM_FIELDS.forEach((f) => {
      if (!(f in item)) push(errors, where + ": missing field " + f);
    });
    if (seen.has(item.id)) push(errors, where + ": duplicate id");
    seen.add(item.id);

    if (!TIERS.includes(item.tier)) push(errors, where + ": bad tier " + item.tier);
    if (item.tier && !item._file.startsWith(item.tier)) {
      push(errors, where + ": tier " + item.tier + " does not match its file");
    }

    let columns = DATASETS[item.dataset];
    if (!columns) {
      push(errors, where + ": unknown dataset " + item.dataset);
      continue;
    }
    if (item.strata && !ENTITY_KINDS.includes(item.strata.entity)) {
      push(errors, where + ": bad entity kind " + item.strata.entity);
    }
    if (typeof item.utterance !== "string" || item.utterance.trim() === "") {
      push(errors, where + ": empty utterance");
    }

    if (!item.gold || typeof item.gold.command !== "string") {
      push(errors, where + ": gold has no command");
      continue;
    }
    checkCommand(item.gold.command, item.gold.args, where, errors, push);

    // The check that matters: every column named in a gold label must exist.
    dimsUsed(item.gold, []).forEach((dim) => {
      if (!columns.includes(dim)) {
        push(errors, where + ": " + JSON.stringify(dim) + " is not a column of " + item.dataset);
      }
    });

    // `strata.entity` describes the column mention in the *utterance*, which
    // is what an approach has to resolve. When the gold is clarify or abstain
    // the mention deliberately does not survive into the label, so only the
    // executable commands can be cross-checked against it.
    let named = dimsUsed(item.gold, []).length > 0;
    let executable = !["clarify", "abstain"].includes(item.gold.command);
    if (item.strata && executable) {
      if (named && item.strata.entity === "none") {
        push(errors, where + ": names a column but entity is none");
      }
      if (!named && item.strata.entity !== "none") {
        push(errors, where + ": names no column but entity is " + item.strata.entity);
      }
    }
  }

  report(items, errors);
  process.exit(errors.length === 0 ? 0 : 1);
}

function tally(items, keyOf) {
  let counts = {};
  items.forEach((i) => {
    let key = keyOf(i);
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function table(title, counts, total) {
  console.log("\n" + title);
  let width = Math.max(...Object.keys(counts).map((k) => k.length));
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, n]) => {
      let pct = ((100 * n) / total).toFixed(0).padStart(3);
      console.log("  " + key.padEnd(width) + "  " + String(n).padStart(4) + "  " + pct + "%");
    });
}

function report(items, errors) {
  let total = items.length;
  console.log("DesignSense assistant eval set: " + total + " items");

  table("By tier", tally(items, (i) => i.tier), total);
  table("By dataset", tally(items, (i) => i.dataset), total);
  table("By entity difficulty", tally(items, (i) => (i.strata || {}).entity || "?"), total);
  table("By clause count", tally(items, (i) => String((i.strata || {}).clauses || "?")), total);
  table("Context-dependent", tally(items, (i) => String((i.strata || {}).context)), total);
  table("By command", tally(items, (i) => i.gold.command), total);

  let meta = items.filter((i) => ["clarify", "abstain"].includes(i.gold.command));
  console.log(
    "\nAsk-or-decline items: " + meta.length + " (" +
    ((100 * meta.length) / total).toFixed(0) + "%) — the strata that decide whether the" +
    "\nassistant is trustworthy rather than merely accurate."
  );

  if (errors.length === 0) {
    console.log("\nOK — every gold label type-checks and every column exists.");
  } else {
    console.log("\n" + errors.length + " problem(s):");
    errors.forEach((e) => console.log("  " + e));
  }
}

main();
