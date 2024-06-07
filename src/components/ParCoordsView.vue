<template>
  <v-container>
    <v-row no-gutters>
      <v-col
        style="position: relative; left: -12px; top: -12px"
        :cols="isCustomizingDimensions ? 2 : 1"
      >
        <span>
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn
                color="red"
                small
                icon
                v-on="on"
                @click="
                  () => (isCustomizingDimensions = !isCustomizingDimensions)
                "
              >
                <v-icon>mdi-wrench-outline</v-icon>
              </v-btn>
            </template>
            <span>Customize the Chart</span>
          </v-tooltip>
        </span>
        <MultiDimensionSelect
          v-show="isCustomizingDimensions"
          :initialValue="numericDimensions"
          :keys="allKeys"
          :width="(1 / 6.0) * width"
          v-on:update="onDimensionChange($event)"
        />
      </v-col>
      <v-col
        :style="[
          !isCustomizingDimensions
            ? { position: 'relative', left: '-60px' }
            : { position: 'relative', left: '0px' },
        ]"
        :cols="isCustomizingDimensions ? 10 : 11"
      >
        <div :id="viewID" ref="parcoords" class="parcoords"></div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import "parcoord-es/dist/parcoords.css";

import ParCoords from "parcoord-es";
import * as d3 from "d3";
import { mapGetters, mapState } from "vuex";
import TemplateView from "@/components/TemplateView.vue";
import MultiDimensionSelect from "@/components/MultiDimensionSelect.vue";
import { round } from "@/components/utils.js";
import { operations } from "@/components/operations.js";

export default {
  mixins: [TemplateView],
  components: { MultiDimensionSelect },
  name: "ParCoordsView",
  data() {
    return {
      excludedDimensions: [],
      isCustomizingDimensions: false,
      allKeys: [],
      keysBlackList: [],
      graphCentriodPoints: null,
    };
  },
  computed: {
    ...mapState({
      numericDimensions: (state) => state.numericDimensions,
      nonNumericDimensions: (state) => state.nonNumericDimensions,
    }),
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

    this.excludedDimensions = this.nonNumericDimensions;
    this.excludedDimensions.push("selected");
  },
  watch: {
    isCustomizingDimensions: {
      handler: function(newValue) {
        this.refresh();
      },
      //deep: true
    },
  },
  methods: {
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
    onDimensionChange(newDimensions) {
      this.excludedDimensions = Object.keys(this.chartData[0]).filter(
        (d) => !newDimensions.includes(d)
      );
      /*
      this.excludedDimensions.push("selected");
      this.excludedDimensions.push(...this.keysBlackList)
      */
      this.refresh();
    },
    markingChangeHandler: function(reset) {
      console.log("resetting!!! PCP", reset);
      if (reset) {
        //this.chart.unhighlight(this.$store.getters.data);
        this.chart.highlight(this.$store.getters.data);
        //this.chart.brushReset();
      } else {
        this.chart.unhighlight(this.$store.getters.data);
        var result = this.$store.getters.selectedDataInView(this.viewID);
        this.chart.highlight(result);
      }
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
      d3.select("#" + this.viewID)
        .selectAll("canvas")
        .nodes()
        .forEach((d, i) => {
          let canvas = d3.select(d);
          if (canvas.attr("class").includes("foreground")) {
            canvas.style("opacity", 0.35);
          } else if (canvas.attr("class").includes("highlight")) {
            if (hovered) {
              canvas.style("opacity", 0.5);
            } else {
              canvas.style("opacity", 1);
            }
          } else if (canvas.attr("class").includes("marked")) {
          }
        });
    },
    markLineOnHover(mousePosition) {
      let hoveredData = this.getHoveredLines(mousePosition);
      //console.log(hoveredData);
      if (hoveredData && hoveredData.length != 0) {
        //picking the first in the array for now (todo: consider picking the closes to mouse?)
        this.$store.commit("hover", { hovered: hoveredData[0] });
      }
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
    getHoveredLines(mouseClick) {
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
      var tolerance = 3;
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
        markedLineWidth: 3,
        highlightedLineWidth: 3,
        lineWidth: 1.4,
        markedShadowColor: '#ff0000',
        markedShadowBlur: 5,

      })("#" + this.viewID)
        .data(this.chartData)
        .width(
          (this.isCustomizingDimensions ? (5 / 6.0) * this.width : this.width) -
            20
        )
        .height(this.height - 25)
        //    .dimensions(sampleDimensions)
        //chart.detectDimensions();
        .hideAxis(this.excludedDimensions);
      chart
        .createAxes()

        .brushMode("1D-axes") //1D-axes-multi 2D-strums angular 1D-axes
        .reorderable()
        .mode("queue")

        .render()
        .on("brushend", (brushed, args) => {
          if (d3.event.selection === null) return;
          //To clear the brush/strum once done
          // d3.select("#"+this.viewID).selectAll('.selection').style("display", "none");

          if (chart.brushed().length == chart.data().length) {
            
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
          this.cleanTooltip();

          if (args && d3.event.type === "brush") {
            let sel = args.selection;
            if (sel.raw.length > 0) {
              let x = d3.event.sourceEvent.clientX - this.x;
              let rawY = sel.raw;
              let scaledY = sel.scaled;
              this.createTooltip([
                [x, rawY[0], round(scaledY[0], 4) + ""],
                [x, rawY[1], round(scaledY[1], 4) + ""],
              ]);
            }
          }
        })
        .on("highlight", (e) => {
          console.log("highlighting");
        })
        .on("render", (e) => {
          console.log("render");
          //[todo] this event is raised many time. Is there a better event to listen to or a more efficient implementation of code below?
          var selection = this.$store.getters.selectedDataInView(this.viewID);
          chart.highlight(selection);
          this.graphCentriodPoints = null;
        });
      chart.color((d) => this.colorize(d)).render();

      //Source for the hover on mouse over is adopted from: http://bl.ocks.org/mostaphaRoudsari/b4e090bb50146d88aec4
      //This includes all the auxilary functions called downstream from markLineOnHover() which was called highlightLineOnClick() in the orignal source
      var vueThis = this;
      d3.select("#" + this.viewID)
        .select("svg")
        .on("mousemove", function() {
          if (vueThis.isHoveringEnabled) {
            var mousePosition = d3.mouse(this);
            vueThis.markLineOnHover(mousePosition); //true will also add tooltip
          }
        })
        .on("mouseout", () => {
          //this.cleanTooltip();
          // graph.unhighlight();
          //})
          //.on("click", function() {
          //    var mousePosition = d3.mouse(this);
          //    highlightLineOnClick(mousePosition, true); //true will also add tooltip
        });

      //Resetting the centroids data used for faster hovering via memoization.
      this.graphCentriodPoints = null;

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
</script>

<style scoped>
.parcoords {
  cursor: crosshair;
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
