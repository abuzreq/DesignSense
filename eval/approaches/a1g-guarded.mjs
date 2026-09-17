/**
 * A1G — A1 with the safety behaviour it was missing.
 *
 * A1 got accurate without getting safe: it acted on partial readings, invented
 * thresholds for vague adjectives, and half-applied compound requests. None of
 * that is a modelling problem, so none of it needs a model to fix.
 *
 * Four guards, all living in `makeParser({ guarded: true })`:
 *   - a vague adjective with no number asks for the number;
 *   - a compound request is all or nothing;
 *   - a unit the header contradicts is refused rather than quietly ignored;
 *   - a named family member that does not exist is refused, not guessed at.
 *
 * Judge this one on harmful rate first. Exact match is expected to move less,
 * and may move down: some of what A1 got right, it got right by acting on a
 * guess that happened to land.
 */

import { makeParser } from "./a1-grammar.mjs";

export default {
  id: "a1g",
  name: "A1 plus confidence and refusal guards",
  parse: makeParser({ guarded: true }),
};
