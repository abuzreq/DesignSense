import { operations } from "@/components/operations.js";

/**
 * The selection operations as they are shown outside the toolbar: the same
 * icons the operations bar uses, so a control that applies an operation can
 * say which one it will apply.
 */
export const OPERATION_ICONS = {
  [operations.REPLACE]: "mdi-vector-arrange-above",
  [operations.ADD]: "mdi-vector-union",
  [operations.SUBTRACT]: "mdi-vector-difference-ba",
  [operations.TOGGLE]: "mdi-select-compare",
  [operations.INTERSECT]: "mdi-vector-intersection",
};

/** What clicking something does under each operation, as a sentence ending. */
export const OPERATION_PHRASES = {
  [operations.REPLACE]: "select its options, replacing the selection",
  [operations.ADD]: "add its options to the selection",
  [operations.SUBTRACT]: "remove its options from the selection",
  [operations.TOGGLE]: "toggle its options in the selection",
  [operations.INTERSECT]: "keep only its options that are already selected",
};

export function operationIcon(operation) {
  return OPERATION_ICONS[operation] || OPERATION_ICONS[operations.REPLACE];
}

export function operationPhrase(operation) {
  return OPERATION_PHRASES[operation] || OPERATION_PHRASES[operations.REPLACE];
}
