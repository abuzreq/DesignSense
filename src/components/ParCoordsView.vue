

<template>
<v-container fluid >
          <div 
              class="parcoords"
              id="parcoords"
              ref="parcoords"    
          ></div >
  </v-container>
</template>


<script>
import 'parcoord-es/dist/parcoords.css';
import ParCoords from 'parcoord-es';
import * as d3 from "d3";

let colorRange = d3.scaleOrdinal(d3.schemeCategory10).range();

export default {
  name: "ParCoordsView",
  props: ["chart","chartData", "width", "height", "excluded_dimensions", "colorColumn"],
  mounted() 
  {
      this.width = 1200;
      this.height = 450;
      this.colorColumn = 'collection';
      var excluded = ['image','gltf','geometry','ID','_id','highlighted','collection'] //'GeometryHash' ,'highlighted'
      this.excluded_dimensions = []
      for(var e of excluded)
      {
          this.excluded_dimensions.push(e)
      }
      this.chartData = this.$store.state.data;
      this.chart = this.createChart();
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
        .reorderable()
        .mode("queue")
        .render()
        .on('brush', (brushed, args) =>
        {  
           
        }).on('brushend', (brushed, args)=>
        {
          if(chart.brushed().length == chart.data().length)
          {
            this.$store.commit("unhighlight", chart.data()) 
          }
          else
          {
            this.$store.commit("highlight", brushed)     
          }
              
        });

        //1D-axes  2D-strums   angular
        var colors = d3.scaleOrdinal(d3.schemeCategory10)//d3.scale.ordinal().range(colorRange);
        chart.color(d => colors(d[this.colorColumn])).render()
        return chart;
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
    (state) => {
        let on = [];
        let off =[];

        let it = 0;
        for(var id in state.highlighted_map)
        {
            if( state.highlighted_map[id] == 1)
            {
              on.push(state.data[it])
            }
            else
            {
              off.push(state.data[it])         
            }
            it += 1
        }

        return [on, off]
        //return .array.filter(d => highlighted[d] == 1)
       // return state.highlighted;
    },
    (newValue, oldValue) => 
    {
          let on = newValue[0]
          let off = newValue[1]
         // console.log("newvalue",on,off)
           // this.chartData = newValue;        
          // this.chart.highlight(on);
         //  this.chart.unhighlight(off);
    },
    {
        deep: true //add this if u need to watch object properties change etc.
    });



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

