<template>
  <div class="pcp-view" :style="{ height: `${height}px` }">
    <PanelHeader
      icon="mdi-chart-timeline-variant"
      title="Parallel coordinates"
      :compact="width < 640"
    >
      <span class="ph-meta">{{ headerHint }}</span>
      <template v-slot:actions>
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
              <v-list-item-title>{{ dim }}</v-list-item-title>
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
import { PANEL_HEADER_HEIGHT } from "@/layout.js";
import { round } from "@/components/utils.js";
import { sameRange } from "@/store/filters.js";
import { operations } from "@/components/operations.js";
import { RATING_BOUNDS, RATING_DIMENSION } from "@/ratings.js";

export default {
  mixins: [TemplateView],
  components: { PanelHeader },
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
    };
  },
  computed: {
    ...mapState({
      numericDimensions: (state) => state.numericDimensions,
      nonNumericDimensions: (state) => state.nonNumericDimensions,
    }),
    ...mapGetters([
      "inputDimensions",
      "outputDimensions",
      "hasRatings",
    ]),
    // Rating is offered once something is rated, since only then has it an axis.
    axisOptions() {
      return this.numericDimensions.filter(
        (dim) => dim !== RATING_DIMENSION || this.hasRatings
      );
    },
    visibleAxisCount() {
      return this.axisOptions.filter((dim) => this.isAxisShown(dim)).length;
    },
    chartHeight() {
      return this.height - this.headerHeight;
    },
    headerHint() {
      return (
        (this.isLite
          ? "Drag along an axis to filter"
          : "Drag along an axis to select") + " · drag a title to reorder"
      );
    },
  },
  mounted() {},
  created() {
    this.keysBlackList = [
      "index",
      "selected",
      "gltf",
      "image",
      "ID",
      "id",
      "_id",
      "geometry",
      "json",
      "img",
      "threeD",
      "collection",
      "images",
    ];
    this.allKeys = Object.keys(this.chartData[0]);

    // A copy, so the store's list of categorical dimensions is left alone.
    this.excludedDimensions = this.nonNumericDimensions.concat(["selected"]);
    // Lite's own axis brushes by dimension. Not in data(): d3 state, not view state.
    this.liteBrushes = null;
  },
  watch: {
    // The Rating axis appears with the first rating.
    hasRatings: function() {
      this.scheduleRefresh();
    },
  },
  methods: {
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
        this.chart.highlight(result);
        this.syncLiteBrushes();
      }
      let hovered = this.$store.getters.getHovered;
      this.updateStyleGivenHovered(hovered);
    },
    afterChartRebuilt() {
      this.syncLiteBrushes();
      this.updateStyleGivenHovered(this.$store.getters.getHovered);
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
      this.liteBrushes = {};
      chart.g().each(function(dim) {
        let axis = dimensions[dim];
        if (!axis || hidden.includes(dim)) return;
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
      let x = d3.event.sourceEvent.clientX - this.x;
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
      this.drawPairStrums();
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
        if (sameAxisItems(drawn[dim] || [], wanted, domain[1] - domain[0])) {
          return;
        }
        this.writeAxisBrushes(dim, wanted);
      });
      this.drawPairStrums();
    },
    /**
     * A scatterplot rectangle is drawn as a brush on each of its two axes;
     * this joins the two, top to top and bottom to bottom, so the pair reads
     * as one rectangle rather than two independent brushes. Every line
     * between the two ranges runs between the ties.
     */
    drawPairStrums() {
      if (!this.chart || !this.liteBrushes) return;
      let layer = this.chart.svg.select("g.lite-strums");
      if (layer.empty()) {
        layer = this.chart.svg.insert("g", ":first-child").attr("class", "lite-strums");
      }
      let dimensions = this.chart.dimensions();
      let xscale = this.chart.xscale;
      let pixels = (dim, range) => {
        let y = dimensions[dim].yscale;
        let ys = range ? [y(range[0]), y(range[1])] : y.range();
        return [Math.min(ys[0], ys[1]), Math.max(ys[0], ys[1])];
      };
      let strums = [];
      if (this.isLite) {
        this.$store.state.filters.forEach((filter) => {
          if (filter.kind !== "range" || filter.dims.length !== 2) return;
          if (!filter.dims.every((dim) => this.liteBrushes[dim])) return;
          let [left, right] = filter.dims
            .slice()
            .sort((a, b) => xscale(a) - xscale(b));
          filter.boxes.forEach((box, i) => {
            let ya = pixels(left, box[left]);
            let yb = pixels(right, box[right]);
            [0, 1].forEach((edge) => {
              strums.push({
                key: filter.key + ":" + i + ":" + edge,
                x1: xscale(left),
                y1: ya[edge],
                x2: xscale(right),
                y2: yb[edge],
              });
            });
          });
        });
      }
      let groups = layer.selectAll("g.lite-strum").data(strums, (d) => d.key);
      let entered = groups.enter().append("g").attr("class", "lite-strum");
      entered.append("line");
      entered.append("circle").attr("class", "from").attr("r", 3.5);
      entered.append("circle").attr("class", "to").attr("r", 3.5);
      let all = entered.merge(groups);
      all
        .select("line")
        .attr("x1", (d) => d.x1)
        .attr("y1", (d) => d.y1)
        .attr("x2", (d) => d.x2)
        .attr("y2", (d) => d.y2);
      all
        .select("circle.from")
        .attr("cx", (d) => d.x1)
        .attr("cy", (d) => d.y1);
      all
        .select("circle.to")
        .attr("cx", (d) => d.x2)
        .attr("cy", (d) => d.y2);
      groups.exit().remove();
    },

    hoverHandler: function() {
      this.cleanTooltip();
      this.chart.unmark();

      let hovered = this.$store.getters.getHovered;
      if (hovered) {
        this.chart.mark([hovered]);
        this.addTooltip([hovered]);
      }

      this.updateStyleGivenHovered(hovered);
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
     * A click on a line (not on an axis, not a drag) inspects it in Lite. In
     * either mode, clicking the inspected line stops inspecting.
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

      var margins = this.chart.margin();
      let dimensions = this.chart.dimensions();
      let xscale = this.chart.xscale;

      for (var i = 0; i < clicked.length; i++) {
        let datum = clicked[i];
        for (let dimName in dimensions) {
          let dim = dimensions[dimName];
          let yscale = dim.yscale;

          let y = yscale(datum[dimName]);
          let x = xscale(dimName);

          var text = datum[dimName];
          clickedDataSet.push([x, y, "" + text]);
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
      // console.log("filtered " + data);
      data.forEach((d) => {
        var initCenPts = this.chart.compute_real_centroids(d);

        // move points based on margins
        var cenPts = initCenPts.map(function(d) {
          return [d[0] + margins["left"], d[1] + margins["top"]];
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

      const chart = ParCoords({
        markedLineWidth: 4,
        highlightedLineWidth: 1.4,
        lineWidth: 1.4,
        // Options missing a value cross below the axes, under a separator line.
        nullValueSeparator: "bottom",
       // markedShadowColor: "#ff0000",
       // markedShadowBlur: 4,

      })("#" + this.viewID)
        .data(this.chartData)
        .width(this.width - 8)
        .height(this.chartHeight - 6)
        //    .dimensions(sampleDimensions)
        //chart.detectDimensions();
        .hideAxis(this.hiddenAxes());

      // The library reads each axis type from the first row, which may be blank.
      applyNumericTypes(chart, this.numericDimensions);

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
            });
          }
        })
        .on("brush", (brushed, args) => {
          if (this.isSyncingBrush) return;
          this.cleanTooltip();

          if (args && d3.event.type === "brush") {
            let sel = args.selection;
            if (sel.raw.length > 0) {
              let x = d3.event.sourceEvent.clientX - this.x;
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

      chart.color((d) => this.colorize(d)).render();

      // The Rating axis always spans 0 to 5 stars, however few are rated.
      if (chart.dimensions()[RATING_DIMENSION]) {
        chart.scale(RATING_DIMENSION, RATING_BOUNDS.slice());
      }

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
      // Dragging a title reorders the axes over a short transition; the
      // bands between axes follow once it has settled.
      svg.node().addEventListener(
        "mouseup",
        () => {
          if (this.press && this.press.onAxis) {
            setTimeout(() => this.drawPairStrums(), 350);
          }
        },
        true
      );

      let outputLabelColor = "steelblue";
      let inputLabelColor = "black";
      let colorSet = [];
      console.log("OUTPUT DIMS", this.outputDimensions)
      // Coloring axes titles and lines based on whether dimensions were inputs (prefixed with "in:") or outputs (prefixed with "out:")
      d3.selectAll(".parcoords text.label").style("fill", (d) => {
        // change colors for inputs vs outputs
        if (this.outputDimensions.includes(d.toUpperCase())) {
          colorSet.push(outputLabelColor);
          return outputLabelColor;
        } else {
          colorSet.push(inputLabelColor);
          return inputLabelColor;
        }
      });
      d3.selectAll(".parcoords path.domain").style("stroke", function(d, i) {
        return colorSet[i];
      });

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

/* The ties between the two axis brushes of one scatterplot rectangle. */
::v-deep .parcoords g.lite-strum {
  pointer-events: none;
}
::v-deep .parcoords g.lite-strum line {
  stroke: #1e88e5;
  stroke-width: 1;
  stroke-opacity: 0.55;
  stroke-dasharray: 4 3;
}
::v-deep .parcoords g.lite-strum circle {
  fill: #1e88e5;
  fill-opacity: 0.7;
  stroke: none;
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

.parcoords /deep/ .label {
  transform: rotate(10deg) translate(0px, -10px);
}

</style>

<style scoped>
.pcp-view {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pcp-view .parcoords {
  flex: 0 0 auto;
  position: relative;
}
</style>
