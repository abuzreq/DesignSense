

<template>
  <v-container fluid>
    <div :id="viewID" ref="scatter" class="scatter" />
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
//import ScatterPlot from "@/components/Scatterplot.js";
import views from "@/components/constants.js";
import { operations, getOperationFromEvent } from "@/components/operations.js";
import { mapState } from "vuex";

export default {
  name: "ScatterplotView",
  //props: ["chartData"],
  data: function() {
    return {
      data: null,
      viewID: null,
      chart: null,
      xColumn: "TotalFlrArea",
      yColumn: "NetSolar",
      colorColumn: "collection",
      width: 650,
      height: 450
    };
  },
  computed: {
    ...mapState({ chartData: state => state.data })
  },
  mounted() {
    //this.width = 650;
    //this.height = 450;
    //this.colorColumn = "collection";
    //this.columns = ["TotalFlrArea", "Height", "NetSolar", "EnergyUse"];
    //this.columns = ["objective_value", "surface_area", "weight", "total_load"];

    this.chart = this.createChart();
    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this
    });
  },
  watch: {
    width: function(newValue, oldValue) {
      this.createChart();
      /* this.chart.outerWidth(newValue)
      d3.select("#"+this.id)
        .datum(this.chartData)
        .call(this.chart);*/
    },
    height: function(newValue, oldValue) {
      this.createChart();
      /*
            this.chart.outerWidth(newValue)
      d3.select("#"+this.id)
        .datum(this.chartData)
        .call(this.chart);*/
    },
    chartData: {
      handler: function(newValue, oldValue) {
        /*
        d3.select("#" + this.viewID)
          .datum(this.chartData)
          .call(this.chart);
*/
        this.chart = this.createChart();
        /*d3.select("#" + this.viewID)
          .datum(newValue)
          .call(this.chart);*/
      }
    }
  },
  created() {
    this.viewID = "id" + this._uid;

    this.$store.subscribe((mutation, state) => {
      if (mutation.type === "update") {
        //TODO currently this is called every time a change happens to ANY marking. Should only listen to changes in this view's marking
        let marking = this.$store.getters.getMarking(this.viewID);
        var result = this.$store.getters.selectedInView(this.viewID);
      /*
        var result = [];
        for (var alt in marking) {
          result.push(marking[alt]);
        }

        var atLeastOne = false;
        for (var on of result) {
          if (on) {
            atLeastOne = true;
            break;
          }
        }
        */
       this.chart.highlight(result);
       /*
        if (atLeastOne) {
           console.log("Updating!!",result)
          
        } else {
          this.chart.unhighlightAll();
        }*/
      }
    });
  },
  methods: {
    createChart: function() {
      this.destroyChart()

      var scatterPlot = new ScatterPlot();

      scatterPlot
        .outerWidth(this.width)
        .outerHeight(this.height)
        .margin({ left: 50, top: 10, right: 10, bottom: 30 })
        .xColumn(this.xColumn)
        .xAxisLabel(this.xColumn)
        .xAxisLabelOffset(30)
        .xTicks(20)
        .yColumn(this.yColumn)
        .yAxisLabel(this.yColumn)
        .yAxisLabelOffset(30)
        .yTicks(20)
        .colorColumn(this.colorColumn)
        .colorRange(["#00c65c", "#8400c6", "#e54100"])
        .onBrushed(brushedIDs => {
          this.$store.commit("update", {
            view: this.viewID,
            selection: brushedIDs,
            operation: getOperationFromEvent(d3.event.sourceEvent)
          });
        });

      d3.select("#" + this.viewID)
        .datum(this.chartData)
        .call(scatterPlot);

      return scatterPlot;
    },
    destroyChart: function() {
      let node = d3.select("#"+this.viewID)._groups[0][0];//this.$refs["parcoords"];
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    }
  }
};
class ScatterPlot {
  constructor() {
    var outerWidth = 0;
    var outerHeight = 0;

    var margin = { left: 10, top: 5, right: 10, bottom: 10 };

    var xColumn = "No X column configured";
    var yColumn = "No Y column configured";
    var colorColumn = "No color column configured";
    var colorRange = d3.scaleOrdinal(d3.schemeCategory10).range();

    var xAxisLabel = "No X axis label configured";
    var xAxisLabelOffset = 40;

    var yAxisLabel = "No Y axis label configured";
    var yAxisLabelOffset = 30;

    var xScale = d3.scaleLinear();
    var yScale = d3.scaleLinear();
    var colorScale = d3.scaleOrdinal();

    var xAxis = d3
      .axisBottom()
      .ticks(6)
      .tickFormat(d3.format("s"));
    var xTicks = 5;

    var yAxis = d3
      .axisLeft()
      .ticks(6)
      .tickFormat(d3.format("s"));
    var yTicks = 5;
    let thisG = null;

    var onBrushed;

    function chart(selection) {
      var innerWidth = outerWidth - margin.left - margin.right;
      var innerHeight = outerHeight - margin.top - margin.bottom;

      colorScale.range(colorRange);
      xScale.range([0, innerWidth]);
      yScale.range([innerHeight, 0]);
      let thisChart = this;

      selection.each(function(data) {
        var div = d3.select(this);
        var svg = div.select("svg").empty()
          ? div.select("svg").append("svg")
          : div.select("svg").remove();

        if (!svg || svg.empty()) {
          svg = div.append("svg");
        }

        var g = svg.append("g");

        var circles = g
          .selectAll("circle")
          .data(data)
          .enter()
          .append("circle");

        g.append("g")
          .attr("class", "x axis")
          .append("text")
          .attr("class", "label")
          .style("text-anchor", "middle");

        g.append("g")
          .attr("class", "y axis")
          .append("text")
          .attr("class", "label")
          .style("text-anchor", "middle");

        xScale.domain(
          d3.extent(data, function(d) {
            return d[xColumn];
          })
        );
        yScale.domain(
          d3.extent(data, function(d) {
            return d[yColumn];
          })
        );
        var brush = d3
          .brush()
          .extent([
            [0, 0],
            [innerWidth, innerHeight]
          ])
          .on("start", brushstart)
          .on("brush", brushmove)
          .on("end", brushend);

        //ref: https://github.com/d3/d3-brush/issues/20
        brush.keyModifiers(false);
        //brush.keyModifiers(d3.brushFixSize, null)
        //brush.keyModifiers(d3.brushFixCenter , null)

        svg.attr("width", outerWidth).attr("height", outerHeight);

        g.attr(
          "transform",
          "translate(" + margin.left + "," + margin.top + ")"
        );

        g.select(".x.axis")
          .attr("transform", "translate(0," + innerHeight + ")")
          .call(d3.axisBottom(xScale))
          .select("text")
          .attr("x", innerWidth / 2)
          .attr("y", xAxisLabelOffset)
          .text(xAxisLabel);

        //console.log(g.select(".x.axis").select("text"));
        g.select(".y.axis")
          .call(d3.axisLeft(yScale))
          .select("text")
          .attr(
            "transform",
            "translate(-" +
              yAxisLabelOffset +
              "," +
              innerHeight / 2 +
              ") rotate(-90)"
          )
          .text(yAxisLabel);

        circles
          .attr("cx", function(d) {
            return xScale(d[xColumn]);
          })
          .attr("cy", function(d) {
            return yScale(d[yColumn]);
          })
          .attr("r", function(d) {
            return 3;
          })
          .attr("fill", function(d) {
            return colorScale(d[colorColumn]);
          });

        circles.exit().remove();

        //Brushing functions ***********************************
        var brushCell;

        // Clear the previously-active brush, if any.
        function brushstart(p) {
          if (brushCell !== this) {
            g.select(brushCell).call(brush.clear);
            //console.log(brush.empty()? xScale.domain(): brush.extent());
            //x.domain(brush.empty()? xScale.domain(): brush.extent());//domainByTrait[p.x]);
            //y.domain(brush.empty()? yScale.domain(): brush.extent());//domainByTrait[p.y]);
            brushCell = this;
          }
        }

        // Highlight the selected circles.
        function brushmove(p) {}

        // If the brush is empty, select all circles.
        function brushend() {
          if (d3.event.selection !== null) {
            const e = d3.event.selection;

            let brushed = [];
            let brushedMask = [];
            let brushedIDs = [];

            let circles = g.selectAll("circle");
            circles.each((d, i) => {
              var cx = xScale(d[xColumn]);
              var cy = yScale(d[yColumn]);
              var isOutside =
                e[0][0] > cx || cx > e[1][0] || e[0][1] > cy || cy > e[1][1];

              if (isOutside) {
                brushedMask.push(0);
              } else if (!isOutside) {
                // && currentMask[i])  //TODO this will work only in case of a details view
                brushedIDs.push(d._id);
                brushed.push(d);
                brushedMask.push(1);
              }
            });

            if (brushed.length > 0) {
              onBrushed(brushedIDs);
            } else {
              onBrushed([]);
            }
          }
        }

        var highlight = function(selection) 
        {          
          thisG.selectAll("circle").classed("hidden", (d, i) =>
          {
              if(d._id in selection)
              {
                return false;
              }
              else
              {
                return true;
              }   
          });
        };
        var unhighlightAll = function() {
          thisG.selectAll("circle").classed("hidden", false);
        };

        chart.highlight = highlight;
        chart.unhighlightAll = unhighlightAll;

        g.call(brush);
        thisG = g;
      });
    }

    chart.onBrushed = function(_) {
      if (!arguments.length) return onBrushed;
      onBrushed = _;
      return chart;
    };

    chart.outerWidth = function(_) {
      if (!arguments.length) return outerWidth;
      outerWidth = _;
      return chart;
    };

    chart.outerHeight = function(_) {
      if (!arguments.length) return outerHeight;
      outerHeight = _;
      return chart;
    };

    chart.xColumn = function(_) {
      if (!arguments.length) return xColumn;
      xColumn = _;
      return chart;
    };

    chart.yColumn = function(_) {
      if (!arguments.length) return yColumn;
      yColumn = _;
      return chart;
    };

    chart.colorRange = function(_) {
      if (!arguments.length) return colorRange;
      colorRange = _;
      return chart;
    };

    chart.colorColumn = function(_) {
      if (!arguments.length) return colorColumn;
      colorColumn = _;
      return chart;
    };

    chart.xAxisLabel = function(_) {
      if (!arguments.length) return xAxisLabel;
      xAxisLabel = _;
      return chart;
    };

    chart.yAxisLabel = function(_) {
      if (!arguments.length) return yAxisLabel;
      yAxisLabel = _;
      return chart;
    };

    chart.xAxisLabelOffset = function(_) {
      if (!arguments.length) return xAxisLabelOffset;
      xAxisLabelOffset = _;
      return chart;
    };

    chart.yAxisLabelOffset = function(_) {
      if (!arguments.length) return yAxisLabelOffset;
      yAxisLabelOffset = _;
      return chart;
    };

    chart.xTicks = function(_) {
      if (!arguments.length) return xTicks;
      xTicks = _;
      return chart;
    };

    chart.yTicks = function(_) {
      if (!arguments.length) return yTicks;
      yTicks = _;
      return chart;
    };

    chart.margin = function(_) {
      if (!arguments.length) return margin;
      margin = _;
      return chart;
    };

    return chart;
  }
}
</script>

