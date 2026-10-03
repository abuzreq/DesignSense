//export {ScatterPlot};
import * as d3 from "d3";

export default class ScatterPlot {
  // `vueThis` is the component that holds the chart: brushing commits the
  // brushed options to its store. Nothing builds this class now; see
  // ScatterplotView.vue, which draws the scatterplot the app shows.
  constructor(vueThis) {
    var outerWidth = 100;
    var outerHeight = 100;

    var margin = { left: 60, top: 5, right: 10, bottom: 60 };


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
      .tickFormat(d3.format("s"))
    var xTicks = 5;

    var yAxis = d3
      .axisLeft()
      .ticks(6)
      .tickFormat(d3.format("s"))
    var yTicks = 5;

    function chart(selection) {
      var innerWidth = outerWidth - margin.left - margin.right;
      var innerHeight = outerHeight - margin.top - margin.bottom;

      colorScale.range(colorRange);
      xScale.range([0, innerWidth]);
      yScale.range([innerHeight, 0]);

      selection.each(function (data) {
        var svg = d3.select(this).append("svg");
        var g = svg.append("g");

        var circles = g.selectAll("circle").data(data).enter().append('circle');

        g
          .append("g")
          .attr("class", "x axis")
          .append("text")
          .attr("class", "label")
          .style("text-anchor", "middle");

        g
          .append("g")
          .attr("class", "y axis")
          .append("text")
          .attr("class", "label")
          .style("text-anchor", "middle");

        xScale.domain(d3.extent(data, function (d) { return d[xColumn]; }));
        yScale.domain(d3.extent(data, function (d) { return d[yColumn]; }));

        var brush = d3.brush().extent([[0,0],[innerWidth,innerHeight]])
        .on("start", brushstart)
        .on("brush", brushmove)
        .on("end", brushend);


        svg
          .attr("width", outerWidth)
          .attr("height", outerHeight);

        g.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        
        g
          .select(".x.axis")
          .attr("transform", "translate(0," + innerHeight + ")")
          .call(d3.axisBottom(xScale))
          .select("text")
          .attr("x", innerWidth / 2)
          .attr("y", xAxisLabelOffset)
          .text(xAxisLabel);

        console.log( g.select(".x.axis").select("text"))
        g
          .select(".y.axis")
          .call(d3.axisLeft(yScale))
          .select("text")
          .attr("transform", "translate(-" + yAxisLabelOffset + "," + (innerHeight / 2) + ") rotate(-90)")
          .text(yAxisLabel);


        circles
          .attr("cx", function (d) { return xScale(d[xColumn]); })
          .attr("cy", function (d) { return yScale(d[yColumn]); })
          .attr("r", function (d) { return 3;})
          .attr("fill", function (d) { return colorScale(d[colorColumn]); });

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
        function brushmove(p) 
        {
          //var e = brush.extent()();
          //TODO change to:
          const e = d3.event.selection;
          
          let brushed = [];
          let brushedMask = [];

          g.selectAll("circle").classed("hidden",  (d) => 
          {
            var cx = xScale(d[xColumn])
            var cy = yScale(d[yColumn])
           // console.log(e, cx,cy)
            if (!(e[0][0] > cx || cx > e[1][0]
              || e[0][1] > cy || cy > e[1][1])) 
              {
                brushedMask.push(0);
                return true;
              }
              else 
              {
                brushed.push(d);
                brushedMask.push(1);
                return false;
              }           
          });
          
          
          //g.selectAll("circle").classed("hidden", (d, i) => (brushedMask ? true : false));
          console.log("brush",this);
          if (brushed.length > 0) {
            vueThis.$store.commit("highlight", brushed);
            // this.$store.commit("unhighlight", chart.data())
          }
          




        }

        // If the brush is empty, select all circles.
        function brushend() {
          if (d3.event.selection !== null) return;
        }

        g.call(brush);



      });
    }

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


    chart.colorRange = function (_) {
      if (!arguments.length) return colorRange;
      colorRange = _;
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

    return chart;

  }

}