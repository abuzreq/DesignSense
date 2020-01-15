

<template>
          <div 
              class="parcoords"
              id="parcoords"
              ref="parcoords"    
              style="position: relative"          
          ></div >
</template>


<script>
import 'parcoord-es/dist/parcoords.css';
import ParCoords from 'parcoord-es';
import * as d3 from "d3";

let colorRange = d3.scaleOrdinal(d3.schemeCategory10).range();

export default {
  name: "CompareView",
  props: ["chartData", "width", "height", "excluded_dimensions", "colorColumn"],
  mounted() 
  {
      this.width = 1400;
      this.height = 450;
      this.colorColumn = 'collection';
      var excluded = ['img','ID'] //'GeometryHash'
      this.excluded_dimensions = []
      for(var e of excluded)
      {
          this.excluded_dimensions.push(e)
      }

      this.chartData = this.$store.state.data
      this.createChart();
  }, 
  computed:
  {

  },
  methods: {
    createChart: function() 
    {
        //this.destroyPrCoords()
        //console.log(d3.select('#parcoords'))
        const chart = ParCoords()("#parcoords")
        .data(this.chartData)
        .width(this.width)
        .height(this.height)
        .hideAxis(this.excluded_dimensions)
        .alpha(1)
        .createAxes()
        //.margin({ top: 40, left: 20, bottom: 20, right: 20 })
        .brushMode("1D-axes")
        .alphaOnBrushed(0.2) 
       // .reorderable()
        .mode("queue")
        .render()
        .on('brushend', function(brushed, args)
        {
            //            this.$store.commit("highlight",brushed)
          
          console.log(brushed)
        })
        
        //1D-axes  2D-strums   angular
        var colors = d3.scaleOrdinal(d3.schemeCategory10)//d3.scale.ordinal().range(colorRange);
        chart.color(d => colors(d[this.colorColumn])).render()
    }, 
    destroyPrCoords: function() {
      let node = this.$refs["parcoords"];
      console.log(node)
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    }
  },
  created()
  {
    
     this.$store.watch(
      (state, getters) => getters.data,
      (newValue, oldValue) => 
      {
            this.chartData = newValue;        
            this.createChart();
      })
  },
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

