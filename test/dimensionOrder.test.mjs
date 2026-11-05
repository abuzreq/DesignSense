import { test } from "node:test";
import assert from "node:assert/strict";
import { orderDimensions } from "../src/dimensionOrder.js";

const kinds = {
  colour: null,
  width: "in",
  material: "in",
  cost: "out",
  weight: "out",
  score: "weighted",
  looks: "custom",
};
const numeric = new Set(["width", "cost", "weight", "score", "looks"]);
const describe = (goals) => ({
  hasGoal: (dim) => goals.includes(dim),
  kindOf: (dim) => kinds[dim],
  isNumeric: (dim) => numeric.has(dim),
});
const dims = Object.keys(kinds);

test("goals, then outputs, inputs, built dimensions and the rest", () => {
  assert.deepEqual(orderDimensions(dims, describe(["weight", "score"])), [
    "weight",
    "score",
    "cost",
    "width",
    "material",
    "looks",
    "colour",
  ]);
});

test("categories come last within their group", () => {
  // material is a categorical input, listed before width in the file.
  let order = orderDimensions(["material", "width"], describe([]));
  assert.deepEqual(order, ["width", "material"]);
});

test("with nothing known, the file's order stands", () => {
  assert.deepEqual(orderDimensions(["b", "a", "c"]), ["b", "a", "c"]);
  assert.deepEqual(orderDimensions(null), []);
});
