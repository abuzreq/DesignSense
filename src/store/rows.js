/*
 * The collection's rows are not reactive.
 *
 * Vue 2 turns every property of every object it observes into a getter and a
 * setter with its own dependency list. For a study of 10,000 options and 20
 * columns that is 200,000 of them: most of the memory a load takes, most of
 * the time it blocks the page, and garbage on every filter. Nothing needs it.
 * Rows are only ever written in a handful of places -- a rating, a custom
 * value, a dimension added or removed -- and every one of those is a store
 * mutation that bumps `dimensionValuesVersion`.
 *
 * So the arrays that hold rows are frozen wherever they enter reactive state:
 * Vue does not observe a frozen array, and so never walks into the rows in it.
 * The rows themselves are left writable. The one rule that follows: anything
 * that shows a row's value and has to follow edits to it reads
 * `$store.state.dimensionValuesVersion` too.
 *
 * Freezing is shallow and in place, so only arrays nobody mutates afterwards
 * come through here; each one is a fresh result of filter() or map(), or the
 * rows a load produced.
 */
export function asRows(rows) {
  return Object.isFrozen(rows) ? rows : Object.freeze(rows);
}
