<template>
  <div>
    <h1>Bar Chart</h1>
    <svg class="bar-chart"></svg>
  </div>
</template>

<script>
import * as d3 from "d3";
import store from "@/store";

export default {
el : "barChart",
  name: "BarChart",
  props: ["chartData", "width", "height", "barPadding"],
  mounted() {
    console.log('Loading data')
    d3.csv("https://gist.githubusercontent.com/abuzreq/29c6d38ff5586b57c7f89916f15e80e5/raw/d6f4f73b1b25b5a26d5d8614698c74e458f49329/test.csv")
    .then((data) => 
    {
        let values = []
        data.forEach((d) => {
            d.value = +d.value         
       })
        console.log(data);
        this.chartData = data;
        this.chartData = this.$store.state.data
        this.width = 400;
        this.height = 400;
        this.barPadding = 10;
        this.createBarChart();
     })
  }, 
  computed:
  {
      svg: function()
      {   
        return d3.select(this.$el)
            .select("svg")
            .attr("width", this.width)
            .attr("height", this.height);
      }
  },
  methods: {
    add: function(i)
    {
        console.log(this.chartData[i].value)      
        this.chartData[i].value += 10
        console.log("after",this.chartData[i].value)
    },  
    createBarChart: function() 
    {
     
      let barWidth = this.width / this.chartData.length; 
        
      this.svg
        .selectAll("rect")
        .data(this.chartData)
        .join("rect")
        .attr("y", d => {
          this.height - d.value;
        })
        .attr("height", d => {
          return d.value;
        })
        .attr("width", barWidth - this.barPadding)
        .attr("transform", (d, i) => {
          let translate = [barWidth * i, 0];
          return "translate(" + translate + ")";
        })
        .attr("fill", (d,i) => d.selected? "red":"black")
        .on('mouseover', (d,i)=>
         {
            //this.$parent.$refs.bar1.add(i)
            //this.$parent.$refs.bar2.add(i)
            this.$store.commit("increment",i)
            this.$store.commit("select",i)
         })
         .on('mouseout', (d,i)=>
         {
            this.$store.commit("unselect",i)
         });

         //this.svg.selectAll("rect").exit().remove()
    },
  },
  created(){
     this.$store.watch(
      (state, getters) => getters.data,
      (newValue, oldValue) => 
      {
            this.chartData = newValue;
            //this.createBarChart();
      })
  },
  watch: {
    chartData: {
        handler: function() 
        {
            this.createBarChart();
        }, deep :true
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