import { makeEmbeddedApproach } from "./embedded-parser.mjs";

/**
 * A3 - all-MiniLM-L6-v2 int8 (~23 MB, 384 dims), six transformer layers.
 *
 * The conventional answer. The question this run settles is whether it earns
 * its download over A1G and A2 on these datasets, where most of the entity
 * difficulty is abbreviations no encoder has a useful vector for.
 */
export default makeEmbeddedApproach({
  id: "a3",
  name: "A1G with all-MiniLM-L6-v2 embeddings",
  kind: "minilm",
  rankScale: 30,
  columnFloor: 0.45,
  columnMargin: 0.05,
  useColumns: true,
});
