<template>
  <div
    v-if="panel || shown"
    :class="panel ? 'sd-panel' : 'sd-strip'"
    :title="panel ? null : stripTitle"
  >
    <div v-if="pieces.length > 0" class="sd-chips" aria-label="What is selected">
      <template v-for="(piece, index) in pieces">
        <span
          v-if="piece.joiner"
          :key="'j' + index"
          class="sd-op sd-piece"
          :class="{ 'sd-over': isOver(index) }"
          >{{ piece.joiner }}</span
        >
        <!-- Alternatives: one bordered pill, OR between them. -->
        <span
          v-else-if="piece.group"
          :key="'g' + index"
          class="sd-group sd-piece"
          :class="{ 'sd-over': isOver(index) }"
        >
          <template v-for="(term, t) in piece.group">
            <span v-if="t > 0" :key="'or' + t" class="sd-op">{{ OR }}</span>
            <template v-for="(chip, c) in term">
              <span v-if="c > 0" :key="'and' + t + '-' + c" class="sd-op">{{
                AND
              }}</span>
              <v-chip
                :key="'c' + t + '-' + c"
                x-small
                class="sd-chip"
                :class="{ 'sd-chip--not': chip.negated }"
                :color="chip.color"
                text-color="white"
              >
                <span class="sd-chip-text">{{ chip.text }}</span>
              </v-chip>
            </template>
          </template>
        </span>
        <v-chip
          v-else
          :key="'c' + index"
          x-small
          class="sd-chip sd-piece"
          :class="{ 'sd-chip--not': piece.negated, 'sd-over': isOver(index) }"
          :color="piece.color"
          text-color="white"
        >
          <v-icon v-if="piece.icon" left x-small>{{ piece.icon }}</v-icon>
          <span class="sd-chip-text">{{ piece.text }}</span>
        </v-chip>
      </template>
      <!-- What didn't fit whole in the strip; the count's menu has it all. -->
      <span v-if="hiddenCount > 0" class="sd-more-pill" :title="stripTitle">{{
        fitCount === 0 ? countText(hiddenCount, hiddenCount === 1 ? "condition" : "conditions") : "+" + hiddenCount
      }}</span>
    </div>
    <p v-else-if="panel" class="sd-empty">
      Nothing is selected. Brush a chart, click a group or pick images.
    </p>
    <p v-if="panel && pieces.length > 0 && description.exact" class="sd-note">
      Each step is a condition. Together they make one logical statement,
      simplified to the shortest one that selects the same options.
    </p>

    <div v-if="panel && description.steps.length > 0" class="sd-history">
      <div class="sd-history-head">
        {{
          description.exact
            ? "Simplified from these " + stepsText + " since the last Replace:"
            : "Too many conditions to simplify into one statement, so these are the " +
              stepsText +
              " as taken:"
        }}
      </div>
      <ol class="sd-steps">
        <li v-for="(step, index) in stepLines" :key="index">
          <v-icon x-small class="sd-step-icon">{{ step.icon }}</v-icon>
          {{ step.text }}
        </li>
      </ol>
      <div v-if="hiddenSteps > 0" class="sd-more">and {{ hiddenSteps }} more</div>
      <div class="sd-note">Undo steps back through them.</div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import { formatValue } from "@/store/filters.js";
import { displayName, optionName } from "@/columns.js";
import { STEP_OPS } from "@/store/selectionLogic.js";
import { operations } from "@/components/operations.js";
import { operationIcon } from "@/components/operationIcons.js";

// The tones of Lite's filter chips, for the same kinds of condition.
const COLORS = {
  range: "blue darken-2",
  set: "deep-orange darken-3",
  pick: "green darken-3",
  all: "blue-grey darken-1",
};
const MAX_STEP_LINES = 12;
// The space between the strip's pieces, and room kept for "+N" before it
// has been drawn.
const GAP = 3;
const PILL_WIDTH = 34;
// Kept spare at the strip's end, so rounding never pushes the last piece
// past it.
const SLACK = 2;
// How the statement joins its conditions, the same everywhere it is written.
const AND = "AND";
const OR = "OR";

const STEP_WORDS = {
  [STEP_OPS.REPLACE]: "Select",
  [STEP_OPS.ADD]: "Add",
  [STEP_OPS.SUBTRACT]: "Remove",
  [STEP_OPS.INTERSECT]: "Keep only",
  [STEP_OPS.INVERT]: "Invert the selection",
};
const STEP_ICONS = {
  [STEP_OPS.REPLACE]: operationIcon(operations.REPLACE),
  [STEP_OPS.ADD]: operationIcon(operations.ADD),
  [STEP_OPS.SUBTRACT]: operationIcon(operations.SUBTRACT),
  [STEP_OPS.INTERSECT]: operationIcon(operations.INTERSECT),
  [STEP_OPS.INVERT]: "mdi-swap-horizontal",
};

/**
 * The Expert selection in words: the steps that built it, reduced to what
 * they amount to (see store/selectionLogic.js). Read-only; undo steps back.
 *
 * Conditions every selected option meets come first; alternatives follow in
 * one pill, OR between them; options clicked in or out by hand come last.
 */
export default {
  name: "SelectionDescription",
  props: {
    // In the count's menu: chips wrap, and the steps are listed below them.
    panel: { type: Boolean, default: false },
  },
  data() {
    return {
      // In the strip, how many pieces fit whole; the rest go into "+N".
      // null while all of them fit.
      fitCount: null,
      AND: AND,
      OR: OR,
    };
  },
  mounted() {
    if (this.panel || typeof ResizeObserver === "undefined") return;
    // A frame later: working out the fit in the observer's own callback
    // would change the strip in the frame it reported, a ResizeObserver loop.
    this.resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(this.measureFrame);
      this.measureFrame = requestAnimationFrame(() => this.measure());
    });
    this.measure();
  },
  updated() {
    this.measure();
  },
  beforeDestroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    cancelAnimationFrame(this.measureFrame);
  },
  computed: {
    ...mapState({
      rawData: (state) => state.rawData,
    }),
    ...mapGetters(["selectionDescription", "selectionCount", "rawDataMap"]),
    description() {
      return this.selectionDescription;
    },
    shown() {
      return this.description.steps.length > 0 && this.pieces.length > 0;
    },
    pieces() {
      let d = this.description;
      if (!d.exact) {
        return d.steps.map((step) => ({
          text: this.stepText(step),
          icon: STEP_ICONS[step.op],
          color: COLORS.all,
        }));
      }
      let out = [];
      if (d.everything) {
        out.push({ text: "All options", color: COLORS.all });
      } else if (!d.nothing) {
        let conditions = d.common.map(this.chipFor);
        if (d.any.length > 0) {
          conditions.push({ group: d.any.map((term) => term.map(this.chipFor)) });
        }
        conditions.forEach((piece, i) => {
          if (i > 0) out.push({ joiner: AND });
          out.push(piece);
        });
      }
      if (d.picked.length > 0) {
        out.push({
          text: "+ " + this.countText(d.picked.length, "picked"),
          icon: "mdi-cursor-default-click-outline",
          color: COLORS.pick,
        });
      }
      if (d.unpicked.length > 0) {
        out.push({
          text: "− " + this.countText(d.unpicked.length, "unpicked"),
          icon: "mdi-cursor-default-click-outline",
          color: COLORS.pick,
        });
      }
      return out;
    },
    /** How many conditions the strip leaves out: chips, counting each in a group. */
    hiddenCount() {
      if (this.panel || this.fitCount === null) return 0;
      return this.pieces.slice(this.fitCount).reduce((n, piece) => {
        if (piece.joiner) return n;
        if (piece.group) return n + piece.group.reduce((m, term) => m + term.length, 0);
        return n + 1;
      }, 0);
    },
    /** The whole statement in one line, for the "+N" pill's tooltip. */
    fullText() {
      return this.pieces
        .map((piece) => {
          if (piece.joiner) return piece.joiner;
          if (piece.group) {
            return (
              "(" +
              piece.group
                .map((term) => term.map((chip) => chip.text).join(" " + AND + " "))
                .join(" " + OR + " ") +
              ")"
            );
          }
          return piece.text;
        })
        .join(" ");
    },
    /** The whole statement, and how it came to be, for hovering the strip. */
    stripTitle() {
      return (
        this.fullText +
        "\n\n" +
        (this.description.exact
          ? "Each selection step is a condition. The " +
            this.stepsText +
            " since the last Replace make one logical statement, simplified to the shortest one that selects the same options."
          : "Too many conditions to simplify, so these are the steps as taken.") +
        " Click the count for the steps."
      );
    },
    stepsText() {
      let n = this.description.steps.length;
      return n + (n === 1 ? " step" : " steps");
    },
    stepLines() {
      return this.description.steps.slice(0, MAX_STEP_LINES).map((step) => ({
        icon: STEP_ICONS[step.op],
        text:
          step.op === STEP_OPS.INVERT
            ? STEP_WORDS[step.op]
            : STEP_WORDS[step.op] + " " + this.stepText(step),
      }));
    },
    hiddenSteps() {
      return Math.max(0, this.description.steps.length - MAX_STEP_LINES);
    },
    /** Each dimension's extent, for rounding and for "≤" / "≥" at its ends. */
    extents() {
      let dims = new Set();
      let collect = (lit) => {
        if (lit.kind === "range") dims.add(lit.dim);
      };
      this.description.common.forEach(collect);
      this.description.any.forEach((term) => term.forEach(collect));
      this.description.steps.forEach((step) => {
        if (step.atom && step.atom.kind === "region") {
          step.atom.boxes.forEach((box) => Object.keys(box).forEach((dim) => dims.add(dim)));
        }
      });
      let out = {};
      dims.forEach((dim) => {
        let lo = Infinity;
        let hi = -Infinity;
        (this.rawData || []).forEach((row) => {
          let v = row[dim];
          if (v === "" || v === null || !isFinite(Number(v))) return;
          v = Number(v);
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        });
        out[dim] = lo <= hi ? [lo, hi] : null;
      });
      return out;
    },
  },
  methods: {
    measure() {
      let el = this.$el;
      if (this.panel || !el || el.nodeType !== 1) return;
      // The strip's element is new each time it shows again.
      if (this.resizeObserver && this.observedEl !== el) {
        if (this.observedEl) this.resizeObserver.unobserve(this.observedEl);
        this.resizeObserver.observe(el);
        this.observedEl = el;
      }
      // Pieces that don't fit are taken out of the flow but keep their
      // width, so they are measured the same whether shown or not; and the
      // strip's own width doesn't depend on them, so this can't loop.
      // Fractional widths: whole pixels, summed, come short of the layout.
      let pieces = Array.from(el.querySelectorAll(".sd-piece"));
      let pill = el.querySelector(".sd-more-pill");
      let pillWidth = pill ? pill.getBoundingClientRect().width : 0;
      let available = el.clientWidth - SLACK;
      let widths = pieces.map((piece) => piece.getBoundingClientRect().width);
      // The same room, pieces and "+N" fit the same way; only a change is
      // worked out again. The "+N" can only grow as fewer pieces fit, so
      // re-rendering after a change can't go round in circles.
      let key = available + "|" + pillWidth + "|" + widths.join(",");
      if (key === this.measuredKey) return;
      this.measuredKey = key;
      let total = widths.reduce((sum, w) => sum + w + GAP, -GAP);
      let fit = null;
      if (total > available) {
        // Room for the "+N" that follows what fits. While nothing fits the
        // pill reads "N conditions" instead, too wide to go by.
        let plus = pill && this.fitCount !== 0 ? pillWidth : PILL_WIDTH;
        let room = available - plus - GAP;
        let used = -GAP;
        fit = 0;
        while (fit < widths.length && used + GAP + widths[fit] <= room) {
          used += GAP + widths[fit];
          fit += 1;
        }
        // Never end on a joiner, which would join nothing.
        while (fit > 0 && this.pieces[fit - 1] && this.pieces[fit - 1].joiner) fit -= 1;
      }
      if (fit !== this.fitCount) this.fitCount = fit;
    },
    /** Whether the strip leaves this piece out. */
    isOver(index) {
      return !this.panel && this.fitCount !== null && index >= this.fitCount;
    },
    countText(n, word) {
      return n + " " + word;
    },
    chipFor(lit) {
      if (lit.kind === "range") {
        return { text: this.rangeText(lit), negated: lit.negated, color: COLORS.range };
      }
      return {
        text: (lit.negated ? "not " : "") + lit.label,
        negated: lit.negated,
        color: COLORS.set,
      };
    },
    /**
     * "price 5k – 15k", "year ≥ 2010"; negated, the ends turn over rather
     * than reading "not ≤": "year < 2010", "price not 5k – 15k".
     */
    rangeText(lit) {
      let name = displayName(lit.dim);
      let bounds = this.extents[lit.dim];
      let lo = lit.lo;
      let hi = lit.hi;
      let span = bounds ? bounds[1] - bounds[0] : hi - lo;
      let magnitude = Math.max(Math.abs(lo), Math.abs(hi));
      let from = formatValue(lo, span, magnitude);
      let to = formatValue(hi, span, magnitude);
      let atLow = bounds && lo <= bounds[0];
      let atHigh = bounds && hi >= bounds[1];
      if (!lit.negated) {
        if (from === to) return name + " = " + from;
        if (atLow && atHigh) return name + " any value";
        if (atLow) return name + " ≤ " + to;
        if (atHigh) return name + " ≥ " + from;
        return name + " " + from + " – " + to;
      }
      if (atLow && atHigh) return name + " missing";
      if (atLow) return name + " > " + to;
      if (atHigh) return name + " < " + from;
      if (from === to) return name + " ≠ " + from;
      return name + " not " + from + " – " + to;
    },
    stepText(step) {
      let atom = step.atom;
      if (!atom) return STEP_WORDS[step.op];
      if (atom.kind === "region") {
        return atom.boxes
          .map((box) =>
            Object.keys(box)
              .map((dim) =>
                this.rangeText({ dim: dim, lo: box[dim][0], hi: box[dim][1], negated: false })
              )
              .join(" " + AND + " ")
          )
          .join(" " + OR + " ");
      }
      if (atom.kind === "pick") {
        return optionName(this.rawDataMap[atom.id]) || "one option";
      }
      let count = (atom.ids || []).length;
      return atom.label + " (" + count + ")";
    },
  },
};
</script>

<style scoped>
/* A fixed height, so which pieces fit never changes the strip's size. */
.sd-strip {
  position: relative;
  display: flex;
  align-items: center;
  height: 24px;
  min-width: 0;
  overflow: hidden;
}
/* Left out of the strip, yet still measured: at the width it has in the
   row, not wrapped to the strip's, or it would seem to fit and flicker. */
.sd-over {
  position: absolute !important;
  width: max-content;
  flex-wrap: nowrap !important;
  visibility: hidden;
  pointer-events: none;
}
.sd-more-pill {
  flex: 0 0 auto;
  padding: 0 7px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 10px;
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
  cursor: default;
}
.sd-chips {
  display: flex;
  align-items: center;
  gap: 3px;
}
.sd-panel .sd-chips {
  flex-wrap: wrap;
  row-gap: 5px;
}
.sd-chip {
  flex: 0 0 auto;
}
.sd-chip--not {
  border: 1px dashed rgba(255, 255, 255, 0.75) !important;
}
.sd-chip-text {
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sd-panel .sd-chip-text {
  max-width: 320px;
}
.sd-group {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 2px;
  padding: 1px 2px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 14px;
}
/* In the menu a group wider than a line wraps inside its outline, rather
   than running past the menu's edge. */
.sd-panel .sd-group {
  flex: 0 1 auto;
  min-width: 0;
  border-color: rgba(0, 0, 0, 0.2);
}
/* AND and OR, alike wherever they join. */
.sd-op {
  flex: 0 0 auto;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  opacity: 0.85;
  padding: 0 1px;
}
.sd-empty {
  margin: 0;
  color: #546e7a;
}
.sd-history {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #e3e8ee;
  font-size: 12px;
  color: #37474f;
}
.sd-history-head {
  margin-bottom: 4px;
}
.sd-steps {
  margin: 0;
  padding-left: 20px;
}
.sd-step-icon {
  margin-right: 2px;
  vertical-align: -1px;
}
.sd-more,
.sd-note {
  margin-top: 4px;
  color: #78909c;
}
.sd-panel > .sd-note {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.45;
}
</style>
