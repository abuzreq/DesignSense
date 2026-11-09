import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TEXT_SIZE,
  TEXT_SIZES,
  applyTextSize,
  controlScaleOf,
  iconSizeCss,
  parseTextSize,
  scaleOf,
  textPx,
} from "../src/textSize.js";

test("the four sizes run from today's to half again as large", () => {
  assert.deepEqual(
    TEXT_SIZES.map((s) => s.scale),
    [1, 1.15, 1.3, 1.5]
  );
  assert.equal(DEFAULT_TEXT_SIZE, "default");
});

test("an unknown or missing size is the default", () => {
  assert.equal(parseTextSize("larger"), "larger");
  assert.equal(parseTextSize("huge"), "default");
  assert.equal(parseTextSize(null), "default");
  assert.equal(scaleOf("nope"), 1);
});

test("sizes set in code follow the size in effect", () => {
  applyTextSize("largest");
  assert.equal(textPx(12), 18);
  applyTextSize("larger");
  assert.equal(textPx(11), 14);
  applyTextSize("default");
  assert.equal(textPx(14), 14);
});

test("icon-only controls grow at half the text's rate", () => {
  assert.deepEqual(
    TEXT_SIZES.map((s) => controlScaleOf(s.id)),
    [1, 1.075, 1.15, 1.25]
  );
  assert.equal(controlScaleOf("nope"), 1);
});

test("an icon's size in pixels follows the icon scale; others pass through", () => {
  assert.equal(iconSizeCss(16), "calc(16px * var(--ds-icon-scale, 1))");
  assert.equal(iconSizeCss("18"), "calc(18px * var(--ds-icon-scale, 1))");
  assert.equal(iconSizeCss("12.5px"), "calc(12.5px * var(--ds-icon-scale, 1))");
  assert.equal(iconSizeCss("1.2em"), "1.2em");
  assert.equal(iconSizeCss(undefined), undefined);
  assert.equal(iconSizeCss(""), undefined);
});
