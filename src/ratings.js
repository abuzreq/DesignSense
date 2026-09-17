/** Star ratings are stored on each option under this key. */
export const RATING_DIMENSION = "Rating";

/** Ratings run from 1 to 5 stars; 0 means not rated yet. */
export const RATING_BOUNDS = [0, 5];

export function isRated(item) {
  return item[RATING_DIMENSION] > 0;
}
