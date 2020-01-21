

<template>
  <v-container fluid>
    <div class="splom" id="splom" ref="splom"></div>
  </v-container>
</template>


<script>
import * as d3 from "d3";

let colorRange = d3.scaleOrdinal(d3.schemeCategory10).range();

export default {
  name: "SPLOMView",
  props: ["chart","cells","chartData", "padding", "width", "columns", "colorColumn"],
  mounted() {
    this.width = 475;
    this.padding = 10;
    this.colorColumn = "collection";
    this.columns = ["TotalFlrArea", "Height", "NetSolar", "EnergyUse"];
    this.columns = [ "objective_value","surface_area","weight", "total_load"];

    this.chartData = this.$store.state.data;
    [this.chart, this.cells]  = this.createChart();
     
  },
  computed: {},
  methods: {
    createChart: function() {
      console.log(this.chartData);
      let colorColumn = this.colorColumn;

      let columns = this.columns;

      let padding = this.padding;
      let width = this.width;

      let size =
        (width - (columns.length + 1) * padding) / columns.length + padding;
      let totalSize = size * columns.length;
      var margin = { top: 0, right: 10, bottom: 10, left: 50 };
      let markSize = size / 50;
      let columnTitleSize = size /15;
      let columnTickTextSize = size /15;
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
          .style("font", columnTickTextSize+ "px bold sans-serif");
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
        let vueThis = this;
        const brushObj = d3
          .brush()
          .extent([
            [padding / 2, padding / 2],
            [size - padding / 2, size - padding / 2]
          ])
          .on("start", brushstarted)
          .on("brush", brushed)
          .on("end", brushended);

        cells.call(brushObj);

        let brushCell;

        // Clear the previously-active brush, if any.
        function brushstarted() {
          if (brushCell !== this) {
            d3.select(brushCell).call(brushObj.move, null);
            brushCell = this;
          }
        }

        // Highlight the selected circles.
        function brushed([j, i]) {
          if (d3.event.selection === null) return;
          const [[x0, y0], [x1, y1]] = d3.event.selection;

          let brushed = [];
          let brushedMask = [];
          circle.classed("hidden", d => {
            if (
              x0 > x[columns[i]](d[columns[i]]) ||
              x1 < x[columns[i]](d[columns[i]]) ||
              y0 > y[columns[j]](d[columns[j]]) ||
              y1 < y[columns[j]](d[columns[j]])
            ) {
              return true;
              brushedMask.push(0);
            } else {
              brushed.push(d);
              brushedMask.push(1);
              return false;
            }
          });

        circle.classed("hidden",(d,i) => brushedMask?true:false  )

          console.log(this);
          if (brushed.length > 0) {
            vueThis.$store.commit("highlight", brushed);
            // this.$store.commit("unhighlight", chart.data())
          } else {
          }
        }

        // If the brush is empty, select all circles.
        function brushended() 
        {
          if (d3.event.selection !== null) 
                return;

            circle.classed("hidden", false);
            vueThis.$store.commit("unhighlight", vueThis.chartData)

        }
      };

      const svg = d3
        .select("#splom")
        .append("svg")
        .attr("width", totalSize + margin.left + margin.right)
        .attr("height", totalSize + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      //attr("width", size * columns.length).attr("height" ,size * columns.length)
      //.attr("margin", padding*2).attr("y", padding*2)
      //    .attr("viewBox", [-padding, 0, width*columns.length, width*columns.length]);

      svg
        .append("style")
        .text(
          "circle.hidden { fill: #000; fill-opacity: 1; r: " +
            markSize / 3 +
            "px; }"
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

        return [svg,cells];
    },
    highlight: function(highlightMask)
    {
     this.cells.each(([i, j]) => {
        let circles = d3
          .select(this.cells._groups[0][i + this.columns.length * j])
          .selectAll("circle")

            circles.classed("hidden",(d,i) => highlightMask[i]?false:true  )
         })    
    }, 
    unhighlightAll: function()
    {
     this.cells.each(([i, j]) => {
        let circles = d3
          .select(this.cells._groups[0][i + this.columns.length * j])
          .selectAll("circle")
            circles.classed("hidden",false)
         })    
    },

  },
  created() {
    this.$store.watch(
      (state, getters) => getters.highlightedMask,
      (newValue, oldValue) => 
      {
          var atLeastOne = false;
          for(var on of newValue)
          {
              console.log(on)
              if(on)
              {
                  atLeastOne = true;
                  break;
              }
          }

          if(atLeastOne)
          {
            this.highlight(newValue);
          }
          else
          {
            this.unhighlightAll();
          }
      },
      {
        deep: true //add this if u need to watch object properties change etc.
      }
    );
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

