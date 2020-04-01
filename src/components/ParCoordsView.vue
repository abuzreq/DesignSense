

<template>
  <v-container>
    <span style="position:relative;left:-10px;top:-12px;">
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn
            color="red"
            x-small
            icon
            v-on="on"
            @click="() => isCustomizingDimensions = !isCustomizingDimensions"
          >
            <v-icon>mdi-wrench-outline</v-icon>
          </v-btn>
        </template>
        <span>Customize the Chart</span>
      </v-tooltip>
    </span>

    <v-row style="position:relative;top:-25px;">
      <v-col v-if="isCustomizingDimensions" cols="2">
        <MultiDimensionSelect
          :initialValue="this.numericDimensions"
          :width="(1/6.0) * width"
          v-on:update="onDimensionChange($event)"
        />
      </v-col>
      <v-col :cols="isCustomizingDimensions?10:12" >
        <div :id="viewID" ref="parcoords" class="parcoords"></div>
      </v-col>
    </v-row>
  </v-container>
</template>
 <!--
     <v-toolbar dense dark color="blue darken-3" class="mb-1">
      
    </v-toolbar>
-->
<script>
import "parcoord-es/dist/parcoords.css";

import ParCoords from "parcoord-es";
import * as d3 from "d3";
import { operations, getOperationFromEvent } from "@/components/operations.js";
import { mapGetters } from "vuex";
import TemplateView from "@/components/TemplateView.vue";
import MultiDimensionSelect from "@/components/MultiDimensionSelect.vue";
import { round } from "@/components/utils.js";

export default {
  mixins: [TemplateView],
  components: { MultiDimensionSelect },
  name: "ParCoordsView",
  data() {
    return {
      excludedDimensions: [],
      colorColumn: "",
      dimensions: [],
      isCustomizingDimensions: false
    };
  },
  computed: {
    ...mapGetters(["isHoveringEnabled"])
  },
  mounted() {},
  created() {
    this.dimensions = this.formatDimensions(this.numericDimensions);
    this.colorColumn = "collection";
    var excluded = [
      "image",
      "gltf",
      "geometry",
      "ID",
      "_id",
      "collection",
      "UsableSpace",
      "index",
      "selected"
    ];
    /*excluded = [
      "center_of_mass_x",
      "iterationmax_displacment",
      "mu",
      "ID",
      "_id",
      "collection",
      "index",
        "image",
      "gltf",
      "geometry","max_vonmises_stress"
    ]; */
    /*
    this.excludedDimensions = [];
    for (var e of excluded) {
      this.excludedDimensions.push(e);
    }
    */
    this.excludedDimensions = Object.keys(this.chartData[0]).filter(
      d => !this.numericDimensions.includes(d)
    );
    this.excludedDimensions.push("selected");
  },
  watch: {
    isCustomizingDimensions: {
      handler: function(newValue) 
      {
        this.refresh();
      }
      //deep: true
    }
  },
  methods: {
    formatDimensions(dimensions) {
      var result = {};
      dimensions.forEach(dim => {
        result[dim] = {};
      });
      return result;
    },
    prepareDimensions(data, dimensions, chart) {
      let range = this.height; //- chart.margin().top - chart.margin().bottom;
      var result = {};
      dimensions.forEach(dim => {
        let extents = d3.extent(data, d => d[dim]);
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
          ticks: 10
        };
      });
      console.log("dimensions", result);

      return result;
    },
    onDimensionChange(newDimensions) {
      this.excludedDimensions = Object.keys(this.chartData[0]).filter(
        d => !newDimensions.includes(d)
      );
      this.refresh();
    },
    markingChangeHandler: function() {
      this.chart.unhighlight(this.$store.getters.data);
      var result = this.$store.getters.selectedDataInView(this.viewID);
      this.chart.highlight(result);
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
            if (hovered) {
              canvas.style("opacity", 0.1);
            } else {
              canvas.style("opacity", 0.25);
            }
          } else if (canvas.attr("class").includes("highlight")) {
            if (hovered) {
              canvas.style("opacity", 0.25);
            } else {
              canvas.style("opacity", 1);
            }
          } else if (canvas.attr("class").includes("marked")) {
          }
        });
    },
    markLineOnHover(mousePosition) {
      var hovered = [];
      var hoveredCenPts = [];

      let hoveredData = this.getHoveredLines(mousePosition);

      if (hoveredData && hoveredData[0].length != 0) {
        hovered = hoveredData[0];
        hoveredCenPts = hoveredData[1];
        this.$store.commit("hover", { hovered: hovered[0] });
        this.hoveredCenPts = hoveredCenPts;
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
          clickedDataSet.push([x, y, text]);
        }
      }
      // this.createTooltip(clickedDataSet);
    },
    //array of tuples where each is [x,y,text]  for the tooltip
    createTooltip(specs) {
      // add rectangles
      var fontSize = 14;
      var padding = 2;
      var rectHeight = fontSize + 2 * padding; //based on font size
      specs.forEach(d => {
        if (isNaN(d[2])) {
          console.log(d);
        }
      });

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
        .attr("opacity", 0.9)
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
      var hoveredCenPts = [];

      // find which data is activated right now
      var activeData = this.getActiveData();

      // find centriod points
      var graphCentPts = this.getCentroids(activeData);

      if (graphCentPts.length == 0) return false;

      // find between which axes the point is
      var axeNum = this.findAxes(mouseClick, graphCentPts[0]);
      if (!axeNum) return false;

      graphCentPts.forEach((d, i) => {
        if (this.isOnLine(d[axeNum - 1], d[axeNum], mouseClick, 2)) {
          hovered.push(activeData[i]);
          hoveredCenPts.push(graphCentPts[i]); // for tooltip
        }
      });

      return [hovered, hoveredCenPts];
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

      data.forEach(d => {
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
      const chart = ParCoords({
        markedLineWidth: 5,
        highlightedLineWidth: 3,
        lineWidth: 1
      })("#" + this.viewID)
        .data(this.chartData)
        .width((this.isCustomizingDimensions? (5/6.0)*this.width : this.width) -20 )
        .height(this.height-25)
        .hideAxis(this.excludedDimensions)
        .createAxes()
        //.alpha(0.7)
      //  .margin({ top: 25, left:30, bottom: 10, right: 30 })

        .brushMode("1D-axes") //1D-axes-multi 2D-strums angular 1D-axes
        //  .alphaOnBrushed(0.1)
        .reorderable()
        .mode("queue")

        .render()
        .on("brushend", (brushed, args) => {
          if (d3.event.selection === null) return;

          //To clear the brush/strum once done
          //d3.select("#"+this.viewID).selectAll('.selection').style("display", "none");

          if (chart.brushed().length == chart.data().length) {
            console.log("Clearing ", this.viewID);
            this.$store.commit("update", {
              view: this.viewID,
              selection: [],
              operation: operations.REPLACE
            });
          } else {
            //console.log("Brushing ",this.viewID, d3.event)
            this.chart.brushReset();
            //this.chart.unhighlight( this.$store.getters.data) ;
            this.$store.commit("update", {
              view: this.viewID,
              selection: brushed.map(d => d._id),
              operation: getOperationFromEvent(d3.event.sourceEvent)
            });
          }
        })
        .on("brush", (brushed, args) => {
          this.cleanTooltip();

          if (args && d3.event.type === "brush") {
            let sel = args.selection;
            if (sel.raw.length > 0) {
              let x = d3.event.sourceEvent.x;
              let rawY = sel.raw;
              let scaledY = sel.scaled;
              this.createTooltip([
                [x, rawY[0], round(scaledY[0], 4) + ""],
                [x, rawY[1], round(scaledY[1], 4) + ""]
              ]);
            }
          }
        })
        .on("highlight", e => {
          // console.log("highlighting")
        });

      var colorScale = this.$store.state.colorScale; //d3.scale.ordinal().range(colorRange);
      chart.color(d => colorScale(d[this.colorColumn])).render();

      //Source for the hover on mouse over is adopted from: http://bl.ocks.org/mostaphaRoudsari/b4e090bb50146d88aec4
      //This includes all the auxilary functions called downstream from markLineOnHover() which was called highlightLineOnClick() in the orignal source
      var vueThis = this;
      d3.select("#" + this.viewID)
        .select("svg")
        .on("mousemove", function() {
          if (vueThis.isHoveringEnabled) {
            var mousePosition = d3.mouse(this);
            //console.log(mousePosition);
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
      //chart.brushPredicate("OR");

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
    }
  }
};
</script>

<style scoped>
/*
.brushTootlip {
  position: absolute;
}
*/
#tooltip {
  font-family: sans-serif;
  font-size: 14px;
  font-weight: bold;
  color: black;
}

/deep/ .multiselect__tag {
  width: 50px;
  display: none;
}

/deep/ .multiselect {
  width: 200px;
    margin-top: 10px;
}

.parcoords /deep/ .label {
  transform: rotate(10deg) translate(0px, -10px);
}
</style>