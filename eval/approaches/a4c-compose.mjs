/**
 * A4C — A4 with predicate-level compound parsing.
 *
 * The two independent gains stacked: the encoder for intent, the predicate
 * binder for composition.
 */

import { makeEmbeddedApproach } from "./embedded-parser.mjs";

export default makeEmbeddedApproach({
  id: "a4c",
  name: "A4 plus predicate-level composition",
  kind: "minilm",
  head: "logreg",
  compose: true,
  rankScale: 30,
  columnFloor: 0.45,
  columnMargin: 0.05,
  useColumns: true,
});
