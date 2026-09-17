/**
 * Runs approaches over the evaluation set and scores them.
 *
 *   node eval/harness.mjs                 # every approach
 *   node eval/harness.mjs a0 a1           # named approaches
 *   node eval/harness.mjs --errors a1     # plus the first 40 mistakes
 *
 * An approach is a module exporting { id, name, parse(utterance, context) }
 * where context is { dataset, state } and parse returns a command object,
 * or null for "no reading of this".
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, "dataset");

/** Only these two mean "I did not act". Everything else changes the app. */
const DECLINING = ["clarify", "abstain"];

function loadItems() {
  let items = [];
  for (let file of readdirSync(DATA_DIR).filter((f) => f.endsWith(".jsonl"))) {
    readFileSync(join(DATA_DIR, file), "utf8")
      .split("\n")
      .forEach((line) => line.trim() && items.push(JSON.parse(line)));
  }
  return items;
}

/**
 * A stable string for a command. Candidate and value lists are sets, so their
 * order is not scored; step, dims, directions and range lists are positional,
 * so theirs is.
 */
function canonical(node) {
  if (node === null || node === undefined) return "null";
  if (Array.isArray(node)) return "[" + node.map(canonical).join(",") + "]";
  if (typeof node !== "object") return JSON.stringify(node);
  let keys = Object.keys(node).sort();
  return (
    "{" +
    keys
      .map((k) => {
        let v = node[k];
        if ((k === "candidates" || k === "values") && Array.isArray(v)) {
          v = v.slice().sort();
        }
        return JSON.stringify(k) + ":" + canonical(v);
      })
      .join(",") +
    "}"
  );
}

function score(items, approach) {
  let rows = [];
  let started = process.hrtime.bigint();

  for (let item of items) {
    let t0 = process.hrtime.bigint();
    let pred = null;
    let crashed = null;
    try {
      pred = approach.parse(item.utterance, {
        dataset: item.dataset,
        state: item.state || {},
      });
    } catch (e) {
      crashed = e.message;
    }
    let micros = Number(process.hrtime.bigint() - t0) / 1000;

    let intentOk = pred !== null && pred.command === item.gold.command;
    let exactOk =
      pred !== null &&
      canonical({ command: pred.command, args: pred.args || {} }) ===
        canonical({ command: item.gold.command, args: item.gold.args || {} });

    let predActed = pred !== null && !DECLINING.includes(pred.command);
    let goldDeclines = DECLINING.includes(item.gold.command);

    rows.push({
      item: item,
      pred: pred,
      crashed: crashed,
      intentOk: intentOk,
      exactOk: exactOk,
      // The failure that costs trust: it did something, and not the right thing.
      harmful: predActed && !exactOk,
      noParse: pred === null,
      goldDeclines: goldDeclines,
      predDeclines: pred !== null && DECLINING.includes(pred.command),
      micros: micros,
    });
  }

  let wall = Number(process.hrtime.bigint() - started) / 1e6;
  return { approach: approach, rows: rows, wallMs: wall };
}

function pct(n, d) {
  if (d === 0) return "   -";
  return ((100 * n) / d).toFixed(0).padStart(3) + "%";
}

function summarise(rows) {
  let n = rows.length;
  return {
    n: n,
    intent: rows.filter((r) => r.intentOk).length,
    exact: rows.filter((r) => r.exactOk).length,
    harmful: rows.filter((r) => r.harmful).length,
    noParse: rows.filter((r) => r.noParse).length,
  };
}

function line(label, s, width) {
  return (
    "  " + label.padEnd(width) +
    String(s.n).padStart(5) +
    pct(s.intent, s.n).padStart(9) +
    pct(s.exact, s.n).padStart(9) +
    pct(s.harmful, s.n).padStart(10) +
    pct(s.noParse, s.n).padStart(10)
  );
}

function breakdown(title, result, keyOf) {
  let groups = {};
  result.rows.forEach((r) => {
    let key = keyOf(r.item);
    (groups[key] = groups[key] || []).push(r);
  });
  let keys = Object.keys(groups).sort(
    (a, b) => groups[b].length - groups[a].length
  );
  let width = Math.max(10, ...keys.map((k) => k.length));
  console.log("\n  " + title.padEnd(width) + "    n   intent    exact   harmful   no-parse");
  console.log("  " + "-".repeat(width + 43));
  keys.forEach((k) => console.log(line(k, summarise(groups[k]), width)));
}

function report(result, showErrors) {
  let a = result.approach;
  let rows = result.rows;
  let all = summarise(rows);
  let times = rows.map((r) => r.micros).sort((x, y) => x - y);
  let p50 = times[Math.floor(times.length * 0.5)];
  let p95 = times[Math.floor(times.length * 0.95)];

  console.log("\n" + "=".repeat(74));
  console.log(a.id.toUpperCase() + " — " + a.name);
  console.log("=".repeat(74));

  console.log(
    "\n  overall       intent " + pct(all.intent, all.n).trim() +
    "   exact " + pct(all.exact, all.n).trim() +
    "   harmful " + pct(all.harmful, all.n).trim() +
    "   no-parse " + pct(all.noParse, all.n).trim()
  );

  // Did it act when it should have asked, and ask when it should have acted?
  let goldDecline = rows.filter((r) => r.goldDeclines);
  let predDecline = rows.filter((r) => r.predDeclines);
  let hit = rows.filter((r) => r.goldDeclines && r.predDeclines);
  console.log(
    "  declining     recall " + pct(hit.length, goldDecline.length).trim() +
    " (" + hit.length + "/" + goldDecline.length + ")" +
    "   precision " + pct(hit.length, predDecline.length).trim() +
    " (" + hit.length + "/" + predDecline.length + ")"
  );
  console.log(
    "  latency       p50 " + p50.toFixed(0) + "us   p95 " + p95.toFixed(0) +
    "us   total " + result.wallMs.toFixed(0) + "ms"
  );

  if (a.notes) {
    Object.entries(a.notes()).forEach(([k, v]) =>
      console.log("  " + k.padEnd(13) + " " + v)
    );
  }

  breakdown("by tier", result, (i) => i.tier);
  breakdown("by entity", result, (i) => i.strata.entity);
  breakdown("by clauses", result, (i) => String(i.strata.clauses));

  let crashes = rows.filter((r) => r.crashed);
  if (crashes.length > 0) {
    console.log("\n  " + crashes.length + " crash(es):");
    crashes.slice(0, 5).forEach((r) =>
      console.log("    " + r.item.id + ": " + r.crashed)
    );
  }

  if (showErrors) {
    let bad = rows.filter((r) => !r.exactOk);
    console.log("\n  first " + Math.min(40, bad.length) + " of " + bad.length + " misses:");
    bad.slice(0, 40).forEach((r) => {
      let got = r.pred === null ? "(no parse)" : canonical({ c: r.pred.command, a: r.pred.args || {} });
      let want = canonical({ c: r.item.gold.command, a: r.item.gold.args || {} });
      console.log("\n    " + r.item.id + " [" + r.item.tier + "/" + r.item.strata.entity + "] " + JSON.stringify(r.item.utterance));
      console.log("      want " + want);
      console.log("      got  " + got);
    });
  }
}

async function main() {
  let args = process.argv.slice(2);
  let showErrors = args.includes("--errors");
  let wanted = args.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));

  let dir = join(HERE, "approaches");
  let files = readdirSync(dir).filter((f) => /^a\d+[a-z]*-.*\.mjs$/.test(f)).sort();
  let approaches = [];
  for (let file of files) {
    let mod = await import("file://" + join(dir, file));
    let approach = mod.default;
    if (wanted.length === 0 || wanted.includes(approach.id)) approaches.push(approach);
  }
  if (approaches.length === 0) {
    console.log("No approaches matched " + JSON.stringify(wanted));
    process.exit(1);
  }

  let items = loadItems();

  // --limit N takes an evenly spread sample, so a quick run still covers all
  // three tiers rather than just the front of easy.jsonl.
  let limitArg = args.find((a) => a.startsWith("--limit"));
  if (limitArg) {
    let n = Number(limitArg.split("=")[1] || args[args.indexOf(limitArg) + 1]);
    if (n > 0 && n < items.length) {
      let step = items.length / n;
      items = Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]);
    }
  }

  console.log("Evaluating " + approaches.length + " approach(es) over " + items.length + " items.");

  // An approach that needs a model pays for it here, so that download and
  // load time are not charged to per-utterance latency.
  for (let approach of approaches) {
    if (!approach.warmup) continue;
    let started = Date.now();
    process.stdout.write("  warming up " + approach.id + " ... ");
    await approach.warmup(items);
    console.log(((Date.now() - started) / 1000).toFixed(1) + "s");
  }

  let results = approaches.map((a) => score(items, a));
  results.forEach((r) => report(r, showErrors && approaches.length === 1));

  if (results.length > 1) {
    console.log("\n" + "=".repeat(74));
    console.log("SIDE BY SIDE");
    console.log("=".repeat(74));
    let width = Math.max(...results.map((r) => r.approach.id.length), 10);
    console.log("\n  " + "approach".padEnd(width) + "    n   intent    exact   harmful   no-parse");
    console.log("  " + "-".repeat(width + 43));
    results.forEach((r) => console.log(line(r.approach.id, summarise(r.rows), width)));
    ["easy", "medium", "hard"].forEach((tier) => {
      console.log("\n  " + tier);
      results.forEach((r) => {
        let rows = r.rows.filter((x) => x.item.tier === tier);
        console.log(line("  " + r.approach.id, summarise(rows), width));
      });
    });
  }
}

main();
