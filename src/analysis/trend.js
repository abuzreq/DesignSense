/**
 * The straight line that fits a cloud of points best, and how much of the
 * variation it accounts for. Used by the scatterplot's trend line.
 *
 * Least squares on y given x, which is the line people mean by "the trend":
 * it minimises the vertical distances, so it answers "what does y do as x
 * goes up" and is not the same line you would get asking it the other way
 * round. Swapping the axes swaps the question, and the line moves.
 *
 * Kept free of imports, as the other analysis modules are, so anything can
 * take it.
 */

// Fewer rows than this and a line says nothing: two points fit perfectly
// whatever they are, and three is already generous.
export const MIN_TREND_ROWS = 3;

/**
 * `{ slope, intercept, r2, n }` for the least-squares line of `yDim` on
 * `xDim` through `rows`, or null when there is no line to draw: too few
 * rows, or every one of them at the same x, which no straight line of the
 * form y = mx + c can follow. Both happen in the ordinary way of things --
 * a sweep filtered down to one of its values is every option at the same x.
 *
 * Rows must have a number on both dimensions; pareto.js's rowsWithValues is
 * how the callers arrange that.
 *
 * `r2` is the share of the variation in y the line accounts for, from 0 to
 * 1. It is **null** when y does not vary at all: the line is then exactly
 * right and exactly uninformative, and 0/0 is the honest arithmetic. Note
 * that r2 says how closely the points follow the line, not that x brings y
 * about.
 *
 * The sums are taken about the means rather than from the raw squares. Both
 * are the same arithmetic on paper; the raw form subtracts two large, nearly
 * equal numbers, and loses most of its digits doing it whenever the values
 * sit far from zero -- which, for a year or a floor area, they do.
 */
export function linearFit(rows, xDim, yDim) {
  let n = rows.length;
  if (n < MIN_TREND_ROWS) return null;

  let sumX = 0;
  let sumY = 0;
  let xMin = Infinity;
  let xMax = -Infinity;
  rows.forEach((row) => {
    let x = row[xDim];
    sumX += x;
    sumY += row[yDim];
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
  });
  // Every option at the same x: the cloud is a vertical line, and no line of
  // the form y = mx + c follows it.
  //
  // Asked of the values rather than of the sum of squares below, which forty
  // copies of 0.4 leave at 5e-31 rather than at nothing -- their mean is not
  // exactly 0.4, so none of them is exactly on it -- and a slope divided out
  // of that dust is noise, reported to three figures as though it meant
  // something.
  if (!(xMax > xMin)) return null;
  let meanX = sumX / n;
  let meanY = sumY / n;

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  rows.forEach((row) => {
    let dx = row[xDim] - meanX;
    let dy = row[yDim] - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  });
  let slope = sxy / sxx;
  // Two x values a hair apart leave sxx small enough to divide to infinity.
  if (!isFinite(slope)) return null;
  return {
    slope: slope,
    intercept: meanY - slope * meanX,
    r2: syy > 0 ? Math.min(1, (sxy * sxy) / (sxx * syy)) : null,
    n: n,
  };
}
