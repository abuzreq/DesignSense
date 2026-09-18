import * as d3 from "d3";

/**
 * How a numeric axis writes its ticks, chosen from the distance between them.
 * The scatterplot and the parallel coordinates share it, so the same values
 * read the same in both.
 *
 * Ticks a thousand or more apart shrink to SI suffixes ("12k", "1.5M"). Closer
 * ticks keep every digit that tells them apart: a suffix there turned a year
 * axis into "1.99k, 2k, 2.01k", where 2008 and 2012 read the same. Those are
 * written with just the decimals the step needs, and with thousands
 * separators once the axis reaches five digits -- as the filter chips write
 * them, and never on a year.
 */
export function axisTickFormat(scale, count) {
  let domain = scale.domain();
  // The step d3 builds the ticks from, exactly. Subtracting two ticks instead
  // gives 0.3 - 0.2 = 0.0999..., which reads as needing a second decimal.
  let step = Math.abs(d3.tickStep(domain[0], domain[1], count || 10));
  if (!isFinite(step)) step = Math.abs(domain[1] - domain[0]);
  if (step >= 1000) return d3.format("~s");
  let magnitude = Math.max(Math.abs(domain[0]), Math.abs(domain[1]));
  let decimals = step > 0 ? d3.precisionFixed(step) : 0;
  return d3.format((magnitude >= 1e4 ? "," : "") + "." + decimals + "f");
}
