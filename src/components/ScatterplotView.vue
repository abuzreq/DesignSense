

<template>
  <v-container style="width: 100%; height: 100%" fluid class="pa-1">
    <v-toolbar dense dark color="blue darken-3" class="mb-1">
      <v-row no-gutters style="height: 100%">
        <v-col :cols="5">
          <SingleDimensionSelect
            :initialValue="this.xColumn"
            v-on:update="onXChange($event)"
            :width="this.singleDimensionWidth"
            :prefixWidth="this.prefixWidth"
            :dimensionsType="0"
          >
            <template v-slot:prefix>
              <v-tooltip bottom>
                <template v-slot:activator="{ on, attrs }">
                  <v-simple-checkbox
                    :ripple="false"
                    style="float: left"
                    v-on="on"
                    v-bind="attrs"
                    dense
                    v-model="isXAxisIncremental"
                    icon="x-small"
                    :off-icon="arrowRightIcon"
                    :on-icon="arrowLeftIcon"
                  />
                </template>
                <span v-if="isXAxisIncremental"
                  >Press to change to Ascending from right to left</span
                >
                <span v-else
                  >Press to change to Descending from right to left</span
                >
              </v-tooltip>
              <div
                :style="{
                  float: 'left',
                  height: '100%',
                  width: `${prefixWidth}px`,
                }"
              >
                X:
              </div>
            </template>
          </SingleDimensionSelect>
        </v-col>
        <v-col :cols="5">
          <SingleDimensionSelect
            :initialValue="this.yColumn"
            v-on:update="onYChange($event)"
            :width="this.singleDimensionWidth"
            :prefixWidth="this.prefixWidth"
            :dimensionsType="0"
          >
            <template v-slot:prefix>
              <v-tooltip bottom>
                <template v-slot:activator="{ on, attrs }">
                  <v-simple-checkbox
                    :ripple="false"
                    style="float: left"
                    v-on="on"
                    v-bind="attrs"
                    dense
                    v-model="isYAxisIncremental"
                    icon="x-small"
                    :off-icon="arrowUpIcon"
                    :on-icon="arrowDownIcon"
                  />
                </template>
                <span v-if="isYAxisIncremental"
                  >Press to change to Ascending from bottom to top</span
                >
                <span v-else
                  >Press to change to Descending from bottom to top</span
                >
              </v-tooltip>
              <div
                :style="{
                  float: 'left',
                  height: '100%',
                  width: `${prefixWidth}px`,
                }"
              >
                Y:
              </div>
            </template>
          </SingleDimensionSelect>
        </v-col>
        <v-col :cols="2">
          <v-row no-gutters>
            <v-tooltip bottom>
              <template v-slot:activator="{ on, attrs }">
                <v-simple-checkbox
                  :ripple="false"
                  style="float: left"
                  v-on="on"
                  v-bind="attrs"
                  dense
                  v-model="useLassoBrush"
                  icon="x-small"
                  :off-icon="lassoBrushIcon"
                  :on-icon="rectBrushIcon"
                />
              </template>
              <span v-if="useLassoBrush">Switch to the rectangular brush</span>
              <span v-else>Switch to the Lasso brush</span>
            </v-tooltip>

            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  style="float: right"
                  v-on="on"
                  icon
                  @click="calculateParetoFrontier($event)"
                >
                  <v-icon color="yellow">mdi-trophy-outline</v-icon>
                </v-btn>
              </template>
              <span
                >Compute the Pareto-Frontier for the chosen dimensions.</span
              >
            </v-tooltip>
          </v-row>
        </v-col>
      </v-row>
    </v-toolbar>
    <div
      :id="viewID"
      ref="scatter"
      :style="{
        height: `${this.height - this.toolbarHeight}px`,
      }"
    />
  </v-container>
</template>

<style scoped>

::v-deep .x.axis .tick text
{
  transform: rotate(35deg);
}

::v-deep .v-toolbar > .v-toolbar__content {
  padding: 0 0 0 0;
}

div ::v-deep .axis line {
  stroke: #ddd;
}

div ::v-deep .axis path {
  display: none;
}

div ::v-deep .cell text {
  font-weight: bold;
  text-transform: capitalize;
}

div ::v-deep .frame {
  fill: none;
  stroke: #aaa;
}

div ::v-deep circle {
  fill-opacity: 1;
}

div ::v-deep circle.hidden:not(.mark-circle) {
  fill: #ccc !important;
}

div ::v-deep .extent {
  fill: #000;
  fill-opacity: 0.125;
  stroke: #fff;
}

::v-deep .lasso path {
  stroke: rgb(80, 80, 80);
  stroke-width: 2px;
}

::v-deep .lasso .drawn {
  fill-opacity: 0.05;
}

::v-deep .lasso .loop_close {
  fill: none;
  stroke-dasharray: 4, 4;
}

::v-deep .lasso .origin {
  fill: #3399ff;
  fill-opacity: 0.5;
}
</style>
<script>
const pf = require("pareto-frontier");

import * as d3 from "d3";
import { lasso } from "d3-lasso";
d3.lasso = lasso;

//import ScatterPlot from "@/components/Scatterplot.js";
import { mapGetters } from "vuex";
import TemplateView from "@/components/TemplateView.vue";
import SingleDimensionSelect from "@/components/SingleDimensionSelect.vue";

export default {
  mixins: [TemplateView],
  name: "ScatterplotView",
  components: { SingleDimensionSelect },
  data: function () {
    return {
      xColumn: "",
      yColumn: "",
      isXAxisIncremental: false,
      isYAxisIncremental: false,
      useLassoBrush: false,
      isShowingParetoFrontier: false,
      toolbarHeight: 48,
      arrowUpIcon: "mdi-arrow-up",
      arrowDownIcon: "mdi-arrow-down",
      arrowRightIcon: "mdi-arrow-right",
      arrowLeftIcon: "mdi-arrow-left",
      lassoBrushIcon: "mdi-lasso",
      rectBrushIcon: "mdi-select-drag",
      prefixWidth: 20,
      numTicks: 20
    };
  },
  computed: {
    singleDimensionWidth() {
      if (this.width <= 400) {
        `1`;
        return Math.min(110, (4 * this.width) / 12);
      } else {
        return Math.min(180, (4 * this.width) / 12);
      }
    },
  },
  watch: {
    useLassoBrush: {
      handler: function (newValue) {
        this.useLassoBrush = newValue;
        this.refresh();
      },
    },
    isXAxisIncremental: {
      handler: function (newValue) {
        this.isXAxisIncremental = newValue;
        this.refresh();
      },
    },
    isYAxisIncremental: {
      handler: function (newValue) {
        this.isYAxisIncremental = newValue;
        this.refresh();
      },
    },
  },
  created() {
    //To give access to d3-lasso to the d3 object
    window["d3"] = d3;

    this.xColumn = this.numericDimensions[0];
    this.yColumn = this.numericDimensions[1];
  },
  methods: {
    calculateParetoFrontier: function (event) {
      this.isShowingParetoFrontier = true;
      let graph = this.chartData.map((d) => [
        d[this.xColumn],
        d[this.yColumn],
        d._id,
      ]);
      //https://github.com/justinormont/pareto-frontier/pull/2
      const out = pf.getParetoFrontier(graph, { optimize: "topRight" }); //topLeft topRight bottomRight bottomLeft
      console.log(out, this.$store);
      this.$store.commit("update", {
        view: this.viewID,
        selection: out.map((d) => d[2]),
        operation: this.$store.state.currentSelectionOperation,
      });
    },
    onXChange: function (newXColumn) {
      this.xColumn = newXColumn;
      this.refresh();
    },
    onYChange: function (newYColumn) {
      this.yColumn = newYColumn;
      this.refresh();
    },
    markingChangeHandler: function (reset) {
      if (reset) {
        this.chart.unhighlightAll();
      } else {
        //this.chart.unhighlight(this.$store.getters.data);
        var result = this.$store.getters.selectedDataInView(this.viewID);
        this.chart.highlight(result);
      }
    },
    hoverHandler: function () {
      let hovered = this.$store.getters.getHovered;
      this.chart.mark(hovered);
    },
    Chart: function () {
      var scatterPlot = new ScatterPlot();
      scatterPlot
        .outerWidth(this.width)
        .outerHeight(this.height - this.toolbarHeight)
        .margin({ left: 45, top: 10, right: 10, bottom: 50 })
        .xColumn(this.xColumn)
        .xAxisLabel(this.xColumn)
        .xAxisLabelOffset(35)
        .xTicks(this.numTicks)
        .yColumn(this.yColumn)
        .yAxisLabel(this.yColumn)
        .yAxisLabelOffset(35)
        .yTicks(this.numTicks)
        .isXAxisIncremental(this.isXAxisIncremental)
        .isYAxisIncremental(this.isYAxisIncremental)
        .useLassoBrush(this.useLassoBrush)
        .colorColumn(this.colorColumn)
        .colorScale(this.colorScale)
        .onBrushed((brushedIDs) => {
          this.$store.commit("update", {
            view: this.viewID,
            selection: brushedIDs,
            operation: this.currentSelectionOperation,
          });
        })
        .onHovered((hovered) => {
          if (this.isHoveringEnabled) {
            this.$store.commit("hover", { hovered: hovered });
          }
        })
        .keyFunc((d) => d._id); //TODO make the dimension name (i.e. _id) global

      d3.select("#" + this.viewID)
        .datum(this.chartData)
        .call(scatterPlot);

      return scatterPlot;
    },
  },
};
class ScatterPlot {
  constructor() {
    var outerWidth = 0;
    var outerHeight = 0;

    var margin = { left: 0, top: 0, right: 0, bottom: 0 };

    var circlesRadius = 3;
    var markCircleRadius = 9;

    var xColumn = "No X column configured";
    var yColumn = "No Y column configured";
    var colorColumn = "No color column configured";

    var xAxisLabel = "No X axis label configured";
    var xAxisLabelOffset = 40;
    var isXAxisIncremental = true;

    var yAxisLabel = "No Y axis label configured";
    var yAxisLabelOffset = 30;
    var isYAxisIncremental = true;

    var xScale = d3.scaleLinear();
    var yScale = d3.scaleLinear();
    var colorScale = d3.scaleOrdinal();

    var xAxis = d3.axisBottom().ticks(6).tickFormat(d3.format("s"));
    var xTicks = 6;

    var yAxis = d3.axisLeft().ticks(6).tickFormat(d3.format("s"));
    var yTicks = 6;
    let thisG = null;

    var useLassoBrush;
    var onBrushed;
    var onHovered;

    var keyFunc;
    function chart(selection) {
      var innerWidth = outerWidth - margin.left - margin.right;
      var innerHeight = outerHeight - margin.top - margin.bottom;
 console.log("colorColumn",colorColumn)
      //colorScale.range();
      //[todo] externalize this offset parameter
      var offset = 15;
      xScale.range(
        isXAxisIncremental
          ? [innerWidth - offset, offset]
          : [offset, innerWidth - offset]
      );
      yScale.range(
        isYAxisIncremental
          ? [offset, innerHeight - offset]
          : [innerHeight - offset, offset]
      );

      selection.each(function (data) {
        var div = d3.select(this);
        var svg = div.select("svg").empty()
          ? div.select("svg").append("svg")
          : div.select("svg").remove();

        if (!svg || svg.empty()) {
          svg = div.append("svg");
        }

        svg.attr("width", outerWidth).attr("height", outerHeight);
        svg.attr("viewBox", [0, 0, outerWidth, outerHeight]);

        var g = svg.append("g");

        var circles = g
          .selectAll("circle")
          .data(data, keyFunc)
          .enter()
          .append("circle");

        g.append("g")
          .attr("class", "x axis")
          .append("text")
          .attr("class", "label x_label")
          .style("text-anchor", "middle");

        g.append("g")
          .attr("class", "y axis")
          .append("text")
          .attr("class", "label y_label")
          .style("text-anchor", "middle");

        xScale.domain(
          d3.extent(data, function (d) {
            return d[xColumn];
          })
        );
        yScale.domain(
          d3.extent(data, function (d) {
            return d[yColumn];
          })
        );

        var rectBrush, lassoBrush;
        if (!useLassoBrush) {
          rectBrush = d3
            .brush()
            .extent([
              [0, 0],
              [innerWidth, innerHeight],
            ])
            .on("start", brushstart)
            .on("brush", brushmove)
            .on("end", brushend);
          //ref: https://github.com/d3/d3-brush/issues/20
          rectBrush.keyModifiers(false);
          //brush.keyModifiers(d3.brushFixSize, null)
          //brush.keyModifiers(d3.brushFixCenter , null)
        } else {
          var lasso_area = g
            .insert("rect", ":first-child")
            .attr("width", innerWidth)
            .attr("height", innerHeight)
            .style("opacity", 0);

          // Define the lasso
          lassoBrush = d3
            .lasso()
            .closePathDistance(120) // max distance for the lasso loop to be closed
            .closePathSelect(true) // can items be selected by closing the path?
            .hoverSelect(false) // can items by selected by hovering over them?
            .targetArea(lasso_area) // area where the lasso can be started
            .on("start", brushstart)
            .on("brush", brushmove)
            .on("end", brushend);

          lassoBrush.items(circles);
        }

        g.attr(
          "transform",
          "translate(" + margin.left + "," + margin.top + ")"
        );

        g.select(".x.axis")
          .attr("transform", "translate(0," + innerHeight + ")")
          .call(d3.axisBottom(xScale).ticks(xTicks))//.tickFormat(d3.format("s"))
          .select("text")
          .attr("x", innerWidth / 2)
          .attr("y", xAxisLabelOffset)
          .attr("fill", "black")
          .text(xAxisLabel)
          .style("font-size", "12px")   
        //console.log(g.select(".x.axis").select("text"));
        g.select(".y.axis")
          .call(d3.axisLeft(yScale).ticks(yTicks))
          .select("text")
          .attr(
            "transform",
            "translate(-" +
              yAxisLabelOffset +
              "," +
              innerHeight / 2 +
              ") rotate(-90)"
          )
          .text(yAxisLabel)
          .attr("fill", "black")
          .style("font-size", "12px");

        circles
          .attr("cx", function (d) {
            return xScale(d[xColumn]);
          })
          .attr("cy", function (d) {
            return yScale(d[yColumn]);
          })
          .attr("r", function (d) {
            return circlesRadius;
          })
          .attr("fill", function (d) {
           
            return colorScale(d[colorColumn]);
          });

        var markCircle = g
          .append("circle")
          .attr("class", "mark-circle")
          .attr("r", markCircleRadius)
          .attr("stroke", "#ff0000")
          .attr("stroke-width", "2")
          .attr("fill", "none");
        markCircle.attr("opacity", 0);

        circles.exit().remove();

        //Brushing functions ***********************************
        var brushCell;

        // Clear the previously-active brush, if any.
        function brushstart(p) {
          if (brushCell !== this) {
            if (rectBrush) {
              g.select(brushCell).call(rectBrush.clear);
            }

            //console.log(brush.empty()? xScale.domain(): brush.extent());
            //x.domain(brush.empty()? xScale.domain(): brush.extent());//domainByTrait[p.x]);
            //y.domain(brush.empty()? yScale.domain(): brush.extent());//domainByTrait[p.y]);
            brushCell = this;
          }
        }

        // Highlight the selected circles.
        function brushend(p) {
          let brushedIDs = [];
          if (rectBrush) {
            if (d3.event.selection !== null) {
              const e = d3.event.selection;
              let circles = g.selectAll("circle");

              circles.each((d) => {
                var cx = xScale(d[xColumn]);
                var cy = yScale(d[yColumn]);
                var isOutside =
                  e[0][0] > cx || cx > e[1][0] || e[0][1] > cy || cy > e[1][1];
                if (!isOutside) {
                  brushedIDs.push(keyFunc(d));
                }
              });
            }
          } else if (lassoBrush) {
            var selected = lassoBrush.selectedItems();

            selected.each((d) => {
              brushedIDs.push(keyFunc(d));
            });
          }

          if (brushedIDs.length > 0) {
            onBrushed(brushedIDs);
          }
        }

        function brushmove() {}

        var highlight = function (selection) {
          selection = selection.map(keyFunc);

          thisG
            .selectAll("circle")
            .classed("hidden", (d, i) => {
              if (selection.includes(keyFunc(d))) {
                //TODO can be made faster by doing a membership test on a key-value map
                return false;
              } else {
                return true;
              }
            })
            .sort(
              (
                a,
                b //To insure that the highlighted circles will be moved down in the DOM making sure they will drawn on top
              ) => {
                let aIn = selection.includes(keyFunc(a));
                let bIn = selection.includes(keyFunc(b));
                if (aIn == bIn) {
                  return 0;
                } else if (aIn == true) {
                  return 1;
                } else if (bIn == true) {
                  return -1;
                }
              }
            );
        };

        var unhighlightAll = function () {
          thisG.selectAll("circle").classed("hidden", false);
          markCircle.attr("opacity", 0);
        };

        var mark = function (item) {
          if (item) {
            markCircle
              .attr("stroke", colorScale(item[colorColumn]))
              .attr("opacity", 1)
              .attr("cx", xScale(item[xColumn]))
              .attr("cy", yScale(item[yColumn]));
          } else {
            markCircle.attr("opacity", 0);
          }

          /*    thisG.selectAll("circle").attr("r", (d, i) => {
            console.log(markCircle,d,xColumn, xScale(d[xColumn]))

           
            //[todo] parametrize those radii
            if (item && keyFunc(item) == keyFunc(d)) {
              return 5;
            } else {
              return 3;
            }
          }); */
        };

        chart.highlight = highlight;
        chart.unhighlightAll = unhighlightAll;
        chart.mark = mark;
        if (rectBrush) {
          g.call(rectBrush);
        }
        if (lassoBrush) {
          g.call(lassoBrush);
        }
        //using a voronoi diagram to quickly find the nearest point to the mouse
        const voronoiDiagram = d3
          .voronoi()
          .x((d) => {
            return xScale(d[xColumn]);
          })
          .y((d) => yScale(d[yColumn]))
          .size([innerWidth, innerHeight])(data);
        const voronoiRadius = innerWidth / 10;

        g.on("mousemove", function () {
          const [mx, my] = d3.mouse(this);
          const site = voronoiDiagram.find(mx, my, voronoiRadius);
          onHovered(site && site.data);
        });

        /*
        d3.select(".x_label").on("dblclick", function (d) {
          isXAxisFlipped = !isXAxisFlipped;
        });

        d3.select(".y_label").on("dblclick", function (d) {
          isYAxisFlipped = !isYAxisFlipped;
        });
*/
        thisG = g;
      });
    }

    chart.onBrushed = function (_) {
      if (!arguments.length) return onBrushed;
      onBrushed = _;
      return chart;
    };
    chart.onHovered = function (_) {
      if (!arguments.length) return onHovered;
      onHovered = _;
      return chart;
    };

    chart.keyFunc = function (_) {
      if (!arguments.length) return keyFunc;
      keyFunc = _;
      return chart;
    };
    chart.outerWidth = function (_) {
      if (!arguments.length) return outerWidth;
      outerWidth = _;
      return chart;
    };

    chart.outerHeight = function (_) {
      if (!arguments.length) return outerHeight;
      outerHeight = _;
      return chart;
    };

    chart.xColumn = function (_) {
      if (!arguments.length) return xColumn;
      xColumn = _;
      return chart;
    };

    chart.yColumn = function (_) {
      if (!arguments.length) return yColumn;
      yColumn = _;
      return chart;
    };

    chart.colorScale = function (_) {
      if (!arguments.length) return colorScale;
      colorScale = _;
      return chart;
    };

    chart.colorColumn = function (_) {
      if (!arguments.length) return colorColumn;
      colorColumn = _;
      return chart;
    };

    chart.xAxisLabel = function (_) {
      if (!arguments.length) return xAxisLabel;
      xAxisLabel = _;
      return chart;
    };

    chart.yAxisLabel = function (_) {
      if (!arguments.length) return yAxisLabel;
      yAxisLabel = _;
      return chart;
    };

    chart.isXAxisIncremental = function (_) {
      if (!arguments.length) return isXAxisIncremental;
      isXAxisIncremental = _;
      return chart;
    };
    chart.isYAxisIncremental = function (_) {
      if (!arguments.length) return isYAxisIncremental;
      isYAxisIncremental = _;
      return chart;
    };

    chart.xAxisLabelOffset = function (_) {
      if (!arguments.length) return xAxisLabelOffset;
      xAxisLabelOffset = _;
      return chart;
    };

    chart.yAxisLabelOffset = function (_) {
      if (!arguments.length) return yAxisLabelOffset;
      yAxisLabelOffset = _;
      return chart;
    };

    chart.xTicks = function (_) {
      if (!arguments.length) return xTicks;
      xTicks = _;
      return chart;
    };

    chart.yTicks = function (_) {
      if (!arguments.length) return yTicks;
      yTicks = _;
      return chart;
    };

    chart.margin = function (_) {
      if (!arguments.length) return margin;
      margin = _;
      return chart;
    };
    chart.useLassoBrush = function (_) {
      if (!arguments.length) return useLassoBrush;
      useLassoBrush = _;
      return chart;
    };

    return chart;
  }
}
</script>

