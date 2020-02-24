

<template>
  <v-container>
    <div :id="viewID" ref="parcoords" class="parcoords" />
  </v-container>
</template>


<script>
import "parcoord-es/dist/parcoords.css";
import views from "@/components/constants.js";

import ParCoords from "parcoord-es";
import * as d3 from "d3";
import {operations, getOperationFromEvent} from "@/components/operations.js";
import { mapState } from "vuex";

export default {
  name: "ParCoordsView",
 // props: ["chartData"],
  data() {
    return {
      chart: null,
      viewID: null,
      width: 0,
      height: 0,
      excluded_dimensions: [],
      colorColumn: "",
    };
  },
  computed: {
      ...mapState({chartData: state => state.data})
  },
  mounted() {
    this.width = 1400;
    this.height = 450;
    this.colorColumn = "collection";
    var excluded = [
      "image",
      "gltf",
      "geometry",
      "ID",
      "_id",
      "collection",
      "UsableSpace",
      "index"
    ]; 
      /*excluded = [
      "center_of_mass_x",
      "iterationmax_displacment",
      "mu",
      "ID",
      "_id",
      "collection",
      "index",
        "image",
      "gltf",
      "geometry","max_vonmises_stress"
    ]; */
    
    //'GeometryHash' ,'highlighted'
    this.excluded_dimensions = [];
    for (var e of excluded) {
      this.excluded_dimensions.push(e);
    }
    //this.chartData = this.$store.state.data;
    this.chart = this.createChart();
    this.$store.dispatch('createDefaultView',{view: this.viewID, vueComponent: this})
  },
  created() {
     this.viewID = 'id'+this._uid;

     this.$store.subscribe((mutation, state) => {
      if (mutation.type === 'update' || mutation.type === 'resetMarking') 
      {
        this.chart.unhighlight( this.$store.getters.data) ;  
        var result = this.$store.getters.selectedDataInView(this.viewID);
        this.chart.highlight(result) ;  
      }
    });

  },
  methods: {
    createChart: function() {
      this.destroyChart()
   
      const chart = ParCoords({ nullValueSeparator: "bottom" })("#"+this.viewID)
        .data(this.chartData)
        .width(this.width)
        .height(this.height)
        .hideAxis(this.excluded_dimensions)
        .alpha(1.0)
        .createAxes()
        //.margin({ top: 40, left: 20, bottom: 20, right: 20 })
        .brushMode("1D-axes") //1D-axes-multi
        .alphaOnBrushed(0.1)
        .reorderable()
        .mode("queue")
        .render()
        .on("brush", (brushed, args) => {})
        .on("brushend", (brushed, args) => 
        {
          if(d3.event.selection === null) return;

           //To clear the brush/strum once done
           //d3.select("#"+this.viewID).selectAll('.selection').style("display", "none");
             if (chart.brushed().length == chart.data().length) 
             {
               
               /*
                console.log("Clearing ",this.viewID)
                    this.$store.commit("update", 
                {view: this.viewID,
                  selection: [], 
                  "operation": operations.REPLACE 
                  })*/
             }
             else
             {
               //console.log("Brushing ",this.viewID, d3.event)
                this.chart.brushReset();
                //this.chart.unhighlight( this.$store.getters.data) ;
                this.$store.commit("update", 
                {view: this.viewID,
                  selection: brushed.map(d => d._id), 
                  "operation": getOperationFromEvent(d3.event.sourceEvent) 
                  })
             }
        })
        .on("highlight", e => {
         // console.log("highlighting")
        });

      //1D-axes  2D-strums   angular
      var colors = d3.scaleOrdinal(d3.schemeCategory10); //d3.scale.ordinal().range(colorRange);
      chart.color(d => colors(d[this.colorColumn])).render();

      //chart.brushPredicate("OR");

      return chart;
    },
    destroyChart: function() {
      let node = d3.select("#"+this.viewID)._groups[0][0];//this.$refs["parcoords"];
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    }
  },
  watch: {
    chartData: {
      handler: function(newValue, oldValue) {
        this.chart = this.createChart();
      }
      //deep: true
    }
  }
};
</script>

