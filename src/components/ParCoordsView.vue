<template>
  <div class="pcp-view" :style="{ height: `${height}px` }">
    <PanelHeader
      icon="mdi-chart-timeline-variant"
      title="Parallel coordinates"
      :compact="width < 640"
    >
      <template v-slot:default>
        <span class="ph-label">Colour</span>
        <!-- Wide, not the narrow width beside it: that is sized for a
             count, and cut "Total Steel Tonnage" to "Total". -->
        <DimensionPicker
          id="colour-picker"
          :value="colorColumn"
          :items="colorItems"
          dense
          outlined
          hide-details
          class="ph-select ph-select--wide"
          @change="setColorColumn"
        />
        <ColorKey />
        <PaletteMenu />
        <span class="ph-divider" />
        <span class="ph-meta">{{ headerHint }}</span>
      </template>
      <template v-slot:actions>
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn id="dimensions-button" small text class="ph-text-btn" v-on="on" @click="openDimensions">
              <v-icon small left>mdi-scale-balance</v-icon>
              Dimensions
            </v-btn>
          </template>
          <span
            >Say which way is better for each output, add criteria of your
            own, and weigh them into weighted dimensions</span
          >
        </v-tooltip>
        <v-menu offset-y left :close-on-content-click="false">
          <template v-slot:activator="{ on: menu }">
            <v-tooltip bottom>
              <template v-slot:activator="{ on: tooltip }">
                <v-btn
                  small
                  text
                  class="ph-text-btn"
                  v-on="Object.assign({}, tooltip, menu)"
                >
                  <v-icon small left>mdi-tune-variant</v-icon>
                  Axes ({{ visibleAxisCount }})
                </v-btn>
              </template>
              <span>Choose the dimensions shown as axes</span>
            </v-tooltip>
          </template>
          <v-list dense max-height="360" class="overflow-y-auto">
            <v-list-item
              v-for="dim in axisOptions"
              :key="dim"
              :disabled="isAxisShown(dim) && visibleAxisCount <= 2"
              @click="toggleAxis(dim)"
            >
              <v-list-item-icon class="mr-3">
                <v-icon small :color="isAxisShown(dim) ? 'primary' : undefined">{{
                  isAxisShown(dim)
                    ? "mdi-checkbox-marked"
                    : "mdi-checkbox-blank-outline"
                }}</v-icon>
              </v-list-item-icon>
              <v-list-item-title><DimensionName :name="dim" /></v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </PanelHeader>
    <div
      :id="viewID"
      ref="parcoords"
      class="parcoords"
      :style="{ height: `${chartHeight}px` }"
    ></div>
  </div>
</template>

<script>
import "parcoord-es/dist/parcoords.css";

import ParCoords from "parcoord-es";
import * as d3 from "d3";
import { mapGetters, mapState } from "vuex";
import TemplateView from "@/components/TemplateView.vue";
import PanelHeader from "@/components/PanelHeader.vue";
import ColorKey from "@/components/ColorKey.vue";
import PaletteMenu from "@/components/PaletteMenu.vue";
import DimensionName from "@/components/DimensionName.vue";
import DimensionPicker from "@/components/DimensionPicker.vue";
import { PANEL_HEADER_HEIGHT } from "@/layout.js";
import { round } from "@/components/utils.js";
import { formatValue, sameRange } from "@/store/filters.js";
import { axisTickFormat } from "@/components/axisFormat.js";
import { operations } from "@/components/operations.js";
import { RATING_BOUNDS, RATING_DIMENSION, isRating, starsOf } from "@/ratings.js";
import { snapValue } from "@/customDimensions.js";
import {
  CUSTOM,
  GOAL_MARKS,
  KIND_MARKS,
  MIN,
  WEIGHTED,
  dimensionItems,
  displayName,
  isIgnoredColumn,
} from "@/columns.js";
import { isAssetColumn } from "@/data/assets.js";

/*
 * How tall the axes may get, against how wide the chart is. Parallel
 * coordinates are read across: the lines between the axes carry the shape,
 * and stretching them down a tall panel -- which is what happens when the
 * panel beside this one is closed -- pulls them into near-vertical streaks
 * that say nothing the shorter chart did not. Past this the chart keeps its
 * height and sits in the middle of the panel instead.
 */
const MAX_HEIGHT_OF_WIDTH = 0.7;
// Unless the panel is so narrow that the ratio would leave nothing.
const MIN_CHART_HEIGHT = 220;

// About one tick per this many pixels of axis height. Loose: the values
// matter less than the shape of the lines between them.
const AXIS_TICK_SPACING = 56;
// However tall the panel, more ticks than this is clutter.
const MAX_AXIS_TICKS = 6;
/*
 * How solid a line is drawn, by how many there are. With hundreds of options
 * at full strength the chart is a single mass; faint, the same lines read as
 * shading, which is the thing worth seeing.
 */
const LINE_ALPHA = [
  { upTo: 50, alpha: 0.75, width: 1.4 },
  { upTo: 200, alpha: 0.55, width: 1.4 },
  { upTo: 1000, alpha: 0.35, width: 1.4 },
  { upTo: 5000, alpha: 0.2, width: 1.1 },
  { upTo: Infinity, alpha: 0.12, width: 1 },
];
// Room kept between neighbouring axis titles.
const TITLE_PADDING = 8;

/** How solid and how thick this many lines should be drawn. */
function inkFor(count) {
  return LINE_ALPHA.find((step) => count <= step.upTo);
}

/**
 * How faint the selection is allowed to get, whatever its size. Left to the
 * table alone, a brush taking in most of the collection is drawn at the
 * collection's own alpha and has only the unselected lines' dimming to tell
 * it apart; the floor keeps a wide selection about four times the ink of
 * what it left behind rather than three.
 */
const MIN_SELECTION_ALPHA = 0.45;

/*
 * The inspected option's line is drawn four pixels wide on a canvas of its
 * own, and while it is inspected the rest drop to half their opacity. That
 * lifts it off the other lines but not off the page: an ordered ramp is pale
 * at one end by design, and four pixels of pale is still pale. So the line
 * keeps its hue and is darkened until it reaches the contrast WCAG asks of a
 * graphical object against what is behind it, which here is white.
 *
 * Nothing is lost by darkening it. Where the line crosses the axis of the
 * dimension being coloured by says what its value is, more exactly than its
 * colour could, and the key beside the picker says the rest.
 */
const MARK_CONTRAST = 3;
// How far each step darkens, and how many are allowed: enough to bring white
// itself down, and the loop stops as soon as the contrast is reached.
const DARKEN_STEP = 0.1;
const DARKEN_LIMIT = 40;

function linearChannel(value) {
  let c = Math.max(0, Math.min(255, value)) / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** The WCAG contrast ratio between a colour and the white behind it. */
function contrastOnWhite(rgb) {
  let luminance =
    0.2126 * linearChannel(rgb.r) +
    0.7152 * linearChannel(rgb.g) +
    0.0722 * linearChannel(rgb.b);
  return 1.05 / (luminance + 0.05);
}

function standOut(value) {
  let color = d3.color(value);
  if (!color) return value;
  let rgb = color.rgb();
  for (let i = 0; i < DARKEN_LIMIT && contrastOnWhite(rgb) < MARK_CONTRAST; i++) {
    rgb = rgb.darker(DARKEN_STEP);
  }
  return rgb.formatHex();
}
/*
 * Many axes leave each title a narrow slot, and a dozen names cut to four
 * letters name nothing. So when they will not fit side by side the titles
 * are spread over rows, each lifted clear of the one before: on r rows a
 * title has the room of r slots, since the titles it can run into are the
 * ones r axes away.
 *
 * Past two rows a title is wide enough to reach over a neighbouring axis, so
 * a lifted one is joined to its own axis by a hairline, drawn behind
 * everything else in the group.
 */
const MAX_TITLE_ROWS = 3;
// A row's worth of 11px titles, which is also what the top margin grows by.
const TITLE_ROW_HEIGHT = 13;
// The library's own top margin, which fits one row (see .label in the style).
const TITLE_MARGIN_TOP = 24;
// How long a click on an axis title waits to see whether a second follows.
const DOUBLE_CLICK_MS = 300;

export default {
  mixins: [TemplateView],
  components: {
    PanelHeader,
    ColorKey,
    PaletteMenu,
    DimensionName,
    DimensionPicker,
  },
  name: "ParCoordsView",
  data() {
    return {
      excludedDimensions: [],
      headerHeight: PANEL_HEADER_HEIGHT,
      allKeys: [],
      keysBlackList: [],
      graphCentriodPoints: null,
      // Set while brushes are moved programmatically, so their events are ignored.
      isSyncingBrush: false,
      // Where the current press began, to tell clicks on lines from drags.
      press: null,
      // How many rows the axis titles are laid out on; fitAxisTitles works
      // it out from the room they need, and the chart's top margin follows.
      titleRows: 1,
      // Whether an option is inspected. The header reads this rather than
      // the inspected option, so it doesn't re-render as inspection moves.
      isInspecting: false,
    };
  },
  computed: {
    ...mapState({
      numericDimensions: (state) => state.numericDimensions,
      nonNumericDimensions: (state) => state.nonNumericDimensions,
      dimensionValuesVersion: (state) => state.dimensionValuesVersion,
      colorColumn: (state) => state.colorColumn,
    }),
    ...mapGetters([
      "inputDimensions",
      "outputDimensions",
      "hasRatings",
      "customDimensionNames",
      "weightedDimensionNames",
      "unfilterableDimensions",
      "dimensionStructure",
      "goalOf",
      "goalSignature",
    ]),
    /** How solid and how thick to draw the lines, for this many of them. */
    lineInk() {
      return inkFor(this.chartData ? this.chartData.length : 0);
    },
    /** What the colour can follow: any dimension, or nothing at all. */
    colorItems() {
      let dims = this.numericDimensions
        .concat(this.nonNumericDimensions)
        .filter((dim) => !isAssetColumn(dim) && !this.keysBlackList.includes(dim));
      // Set apart by a rule, because leaving the colour off is a choice of
      // its own rather than a dimension that happens to be called None.
      return [{ text: "No colour", value: "" }, { divider: true }].concat(
        dimensionItems(dims)
      );
    },
    /** Axes drawn over a fixed range rather than their data's extent. */
    fixedAxisBounds() {
      let bounds = { [RATING_DIMENSION]: RATING_BOUNDS.slice() };
      this.unfilterableDimensions.forEach((dim) => {
        bounds[dim] = this.$store.getters.fixedBoundsOf(dim);
      });
      return bounds;
    },
    /**
     * Axis titles: names without their column prefix, with custom axes marked
     * as editable and weighted ones as sums, then ↑ or ↓ for a goal.
     */
    axisTitles() {
      let titles = {};
      this.numericDimensions.forEach((dim) => (titles[dim] = displayName(dim)));
      this.customDimensionNames.forEach((dim) => (titles[dim] += " \u270e"));
      this.weightedDimensionNames.forEach((dim) => (titles[dim] += " \u03a3"));
      this.numericDimensions.forEach((dim) => {
        let mark = GOAL_MARKS[this.goalOf(dim)];
        if (mark) titles[dim] += " " + mark.mark;
      });
      return titles;
    },
    /** What hovering an axis title says beyond its name: why a ↓ axis runs downward. */
    axisHints() {
      let hints = {};
      this.numericDimensions.forEach((dim) => {
        if (this.goalOf(dim) === MIN) {
          hints[dim] =
            "Lower is better, so this axis runs from high at the foot to low at the top.";
        }
      });
      return hints;
    },
    // Rating is offered once something is rated, since only then has it an axis.
    // Picture and model columns are never axes, however they were typed.
    axisOptions() {
      return this.numericDimensions.filter(
        (dim) =>
          !isAssetColumn(dim) && (dim !== RATING_DIMENSION || this.hasRatings)
      );
    },
    visibleAxisCount() {
      return this.axisOptions.filter((dim) => this.isAxisShown(dim)).length;
    },
    /** Room above the axes for the titles: one row, or two. */
    chartMargin() {
      return {
        top: TITLE_MARGIN_TOP + (this.titleRows - 1) * TITLE_ROW_HEIGHT,
        right: 20,
        bottom: 12,
        left: 20,
      };
    },
    chartHeight() {
      // Never below zero: a panel is briefly unmeasured while it mounts, and
      // a negative height reaches the chart's svg as an invalid attribute.
      let room = Math.max(0, this.height - this.headerHeight);
      let tallest = Math.max(
        MIN_CHART_HEIGHT,
        Math.round(this.width * MAX_HEIGHT_OF_WIDTH)
      );
      return Math.min(room, tallest);
    },
    headerHint() {
      let hint =
        (this.isLite
          ? "Drag along an axis to filter"
          : "Drag along an axis to select") +
        " · drag a title to reorder, double-click it to flip its axis";
      if (this.customDimensionNames.some((dim) => this.isAxisShown(dim))) {
        hint += this.isInspecting
          ? " · drag the knob on \u270e axes to edit"
          : " · inspect an option to edit it on \u270e axes";
      }
      return hint;
    },
  },
  mounted() {},
  created() {
    // Bookkeeping columns only: the picture and model ones are isAssetColumn's,
    // since a list can never cover "img_2" or "model3d_3".
    this.keysBlackList = ["index", "selected", "ID", "id", "_id", "collection"];
    this.allKeys = Object.keys(this.chartData[0]);

    // A copy, so the store's list of categorical dimensions is left alone.
    // The library takes its axes from the data's own keys, so a number the
    // sample has asked us not to treat as a dimension is still in the rows
    // and has to be hidden here by name (see columns.js).
    this.excludedDimensions = this.nonNumericDimensions
      .concat(this.allKeys.filter(isIgnoredColumn))
      .concat(["selected"]);
    // Lite's own axis brushes by dimension. Not in data(): d3 state, not view state.
    this.liteBrushes = null;
    // The knob being dragged: { dim, id, y, value, moved }.
    this.knobGesture = null;
    this.lineFrame = null;
    this.knobFrame = null;
    this.titleFrame = null;
    // Positions and titles the axis titles were last fitted to.
    this.fittedTitlesKey = null;
    // Axes turned over by double-clicking their titles, replayed on every
    // rebuild by applyGoalOrientation.
    this.flippedAxes = [];
    // The order the axes were last seen in, so dragging one to a new place
    // outlives the rebuilds a colour, a resize or a new goal sets off.
    this.axisOrder = null;
    // A click on a title waiting to see whether a second one follows:
    // { dim, was, applied }.
    this.titleClick = null;
    this.titleClickTimer = null;
  },
  beforeDestroy() {
    if (this.lineFrame) cancelAnimationFrame(this.lineFrame);
    if (this.knobFrame) cancelAnimationFrame(this.knobFrame);
    if (this.titleFrame) cancelAnimationFrame(this.titleFrame);
    this.cancelTitleClick();
  },
  watch: {
    // The Rating axis appears with the first rating.
    hasRatings: function() {
      this.scheduleRefresh();
    },
    // The margin is read when the chart is built, so a second row of titles
    // needs a new one. The row count comes from the axis positions, which a
    // taller margin does not move, so this settles after one rebuild.
    titleRows: function() {
      this.scheduleRefresh();
    },
    // A goal changed: a title's mark, and which way its axis runs.
    goalSignature: function() {
      this.scheduleRefresh();
    },
    // Custom and weighted dimensions were added, removed or given new bounds.
    dimensionStructure: function() {
      let known = this.$store.state.allDimensions;
      this.excludedDimensions = this.excludedDimensions.filter(
        (dim) => dim === "selected" || known.includes(dim)
      );
      this.scheduleRefresh();
    },
    // Values changed in place: redraw the lines, not the chart.
    dimensionValuesVersion: function() {
      this.scheduleLineRedraw();
    },
  },
  methods: {
    /**
     * What an Expert axis brush selected, for describing the selection: the
     * range brushed, or the options themselves on an axis without one.
     */
    axisStep(brushed, args) {
      let axis = args && args.axis;
      let scaled = args && args.selection && args.selection.scaled;
      if (
        axis &&
        scaled &&
        scaled.length === 2 &&
        scaled.every((v) => typeof v === "number" && isFinite(v))
      ) {
        return {
          kind: "region",
          boxes: [{ [axis]: [Math.min(scaled[0], scaled[1]), Math.max(scaled[0], scaled[1])] }],
        };
      }
      return {
        kind: "set",
        label: axis ? "Brush on " + displayName(axis) : "PCP brush",
        ids: brushed.map((d) => d._id),
      };
    },
    /** Rating stays hidden until an option is rated. */
    hiddenAxes() {
      if (this.hasRatings || this.excludedDimensions.includes(RATING_DIMENSION)) {
        return this.excludedDimensions;
      }
      return this.excludedDimensions.concat([RATING_DIMENSION]);
    },
    formatDimensions(dimensions) {
      var result = {};
      dimensions.forEach((dim) => {
        result[dim] = {};
      });
      return result;
    },
    prepareDimensions(data, dimensions, chart) {
      let range = this.height; //- chart.margin().top - chart.margin().bottom;
      var result = {};
      dimensions.forEach((dim) => {
        let extents = d3.extent(data, (d) => d[dim]);
        let scale = d3
          .scaleLinear()
          .domain(extents)
          .range([range, 1]);
        result[dim] = {
          yscale: scale,
          title: dim,
          tickPadding: 0,
          innerTickSize: 8,
          type: "number",
          orient: "right",
          ticks: 10,
        };
      });

      return result;
    },
    /** How solid and how thick the lines are, for this many of them. */
    setColorColumn(dim) {
      this.$store.commit("changeColorColumn", dim || "");
    },
    /**
     * What an axis title answers to: a click colours the chart by that
     * dimension and a second click takes the colour off, and a double-click
     * turns the axis over, as the benchmark's does.
     *
     * The flip is the library's idea but not the library's handler. Its own
     * lasted only until the next rebuild, which makes the scales afresh from
     * the goals; flipAxis keeps a record, so an axis stays the way it was
     * put. Its wheel handler, which rotated every title to a diagonal on a
     * stray scroll over the chart, is simply dropped.
     */
    bindAxisTitles(chart) {
      if (!chart || !chart.svg) return;
      let vm = this;
      chart.svg
        .selectAll("g.dimension text.label")
        .classed("ds-colour-by", (dim) => dim === this.colorColumn)
        .on("wheel", null)
        .on("click", function(dim) {
          d3.event.stopPropagation();
          vm.onTitleClick(dim, d3.event);
        })
        .on("dblclick", function(dim) {
          d3.event.stopPropagation();
          d3.event.preventDefault();
          vm.onTitleDoubleClick(dim);
        });
    },
    /**
     * A press on a title that turned out to be a click rather than the start
     * of a drag to reorder: moving an axis must not also recolour the chart.
     * The distance is the one onChartClick uses to tell a click from a drag.
     *
     * The colour then waits out the double-click window, so a double-click
     * only flips. A system set slower than that window lets the colour
     * through first, and onTitleDoubleClick puts it back.
     */
    onTitleClick(dim, event) {
      let press = this.press;
      this.press = null;
      // The second press of a double-click: hold back the first one's
      // colour, and leave its record for onTitleDoubleClick to read.
      if (event.detail > 1) {
        this.stopTitleClickTimer();
        return;
      }
      // Any other press ends whatever the press before it was waiting on.
      this.cancelTitleClick();
      // This one travelled, so it was the start of a drag to reorder.
      if (
        press &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) >= 3
      ) {
        return;
      }
      let pending = { dim: dim, was: this.colorColumn, applied: false };
      this.titleClick = pending;
      this.titleClickTimer = setTimeout(() => {
        this.titleClickTimer = null;
        pending.applied = true;
        this.setColorColumn(dim === pending.was ? "" : dim);
      }, DOUBLE_CLICK_MS);
    },
    onTitleDoubleClick(dim) {
      let pending = this.titleClick;
      this.cancelTitleClick();
      // Only if the window was too short for this system's double-click.
      if (pending && pending.applied && pending.dim === dim) {
        this.setColorColumn(pending.was);
      }
      this.flipAxis(dim);
    },
    stopTitleClickTimer() {
      if (this.titleClickTimer) clearTimeout(this.titleClickTimer);
      this.titleClickTimer = null;
    },
    cancelTitleClick() {
      this.stopTitleClickTimer();
      this.titleClick = null;
    },
    /**
     * Turns an axis over, its low end where its high end was. Written down
     * as well as done: every rebuild makes the scales again, so
     * applyGoalOrientation replays the flips beside the goals' own
     * reversals. Flipping itself does not rebuild, so axes dragged into an
     * order keep it.
     */
    flipAxis(dim) {
      let chart = this.chart;
      let axis = chart && chart.dimensions()[dim];
      if (!axis || !axis.yscale || typeof axis.yscale.invert !== "function") {
        return;
      }
      let at = this.flippedAxes.indexOf(dim);
      if (at < 0) this.flippedAxes.push(dim);
      else this.flippedAxes.splice(at, 1);
      axis.yscale.domain(axis.yscale.domain().slice().reverse());
      // This axis redrawn on the spot: d3's axis touches only the ticks and
      // the domain line, so the title above it keeps its colour and its fit.
      chart.svg
        .selectAll("g.dimension")
        .filter((d) => d === dim)
        .select("g.axis")
        .call(chart.applyAxisConfig(null, axis));
      // The lines, the selection over them and the knobs follow the scale.
      this.redrawLinesInPlace();
      // A brush stands for a range of values, not a stretch of pixels.
      this.syncLiteBrushes();
    },
    isAxisShown(dim) {
      return !this.excludedDimensions.includes(dim);
    },
    /** Shows or hides a dimension's axis, keeping at least two. */
    toggleAxis(dim) {
      if (this.isAxisShown(dim)) {
        if (this.visibleAxisCount <= 2) return;
        this.excludedDimensions = this.excludedDimensions.concat([dim]);
      } else {
        this.excludedDimensions = this.excludedDimensions.filter(
          (d) => d !== dim
        );
      }
      this.refresh();
    },
    /**
     * The selection, drawn on a canvas of its own over the rest.
     *
     * That canvas is the one the library leaves solid: autoscale gives the
     * foreground and brushed contexts `config.alpha` and gives the highlight
     * context only a line width, so a brushed line was drawn at full
     * strength however faint its neighbours were -- eight times the ink at
     * 648 rows. Worse than bright: solid lines stop accumulating where they
     * overlap, so brushing threw away the density the alpha is there to
     * show, in exactly the set that had just been asked about.
     *
     * Its ink follows the number of lines drawn on it, through the table the
     * rest of the chart uses, so a handful stays solid and hundreds are as
     * translucent as hundreds should be, down to MIN_SELECTION_ALPHA. Never
     * fainter than its neighbours: a selection is a subset, so its step is
     * never past theirs.
     *
     * Set on every call, not once, because a render resizes the canvases and
     * setting a canvas's width wipes its context.
     */
    highlight(selection) {
      if (!this.chart || typeof this.chart.highlight !== "function") return;
      let ctx = this.chart.ctx && this.chart.ctx.highlight;
      if (ctx) {
        ctx.globalAlpha = Math.max(
          MIN_SELECTION_ALPHA,
          inkFor(selection ? selection.length : 0).alpha
        );
      }
      // With filters active, an empty selection means "nothing matches".
      this.chart.highlight(selection, this.isFilterActive);
    },
    markingChangeHandler: function(reset) {
      if (reset) {
        if (this.liteBrushes) this.clearLiteBrushes();
        else this.chart.brushReset();
        this.chart.unhighlight();
        //this.chart.highlight(this.$store.getters.data);
        
      } else {
        //this.chart.brushReset();
        //this.chart.unhighlight();
        var result = this.$store.getters.selectedDataInView(this.viewID);
        this.highlight(result);
        this.syncLiteBrushes();
      }
      let hovered = this.$store.getters.getHovered;
      this.updateStyleGivenHovered(hovered);
      this.drawKnobs();
    },
    afterChartRebuilt() {
      this.syncLiteBrushes();
      this.updateStyleGivenHovered(this.$store.getters.getHovered);
      this.drawKnobs();
    },
    openDimensions() {
      this.$store.dispatch("openDimensionDialog", { mode: "manage" });
    },
    /*
     * Custom dimensions are edited on their axes, one option at a time: the
     * inspected option gets a knob, a slider thumb where its line crosses
     * each custom axis, dragged to set its value. A line with no value crosses
     * below the axes, in the band under the separator, and its knob waits
     * there; dragging a knob down into that band clears the value. Knobs sit
     * inside the axis group, so they move with the axis when it is reordered,
     * and their drag keeps presses from reordering, brushing or inspecting.
     */
    drawKnobs() {
      let chart = this.chart;
      if (this._isDestroyed || !chart || !chart.g()) return;
      let editable = new Set(this.customDimensionNames);
      let dimensions = chart.dimensions();
      let hovered = this.$store.state.hovered;
      // Only a line that is drawn can be edited on the chart.
      let items =
        editable.size > 0 &&
        hovered &&
        chart.data().some((d) => d._id === hovered._id)
          ? [hovered]
          : [];
      let nullY = this.nullBandY();
      let vm = this;
      chart.g().each(function(dim) {
        let group = d3.select(this);
        let layer = group.select("g.ds-knobs");
        if (!editable.has(dim) || !dimensions[dim]) {
          layer.remove();
          return;
        }
        if (layer.empty()) layer = group.append("g").attr("class", "ds-knobs");
        let yscale = dimensions[dim].yscale;
        let knobs = layer.selectAll("g.ds-knob").data(items, (d) => d._id);
        knobs.exit().remove();
        let entered = knobs
          .enter()
          .append("g")
          .attr("class", "ds-knob")
          .call(vm.knobDrag(dim));
        // A larger, invisible target, so the thumb is easy to grab.
        entered
          .append("rect")
          .attr("class", "ds-knob-target")
          .attr("x", -16)
          .attr("y", -12)
          .attr("width", 32)
          .attr("height", 24);
        entered
          .append("rect")
          .attr("class", "ds-knob-thumb")
          .attr("x", -12)
          .attr("y", -7)
          .attr("width", 24)
          .attr("height", 14)
          .attr("rx", 4);
        [-2.5, 2.5].forEach((y) => {
          entered
            .append("line")
            .attr("class", "ds-knob-grip")
            .attr("x1", -5)
            .attr("x2", 5)
            .attr("y1", y)
            .attr("y2", y);
        });
        entered.append("title");
        layer
          .selectAll("g.ds-knob")
          .each(function(d) {
            let y = vm.knobY(yscale, d[dim], nullY);
            this.__knobY = y;
            d3.select(this)
              .attr("transform", "translate(0," + y + ")")
              .classed("ds-knob--empty", !Number.isFinite(d[dim]));
          })
          .select("title")
          .text(
            (d) =>
              "Drag to set " +
              displayName(dim) +
              " of " +
              d._id +
              " (" +
              vm.formatAxisValue(dim, d[dim]) +
              ")"
          );
      });
    },
    scheduleKnobRedraw() {
      if (this.knobFrame) return;
      this.knobFrame = requestAnimationFrame(() => {
        this.knobFrame = null;
        this.drawKnobs();
      });
    },
    knobDrag(dim) {
      let vm = this;
      return d3
        .drag()
        .subject(function() {
          return { x: 0, y: this.__knobY || 0 };
        })
        .on("start", function(d) {
          vm.knobGesture = { dim: dim, id: d._id, moved: false };
          d3.select(this).classed("ds-knob--dragging", true);
          // The pointer leaves the thumb while dragging fast; keep the grip.
          document.body.classList.add("ds-knob-grabbing");
        })
        .on("drag", function(d) {
          let gesture = vm.knobGesture;
          let axis = vm.chart && vm.chart.dimensions()[dim];
          let def = vm.$store.getters.dimensionDef(dim);
          if (!gesture || !axis || !def) return;
          gesture.moved = true;
          let yscale = axis.yscale;
          let range = yscale.range();
          let top = Math.min(range[0], range[1]);
          let bottom = Math.max(range[0], range[1]);
          let nullY = vm.nullBandY();
          let y = Math.max(top, Math.min(nullY, d3.event.y));
          // Past the separator line, halfway down to the missing band.
          let cleared = y >= (bottom + nullY) / 2;
          let raw = yscale.invert(Math.min(y, bottom));
          // Ratings are whole stars.
          let value = cleared
            ? undefined
            : isRating(dim)
            ? starsOf(raw)
            : snapValue(raw, def.bounds);
          gesture.value = value;
          gesture.y = cleared ? nullY : yscale(value);
          this.__knobY = gesture.y;
          d3.select(this)
            .attr("transform", "translate(0," + gesture.y + ")")
            .classed("ds-knob--empty", cleared);
          vm.$store.dispatch("setDimensionValue", {
            dim: dim,
            id: d._id,
            value: value,
            final: false,
          });
          vm.showKnobTooltip();
        })
        .on("end", function(d) {
          let gesture = vm.knobGesture;
          vm.knobGesture = null;
          d3.select(this).classed("ds-knob--dragging", false);
          document.body.classList.remove("ds-knob-grabbing");
          if (!vm.chart) return;
          vm.cleanTooltip();
          if (vm.hovered) vm.addTooltip([vm.hovered]);
          if (gesture && gesture.moved) {
            if (isRating(dim)) {
              // As the stars do: a filter on Rating follows, and clearing
              // the last rating lets the rating go.
              vm.$store.dispatch("rateAlt", { item: d, rating: d[dim] || 0 });
            } else {
              vm.$store.dispatch("setDimensionValue", {
                dim: dim,
                id: d._id,
                value: d[dim],
                final: true,
              });
            }
          }
        });
    },
    showKnobTooltip() {
      let gesture = this.knobGesture;
      if (!gesture || !this.chart) return;
      this.cleanTooltip();
      this.createTooltip([
        [
          this.chart.xscale(gesture.dim),
          this.knobTooltipY(gesture.y),
          this.formatAxisValue(gesture.dim, gesture.value),
        ],
      ]);
    },
    /** Where lines with no value cross, below the axes. */
    nullBandY() {
      let margin = this.chart.margin();
      return this.chart.height() - margin.top - margin.bottom + 1;
    },
    /**
     * The baseline of a value label for a knob at `y`, clear of its thumb
     * (14px tall): above it, or below it where the top of the chart would cut
     * the label off. A label box runs from 14px above its baseline to 4px
     * below (see createTooltip).
     */
    knobTooltipY(y) {
      let above = y - 12;
      return above - 14 < -this.chart.margin().top ? y + 22 : above;
    },
    knobY(yscale, value, nullY) {
      let y = Number.isFinite(value) ? yscale(value) : NaN;
      return Number.isFinite(y) ? y : nullY;
    },
    formatAxisValue(dim, value) {
      if (value === undefined || value === null || value === "") return "\u2013";
      let bounds = this.fixedAxisBounds[dim];
      if (bounds && typeof value === "number" && dim !== RATING_DIMENSION) {
        return formatValue(value, bounds[1] - bounds[0]);
      }
      return "" + value;
    },
    scheduleLineRedraw() {
      if (this.lineFrame) return;
      this.lineFrame = requestAnimationFrame(() => {
        this.lineFrame = null;
        this.redrawLinesInPlace();
      });
    },
    /**
     * Values edited on rows are redrawn from the same rows: the lines, the
     * selection over them, tooltips and knobs, without rebuilding the axes.
     */
    redrawLinesInPlace() {
      if (this._isDestroyed || !this.chart || !this.$el.isConnected) return;
      // A rebuild is on its way and redraws everything anyway.
      if (this._refreshTimer) return;
      this.chart.render();
      // Rendering clears the canvas the selection is drawn on.
      this.highlight(this.$store.getters.selectedDataInView(this.viewID));
      this.updateStyleGivenHovered(this.hovered);
      this.cleanTooltip();
      if (this.knobGesture) this.showKnobTooltip();
      else if (this.hovered) this.addTooltip([this.hovered]);
      this.drawKnobs();
    },
    /**
     * Marks custom and weighted axes: no brushes, their own colours, and a
     * tinted column behind each, from its title to its foot, so they stand
     * apart from the file's own dimensions.
     */
    decorateAxes(chart) {
      let custom = new Set(this.customDimensionNames);
      let weighted = new Set(this.weightedDimensionNames);
      // The rating is custom but keeps its brushes: it can be filtered by.
      let unfilterable = new Set(this.unfilterableDimensions);
      let band = axisBand(chart);
      let outputs = new Set(this.outputDimensions);
      let coloured = this.colorColumn;
      chart.svg.selectAll("g.dimension").each(function(dim) {
        let group = d3.select(this);
        group
          .classed("ds-unfilterable", unfilterable.has(dim))
          .classed("ds-custom-axis", custom.has(dim))
          .classed("ds-weighted-axis", weighted.has(dim));
        // Results are set apart from the parameters that produced them, and
        // whatever the colour follows is set apart from both.
        group
          .select("text.label")
          .style(
            "fill",
            dim === coloured
              ? "#263238"
              : outputs.has(String(dim).toUpperCase())
              ? "#1565c0"
              : "#37474f"
          )
          .style("font-weight", dim === coloured ? 700 : 600);
        let mark = custom.has(dim)
          ? KIND_MARKS[CUSTOM]
          : weighted.has(dim)
          ? KIND_MARKS[WEIGHTED]
          : null;
        let rect = group
          .selectAll("rect.ds-axis-band")
          .data(mark ? [mark] : []);
        rect.exit().remove();
        rect
          .enter()
          .insert("rect", ":first-child")
          .attr("class", "ds-axis-band")
          .merge(rect)
          .attr("x", -band.width / 2)
          .attr("width", band.width)
          .attr("y", band.top)
          .attr("height", band.height)
          .attr("rx", 4)
          .style("fill", (d) => d.color);
        if (!mark) return;
        group.select("text.label").style("fill", mark.color);
        group.select("path.domain").style("stroke", mark.color);
      });
    },
    scheduleTitleFit(chart) {
      if (this.titleFrame) return;
      this.titleFrame = requestAnimationFrame(() => {
        this.titleFrame = null;
        if (this._isDestroyed || chart !== this.chart) return;
        this.fitAxisTitles(chart);
      });
    },
    /**
     * Keeps axis titles from running into each other: each gets the room
     * halfway to its neighbours (the outermost ones also the margin beside
     * them), is nudged inward at the edges, and is cut with an ellipsis when
     * still too long, with the full name in a <title> for hovering. The
     * library only writes titles when it creates the axes, so this reruns
     * after renders, which also cover dragging an axis to reorder.
     *
     * Where a row of titles cannot hold them all whole, they go on two, every
     * other title lifted by a row; `titleRows` then asks for the margin that
     * second row needs, which is read when the chart is next built.
     */
    fitAxisTitles(chart) {
      if (!chart || !chart.svg) return;
      let dimensions = chart.dimensions();
      let margin = chart.margin();
      let innerWidth = chart.width() - margin.left - margin.right;
      let labels = chart.svg.selectAll("g.dimension text.label");
      if (labels.empty()) return;
      let positions = {};
      labels.each((dim) => {
        let x = chart.xscale(dim);
        positions[dim] = Number.isFinite(x) ? x : 0;
      });
      let titleOf = (dim) =>
        (dimensions[dim] && dimensions[dim].title) || "" + dim;
      let hints = this.axisHints;
      let keys = Object.keys(positions);
      let key =
        innerWidth +
        "|" +
        keys.map((dim) => dim + ":" + positions[dim] + ":" + titleOf(dim)).join("|");
      // Nothing moved or was renamed since the last fit, and the labels are
      // the ones fitted then (a rebuild makes fresh, unmarked ones).
      if (key === this.fittedTitlesKey) {
        let fresh = false;
        labels.each(function(dim) {
          if (this.getAttribute("data-full-title") !== titleOf(dim)) fresh = true;
        });
        if (!fresh) return;
      }
      let xs = keys.map((dim) => positions[dim]).sort((a, b) => a - b);
      let leftEdge = -margin.left + 2;
      let rightEdge = innerWidth + margin.right - 2;
      /*
       * How much room the title at the `at`th axis has when the titles are
       * spread over `rows` rows: halfway to the axes it shares its row with,
       * which are `rows` apart, and the chart's edge beyond the outermost.
       */
      let roomAt = (at, rows) => {
        let left =
          at - rows >= 0
            ? Math.max(leftEdge, (xs[at - rows] + xs[at]) / 2 + TITLE_PADDING / 2)
            : leftEdge;
        let right =
          at + rows < xs.length
            ? Math.min(rightEdge, (xs[at] + xs[at + rows]) / 2 - TITLE_PADDING / 2)
            : rightEdge;
        return { left: left, right: right, room: Math.max(0, right - left) };
      };

      // First the whole titles, to see what room they ask for. Hidden panels
      // measure every text as 0 wide; fit again once shown.
      let measured = true;
      let entries = [];
      labels.each(function(dim) {
        let label = d3.select(this);
        let full = titleOf(dim);
        // Setting the text also drops an earlier <title>.
        label.text(full).attr("data-full-title", full);
        let node = label.node();
        let width = node.getComputedTextLength();
        if (width === 0 && full.length > 0) measured = false;
        entries.push({
          dim: dim,
          label: label,
          node: node,
          full: full,
          width: width,
          x: positions[dim],
          at: xs.indexOf(positions[dim]),
        });
      });

      let rows = 1;
      while (
        rows < MAX_TITLE_ROWS &&
        entries.some((entry) => entry.width > roomAt(entry.at, rows).room)
      ) {
        rows++;
      }

      entries.forEach((entry) => {
        let { label, node, full, x, at } = entry;
        let { left, right, room } = roomAt(at, rows);
        let width = entry.width;
        let hover = [];
        if (width > room) {
          // Keep the custom (✎), weighted (Σ) and goal (↑ ↓) marks; cut the
          // name before them.
          let marks = /(\s[✎Σ↑↓])+$/.exec(full);
          let mark = marks ? marks[0] : "";
          let name = full.slice(0, full.length - mark.length);
          let shortened = (n) => name.slice(0, n).trim() + "…" + mark;
          // The longest prefix that fits with the ellipsis.
          let lo = 0;
          let hi = name.length;
          while (lo < hi) {
            let mid = Math.ceil((lo + hi) / 2);
            node.textContent = shortened(mid);
            if (node.getComputedTextLength() <= room) lo = mid;
            else hi = mid - 1;
          }
          node.textContent = shortened(lo);
          width = node.getComputedTextLength();
          hover.push(full);
        }
        if (hints[entry.dim]) hover.push(hints[entry.dim]);
        if (hover.length > 0) label.append("title").text(hover.join(": "));
        // Centred on the axis unless that would cross the room's edges.
        let center = x;
        if (center - width / 2 < left) center = left + width / 2;
        if (center + width / 2 > right) center = right - width / 2;
        // Rows run from the one nearest the axes upward, so the leftmost
        // title keeps the place a single row would have given it.
        let row = at % rows;
        label.attr("x", center - x).attr("y", -row * TITLE_ROW_HEIGHT);
        // Down the axis's own x, whatever the title was nudged to.
        let group = d3.select(node.parentNode);
        let leader = group
          .selectAll("line.ds-title-leader")
          .data(row > 0 ? [row] : []);
        leader.exit().remove();
        leader
          .enter()
          .insert("line", ":first-child")
          .attr("class", "ds-title-leader")
          .merge(leader)
          .attr("x1", 0)
          .attr("x2", 0)
          .attr("y1", (d) => -d * TITLE_ROW_HEIGHT - 6)
          .attr("y2", -2);
      });
      this.fittedTitlesKey = measured ? key : null;
      if (measured) this.titleRows = rows;
    },
    /*
     * Lite's axis brushes: several per axis, OR-ed, owned here. The library's
     * multi-brush mode finds its brushes by axis position, which reordering
     * breaks, and clears a whole axis when one brush collapses; so Lite draws
     * d3 brushes of its own inside each axis group. The last brush on an axis
     * is always empty and takes the next drag; the store decides what matches.
     */
    installLiteBrushes(chart) {
      let vm = this;
      let dimensions = chart.dimensions();
      let hidden = this.hiddenAxes();
      let unfilterable = new Set(this.unfilterableDimensions);
      this.liteBrushes = {};
      chart.g().each(function(dim) {
        let axis = dimensions[dim];
        if (!axis || hidden.includes(dim)) return;
        // Custom and weighted dimensions can't be filtered by.
        if (unfilterable.has(dim)) return;
        if (!axis.yscale || typeof axis.yscale.invert !== "function") return;
        vm.liteBrushes[dim] = {
          group: d3.select(this).append("g").attr("class", "lite-brushes"),
          yscale: axis.yscale,
          list: [],
          next: 0,
        };
        vm.addAxisBrush(dim);
        vm.drawAxisBrushes(dim);
      });
    },
    /**
     * One more brush on an axis. `from` is null for the axis's own brush, or
     * `{ key, index }` when the brush is one range of a scatterplot rectangle
     * (box `index` of the range filter `key`) drawn here so the rectangle can
     * be seen and moved on the axes as well.
     */
    addAxisBrush(dim, from) {
      let vm = this;
      let entry = this.liteBrushes[dim];
      let range = entry.yscale.range();
      let brush = d3
        .brushY()
        .extent([
          [-15, Math.min(range[0], range[1])],
          [15, Math.max(range[0], range[1])],
        ])
        // Wide enough grips at each end to resize a brush without hunting.
        .handleSize(10)
        .on("start", function() {
          // Keep the press from starting the axis title's reorder drag.
          let source = d3.event.sourceEvent;
          if (source && typeof source.stopPropagation === "function") {
            source.stopPropagation();
          }
        })
        .on("brush", function() {
          vm.onAxisBrushMove(dim);
        })
        .on("end", function() {
          vm.onAxisBrushEnd(dim, this);
        });
      entry.list.push({ id: entry.next++, brush: brush, from: from || null });
    },
    axisBrushNode(entry, item) {
      return entry.group
        .selectAll("g.lite-brush")
        .filter((d) => d === item)
        .node();
    },
    /**
     * Binds an axis's brushes to groups. A new group goes beneath the others,
     * so drawn brushes stay above the fresh full-axis overlay and can still be
     * dragged; only the last (empty) brush's overlay takes events, so a drag
     * starts a brush and never restarts an old one.
     */
    drawAxisBrushes(dim) {
      let entry = this.liteBrushes[dim];
      let groups = entry.group
        .selectAll("g.lite-brush")
        .data(entry.list, (d) => d.id);
      groups
        .enter()
        .insert("g", ":first-child")
        .attr("class", "lite-brush")
        .each(function(d) {
          d3.select(this).call(d.brush);
        });
      groups.exit().remove();
      let last = entry.list[entry.list.length - 1];
      entry.group.selectAll("g.lite-brush").each(function(d) {
        d3.select(this)
          .selectAll(".overlay")
          .style("pointer-events", d === last ? "all" : "none");
      });
    },
    onAxisBrushMove(dim) {
      if (this.isSyncingBrush) return;
      this.cleanTooltip();
      let raw = d3.event.selection;
      if (!raw || !d3.event.sourceEvent) return;
      // On the axis the brush is on, not under the pointer. A brush moves
      // only up and down, so a drag that wanders sideways -- which every
      // drag does -- was carrying the two values away from their own axis.
      let x = this.chart.xscale(dim);
      if (!Number.isFinite(x)) return;
      let yscale = this.liteBrushes[dim].yscale;
      this.createTooltip([
        [x, raw[0], round(yscale.invert(raw[0]), 4) + ""],
        [x, raw[1], round(yscale.invert(raw[1]), 4) + ""],
      ]);
    },
    /**
     * A gesture ended on one brush: a range drawn on the empty brush calls
     * for a new empty one; a click on the empty part of the axis clears the
     * axis; a brush dragged down to nothing (d3 nulls it) is dropped. What
     * the axis shows then becomes the filters, in one step: its own brushes
     * as its range filter, and each rectangle's brush as that rectangle's
     * range on this dimension (a dropped one drops the rectangle).
     */
    onAxisBrushEnd(dim, node) {
      if (this.isSyncingBrush || !d3.event.sourceEvent) return;
      this.cleanTooltip();
      let entry = this.liteBrushes[dim];
      let item = d3.select(node).datum();
      let selection = d3.brushSelection(node);
      let live = !!selection && selection[0] !== selection[1];
      let last = entry.list[entry.list.length - 1];
      if (item === last) {
        if (live) this.addAxisBrush(dim, null);
        else this.writeAxisBrushes(dim, []);
      } else if (!live) {
        entry.list = entry.list.filter((b) => b !== item);
      }
      this.drawAxisBrushes(dim);

      let shown = this.readAxisBrushes()[dim] || [];
      let pairs = [];
      this.$store.state.filters.forEach((filter) => {
        if (filter.kind !== "range" || filter.dims.length !== 2) return;
        if (!filter.dims.includes(dim)) return;
        let boxes = filter.boxes
          .map((box, index) => {
            // A rectangle unconstrained on this dimension has no brush here.
            if (!box[dim]) return box;
            let drawn = shown.find(
              (s) => s.from && s.from.key === filter.key && s.from.index === index
            );
            return drawn ? Object.assign({}, box, { [dim]: drawn.range }) : null;
          })
          .filter(Boolean);
        pairs.push({ key: filter.key, boxes: boxes });
      });
      this.$store.dispatch("setAxisBrushes", {
        dim: dim,
        ranges: shown.filter((s) => !s.from).map((s) => s.range),
        pairs: pairs,
      });
    },
    /**
     * What each axis should show: `[{ range, from }]`, its own brushes (from
     * null) and the range of every scatterplot rectangle on this dimension.
     */
    axisItemsFor(dim) {
      let items = this.$store.getters
        .boxesFor([dim])
        .map((box) => ({ range: box[dim], from: null }));
      this.$store.state.filters.forEach((filter) => {
        if (filter.kind !== "range" || filter.dims.length !== 2) return;
        if (!filter.dims.includes(dim)) return;
        filter.boxes.forEach((box, index) => {
          if (box[dim]) {
            items.push({ range: box[dim], from: { key: filter.key, index: index } });
          }
        });
      });
      return items;
    },
    /** `{ dim: [{ range, from }, ...] }` of the brushes drawn, oldest first. */
    readAxisBrushes() {
      let out = {};
      Object.keys(this.liteBrushes || {}).forEach((dim) => {
        let entry = this.liteBrushes[dim];
        out[dim] = [];
        entry.list.forEach((item) => {
          let node = this.axisBrushNode(entry, item);
          let raw = node ? d3.brushSelection(node) : null;
          if (!raw || raw[0] === raw[1]) return;
          let a = entry.yscale.invert(raw[0]);
          let b = entry.yscale.invert(raw[1]);
          out[dim].push({ range: [Math.min(a, b), Math.max(a, b)], from: item.from });
        });
      });
      return out;
    },
    /** Redraws an axis with exactly these `[{ range, from }]`, plus the empty brush. */
    writeAxisBrushes(dim, items) {
      let entry = this.liteBrushes[dim];
      this.isSyncingBrush = true;
      try {
        entry.list = [];
        items.forEach((item) => this.addAxisBrush(dim, item.from));
        this.addAxisBrush(dim, null);
        this.drawAxisBrushes(dim);
        entry.list.forEach((item, i) => {
          let node = d3.select(this.axisBrushNode(entry, item));
          if (i < items.length) {
            let range = items[i].range;
            let ys = [entry.yscale(range[0]), entry.yscale(range[1])];
            node.call(item.brush.move, [
              Math.min(ys[0], ys[1]),
              Math.max(ys[0], ys[1]),
            ]);
          } else {
            node.call(item.brush.move, null);
          }
        });
      } finally {
        this.isSyncingBrush = false;
      }
    },
    clearLiteBrushes() {
      Object.keys(this.liteBrushes || {}).forEach((dim) =>
        this.writeAxisBrushes(dim, [])
      );
    },
    /**
     * Draws the store's brushes on each axis, so a filter set on the
     * scatterplot, typed to the assistant, restored by undo, or removed from
     * the filter bar shows here. Ranges read back from pixels differ from the
     * stored ones by noise, which the tolerance ignores.
     */
    syncLiteBrushes() {
      if (!this.isLite || !this.chart || !this.liteBrushes) return;
      let drawn = this.readAxisBrushes();
      Object.keys(this.liteBrushes).forEach((dim) => {
        let wanted = this.axisItemsFor(dim);
        let domain = this.liteBrushes[dim].yscale.domain();
        // A goal can run an axis downward, so its span is taken either way.
        let span = Math.abs(domain[1] - domain[0]);
        if (sameAxisItems(drawn[dim] || [], wanted, span)) {
          return;
        }
        this.writeAxisBrushes(dim, wanted);
      });
    },
    /**
     * What a line is drawn in: its own colour, except the inspected one,
     * which is darkened until it can be found (see standOut). The library
     * asks for this afresh each time it marks a line, so inspecting another
     * option is enough to move the darkening to it.
     */
    lineColor(datum) {
      let color = this.colorize(datum);
      let hovered = this.$store.getters.getHovered;
      if (!hovered || !datum || hovered._id !== datum._id) return color;
      return standOut(color);
    },
    hoverHandler: function() {
      this.cleanTooltip();
      this.chart.unmark();

      let hovered = this.$store.getters.getHovered;
      this.isInspecting = !!hovered;
      if (hovered) {
        this.chart.mark([hovered]);
        this.addTooltip([hovered]);
      }

      this.updateStyleGivenHovered(hovered);
      this.drawKnobs();
    },
    updateStyleGivenHovered(hovered) {
      let dict = {}
      d3.select("#" + this.viewID)
        .selectAll("canvas").nodes().map(canvas => dict[canvas.getAttribute("class").split(' ')[0]] = canvas)
          var selection = this.$store.getters.selectedDataInView(this.viewID);
          if(Object.keys(dict).length == 0)
              return;
          
          // Active filters that match nothing still dim every line.
          if(selection.length > 0 || this.isFilterActive)
          {
            if(hovered)
            {
              dict["foreground"].style.opacity = 0.25;
              dict["brushed"].style.opacity = 0.25;
              dict["highlight"].style.opacity = 0.5;
            }
            else 
            {
              dict["foreground"].style.opacity = 0.35;
              dict["brushed"].style.opacity = 0.35;
              dict["highlight"].style.opacity = 1;
            }
          }
          else 
          {
            dict["highlight"].style.opacity = 0.0;

            if(hovered)
            {
              dict["foreground"].style.opacity = 0.5;
              dict["brushed"].style.opacity = 0.5;
            }
            else 
            {
              dict["foreground"].style.opacity = 1;
              dict["brushed"].style.opacity = 0.0;
            }
          }
    },
    markLineOnHover(mousePosition) {
      let hoveredData = this.getHoveredLines(mousePosition);
      //console.log(hoveredData);
      if (hoveredData && hoveredData.length != 0) {
        //picking the first in the array for now (todo: consider picking the closes to mouse?)
        if (hoveredData[0] !== this.$store.state.hovered) {
          this.$store.commit("hover", { hovered: hoveredData[0] });
        }
      }
    },
    recordPress(e) {
      this.press = {
        x: e.clientX,
        y: e.clientY,
        // Axis ticks, titles and strum overlays all sit inside g.dimension.
        onAxis: !!(e.target && e.target.closest && e.target.closest("g.dimension")),
      };
    },
    /** The line under `pos`, preferring the inspected one, then one in the result. */
    pickLineAt(pos) {
      let lines = this.getHoveredLines(pos, 4);
      if (!Array.isArray(lines) || lines.length === 0) return null;
      let hovered = this.hovered;
      if (hovered && lines.some((d) => d._id === hovered._id)) return hovered;
      if (this.isFilterActive) {
        let matching = new Set(
          this.$store.getters.selectedDataInView(this.viewID).map((d) => d._id)
        );
        let inResult = lines.find((d) => matching.has(d._id));
        if (inResult) return inResult;
      }
      return lines[0];
    },
    /**
     * A click on a line (not on an axis, not a drag) inspects it; clicking
     * the inspected line stops inspecting.
     */
    onChartClick(pos, evt) {
      let press = this.press;
      this.press = null;
      if (!press || press.onAxis) return;
      if (Math.hypot(evt.clientX - press.x, evt.clientY - press.y) >= 3) return;
      let item = this.pickLineAt(pos);
      if (!item) return;
      let isInspected = !!this.hovered && this.hovered._id === item._id;
      if (this.can("clickToInspect") || this.isChartHoverEnabled || isInspected) {
        this.$store.dispatch("inspectByClick", { item: item });
      }
    },
    updateLineCursor(pos) {
      if (this.cursorFrame) return;
      this.cursorFrame = requestAnimationFrame(() => {
        this.cursorFrame = null;
        let lines = this.chart ? this.getHoveredLines(pos, 4) : false;
        d3.select("#" + this.viewID)
          .select("svg")
          .style("cursor", lines && lines.length ? "pointer" : null);
      });
    },
    cleanTooltip() {
      // removes any object under #tooltip is
      this.chart.svg.selectAll("#tooltip").remove();
    },
    addTooltip(clicked) {
      // add tooltip to multiple clicked lines
      var clickedDataSet = [];

      let dimensions = this.chart.dimensions();
      let xscale = this.chart.xscale;
      let nullY = this.nullBandY();
      let knobAxes = new Set(this.customDimensionNames);

      for (var i = 0; i < clicked.length; i++) {
        let datum = clicked[i];
        for (let dimName in dimensions) {
          let dim = dimensions[dimName];
          let yscale = dim.yscale;

          // A missing value is drawn in the band below the axes.
          let y = yscale(datum[dimName]);
          if (!Number.isFinite(y)) y = nullY;
          // The inspected option's knob sits on custom axes; keep clear of it.
          if (knobAxes.has(dimName)) y = this.knobTooltipY(y);
          let x = xscale(dimName);

          clickedDataSet.push([
            x,
            y,
            this.formatAxisValue(dimName, datum[dimName]),
          ]);
        }
      }
      this.createTooltip(clickedDataSet);
    },
    //array of tuples where each is [x,y,text]  for the tooltip
    createTooltip(specs) {
      // add rectangles
      var fontSize = 14;
      var padding = 2;
      var rectHeight = fontSize + 2 * padding; //based on font size

      this.chart.svg
        .selectAll("rect[id='tooltip']")
        .data(specs)
        .enter()
        .append("rect")
        .attr("x", function(d) {
          return d[0] - d[2].length * 5;
        })
        .attr("y", function(d) {
          return d[1] - rectHeight + 2 * padding;
        })
        .attr("rx", "2")
        .attr("ry", "2")
        .attr("id", "tooltip")
        .attr("fill", "grey")
        .attr("opacity", 1)
        .attr("width", function(d) {
          return d[2].length * 10;
        })
        .attr("height", rectHeight);

      // add text on top of rectangle
      this.chart.svg
        .selectAll("text[id='tooltip']")
        .data(specs)
        .enter()
        .append("text")
        .attr("x", function(d) {
          return d[0];
        })
        .attr("y", function(d) {
          return d[1];
        })
        .attr("id", "tooltip")
        .attr("fill", "white")
        .attr("text-anchor", "middle")
        .attr("font-size", fontSize)
        .text(function(d) {
          return d[2];
        });
    },
    getHoveredLines(mouseClick, tolerance) {
      var hovered = [];
      var activeData = this.getActiveData();

      if (this.graphCentriodPoints == null) {
        // find centriod points. This value will be null if the chart data changed
        this.graphCentriodPoints = this.getCentroids(activeData);
      }

      if (this.graphCentriodPoints.length == 0) return false;

      // find between which axes the point is
      var axeNum = this.findAxes(mouseClick, this.graphCentriodPoints[0]);
      if (!axeNum) return false;
      if (tolerance === undefined) tolerance = 3;
      this.graphCentriodPoints.forEach((d, i) => {
        if (this.isOnLine(d[axeNum - 1], d[axeNum], mouseClick, tolerance)) {
          hovered.push(activeData[i]);
        }
      });
      return hovered;
    },
    isOnLine(startPt, endPt, testPt, tol) {
      // check if test point is close enough to a line
      // between startPt and endPt. close enough means smaller than tolerance
      var x0 = testPt[0];
      var y0 = testPt[1];
      var x1 = startPt[0];
      var y1 = startPt[1];
      var x2 = endPt[0];
      var y2 = endPt[1];
      var Dx = x2 - x1;
      var Dy = y2 - y1;
      var delta =
        Math.abs(Dy * x0 - Dx * y0 - x1 * y2 + x2 * y1) /
        Math.sqrt(Math.pow(Dx, 2) + Math.pow(Dy, 2));
      if (delta <= tol) return true;
      return false;
    },
    // Add highlight for every line on hovered
    getCentroids(data) {
      // this function returns centroid points for data. I had to change the source
      // for parallelcoordinates and make compute_centroids public.
      // I assume this should be already somewhere in graph and I don't need to recalculate it
      // but I couldn't find it so I just wrote this for now
      var margins = this.chart.margin();
      var graphCentPts = [];
      let nullY = this.nullBandY();
      // console.log("filtered " + data);
      data.forEach((d) => {
        var initCenPts = this.chart.compute_real_centroids(d);

        // move points based on margins; missing values cross below the axes
        var cenPts = initCenPts.map(function(d) {
          let y = Number.isFinite(d[1]) ? d[1] : nullY;
          return [d[0] + margins["left"], y + margins["top"]];
        });

        graphCentPts.push(cenPts);
      });

      return graphCentPts;
    },
    findAxes(testPt, cenPts) {
      // finds between which two axis the mouse is
      var x = testPt[0];
      var y = testPt[1];

      // make sure it is inside the range of x
      if (cenPts[0][0] > x) return false;
      if (cenPts[cenPts.length - 1][0] < x) return false;

      // find between which segment the point is
      for (var i = 0; i < cenPts.length; i++) {
        if (cenPts[i][0] > x) return i;
      }
    },
    getActiveData() {
      // I'm pretty sure this data is already somewhere in graph
      if (this.chart.brushed() != false) return this.chart.brushed();
      return this.chart.data();
    },
    Chart: function() {
      //   nullValueSeparator: "bottom",
      var sampleDimensions = {
        "in:width": {
          title: "Width",
          orient: "left",
          type: "number",
          yscale: d3.scaleLinear().range([0, this.height]),
        },
        "in:height": {
          title: "Height",
          orient: "left",
          type: "number",
          yscale: d3.scaleLinear().range([0, this.height]),
        },
        "in:length": {
          title: "Length",
          orient: "left",
          type: "number",
          yscale: d3.scaleLinear().range([0, this.height]),
        },
        "out:surfaceArea": {
          title: "Surface Area",
          orient: "left",
          type: "ynumber",
          scale: d3.scaleLinear().range([0, this.height]),
        },
        "out:volume": {
          title: "Volume",
          orient: "left",
          type: "number",
          yscale: d3.scaleLinear().range([0, this.height]),
        },
        "out:edgeLength": {
          title: "Edge Length",
          orient: "left",
          type: "number",
          yscale: d3.scaleLinear().range([0, this.height]),
        },
      };

      let ink = this.lineInk;
      const chart = ParCoords({
        markedLineWidth: 4,
        // A little thicker than the rest, which with the selection's own
        // alpha (see highlight) separates it from them without reaching the
        // inspected line's 4.
        highlightedLineWidth: 1.8,
        alpha: ink.alpha,
        lineWidth: ink.width,
        margin: this.chartMargin,
        // Options missing a value cross below the axes, under a separator line.
        nullValueSeparator: "bottom",
       // markedShadowColor: "#ff0000",
       // markedShadowBlur: 4,

      })("#" + this.viewID)
        .data(this.chartData)
        .width(Math.max(0, this.width - 8))
        .height(Math.max(0, this.chartHeight - 6));
      // The library reads each axis type from the first row, and hiding axes
      // renders, which fails for a type it can't scale: a blank first value.
      declareNumberAxes(
        chart,
        this.chartData,
        this.numericDimensions,
        this.axisOrder
      );
      chart.hideAxis(this.hiddenAxes());
      applyNumericTypes(chart, this.numericDimensions);
      applyFixedScales(chart, this.fixedAxisBounds, this.axisTitles);
      // A dimension that has gone takes its flip with it.
      this.flippedAxes = this.flippedAxes.filter((dim) =>
        this.numericDimensions.includes(dim)
      );
      applyGoalOrientation(chart, this.goalOf, this.flippedAxes);
      applyTickCounts(chart);

      chart.createAxes();
      // Expert brushes once per axis with the library; Lite draws its own
      // brushes (several per axis, OR-ed) once the chart is rendered.
      if (!this.can("multiBrush")) chart.brushMode("1D-axes");
      chart
        .reorderable()
        .mode("default")

        .render()
        .on("brushend", (brushed, args) => {
          if (this.isSyncingBrush) return;
          if (d3.event.selection === null) return;
          //To clear the brush/strum once done
          // d3.select("#"+this.viewID).selectAll('.selection').style("display", "none");

          if (chart.brushed().length == chart.data().length) {
            // Clear the strum as well, as the branch below does.
            this.isSyncingBrush = true;
            try {
              chart.brushReset();
            } finally {
              this.isSyncingBrush = false;
            }
            this.$store.dispatch("update", {
              view: this.viewID,
              selection: [],
              operation: operations.REPLACE,
            });
          } else {
            this.chart.brushReset();
            this.$store.dispatch("update", {
              view: this.viewID,
              selection: brushed.map((d) => d._id),
              operation: this.currentSelectionOperation,
              step: this.axisStep(brushed, args),
            });
          }
        })
        .on("brush", (brushed, args) => {
          if (this.isSyncingBrush) return;
          this.cleanTooltip();

          if (args && d3.event.type === "brush") {
            let sel = args.selection;
            // On the axis, not under the pointer (see onAxisBrushMove).
            let x = this.chart.xscale(args.axis);
            if (sel.raw.length > 0 && Number.isFinite(x)) {
              let rawY = sel.raw;
              let scaledY = sel.scaled;
              // console.log(sel, sel.scaled);
              this.createTooltip([
                [x, rawY[0], round(scaledY[0], 4) + ""],
                [x, rawY[1], round(scaledY[1], 4) + ""],
              ]);
            }
          }
        })
        .on("highlight", (e) => {
          //console.log("highlighting");
        })
        .on("render", (e) => {
          //console.log("render");
          //[todo] this event is raised many time. Is there a better event to listen to or a more efficient implementation of code below?
          /// var selection = this.$store.getters.selectedDataInView(this.viewID);
          // chart.highlight(selection);
          this.graphCentriodPoints = null;
        });

      chart.color((d) => this.lineColor(d)).render();
      // Flipping an axis or brushing re-renders; knobs follow.
      chart.on("render.knobs", () => this.scheduleKnobRedraw());
      // Reordering moves axes and re-renders; titles are refitted to the new
      // neighbours (a no-op when nothing moved).
      chart.on("render.titles", () => this.scheduleTitleFit(chart));

      //Source for the hover on mouse over is adopted from: http://bl.ocks.org/mostaphaRoudsari/b4e090bb50146d88aec4
      //This includes all the auxilary functions called downstream from markLineOnHover() which was called highlightLineOnClick() in the orignal source
      var vueThis = this;
      let svg = d3.select("#" + this.viewID).select("svg");
      svg
        .on("mousemove", function() {
          var mousePosition = d3.mouse(this);
          if (vueThis.isChartHoverEnabled) {
            vueThis.markLineOnHover(mousePosition); //true will also add tooltip
          } else if (vueThis.can("clickToInspect")) {
            vueThis.updateLineCursor(mousePosition);
          }
        })
        .on("mouseleave", () => {
          svg.style("cursor", null);
        })
        .on("click", function() {
          vueThis.onChartClick(d3.mouse(this), d3.event);
        });
      // Strums and axis drags stop propagation, so listen in the capture phase
      // to learn where every press began.
      svg.node().addEventListener("mousedown", (e) => this.recordPress(e), true);

      // Titles are coloured in decorateAxes, which runs per axis with the
      // dimension in hand. It used to be done here with a document-wide
      // selection and a list of colours indexed by position, which two
      // parallel-coordinates panels would have crossed, and which an axis
      // flip dropped because only createAxes writes the titles.
      this.decorateAxes(chart);
      this.bindAxisTitles(chart);
      chart.on("render.axes", () => {
        // Dragging an axis sorts the dimensions and renders, so this is
        // where the order the reader left them in is read off.
        this.axisOrder = chart.getOrderedDimensionKeys();
        this.decorateAxes(chart);
        this.bindAxisTitles(chart);
      });
      this.fittedTitlesKey = null;
      this.fitAxisTitles(chart);

      //Resetting the centroids data used for faster hovering via memoization.
      this.graphCentriodPoints = null;

      if (this.can("multiBrush")) this.installLiteBrushes(chart);
      else this.liteBrushes = null;

      //To place the zero values at center vertically  https://github.com/BigFatDog/parcoords-es/issues/16
      /* 
      this.numericDimensions.forEach(dim => 
      {
        let extents = d3.extent(this.chartData, d => d[dim])
        
        let x = Math.abs(extents[0])
        let y = Math.abs(extents[1])
        let largest = x > y? x: y;
        console.log(dim, [-largest,largest])
        if(!isNaN(largest))
            chart.scale(dim, [-largest,largest])
      });
      */
      /* //https://github.com/syntagmatic/parallel-coordinates/issues/41
      chart.dimensions(
        this.prepareDimensions(
          this.chartData,
          this.numericDimensions,
          this.chart
        ).createAxes().render()
      );
      */

      return chart;
    },
  },
};

/**
 * The file's columns in the order the axes should stand in: the ones the
 * reader has arranged take the places those same columns hold in the file,
 * in the order they were left in, and every other column keeps its own place.
 *
 * Put the other way round, dragging axes about rearranges them among
 * themselves and moves nothing else. So an axis switched off and on again
 * comes back where the file put it rather than at the far right, and a
 * column that arrives with new data lands where the file has it.
 */
function orderedColumns(columns, order) {
  let known = (Array.isArray(order) ? order : []).filter((dim) =>
    columns.includes(dim)
  );
  if (known.length === 0) return columns;
  let result = columns.slice();
  let at = 0;
  columns.forEach((dim, i) => {
    if (known.includes(dim)) result[i] = known[at++];
  });
  return result;
}

/**
 * Declares numeric axes before anything renders. Without this, a blank value
 * in the first row makes the library type the axis "undefined", which it has
 * no scale for.
 *
 * They are declared in `order` (see orderedColumns), which is how an axis
 * dragged to a new place stays there: the library takes the order it is
 * given, and a rebuild would otherwise go back to the file's.
 */
function declareNumberAxes(chart, data, numericDimensions, order) {
  if (!data || data.length === 0) return;
  let columns = Object.keys(data[0]).filter(
    (dim) => numericDimensions.indexOf(dim) !== -1
  );
  let declared = {};
  orderedColumns(columns, order).forEach((dim) => {
    declared[dim] = { type: "number" };
  });
  if (Object.keys(declared).length > 0) chart.dimensions(declared);
}

/**
 * Where the tint behind a custom or weighted axis goes, in the axis's own
 * coordinates: from above its title to its foot, as wide as the axes' spacing
 * allows without touching a neighbour's.
 */
function axisBand(chart) {
  let margin = chart.margin();
  let h = chart.height() - margin.top - margin.bottom;
  let xs = Object.keys(chart.dimensions())
    .map((dim) => chart.xscale(dim))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  let spacing = Infinity;
  for (let i = 1; i < xs.length; i++) spacing = Math.min(spacing, xs[i] - xs[i - 1]);
  let width = Math.max(10, Math.min(28, spacing - 8));
  let top = -Math.min(margin.top - 1, 24);
  return { width: width, top: top, height: h - top + 2 };
}

/**
 * Draws these axes over fixed bounds (`{ dim: [min, max] }`) rather than their
 * values' extent, with a linear scale even when every value is the same or
 * missing, so they stay put while values change and knobs can be dragged.
 * The Rating axis always spans 0 to 5 stars, however few are rated.
 */
function applyFixedScales(chart, boundsByDim, titles) {
  let dimensions = chart.dimensions();
  if (!dimensions) return;
  let margin = chart.margin();
  let padding = chart.nullValueSeparatorPadding();
  let h = chart.height() - margin.top - margin.bottom;
  let range = [h + 1 - padding.bottom - padding.top, 1];
  Object.keys(dimensions).forEach((dim) => {
    let axis = dimensions[dim];
    if (titles[dim]) axis.title = titles[dim];
    let bounds = boundsByDim[dim];
    if (!bounds) return;
    axis.type = "number";
    axis.yscale = d3
      .scaleLinear()
      .domain(bounds.slice())
      .range(range);
  });
}

/**
 * Puts better at the top: an axis whose dimension has "lower is better" for
 * its goal runs from its highest value at the foot to its lowest at the top.
 * The library makes a scale only for an axis without one, and keeps it
 * through renders, so the axes are scaled first and the reversed ones stay
 * reversed.
 *
 * `flipped` are the axes the reader turned over by double-clicking a title
 * (see flipAxis). A goal's reversal and a reader's cancel each other out:
 * asking for the other way round on an axis already the other way round
 * puts it back as it was.
 */
function applyGoalOrientation(chart, goalOf, flipped) {
  let dimensions = chart.dimensions();
  if (!dimensions) return;
  let turned = new Set(flipped || []);
  let reversed = Object.keys(dimensions).filter(
    (dim) => (goalOf(dim) === MIN) !== turned.has(dim)
  );
  if (reversed.length === 0) return;
  chart.autoscale();
  reversed.forEach((dim) => {
    let yscale = dimensions[dim].yscale;
    if (!yscale || typeof yscale.invert !== "function") return;
    yscale.domain(yscale.domain().slice().reverse());
  });
}

/**
 * Gives every axis about one tick per AXIS_TICK_SPACING pixels of its height,
 * rather than the library's fixed 5. Flipping an axis redraws it from the same
 * settings, so the count sticks.
 */
function applyTickCounts(chart) {
  let dimensions = chart.dimensions();
  if (!dimensions) return;
  let margin = chart.margin();
  let padding = chart.nullValueSeparatorPadding();
  let axisHeight =
    chart.height() - margin.top - margin.bottom - padding.bottom - padding.top;
  let ticks = Math.max(
    2,
    Math.min(MAX_AXIS_TICKS, Math.round(axisHeight / AXIS_TICK_SPACING))
  );
  Object.keys(dimensions).forEach((dim) => {
    let axis = dimensions[dim];
    axis.ticks = ticks;
    // Ratings are whole stars, so their axis has no half-star ticks.
    if (dim === RATING_DIMENSION) {
      axis.tickValues = d3.range(RATING_BOUNDS[0], RATING_BOUNDS[1] + 1);
    }
    // Left unset, d3 writes a year axis "1,950 … 2,000". The format is worked
    // out from this axis's own scale and count each time its ticks are drawn,
    // so it follows a flip or a resize.
    if (axis.type === "number") {
      axis.tickFormat = function(value) {
        if (!axis.yscale) return String(value);
        // Whole stars need no decimals, whatever the scale would tick.
        if (axis.tickValues) return d3.format(",")(value);
        return axisTickFormat(axis.yscale, axis.ticks)(value);
      };
    }
  });
}

/** Marks every numeric dimension as a number axis, whatever the first row holds. */
function applyNumericTypes(chart, numericDimensions) {
  let dimensions = chart.dimensions();
  if (!dimensions) return;
  let changed = false;
  Object.keys(dimensions).forEach((dim) => {
    if (
      numericDimensions.indexOf(dim) !== -1 &&
      dimensions[dim].type !== "number"
    ) {
      dimensions[dim].type = "number";
      changed = true;
    }
  });
  if (changed) chart.dimensions(dimensions);
}

/** Whether an axis shows these brushes: same ranges (within tolerance) with the same origins, in any order. */
function sameAxisItems(drawn, wanted, span) {
  if (drawn.length !== wanted.length) return false;
  let left = wanted.slice();
  return drawn.every((item) => {
    let at = left.findIndex(
      (other) =>
        sameRange(item.range, other.range, span) &&
        (item.from ? other.from && other.from.key === item.from.key && other.from.index === item.from.index : !other.from)
    );
    if (at < 0) return false;
    left.splice(at, 1);
    return true;
  });
}

</script>

<style scoped>
.parcoords {
  /* cursor: crosshair;*/
}

::v-deep .parcoords rect.overlay {
  fill: transparent;
}

::v-deep .parcoords rect.overlay:hover {
  fill: rgba(120, 120, 120, 0.2);
}

/* A brush shows its resize grips while the pointer is over it. */
::v-deep .parcoords g.lite-brush rect.handle {
  fill: transparent;
}
::v-deep .parcoords g.lite-brush:hover rect.handle {
  fill: rgba(40, 40, 40, 0.3);
}

/* Behind a custom or weighted axis; the lines and the title stay clickable. */
::v-deep .parcoords rect.ds-axis-band {
  fill-opacity: 0.08;
  pointer-events: none;
}
/* Custom and weighted axes can't be brushed; the library reinstalls its brushes, so hide them. */
::v-deep .parcoords g.dimension.ds-unfilterable > g.brush {
  display: none;
}
/* The inspected option's thumb on a custom axis. */
::v-deep .parcoords g.ds-knob {
  cursor: grab;
}
::v-deep .parcoords g.ds-knob .ds-knob-target {
  fill: transparent;
}
::v-deep .parcoords g.ds-knob .ds-knob-thumb {
  fill: #ffffff;
  stroke: #6a1b9a;
  stroke-width: 2px;
  filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.35));
}
::v-deep .parcoords g.ds-knob .ds-knob-grip {
  stroke: #6a1b9a;
  stroke-width: 1.5px;
  stroke-linecap: round;
  pointer-events: none;
}
::v-deep .parcoords g.ds-knob:hover .ds-knob-thumb,
::v-deep .parcoords g.ds-knob.ds-knob--dragging .ds-knob-thumb {
  fill: #f3e5f5;
  stroke-width: 2.5px;
}
/* Waiting below the axes: this option has no value yet. */
::v-deep .parcoords g.ds-knob.ds-knob--empty .ds-knob-thumb {
  stroke-dasharray: 3 2;
}

#tooltip {
  font-family: sans-serif;
  font-size: 14px;
  font-weight: bold;
  color: black;
}

::v-deep .multiselect__tag {
  width: 50px;
  display: none;
}

::v-deep .multiselect {
  width: 200px;
  margin-top: 10px;
}

/* Titles sit level above the axes; fitAxisTitles keeps them apart. */
.parcoords /deep/ .label {
  transform: translate(0px, -10px);
}
::v-deep .parcoords g.axis .tick text {
  font-size: 10px;
  fill: #78909c;
  font-variant-numeric: tabular-nums;
}
/* The library writes these inline when it builds an axis, and does not write
   them again when it updates one, so restyling them in script is lost on the
   next flip. */
::v-deep .parcoords g.axis .tick line {
  stroke: #cfd8dc !important;
}
/* A custom or weighted axis is left out: decorateAxes gives it the colour of
   its own mark, inline, which !important here would override. */
::v-deep .parcoords g.dimension:not(.ds-custom-axis):not(.ds-weighted-axis) path.domain {
  stroke: #b0bec5 !important;
}
::v-deep .parcoords text.label {
  font-size: 11px;
  cursor: pointer;
}
/* Joins a lifted title to the axis below it. */
::v-deep .parcoords line.ds-title-leader {
  stroke: #cfd8dc;
  stroke-width: 1px;
  pointer-events: none;
}

</style>

<style scoped>
.pcp-view {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* Centred in whatever the chart does not take, so a panel taller than the
   chart should be reads as room to spare rather than a chart cut short. */
.pcp-view .parcoords {
  flex: 0 0 auto;
  position: relative;
  margin: auto 0;
}
</style>

<style>
/* While a custom-axis knob is dragged, the grabbing hand follows the pointer anywhere. */
body.ds-knob-grabbing,
body.ds-knob-grabbing * {
  cursor: grabbing !important;
}
</style>
