


<template>
  <v-container fluid>
    <div :id="viewID" ref="splom" class="splom" />
  </v-container>
</template>


<script>
import * as d3 from "d3";
import { operations } from "@/components/operations.js";
import TemplateView from "@/components/TemplateView.vue";
import { SELECTED } from "@/stateColors.js";

export default {
  mixins: [TemplateView],
  name: "SPLOMView",
  computed: {},
  data() {
    return {
      padding: 10,
      colorColumn: "collection",
      columns: ["out:Sunshine rs", "out:SVF", "out:A/V ratio"]
    };
  },
  mounted() {
    //this.columns = ["objective_value", "surface_area", "weight", "total_load"];
    //console.log("SPLOM")
    //console.log(this.chart._groups)
    //console.log(this.cells._groups)
  },
  created() {},
  methods: {
    markingChangeHandler: function(reset) 
    {
      if(reset)
      {
        this.chart.unhighlight(this.$store.getters.data);
      }
      else
      {
        var result = this.$store.getters.selectedDataInView(this.viewID);
        this.chart.highlight(result);
      }  
    },
    onBrushed: function(brushedIDs) {
      //TODO expose as a passable function (See onBrushed in ScaterplotView)
      let operation = this.$store.state.currentSelectionOperation;
      // An empty brush clears the selection, but only under Replace.
      if (brushedIDs.length === 0 && operation !== operations.REPLACE) {
        return;
      }
      this.$store.dispatch("update", {
        view: this.viewID,
        selection: brushedIDs,
        operation: operation
      });
    },
    Chart: function() {
      let colorColumn = this.colorColumn;
      let columns = this.columns;
      let padding = this.padding;
      let width = this.width;
      let height = this.height;

      let sizeX =
        (width - (columns.length + 1) * padding) / columns.length + padding;
      let size = sizeX;

      let sizeY =
        (height - (columns.length + 1) * padding) / columns.length + padding;

      let totalSizeX = sizeX * columns.length;
      let totalSizeY = sizeY * columns.length;

      var margin = { top: 0, right: 10, bottom: 10, left: 50 };
      let markSize = size / 50;
      let columnTitleSize = size / 15;
      let columnTickTextSize = size / 15;
      let z = d3
        .scaleOrdinal()
        .domain(this.chartData.map(d => d[colorColumn]))
        .range(d3.schemeCategory10);
      /*
        let x = columns.map(c => d3.scaleLinear()
            .domain(d3.extent(data, d => d[c]))
            .rangeRound([padding / 2, size - padding / 2]))
        let y = x.map(x => x.copy().range([size - padding / 2, padding / 2]))
    */
      var x = {},
        y = {};
      columns.forEach(col => {
        // Coerce values to numbers.
        this.chartData.forEach(function(d) {
          d[col] = +d[col]; //TODO maybe not necessary
        });

        var domain = d3.extent(this.chartData, d => d[col]),
          range = [padding, size - padding]; // TODO switch to padding/2 to make the origin exactly at bottom-left
        x[col] = d3
          .scaleLinear()
          .domain(domain)
          .rangeRound(range);
        y[col] = d3
          .scaleLinear()
          .domain(domain)
          .rangeRound(range.reverse());
      });

      let xAxis = g => {
        const axis = d3
          .axisBottom()
          .ticks(6)
          .tickSize(size * columns.length);

        let values = Object.keys(x).map(function(_) {
          return x[_];
        });

        return g
          .select("g")
          .data(values)
          .join("g")
          .attr("transform", (d, i) => `translate(${i * size},0)`)
          .each(function(d) {
            return d3.select(this).call(axis.scale(d));
          })
          .call(g => g.select(".domain").remove())
          .call(g =>
            g
              .selectAll(".tick line")
              .attr("stroke", "#ddd")
              .attr("stroke-width", size / 200)
          )
          .style("font", columnTickTextSize + "px bold sans-serif");
      };

      let yAxis = g => {
        const axis = d3
          .axisLeft()
          .ticks(6)
          .tickSize(-size * columns.length);

        let values = Object.keys(y).map(function(_) {
          return y[_];
        });

        return g
          .select("g")
          .data(values)
          .join("g")
          .attr("transform", (d, i) => `translate(0,${i * size})`)
          .each(function(d) {
            return d3.select(this).call(axis.scale(d));
          })
          .call(g => g.select(".domain").remove())
          .call(g =>
            g
              .selectAll(".tick line")
              .attr("stroke", "#ddd")
              .attr("stroke-width", size / 200)
          )
          .style("font", columnTickTextSize + "px sans-serif");
      };

      let brush = (cells, circle) => {
        let brushCell;

        // Clear the previously-active brush, if any.
        function brushstarted() {
          if (brushCell !== this) {
            d3.select(brushCell).call(brushObj.move, null);
            brushCell = this;
          }
        }

        // Highlight the selected circles.
        var brushed = ([j, i]) => {
          if (d3.event.selection === null) {
            // Brush cleared -- report an empty selection so it can clear.
            this.onBrushed([]);
            return;
          }
          const [[x0, y0], [x1, y1]] = d3.event.selection;

          let brushedIDs = [];
          let brushedMask = [];
          circle.each(d => {
            if (
              x0 > x[columns[i]](d[columns[i]]) ||
              x1 < x[columns[i]](d[columns[i]]) ||
              y0 > y[columns[j]](d[columns[j]]) ||
              y1 < y[columns[j]](d[columns[j]])
            ) {
              brushedMask.push(0);
            } else {
              brushedIDs.push(d._id);
              brushedMask.push(1);
            }
          });
          this.onBrushed(brushedIDs);
        };
        /*
        // If the brush is empty, select all circles.
        let brushended = () => {
          if (d3.event.selection !== null) return;
          this.onBrushed([])
          //circle.classed("hidden", false);
          //this.$store.commit("unhighlight", this.chartData);
        };
        */
        const brushObj = d3
          .brush()
          .extent([
            [padding / 2, padding / 2],
            [size - padding / 2, size - padding / 2]
          ])
          .on("start", brushstarted)
          //   .on("brush", brushed)
          .on("end", brushed);

        //ref: https://github.com/d3/d3-brush/issues/20
        brushObj.keyModifiers(false);
        cells.call(brushObj);
      };
      const svg = d3
        .select("#" + this.viewID)
        .append("svg")
        .attr("width", totalSizeX + margin.left + margin.right)
        .attr("height", totalSizeY + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      //attr("width", size * columns.length).attr("height" ,size * columns.length)
      //.attr("margin", padding*2).attr("y", padding*2)
      //    .attr("viewBox", [-padding, 0, width*columns.length, width*columns.length]);

      svg
        .append("style")
        .text(
          "circle.hidden { opacity: 0.35; } " +
            "g.has-selection circle:not(.hidden) { stroke: " +
            SELECTED +
            "; stroke-width: 1px; }"
        );

      const cells = svg
        .append("g")
        .selectAll("g")
        .data(d3.cross(d3.range(columns.length), d3.range(columns.length)))
        .join("g")
        .attr("transform", ([i, j]) => `translate(${i * size},${j * size})`);

      cells
        .append("rect")
        .attr("fill", "none")
        .attr("stroke", "#aaa")
        .attr("stroke-width", "1px") //Ahmed
        .attr("x", padding / 2 + 0.5)
        .attr("y", padding / 2 + 0.5)
        .attr("width", size - padding)
        .attr("height", size - padding);

      cells.append("g").call(xAxis);

      cells.append("g").call(yAxis);

      cells.each(([i, j]) => {
        let circles = d3
          .select(cells._groups[0][i + columns.length * j])
          .selectAll("circle")
          .data(this.chartData)
          .join("circle");

        circles
          .attr("cx", d => x[columns[i]](d[columns[i]]))
          .attr("cy", d => y[columns[j]](d[columns[j]]));
      });

      const circle = cells
        .selectAll("circle")
        .attr("r", markSize)
        .attr("fill-opacity", 0.7)
        .attr("fill", d => z(d[colorColumn]));

      cells.call(brush, circle);

      svg
        .append("g")
        .style("font", "bold " + columnTitleSize + "px sans-serif")
        .style("pointer-events", "none")
        .selectAll("text")
        .data(columns)
        .join("text")
        .attr("transform", (d, i) => `translate(${i * size},${i * size})`)
        .attr("x", padding)
        .attr("y", padding)
        .attr("dy", ".71em")
        .text(d => d);

      return {
        highlight: selection => {
          selection = selection.map(d => d._id);
          cells.each(([i, j]) => {
            let circles = d3
              .select(cells._groups[0][i + this.columns.length * j])
              .selectAll("circle");

            circles.classed("hidden", (d, i) => {
              return selection.includes(d._id) ? false : true;
            });
          });
          cells.classed("has-selection", selection.length > 0);
        },
        unhighlight: selection => {
          selection = selection.map(d => d._id);
          cells.each(([i, j]) => {
            let circles = d3
              .select(cells._groups[0][i + this.columns.length * j])
              .selectAll("circle");

            circles.classed("hidden", (d, i) => {
              //console.log(d, i);
              return selection.includes(d._id) ? true : false;
            });
          });
        }
      };
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

