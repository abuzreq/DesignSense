import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSummarySettings, shownFor } from "../src/story/summarySettings.js";

const withFront = { chart: { steps: [[0, 1], [1, 0]] }, parallel: null };

test("the best trade-offs line is shown unless turned off", () => {
  assert.equal(parseSummarySettings(null).front, true);
  assert.equal(parseSummarySettings('{"front":false}').front, false);
  // Settings saved before there was a choice keep the line.
  assert.equal(parseSummarySettings('{"chart":true,"goals":false}').front, true);
});

test("the line goes with the scatterplot", () => {
  let settings = parseSummarySettings(null);
  assert.equal(shownFor(settings, withFront).front, true);
  assert.equal(shownFor(Object.assign({}, settings, { chart: false }), withFront).front, false);
  assert.equal(shownFor(settings, { chart: null, parallel: null }).front, false);
  assert.equal(shownFor(Object.assign({}, settings, { front: false }), withFront).front, false);
});
