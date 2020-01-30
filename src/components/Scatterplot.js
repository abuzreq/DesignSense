//export {ScatterPlot};
import * as d3 from "d3";

export default class ScatterPlot {
  constructor() {
    var outerWidth = 100;
    var outerHeight = 100;

    var margin = { left: 60, top: 5, right: 10, bottom: 60 };

    var rMin = 2; // "r" stands for radius
    var rMax = 300;
    var xColumn = "No X column configured";
    var yColumn = "No Y column configured";
    var rColumn = null;
    var colorColumn = "No color column configured";
    var colorRange = d3.scaleOrdinal(d3.schemeCategory10).range();

    var xAxisLabel = "No X axis label configured";
    var xAxisLabelOffset = 40;

    var yAxisLabel = "No Y axis label configured";
    var yAxisLabelOffset = 30;

    var xScale = d3.scaleLinear();
    var yScale = d3.scaleLinear();
    var rScale = d3.scaleLinear();
    var colorScale = d3.scaleOrdinal();
    /*
      var xAxis = d3.svg.axis().scale(xScale).orient("bottom")
      .tickFormat(d3.format("s"))
      .outerTickSize(0);
    */
    var xAxis = d3
      .axisBottom()
      .ticks(6)
      .tickFormat(d3.format("s"))
    //.tickSize( columns.length);
    var xTicks = 5;

    /*
      var yAxis = d3.svg.axis().scale(yScale).orient("left")
      .tickFormat(d3.format("s"))
      .outerTickSize(0);
    */
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
      rScale.range([rMin, rMax]);




      //xAxis.ticks(xTicks);
      //yAxis.ticks(yTicks);

      selection.each(function (data) {
        /*
              var svg = d3.select(this).selectAll("svg").data([data]);
              var gEnter = svg.enter().append("svg").append("g");
    */

        var svg = d3.select(this).append("svg");
        var g = svg.append("g");

        //var g = gEnter ;//svg.select("g");


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
        
        rScale.domain(d3.extent(data, function (d) { return d[rColumn]; }));

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

        g
          .select(".y.axis")
          .call(d3.axisLeft(yScale))
          .select("text")
          .attr("transform", "translate(-" + yAxisLabelOffset + "," + (innerHeight / 2) + ") rotate(-90)")
          .text(yAxisLabel);


        circles
          .attr("cx", function (d) { return xScale(d[xColumn]); })
          .attr("cy", function (d) { return yScale(d[yColumn]); })
          .attr("r", function (d) { return rScale(d[rColumn]); })
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
        function brushmove(p) {
          var e = brush.extent()();
          //TODO change to:
          //const [[x0, y0], [x1, y1]] = d3.event.selection;
          
          var current_active_selection = [];
          g.selectAll("circle").style("opacity", function (d) {
            var cx = d[xColumn]
            var cy = d[yColumn]
            if (!(e[0][0] > cx || cx > e[1][0]
              || e[0][1] > cy || cy > e[1][1])) {

              current_active_selection.push(d);
            }
          });
          
          /*
            chart.highlight(current_active_selection);
            updateModels(current_active_selection);
            //parcoords.data(current_active_selection).render();
            parcoords.highlight(current_active_selection)
            //dndtree.highlight(current_active_selection);
          */


        }
        // If the brush is empty, select all circles.
        function brushend() {
          if (d3.event.selection !== null) return;
         
          /*
          if (brush.empty()) {
            //chart.unhighlight()
            //parcoords.data(data).render();
            //parcoords.unhighlight();
            //updateModels([]);
            //dndtree.unhighlight()
          }
          */
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

    chart.rColumn = function (_) {
      if (!arguments.length) return rColumn;
      rColumn = _;
      return chart;
    };

    chart.rMin = function (_) {
      if (!arguments.length) return rMin;
      rMin = _;
      return chart;
    };

    chart.rMax = function (_) {
      if (!arguments.length) return rMax;
      rMax = _;
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