/**
 * A1C — A1G with predicate-level compound parsing. No model.
 *
 * Isolates the composition change from the encoder: everything else is A1G, so
 * the difference against A1G is this and only this.
 */

import { makeParser } from "./a1-grammar.mjs";

export default {
  id: "a1c",
  name: "A1G plus predicate-level composition",
  parse: makeParser({ guarded: true, compose: true }),
};
