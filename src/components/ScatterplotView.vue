

<template>
  <v-container fluid>
    <div id="scatter" ref="scatter" class="scatter" />
  </v-container>
</template>

<style scoped>

div >>> .axis,
.frame {
  shape-rendering: crispEdges;
}

div >>> .axis line {
  stroke: #ddd;
}

div >>> .axis path {
  display: none;
}

div >>> .cell text {
  font-weight: bold;
  text-transform: capitalize;
}

div >>> .frame {
  fill: none;
  stroke: #aaa;
}

div >>> circle {
  fill-opacity: 0.7;
}

div >>> circle.hidden {
  fill: #ccc !important;
}

div >>> .extent {
  fill: #000;
  fill-opacity: 0.125;
  stroke: #fff;
}
</style>
<script>
import * as d3 from "d3";
import ScatterPlot from "@/components/Scatterplot.js";

export default {
  name: "ScatterplotView",
  props: ["chart", "chartData", "width", "columns", "colorColumn"],
  computed: {},
  mounted() {
    this.width = 650;
    this.height = 450;
    this.colorColumn = "collection";
    this.columns = ["TotalFlrArea", "Height", "NetSolar", "EnergyUse"];
    //this.columns = ["objective_value", "surface_area", "weight", "total_load"];

    this.chartData = this.$store.state.data;
    this.chart = this.createChart();
  },
  created() {},
  methods: {
    createChart: function() {
      var scatterPlot = new ScatterPlot();

      scatterPlot
        .outerWidth(this.width)
        .outerHeight(this.height)
        .margin({ left: 50, top: 10, right: 10, bottom: 30 })
        .xColumn("TotalFlrArea")
        .xAxisLabel("TotalFlrArea")
        .xAxisLabelOffset(30)
        .xTicks(20)
        .yColumn("NetSolar")
        .yAxisLabel("NetSolar")
        .yAxisLabelOffset(30)
        .yTicks(20)
        .colorColumn("collection")
        .colorRange(["#00c65c", "#8400c6", "#e54100"]);

      d3.select("#scatter")
        .datum(this.chartData)
        .call(scatterPlot);
    },
    highlight: function(highlightMask) {
      this.cells.each(([i, j]) => {
        let circles = d3
          .select(this.cells._groups[0][i + this.columns.length * j])
          .selectAll("circle");

        circles.classed("hidden", (d, i) => (highlightMask[i] ? false : true));
      });
    },
    unhighlightAll: function() {
      this.cells.each(([i, j]) => {
        let circles = d3
          .select(this.cells._groups[0][i + this.columns.length * j])
          .selectAll("circle");
        circles.classed("hidden", false);
      });
    }
  }
  /*
  watch: {
    chartData: {
        handler: function() 
        {
           this.createChart();
        }, deep :true
    }
  }*/
};
</script>

