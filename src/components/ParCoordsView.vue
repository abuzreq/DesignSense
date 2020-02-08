

<template>
  <v-container>
    <div 
      id="parcoords"
      ref="parcoords"    
      class="parcoords"
    />
  </v-container>
</template>


<script>
import 'parcoord-es/dist/parcoords.css';
import views from "@/components/constants.js";

import ParCoords from 'parcoord-es';
import * as d3 from "d3";

export default {
  name: "ParCoordsView",
  props: ["chartData"],
  data()
  { 
    return {chart: null, width: 0, height: 0, excluded_dimensions: [], colorColumn: ""}
  },
  computed:
  {

  },
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
      //this.chartData = this.$store.state.data;
      this.chart = this.createChart();
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
  methods: {
    createChart: function() 
    {

        //this.destroyPrCoords()
        //console.log(d3.select('#parcoords'))
        const chart = ParCoords({nullValueSeparator: "bottom"})("#parcoords")
        .data(this.chartData)
        .width(this.width)
        .height(this.height)
        .hideAxis(this.excluded_dimensions)
        .alpha(1.0)
        .createAxes()
        //.margin({ top: 40, left: 20, bottom: 20, right: 20 })
        .brushMode("1D-axes-multi")//1D-axes-multi
        .alphaOnBrushed(0.2) 
        .reorderable()
        .mode("queue")
        .render()
        .on('brush', (brushed, args) =>
        {  
           
        }).on('brushend', (brushed, args)=>
        {

         // d3.select('#parcoords').selectAll('.selection').style("display", "none");

          if(chart.brushed().length == chart.data().length )
          {
            this.$store.commit("unhighlight", chart.data()) 
          }
          else if (this.$store.shiftOn)
          {
            console.log("Hello")
            this.$store.commit("unhighlight",brushed) 
          }
          else
          {
            console.log(this.$store.shiftOn)
            
            this.$store.commit("highlight", [brushed,views.PCOORDS])   
            // chart.clear('brushed') 
          }
              
        }).on('highlight',(e)=>{console.log(e)});

        //1D-axes  2D-strums   angular
        var colors = d3.scaleOrdinal(d3.schemeCategory10)//d3.scale.ordinal().range(colorRange);
        chart.color(d => colors(d[this.colorColumn])).render()

        chart.brushPredicate("OR")

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

