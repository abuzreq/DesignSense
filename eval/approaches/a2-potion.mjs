import { makeEmbeddedApproach } from "./embedded-parser.mjs";

/**
 * A2 - static embeddings (model2vec / potion-base-8M, 30 MB, 256 dims).
 *
 * No transformer forward pass: the sentence vector is a mean over a lookup
 * table. If this closes most of the gap to MiniLM it is the better trade, at
 * a fraction of the download and roughly free at query time.
 */
export default makeEmbeddedApproach({
  id: "a2",
  name: "A1G with potion static embeddings",
  kind: "potion",
  rankScale: 60,
  columnFloor: 0.25,
  columnMargin: 0.05,
  useColumns: true,
});
