<template>
  <div>
    <h1>Bar Chart</h1>
    <svg class="bar-chart"></svg>
  </div>
</template>

<script>
import * as d3 from "d3";
export default {
  name: "BarChart",
  props: ["chartData", "width", "height", "barPadding"],
  mounted() {
    console.log('Loading data')
    d3.csv("https://gist.githubusercontent.com/abuzreq/29c6d38ff5586b57c7f89916f15e80e5/raw/d6f4f73b1b25b5a26d5d8614698c74e458f49329/test.csv")
    .then((data) => 
    {
        let values = []
        data.forEach((d) => {
            values.push(+d.value)
            console.log(+d.value)
        })
        console.log(values);
        this.chartData = values;
        this.width = 400;
        this.height = 400;
        this.barPadding = 10;
        this.createBarChart();
     })

    
  },
  methods: {
    createBarChart: function() {
      let barWidth = this.width / this.chartData.length;
      let svg = d3
        .select("svg")
        .attr("width", this.width)
        .attr("height", this.height);
      svg
        .selectAll("rect")
        .data(this.chartData)
        .enter()
        .append("rect")
        .attr("y", d => {
          this.height - d;
        })
        .attr("height", d => {
          return d;
        })
        .attr("width", barWidth - this.barPadding)
        .attr("transform", (d, i) => {
          let translate = [barWidth * i, 0];
          return "translate(" + translate + ")";
        });
    }
  },
  watch: {
    chartData: function() {
      this.createBarChart();
    },
    width: function() {
      this.createBarChart();
    },
    height: function() {
      this.createBarChart();
    },
    barPadding: function() {
      this.createBarChart();
    }
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>