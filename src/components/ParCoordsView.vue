

<template>
  <v-container>
    <!--
    <MultiDimensionSelect
      :initialValue="this.numericDimensions"
      v-on:update="onDimensionChange($event)"
    />
    -->
    <div :id="viewID" ref="parcoords" class="parcoords" />
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
import { mapState } from "vuex";
import TemplateView from "@/components/TemplateView.vue";
import MultiDimensionSelect from "@/components/MultiDimensionSelect.vue";

export default {
  mixins: [TemplateView],
  components: { MultiDimensionSelect },
  name: "ParCoordsView",
  data() {
    return {
      excludedDimensions: [],
      colorColumn: "",
      dimensions: []
    };
  },
  mounted() {},
  created() {
    this.dimensions = this.formatDimensions(this.numericDimensions);
    console.log("created", this.dimensions);
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
    this.excludedDimensions.push("selected")
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
      console.log(result);

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
      this.chart.unmark();
      let hovered = this.$store.getters.getHovered;
      if (hovered) {
        this.chart.mark([hovered]);
      }
      else
      {

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
    markLineOnHover(mousePosition, drawTooltip) {
      var hovered = [];
      var hoveredCenPts = [];

      let hoveredData = this.getHoveredLines(mousePosition);

      if (hoveredData && hoveredData[0].length != 0) {
        hovered = hoveredData[0];
        hoveredCenPts = hoveredData[1];
        console.log(hovered);
        this.$store.commit("hover", { hovered: hovered[0] });

        /* TODO Ahmed
        if (drawTooltip) {
          // clean if anything is there
          cleanTooltip();
          // add tooltip
          addTooltip(clicked, clickedCenPts);
        }
        */
      }
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
      //console.log(delta);
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
        var initCenPts = this.chart
          .compute_real_centroids(d)
         

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
      const chart = ParCoords({
        nullValueSeparator: "bottom",
        markedLineWidth: 5,
        highlightedLineWidth: 3,
        lineWidth: 1
      })(
        //
        "#" + this.viewID
      )
        .data(this.chartData)
        .width(this.width)
        .height(this.height)
        .hideAxis(this.excludedDimensions)
        //.alpha(0.7)
        .createAxes()
        //.margin({ top: 40, left: 20, bottom: 20, right: 20 })
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
            /*
                console.log("Clearing ",this.viewID)
                    this.$store.commit("update", 
                {view: this.viewID,
                  selection: [], 
                  "operation": operations.REPLACE 
                  })*/
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
        /* .on("brushend", (brushed, args) => {

        })*/
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
        .on("mousemove", function() 
        {
          if (vueThis.$store.state.isCtrlKey)
           {
            var mousePosition = d3.mouse(this);
            //console.log(mousePosition);
            vueThis.markLineOnHover(mousePosition, true); //true will also add tooltip
          }
        })
        .on("mouseout", function() {
          // cleanTooltip();
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
      //chart.dimensions(this.prepareDimensions(this.chartData, this.numericDimensions, this.chart))

      return chart;
    }
  }
};
</script>

<style scoped>
/deep/ .multiselect__tag {
  width: 50px;
  display: none;
}

/deep/ .multiselect {
  width: 200px;
}

/deep/ .parcoords canvas.brushed {
  border: red;
}

.parcoords /deep/  .label {
  transform: rotate(10deg) translate(0px, -10px);
}


</style>