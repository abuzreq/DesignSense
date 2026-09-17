/* GENERATED from src/assistant/composition.js by the eval harness. Do not edit. */
/*
 * Ported from eval/approaches/, which is where this parser was measured.
 * See eval/README.md: this is the A1C configuration (grammar + composition,
 * no model) with the intent-ranking seam left open for the encoder.
 *
 * The one structural change: the eval looks a dataset up by name from a table
 * of headers, while the app has whatever CSV was loaded, so everything here
 * takes a `schema` built by schema.js from the live store.
 */

import { MAX_WORDS, MIN_WORDS, tokens } from "./lexicon.mjs";

/* ------------------------------------------------------------------ spans -- */

/** Equal, or equal but for a trailing plural: "cylinder" reaches "cylinders". */
function sameWord(a, b) {
  return a === b || a === b + "s" || a + "s" === b;
}

function runAt(haystack, needle, start) {
  if (start + needle.length > haystack.length) return false;
  for (let i = 0; i < needle.length; i++) {
    if (!sameWord(haystack[start + i], needle[i])) return false;
  }
  return true;
}

function containsRun(haystack, needle) {
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (runAt(haystack, needle, i)) return true;
  }
  return false;
}

/**
 * Every column the utterance names, as non-overlapping spans, longest match
 * winning. A span that several columns claim equally is marked ambiguous and
 * carries its candidates, so the caller can ask instead of picking.
 */
export function columnMentions(schema, toks) {
  let index = schema.index;
  let hits = [];
  for (let entry of index) {
    for (let phrase of entry.phrases) {
      for (let at = 0; at + phrase.length <= toks.length; at++) {
        if (runAt(toks, phrase, at)) {
          hits.push({
            column: entry.column,
            start: at,
            end: at + phrase.length,
            length: phrase.length,
            phrase: phrase,
            exactName: phrase.join(" ") === entry.norm,
          });
        }
      }
    }
  }
  if (hits.length === 0) return [];

  hits.sort((a, b) => b.length - a.length || a.start - b.start);
  let taken = [];
  let used = new Set();
  for (let hit of hits) {
    let clash = false;
    for (let i = hit.start; i < hit.end; i++) if (used.has(i)) clash = true;
    if (clash) continue;

    // Columns claiming exactly this span, and columns whose own name merely
    // contains what was said -- the "floor area" / "floor area small" case.
    let rivals = hits.filter(
      (other) =>
        other.column !== hit.column && other.start === hit.start && other.end === hit.end
    );
    let broader = hit.exactName
      ? []
      : index.filter(
          (entry) =>
            entry.column !== hit.column &&
            entry.phrases.some((p) => p.length > hit.length && containsRun(p, hit.phrase))
        );

    let candidates = [hit.column]
      .concat(rivals.map((r) => r.column))
      .concat(broader.map((b) => b.column));
    candidates = Array.from(new Set(candidates));

    taken.push({
      column: hit.column,
      start: hit.start,
      end: hit.end,
      ambiguous: candidates.length > 1 ? candidates : null,
    });
    for (let i = hit.start; i < hit.end; i++) used.add(i);
  }
  return taken.sort((a, b) => a.start - b.start);
}

const SCALES = { k: 1e3, m: 1e6, b: 1e9, grand: 1e3, thousand: 1e3, million: 1e6, billion: 1e9 };

/** Numbers with their token position, scale applied, percentages flagged. */
export function numberMentions(toks) {
  let out = [];
  for (let i = 0; i < toks.length; i++) {
    let match = toks[i].match(/^(-?\d+(?:\.\d+)?)(k|m|b|%)?$/);
    if (!match) continue;
    let value = parseFloat(match[1]);
    let percent = match[2] === "%";
    if (match[2] && SCALES[match[2]]) value *= SCALES[match[2]];
    let end = i + 1;
    // A scale word can also be the next token: "9 million", "5 grand".
    if (!match[2] && i + 1 < toks.length) {
      let next = toks[i + 1];
      if (SCALES[next]) {
        value *= SCALES[next];
        end = i + 2;
      } else if (next === "percent") {
        percent = true;
        end = i + 2;
      }
    }
    out.push({ value: value, percent: percent, start: i, end: end });
    i = end - 1;
  }
  return out;
}

const COMPARATOR_PHRASES = [
  [["between"], "between"],
  [["at", "least"], "gte"], [["no", "less", "than"], "gte"], [["minimum", "of"], "gte"],
  [["at", "most"], "lte"], [["no", "more", "than"], "lte"], [["maximum", "of"], "lte"],
  [["greater", "than"], "gte"], [["more", "than"], "gte"], [["higher", "than"], "gte"],
  [["bigger", "than"], "gte"], [["larger", "than"], "gte"], [["newer", "than"], "gte"],
  [["taller", "than"], "gte"], [["above"], "gte"], [["over"], "gte"], [["exceeds"], "gte"],
  [["less", "than"], "lte"], [["lower", "than"], "lte"], [["smaller", "than"], "lte"],
  [["cheaper", "than"], "lte"], [["older", "than"], "lte"], [["below"], "lte"],
  [["under"], "lte"], [["beneath"], "lte"],
  [["after"], "gte"], [["since"], "gte"], [["before"], "lte"],
  [["equal", "to"], "eq"], [["equals"], "eq"], [["exactly"], "eq"],
];

export function comparatorMentions(toks) {
  let out = [];
  let used = new Set();
  let ordered = COMPARATOR_PHRASES.slice().sort((a, b) => b[0].length - a[0].length);
  for (let [phrase, op] of ordered) {
    for (let at = 0; at + phrase.length <= toks.length; at++) {
      if (!runAt(toks, phrase, at)) continue;
      let clash = false;
      for (let i = at; i < at + phrase.length; i++) if (used.has(i)) clash = true;
      if (clash) continue;
      out.push({ op: op, start: at, end: at + phrase.length });
      for (let i = at; i < at + phrase.length; i++) used.add(i);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/* --------------------------------------------------------------- binding -- */

/** The first unclaimed mention at or after a position: "sorted by <column>". */
function nextAfter(mentions, claimed, at) {
  for (let mention of mentions) {
    if (claimed.has(mention)) continue;
    if (mention.start >= at) return mention;
  }
  return null;
}

/** Nearest unclaimed mention to a span, preferring one that comes before it. */
function nearest(mentions, claimed, at, window) {
  let best = null;
  let bestCost = Infinity;
  for (let mention of mentions) {
    if (claimed.has(mention)) continue;
    let distance =
      mention.end <= at ? at - mention.end : mention.start - at;
    if (distance < 0) distance = 0;
    if (window !== undefined && distance > window) continue;
    // A tie goes to the mention already spoken, which is the usual word order.
    let cost = distance * 2 + (mention.start > at ? 1 : 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = mention;
    }
  }
  return best;
}

const ACTION_VERBS = [
  { words: [["sort"], ["sorted"], ["order"], ["arrange"], ["rank"]], kind: "sort" },
  { words: [["color"], ["colour"], ["shade"], ["tint"]], kind: "color" },
  { words: [["save"], ["bookmark"]], kind: "save" },
  { words: [["zoom"]], kind: "zoom" },
  { words: [["cluster"], ["clusters"]], kind: "cluster" },
];

function findVerb(toks, kind) {
  for (let group of ACTION_VERBS) {
    if (group.kind !== kind) continue;
    for (let phrase of group.words) {
      for (let at = 0; at + phrase.length <= toks.length; at++) {
        if (runAt(toks, phrase, at)) return at;
      }
    }
  }
  return -1;
}

const FILTERS = ["filter.range", "filter.categorical"];
const RANKS = ["filter.topk", "filter.percentile"];
const SCOPES = ["scope.zoom", "scope.exclude"];

/**
 * A rank is over the filtered set and a zoom over the current result, so those
 * follow the filters whatever order they were said in. Everything else keeps
 * the order it was spoken.
 */
function orderSteps(steps) {
  let pick = (test) => steps.filter(test);
  return pick((s) => FILTERS.includes(s.command))
    .concat(pick((s) => RANKS.includes(s.command)))
    .concat(pick((s) => SCOPES.includes(s.command)))
    .concat(pick((s) => !FILTERS.concat(RANKS, SCOPES).includes(s.command)));
}

/* ---------------------------------------------------------------- parser -- */

/**
 * Returns a sequence when the utterance holds two or more operations, a
 * clarify when a column it needs is ambiguous, and null when there is nothing
 * compound here — leaving single-operation utterances to the existing shapes.
 */
export function parseCompound(utterance, schema) {
  let toks = tokens(utterance);
  if (toks.length === 0) return null;

  let mentions = columnMentions(schema, toks);
  let numbers = numberMentions(toks);
  let comparators = comparatorMentions(toks);
  let claimedMentions = new Set();
  let claimedNumbers = new Set();
  let steps = [];
  let ambiguous = null;

  function claim(mention) {
    if (!mention) return null;
    // A candidate the user already picked settles the ambiguity.
    if (mention.ambiguous && schema.prefer && mention.ambiguous.indexOf(schema.prefer) >= 0) {
      return schema.prefer;
    }
    if (mention.ambiguous && !ambiguous) ambiguous = mention.ambiguous;
    claimedMentions.add(mention);
    return mention.column;
  }

  // --- actions first, so they take the column they name ---------------------
  let sortAt = findVerb(toks, "sort");
  let sortStep = null;
  if (sortAt >= 0) {
    let mention = nextAfter(mentions, claimedMentions, sortAt) ||
      nearest(mentions, claimedMentions, sortAt, 6);
    if (mention) {
      let args = { dim: claim(mention) };
      if (toks.includes("descending") || toks.includes("desc")) args.desc = true;
      else if (toks.includes("ascending") || toks.includes("asc")) args.desc = false;
      sortStep = { command: "view.sort", args: args, at: sortAt };
    }
  }

  let colorAt = findVerb(toks, "color");
  let colorStep = null;
  if (colorAt >= 0) {
    let mention = nextAfter(mentions, claimedMentions, colorAt) ||
      nearest(mentions, claimedMentions, colorAt, 6);
    if (mention) {
      colorStep = { command: "view.color", args: { dim: claim(mention) }, at: colorAt };
    }
  }

  let axesArgs = {};
  ["x", "y"].forEach((axis) => {
    let at = toks.indexOf(axis);
    if (at < 0) {
      at = toks.indexOf(axis === "x" ? "horizontal" : "vertical");
    }
    if (at < 0) return;
    let mention = nearest(mentions, claimedMentions, at, 6);
    if (mention) axesArgs[axis] = claim(mention);
  });
  let axesStep = Object.keys(axesArgs).length
    ? { command: "view.axes", args: axesArgs, at: toks.indexOf("on") }
    : null;

  let saveAt = findVerb(toks, "save");
  let saveStep = null;
  if (saveAt >= 0) {
    let named = utterance.match(/\bas\s+([A-Za-z0-9][\w #]*?)\s*$/);
    saveStep = {
      command: "set.create",
      args: named ? { name: named[1].trim() } : {},
      at: saveAt,
    };
  }

  let zoomAt = findVerb(toks, "zoom");
  let zoomStep = zoomAt >= 0 ? { command: "scope.zoom", args: {}, at: zoomAt } : null;

  let clusterAt = findVerb(toks, "cluster");
  let clusterStep = null;
  if (clusterAt >= 0) {
    let number = numbers.find((n) => !claimedNumbers.has(n) && !n.percent && n.start > clusterAt);
    if (number) claimedNumbers.add(number);
    clusterStep = {
      command: "analysis.cluster",
      args: number ? { k: number.value } : {},
      at: clusterAt,
    };
  }

  // --- comparator-bound ranges ---------------------------------------------
  // "exclude the ones below 0.35" keeps what is at or above it.
  let flips = /\bexclude\b|\bdrop\b|\bget rid of\b|\bwithout\b/.test(utterance.toLowerCase());

  for (let comparator of comparators) {
    let number = numbers.find((n) => !claimedNumbers.has(n) && n.start >= comparator.end);
    if (!number) continue;
    let second = comparator.op === "between"
      ? numbers.find((n) => !claimedNumbers.has(n) && n !== number && n.start >= number.end)
      : null;
    if (comparator.op === "between" && !second) continue;
    let op = comparator.op;
    if (flips && (op === "gte" || op === "lte")) op = op === "gte" ? "lte" : "gte";
    let clause = op === "between"
      ? { op: "between", range: [number.value, second.value] }
      : { op: op, value: number.value };

    // "under 5000 or over 20000": a comparison introduced by "or" extends the
    // range before it instead of binding a column of its own. An "or" onto
    // another column ("or year over 2010") is not one filter, and not a
    // compound this composes: the single-clause parser says so.
    let named = mentions.find((m) => m.end === comparator.start);
    let orAt = (named ? named.start : comparator.start) - 1;
    if (orAt >= 0 && toks[orAt] === "or") {
      let previous = steps[steps.length - 1];
      if (named || !previous || previous.command !== "filter.range") return null;
      if (flips) {
        // Excluding "under a or over b" keeps between a and b, or nothing composable.
        let low = previous.args.op === "gte" ? previous.args : clause.op === "gte" ? clause : null;
        let high = previous.args.op === "lte" ? previous.args : clause.op === "lte" ? clause : null;
        if (previous.args.op === "any" || !low || !high || low.value > high.value) return null;
        previous.args = { dim: previous.args.dim, op: "between", range: [low.value, high.value] };
      } else {
        if (previous.args.op !== "any") {
          let first = previous.args.op === "between"
            ? { op: "between", range: previous.args.range }
            : { op: previous.args.op, value: previous.args.value };
          previous.args = { dim: previous.args.dim, op: "any", clauses: [first] };
        }
        previous.args.clauses.push(clause);
      }
      claimedNumbers.add(number);
      if (second) claimedNumbers.add(second);
      continue;
    }

    // "under 100k miles" puts the column after the quantity, "price under
    // 10000" puts it before. A mention sitting immediately after the number is
    // the head noun of the phrase and beats anything merely nearby.
    let mention =
      mentions.find((m) => !claimedMentions.has(m) && m.start === number.end) ||
      nearest(mentions, claimedMentions, comparator.start, 8);
    if (!mention) continue;

    claimedNumbers.add(number);
    if (second) claimedNumbers.add(second);
    steps.push({
      command: "filter.range",
      args: Object.assign({ dim: claim(mention) }, clause),
      at: comparator.start,
    });
  }

  // --- rank: a direction word and a count, with no comparator on it ---------
  let direction = null;
  let directionAt = -1;
  toks.forEach((token, i) => {
    if (direction) return;
    if (MIN_WORDS.includes(token)) { direction = "min"; directionAt = i; }
    else if (MAX_WORDS.includes(token)) { direction = "max"; directionAt = i; }
  });
  if (direction) {
    // A number sitting right after a comparator belongs to that comparator,
    // not to the rank: in "width under 40, keep the 20 cheapest" only 20 is
    // free. Among what is left, the one nearest the direction word wins.
    let spoken = new Set();
    comparators.forEach((comparator) => {
      let owned = numbers.find((num) => num.start === comparator.end);
      if (owned) spoken.add(owned);
    });
    let free = numbers.filter((num) => !claimedNumbers.has(num) && !spoken.has(num));
    let number = free.sort(
      (a, b) => Math.abs(a.start - directionAt) - Math.abs(b.start - directionAt)
    )[0];
    if (number) {
      let mention = nearest(mentions, claimedMentions, directionAt, 8);
      if (mention) {
        claimedNumbers.add(number);
        steps.push({
          command: number.percent ? "filter.percentile" : "filter.topk",
          args: number.percent
            ? {
                dim: claim(mention),
                percent: number.value,
                direction: direction === "min" ? "bottom" : "top",
              }
            : { dim: claim(mention), k: number.value, direction: direction },
          at: directionAt,
        });
      }
    }
  }

  // --- "4 cylinder": a number sitting against a column, with no comparator --
  for (let number of numbers) {
    if (claimedNumbers.has(number) || number.percent) continue;
    let mention = mentions.find(
      (m) => !claimedMentions.has(m) && (m.start === number.end || m.end === number.start)
    );
    if (!mention) continue;
    claimedNumbers.add(number);
    steps.push({
      command: "filter.range",
      args: { dim: claim(mention), op: "eq", value: number.value },
      at: number.start,
    });
  }

  // --- categorical values, from what the data actually contains -------------
  let table = schema.values;
  let negated = /\bnot\b|anything but|get rid of|\bexclude\b|without|except/.test(
    utterance.toLowerCase()
  );
  for (let dim of Object.keys(table)) {
    let values = table[dim].filter(
      (v) => toks.includes(v) || toks.includes(v + "s")
    );
    if (values.length === 0) continue;
    let at = toks.findIndex((t) => values.includes(t) || values.includes(t.replace(/s$/, "")));
    steps.push({
      command: "filter.categorical",
      args: { dim: dim, values: values, op: negated ? "not_in" : "in" },
      at: at < 0 ? toks.length : at,
    });
  }

  // --- assemble -------------------------------------------------------------
  steps.sort((a, b) => a.at - b.at);
  [sortStep, colorStep, axesStep, saveStep, zoomStep, clusterStep].forEach((step) => {
    if (step) steps.push(step);
  });

  if (steps.length < 2) return null;
  if (ambiguous) return { command: "clarify", args: { slot: "dim", candidates: ambiguous } };

  let ordered = orderSteps(steps).map((s) => ({ command: s.command, args: s.args }));
  return { command: "sequence", args: { steps: ordered } };
}
