import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DOCK_DEFAULT_WIDTH,
  DOCK_MAX_WIDTH,
  DOCK_MIN_WIDTH,
  clampDockWidth,
  parseSetsDock,
} from "../src/setsDock.js";

test("nothing saved: not docked, at the default width", () => {
  assert.deepEqual(parseSetsDock(null), { docked: false, width: DOCK_DEFAULT_WIDTH });
  assert.deepEqual(parseSetsDock(""), { docked: false, width: DOCK_DEFAULT_WIDTH });
});

test("a saved choice is read back", () => {
  assert.deepEqual(parseSetsDock('{"docked":true,"width":320}'), { docked: true, width: 320 });
});

test("unreadable text falls back to the defaults", () => {
  assert.deepEqual(parseSetsDock("{not json"), { docked: false, width: DOCK_DEFAULT_WIDTH });
  assert.deepEqual(parseSetsDock('{"docked":"yes","width":"wide"}'), {
    docked: false,
    width: DOCK_DEFAULT_WIDTH,
  });
});

test("the width is kept within the column's limits", () => {
  assert.equal(clampDockWidth(10), DOCK_MIN_WIDTH);
  assert.equal(clampDockWidth(5000), DOCK_MAX_WIDTH);
  assert.equal(clampDockWidth(250.6), 251);
  assert.equal(clampDockWidth(undefined), DOCK_DEFAULT_WIDTH);
  assert.equal(parseSetsDock('{"docked":true,"width":9999}').width, DOCK_MAX_WIDTH);
});
