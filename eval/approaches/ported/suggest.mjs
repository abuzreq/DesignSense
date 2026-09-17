/* GENERATED from src/assistant/suggest.js by the eval harness. Do not edit. */
/**
 * The suggestion engine behind the bar.
 *
 * Text is the source of truth. This module never builds a command: it ranks
 * pre-designed instructions against what has been typed, fills their slots
 * from the data, and hands back strings to insert. Whatever ends up in the
 * input still goes through the parser on Enter, so the guided path and the
 * free-text path converge on the same command.
 *
 * Two phases. In the command phase nothing has been picked: the current word
 * is completed against the instruction vocabulary, the whole text is ranked
 * against every phrasing lexically (BM25) and, when a vector is available,
 * semantically, and any tail already typed past an instruction's head is
 * bound into its slots. In the slot phase an instruction has been picked and
 * the candidates are whatever that slot takes: columns from the table,
 * comparator words, numbers with the column's range, category values, sets.
 *
 * Pure: everything about the app arrives in `context`.
 */

import { TEMPLATES, SLOT_OPTIONS, slots, head, render, preview, vocabulary } from "./templates.mjs";
import { COMPARATORS, tokens, normalizeText, rankColumns, findComparator, parseNumbers } from "./lexicon.mjs";
import * as bm25 from "./bm25.mjs";
import { instructionDocuments, queryInstructions, queryColumns, applyHead, fuse } from "./semantic.mjs";

const LIMIT = 6;
const CONNECTOR = /\s+(?:and|then)\s+|,\s*/i;

/** Fusion weights over [bm25, semantic, head, usage]; set by eval/guided.mjs. */
export const WEIGHTS = { lexical: 1.0, semantic: 1.0, head: 1.0, usage: 0.5 };

const INDEX = bm25.buildIndex(instructionDocuments());
const VOCAB = vocabulary();

/* ------------------------------------------------------------- helpers -- */

function labelOf(column) {
  return String(column).replace(/^(in|out)\s*:\s*/i, "");
}

/** The text a column is inserted as: its normalised name, which the parser resolves. */
function insertName(schema, column) {
  let entry = schema.index.find((e) => e.column === column);
  return entry ? entry.norm : labelOf(column);
}

function columnsOfKind(schema, kind) {
  if (kind === "numeric") return schema.numeric;
  if (kind === "categorical") return schema.columns.filter((c) => !schema.numeric.includes(c));
  return schema.columns;
}

function byPrefix(options, tail) {
  let q = normalizeText(tail);
  if (!q) return options.slice();
  return options.filter((o) => normalizeText(o).startsWith(q));
}

function usageBonus(context, command) {
  let n = (context.usage && context.usage[command]) || 0;
  return n > 0 ? Math.log(1 + n) : 0;
}

/**
 * Columns ranked for a piece of text: the lexicon's phrase / word / trigram
 * scores fused with the encoder's cosine when a vector for the text exists.
 * Returns `[{ column, score, why }]`, best first.
 */
export function rankColumnsFor(context, text, kind) {
  let schema = context.schema;
  let allowed = columnsOfKind(schema, kind);
  let pool = schema.index.filter((e) => allowed.includes(e.column));
  let lexical = rankColumns(pool, tokens(text));

  // What is being typed is usually the start of a name, not a whole word:
  // "pr" is price, "ye" is year. A prefix of the name or of any alias phrase
  // counts below a whole phrase (100) and above a shared word (30).
  let q = normalizeText(text);
  let lastWord = q.split(" ").filter(Boolean).slice(-1)[0] || "";
  if (q) {
    pool.forEach((entry) => {
      let starts = entry.norm.startsWith(q) ||
        entry.phrases.some((p) => p.join(" ").startsWith(q)) ||
        (lastWord.length >= 2 && entry.tokens.some((t) => t.startsWith(lastWord)));
      if (!starts) return;
      let existing = lexical.find((l) => l.column === entry.column);
      if (existing) existing.score = Math.max(existing.score, 50);
      else lexical.push({ column: entry.column, score: 50, matched: null, entry: entry });
    });
    lexical.sort((a, b) => b.score - a.score);
  }
  let vec = context.semantic && context.semantic.vec(text);
  let semantic = vec && context.semantic.index
    ? queryColumns(context.semantic.index, vec, allowed)
    : null;
  if (!semantic) {
    return lexical.map((l) => ({ column: l.column, score: l.score, lexical: l.score, cosine: 0, why: "lexical" }));
  }

  // A phrase match is a certainty the encoder should not outvote; below that
  // the two rankings are peers. The raw lexical score and the cosine travel
  // with each candidate so a caller can judge confidence, not just order.
  let fused = fuse([lexical, semantic], [WEIGHTS.lexical, WEIGHTS.semantic], (x) => x.column);
  return fused.map((f) => {
    let lex = lexical.find((l) => l.column === f.key);
    let sem = semantic.find((s) => s.column === f.key);
    let certain = lex && lex.score >= 100;
    return {
      column: f.key,
      score: certain ? 1 + f.score : f.score,
      lexical: lex ? lex.score : 0,
      cosine: sem ? sem.score : 0,
      why: lex && f.ranks[1] === undefined ? "lexical" : lex ? "both" : "semantic",
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Whether the best column candidate is sure enough to be written into a
 * suggestion unasked. Lexical evidence of a shared word or a near-typo is
 * enough on its own; the encoder alone needs a clear cosine and a clear
 * margin over the runner-up, because short phrases embed noisily. A wrong
 * guess here is a suggestion, not an action.
 */
function confident(ranked) {
  let top = ranked[0];
  if (!top) return false;
  if (top.lexical >= 30) return true;
  let second = ranked.slice(1).reduce((m, r) => Math.max(m, r.cosine || 0), 0);
  return top.cosine >= 0.35 && top.cosine - second >= 0.04;
}

/**
 * The texts a suggestion round would look up vectors for, so the bar can
 * have them encoded before it asks again: the whole text, and the tail past
 * any instruction head it continues ("how old" in "sort by how old"), or
 * past the accepted part in the slot phase.
 */
export function vectorQueries(text, active) {
  let t = String(text || "").trim();
  let norm = normalizeText(t);
  let out = new Set();
  if (active) {
    let base = normalizeText((active.prefixText || "") + render(active.template, active.filled)).trim();
    let tail = norm.startsWith(base) ? norm.slice(base.length).trim() : norm;
    if (tail.length >= 2) out.add(tail);
    return Array.from(out);
  }
  if (norm.length >= 4) out.add(t);
  TEMPLATES.forEach((template) => {
    let h = normalizeText(head(template));
    if (h && norm.startsWith(h) && norm.length > h.length + 1) {
      let tail = norm.slice(h.length).trim();
      if (tail.length >= 2) out.add(tail);
    }
  });
  return Array.from(out);
}

/* -------------------------------------------------------- tail binding -- */

/** Every comparator phrase in the text, left to right, longest phrase winning where they overlap. */
function comparatorsIn(text) {
  let padded = " " + normalizeText(text) + " ";
  let found = [];
  COMPARATORS.forEach((entry) => {
    entry.words.forEach((word) => {
      let at = padded.indexOf(" " + word + " ");
      while (at >= 0) {
        found.push({ op: entry.op, word: word, index: at });
        at = padded.indexOf(" " + word + " ", at + 1);
      }
    });
  });
  found.sort((a, b) => a.index - b.index || b.word.length - a.word.length);
  let out = [];
  found.forEach((f) => {
    let last = out[out.length - 1];
    if (last && f.index <= last.index + last.word.length) return;
    out.push(f);
  });
  return out;
}

/**
 * Reads as many of a template's slots as the text already states, in order,
 * and stops at the first it cannot. "filter pr" binds nothing but knows the
 * next slot is the column; "filter price under" binds the column and the
 * comparator; "only the pricey ones" binds Price semantically and leaves the
 * value open. Returns the filled values.
 */
function bindTail(context, template, text) {
  let filled = [];
  let tail = text;
  let h = head(template);
  let norm = normalizeText(text);
  if (h && norm.startsWith(normalizeText(h))) tail = norm.slice(normalizeText(h).length);
  let numbers = parseNumbers(tail);
  let dimChosen = null;
  // "under 5000 or over 20000" states two comparators: the second op slot
  // takes the second one, not "under" again.
  let comparators = comparatorsIn(tail);
  let opsBound = 0;

  for (let slot of slots(template)) {
    let value = null;
    let t = tokens(tail);
    if (slot.slot === "dim") {
      let ranked = rankColumnsFor(context, tail, slot.kind).filter(
        (r) => r.column !== dimChosen
      );
      let top = ranked[0];
      if (confident(ranked)) {
        value = insertName(context.schema, top.column);
        dimChosen = top.column;
      }
    } else if (slot.slot === "op") {
      let c = comparators[opsBound] || (opsBound === 0 ? findComparator(tail) : null);
      // A second comparison that brings a column of its own ("... or year
      // over 2010") is not this template's second range on the same column:
      // leave the slot open rather than offer a reading that drops the word.
      if (c && opsBound > 0) {
        let previous = comparators[opsBound - 1];
        let between = (" " + normalizeText(tail) + " ").slice(
          previous.index + previous.word.length,
          c.index
        );
        if (confident(rankColumnsFor(context, between, null))) c = null;
      }
      if (c) {
        value = c.word;
        opsBound++;
      }
    } else if (slot.slot === "value") {
      let n = numbers.find((x) => !x.percent && !filled.includes(x.raw));
      if (n) value = n.raw;
    } else if (slot.slot === "k" || slot.slot === "n" || slot.slot === "percent") {
      let n = numbers[0];
      if (n) value = String(n.value);
    } else if (slot.slot === "values") {
      let list = (context.schema.values || {})[dimChosen] || [];
      let hit = list.find((v) => t.includes(v) || t.includes(v + "s"));
      if (hit) value = hit;
    } else if (SLOT_OPTIONS[slot.slot]) {
      let hit = SLOT_OPTIONS[slot.slot].find((o) => norm.includes(normalizeText(o)));
      if (hit) value = hit;
    } else if (slot.slot === "set") {
      let hit = (context.sets || []).find((s) => norm.includes(normalizeText(s)));
      if (hit) value = hit;
    }
    if (value === null) break;
    filled.push(value);
  }
  return filled;
}

/* -------------------------------------------------------- command phase -- */

/** The parser's reading of a text, or null when it would not act on it. */
function readingOf(context, text) {
  if (!context.parse || !String(text).trim()) return null;
  try {
    let result = context.parse(String(text).trim());
    return result && result.command !== "clarify" && result.command !== "abstain" ? result : null;
  } catch (e) {
    return null;
  }
}

/**
 * Whether the text after the last connector starts a new instruction, or is
 * the second half of a phrase ("between year and price"). The tail is a new
 * instruction when the whole reads as a sequence, or when the text before
 * the connector already reads as exactly what the whole reads as -- the
 * tail added nothing to it. When the tail changed the reading, it belongs.
 */
function tailIsNewInstruction(context, whole, before) {
  let all = readingOf(context, whole);
  if (!all || all.command === "sequence") return true;
  let head = readingOf(context, before);
  return !!head && JSON.stringify(head) === JSON.stringify(all);
}

function commandPhase(context, segment, prefixText, whole) {
  let text = segment.trim();
  let norm = normalizeText(text);
  let items = [];

  // 1. The parser's own reading of the whole sentence, when it can act on it.
  //    Always the whole: a chained sentence shows its sequence, and a phrase
  //    with an "and" inside shows the one command it is.
  let wholeText = String(whole === undefined ? prefixText + segment : whole).trim();
  if (wholeText) {
    let result = readingOf(context, wholeText);
    if (result) {
      items.push({
        label: context.describe ? context.describe(result) : result.command,
        hint: "Enter to run",
        insert: wholeText,
        result: result,
        command: result.command,
        template: null,
        filled: null,
        complete: true,
        why: "parser",
      });
    }
  }

  // 2. Rank commands: prefix on the current word, BM25 over every phrasing,
  //    the encoder and the intent head when a vector exists, and usage.
  let words = norm.split(" ").filter(Boolean);
  let last = words.length ? words[words.length - 1] : "";
  let endsInWord = last && !/\s$/.test(text);

  // BM25 with trigrams scores nearly everything a little; keep only what is
  // within reach of the best match, or the list fills with noise.
  let ranked = norm ? bm25.rank(INDEX, norm).filter((r) => r.score > 0) : [];
  let lexical = ranked.filter((r) => ranked.length && r.score >= 0.5 * ranked[0].score);
  let vec = norm.length >= 4 && context.semantic ? context.semantic.vec(text) : null;
  let semantic = vec && context.semantic.index ? queryInstructions(context.semantic.index, vec) : null;
  let headRank = vec && context.semantic.head ? applyHead(context.semantic.head, vec) : null;
  let fused = fuse(
    [lexical, semantic, headRank],
    [WEIGHTS.lexical, WEIGHTS.semantic, WEIGHTS.head],
    (x) => x.label
  );
  let commandScore = new Map(fused.map((f) => [f.key, f.score]));
  let commandWhy = new Map(
    fused.map((f) => [f.key, f.ranks[1] !== undefined || f.ranks[2] !== undefined ? (f.ranks[0] !== undefined ? "both" : "semantic") : "lexical"])
  );

  let scored = TEMPLATES.map((template) => {
    let h = normalizeText(head(template));
    let score = 0;
    let why = null;

    // Prefix: the whole text is the start of this head ("keep the t"), or the
    // current word starts one of its keywords ("f" for filter).
    if (norm && h && h.startsWith(norm) && h !== norm) { score += 3; why = "prefix"; }
    else if (endsInWord && words.length === 1) {
      let keys = (template.keywords || []).map((k) => normalizeText(k).split(" ")[0]);
      if (h.split(" ")[0].startsWith(last)) { score += 2.5; why = "prefix"; }
      else if (keys.some((k) => k.startsWith(last))) { score += 1.5; why = "prefix"; }
    }
    // Head already typed in full: this template is the one being continued.
    if (norm && h && norm.startsWith(h)) { score += 2.5; why = why || "prefix"; }

    let cs = commandScore.get(template.command) || 0;
    if (cs > 0) {
      score += cs * 40; // rrf scores are ~1/60 per list; bring them to the prefix scale
      why = why || commandWhy.get(template.command);
    }
    // A keyword present anywhere picks the phrasing within a command
    // ("bottom" chooses the bottom-k template over the top-k one).
    if (norm && (template.keywords || []).some((k) => norm.includes(normalizeText(k)))) score += 0.5;
    score += WEIGHTS.usage * usageBonus(context, template.command) * 0.3;
    return { template: template, score: score, why: why };
  }).filter((s) => s.score > 0 || !norm);

  if (!norm) {
    // Empty box: the most used instructions, then the natural first few.
    scored.sort((a, b) =>
      usageBonus(context, b.template.command) - usageBonus(context, a.template.command)
    );
  } else {
    scored.sort((a, b) => b.score - a.score);
  }

  let seen = new Set();

  // An instruction whose head is typed in full is being continued, not
  // chosen: what comes next is its slot's candidates, ahead of alternatives.
  let continuing = scored
    .filter((s) => norm && head(s.template) && norm.startsWith(normalizeText(head(s.template))) && slots(s.template).length)
    .sort((a, b) => normalizeText(head(b.template)).length - normalizeText(head(a.template)).length || b.score - a.score)[0];
  if (continuing) {
    let filled = bindTail(context, continuing.template, text);
    let filledText = normalizeText(render(continuing.template, filled)).trim();
    let boundAll = filled.length === slots(continuing.template).length;
    // Only while the typed text does not run past what is bound; otherwise the
    // person is typing the slot themselves and the command list stands.
    if (!boundAll && norm.startsWith(filledText)) {
      let sp = slotPhase(context, { template: continuing.template, filled: filled, prefixText: prefixText }, text, prefixText);
      sp.items.forEach((item) => {
        if (items.length >= LIMIT || seen.has(item.insert)) return;
        seen.add(item.insert);
        items.push(item);
      });
    }
  }

  for (let s of scored) {
    if (items.length >= LIMIT) break;
    let template = s.template;
    let filled = norm ? bindTail(context, template, text) : [];
    let insert = prefixText + render(template, filled);
    if (seen.has(insert)) continue;
    seen.add(insert);
    let complete = filled.length === slots(template).length;
    // The parser item already covers a fully bound, parseable sentence.
    if (complete && items.some((i) => i.why === "parser" && i.command === template.command)) continue;
    items.push({
      label: preview(template, filled),
      hint: complete ? "Enter to run" : "Tab to fill in",
      insert: insert,
      command: template.command,
      template: template,
      filled: filled,
      complete: complete,
      why: s.why || "usage",
    });
  }
  return { items: items, active: null, slot: null };
}

/* ----------------------------------------------------------- slot phase -- */

function slotPhase(context, active, text, prefixText) {
  let template = active.template;
  let filled = active.filled;
  let all = slots(template);
  let slot = all[filled.length];
  let base = render(template, filled);
  let norm = normalizeText(text);
  let baseNorm = normalizeText(base);

  // The person edited the accepted part: back to the command phase.
  if (!slot || !norm.startsWith(baseNorm.trim())) return commandPhase(context, text, prefixText);
  let tail = norm.slice(baseNorm.trim().length).trim();

  let candidates = [];
  let dimFilled = null;
  all.forEach((s, i) => { if (s.slot === "dim" && i < filled.length && !dimFilled) dimFilled = filled[i]; });
  let dimColumn = dimFilled
    ? (context.schema.index.find((e) => e.norm === dimFilled) || {}).column
    : null;

  if (slot.slot === "dim") {
    let exclude = filled.filter((f, i) => all[i].slot === "dim");
    let ranked = tail
      ? rankColumnsFor(context, tail, slot.kind)
      : columnsOfKind(context.schema, slot.kind).map((c) => ({ column: c, why: "all" }));
    ranked.filter((r) => !exclude.includes(insertName(context.schema, r.column))).slice(0, LIMIT).forEach((r) => {
      candidates.push({ label: labelOf(r.column), value: insertName(context.schema, r.column), why: r.why });
    });
  } else if (slot.slot === "value") {
    let extent = dimColumn && context.extents ? context.extents[dimColumn] : null;
    let typed = parseNumbers(tail)[0];
    if (typed) candidates.push({ label: typed.raw, value: typed.raw, why: "typed" });
    if (extent) {
      [["min", extent[0]], ["median", extent[1]], ["max", extent[2]]].forEach(([name, v]) => {
        if (v === undefined || v === null || !Number.isFinite(Number(v))) return;
        let s = String(+Number(v).toPrecision(4));
        if (typed && typed.raw === s) return;
        candidates.push({ label: s + "  (" + name + ")", value: s, why: "range" });
      });
    }
  } else if (slot.slot === "values") {
    let list = dimColumn ? ((context.schema.values || {})[dimColumn] || []) : [];
    let q = normalizeText(tail);
    let hits = q ? list.filter((v) => v.includes(q)) : list;
    if (q && hits.length === 0) hits = list.filter((v) => tokens(v).some((w) => w.startsWith(q)));
    hits.slice(0, LIMIT).forEach((v) => candidates.push({ label: v, value: v, why: q ? "prefix" : "all" }));
  } else if (slot.slot === "set") {
    byPrefix(context.sets || [], tail).slice(0, LIMIT).forEach((s) =>
      candidates.push({ label: s, value: s, why: "all" })
    );
  } else if (SLOT_OPTIONS[slot.slot]) {
    byPrefix(SLOT_OPTIONS[slot.slot], tail).slice(0, LIMIT).forEach((o) =>
      candidates.push({ label: o, value: o, why: tail ? "prefix" : "all" })
    );
  } else if (slot.slot === "name") {
    if (tail) candidates.push({ label: tail, value: tail, why: "typed" });
  }

  let items = candidates.map((c) => {
    let next = filled.concat([c.value]);
    let complete = next.length === all.length;
    return {
      label: preview(template, next),
      candidate: c.label,
      hint: complete ? "Enter to run" : "Tab for the next part",
      insert: prefixText + render(template, next),
      command: template.command,
      template: template,
      filled: next,
      complete: complete,
      why: c.why,
    };
  });
  return {
    items: items,
    active: active,
    slot: { name: slot.slot, kind: slot.kind, index: filled.length, count: all.length, names: all.map((s) => s.slot) },
  };
}

/* ---------------------------------------------------------------- entry -- */

/**
 * `suggest(text, active, context)` → `{ items, active, slot }`.
 *
 * `active` is `{ template, filled }` while an instruction is being filled, or
 * null. `context` is `{ schema, extents, sets, usage, semantic, parse,
 * describe }`; `semantic` is null until an encoder is ready and then
 * `{ vec(text), index, head }` where `vec` returns a cached vector or null.
 */
export function suggest(text, active, context) {
  let raw = String(text || "");
  // A connector after a finished instruction starts another one; everything
  // before it is kept verbatim and prefixed to every insert.
  let prefixText = "";
  let segment = raw;
  if (!active) {
    let m;
    let re = new RegExp(CONNECTOR.source, "gi");
    let lastStart = -1;
    let lastEnd = -1;
    while ((m = re.exec(raw)) !== null) {
      lastStart = m.index;
      lastEnd = m.index + m[0].length;
    }
    if (lastEnd > 0 && tailIsNewInstruction(context, raw, raw.slice(0, lastStart))) {
      prefixText = raw.slice(0, lastEnd);
      segment = raw.slice(lastEnd);
    }
  } else if (active.prefixText) {
    prefixText = active.prefixText;
    segment = raw.startsWith(prefixText) ? raw.slice(prefixText.length) : raw;
  }

  let out = active
    ? slotPhase(context, active, segment, prefixText)
    : commandPhase(context, segment, prefixText, raw);
  out.items.forEach((item) => { item.prefixText = prefixText; });
  return out;
}

/** What `active` becomes after accepting an item. Null once the instruction is complete. */
export function accept(item) {
  if (!item.template || item.complete) return null;
  return { template: item.template, filled: item.filled, prefixText: item.prefixText || "" };
}

export { VOCAB as VOCABULARY };
