/*
 * The order a list of an option's values is read in, wherever one is listed
 * -- a gallery card's values, the rows of Compare: what the options are
 * judged on before what made them.
 *
 *   1. the dimensions with a goal set (by the user, the file or a sample);
 *   2. the other outputs;
 *   3. the inputs;
 *   4. custom and weighted dimensions without a goal;
 *   5. the rest.
 *
 * Within each, numbers before categories, which read as labels rather than
 * as amounts to compare. Otherwise the file's own order.
 *
 * No imports, so it runs under node --test: the caller says what each
 * dimension is.
 */

const KIND_RANK = { out: 1, in: 2, custom: 3, weighted: 3 };

/** Which of the five groups above a dimension is in, from 0. */
export function dimensionGroup(dim, { hasGoal, kindOf }) {
  if (hasGoal && hasGoal(dim)) return 0;
  let rank = KIND_RANK[kindOf ? kindOf(dim) : null];
  return rank === undefined ? 4 : rank;
}

/**
 * `dims` in reading order. `hasGoal(dim)`, `kindOf(dim)` ("in", "out",
 * "custom", "weighted" or anything else) and `isNumeric(dim)` describe them;
 * any left out counts as false or unknown.
 */
export function orderDimensions(dims, options) {
  let opts = options || {};
  let isNumeric = opts.isNumeric || (() => true);
  return (dims || [])
    .map((dim, index) => ({
      dim: dim,
      index: index,
      group: dimensionGroup(dim, opts),
      category: isNumeric(dim) ? 0 : 1,
    }))
    .sort((a, b) => a.group - b.group || a.category - b.category || a.index - b.index)
    .map((entry) => entry.dim);
}
