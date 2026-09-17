/**
 * BM25 over a small corpus of example phrasings, with word and character
 * trigram features.
 *
 * The corpus is a few hundred short strings, so brute force is the right
 * index: ranking every command takes microseconds and there is nothing to
 * tune, cache or ship. Anything described as a vector database at this size is
 * machinery pretending to be capability.
 */

const K1 = 1.2;
const B = 0.75;

function words(s) {
  return String(s).toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean);
}

function trigrams(s) {
  let padded = " " + String(s).toLowerCase().replace(/\s+/g, " ") + " ";
  let out = [];
  for (let i = 0; i + 3 <= padded.length; i++) out.push("_" + padded.slice(i, i + 3));
  return out;
}

/** Words carry the meaning; trigrams carry the typo tolerance. */
function features(s) {
  return words(s).concat(trigrams(s));
}

export function buildIndex(documents) {
  let docs = documents.map((d) => {
    let terms = features(d.text);
    let counts = new Map();
    terms.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
    return { label: d.label, counts: counts, length: terms.length };
  });

  let df = new Map();
  docs.forEach((d) => d.counts.forEach((_, term) => df.set(term, (df.get(term) || 0) + 1)));

  let avgLength = docs.reduce((sum, d) => sum + d.length, 0) / Math.max(1, docs.length);
  let n = docs.length;
  let idf = new Map();
  df.forEach((count, term) => {
    idf.set(term, Math.log(1 + (n - count + 0.5) / (count + 0.5)));
  });

  return { docs: docs, idf: idf, avgLength: avgLength };
}

/** Labels ranked by the best-scoring example under each, highest first. */
export function rank(index, query) {
  let terms = features(query);
  let best = new Map();

  for (let doc of index.docs) {
    let score = 0;
    for (let term of terms) {
      let tf = doc.counts.get(term);
      if (!tf) continue;
      let idf = index.idf.get(term) || 0;
      let norm = 1 - B + (B * doc.length) / index.avgLength;
      score += idf * ((tf * (K1 + 1)) / (tf + K1 * norm));
    }
    if (score > (best.get(doc.label) || 0)) best.set(doc.label, score);
  }

  return Array.from(best.entries())
    .map(([label, score]) => ({ label: label, score: score }))
    .sort((a, b) => b.score - a.score);
}
