/*
 * Star ratings. The rating is a custom dimension (see customDimensions.js)
 * named RATING_DIMENSION, made the first time an option is rated and let go
 * of when no rating is left (see the dimensions store). Unlike other custom
 * dimensions it takes whole stars, can be filtered by, and keeps its fixed
 * goal: higher is better.
 */

import { RATING_DIMENSION } from "@/columns.js";

export { RATING_DIMENSION };

/** Ratings run from 1 to 5 stars; an unrated option has no value. */
export const RATING_BOUNDS = [1, 5];

/** The star range, for scaling a rating against other criteria. */
export const RATING_STARS = RATING_BOUNDS;

/**
 * What ratings were stored under before they were a custom dimension: a
 * column added to every row, and saved with the session (see session.js).
 */
export const LEGACY_RATING_COLUMN = "Rating";

export function isRating(dim) {
  return dim === RATING_DIMENSION;
}

export function isRated(item) {
  return item[RATING_DIMENSION] > 0;
}

/** A value as a whole number of stars, or undefined for none. */
export function starsOf(value) {
  let stars = Math.round(Number(value));
  return stars >= RATING_BOUNDS[0] && stars <= RATING_BOUNDS[1] ? stars : undefined;
}
