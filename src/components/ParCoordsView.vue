

<template>
  <v-container>
    <!--
    <MultiDimensionSelect
      :initialValue="this.numericDimensions"
      v-on:update="onDimensionChange($event)"
    />
    -->
    <div :id="viewID" ref="parcoords" class="parcoords" />
  </v-container>
</template>
 <!--
     <v-toolbar dense dark color="blue darken-3" class="mb-1">
      
    </v-toolbar>
-->
<script>
import "parcoord-es/dist/parcoords.css";

import ParCoords from "parcoord-es";
import * as d3 from "d3";
import { operations, getOperationFromEvent } from "@/components/operations.js";
import { mapState } from "vuex";
import TemplateView from "@/components/TemplateView.vue";
import MultiDimensionSelect from "@/components/MultiDimensionSelect.vue";

export default {
  mixins: [TemplateView],
  components: { MultiDimensionSelect },
  name: "ParCoordsView",
  data() {
    return {
      excludedDimensions: [],
      colorColumn: "",
      dimensions: []
    };
  },
  mounted() {},
  created() {
    this.dimensions = this.formatDimensions(this.numericDimensions);
    console.log("created", this.dimensions);
    this.colorColumn = "collection";
    var excluded = [
      "image",
      "gltf",
      "geometry",
      "ID",
      "_id",
      "collection",
      "UsableSpace",
      "index",
      "selected"
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
    /*
    this.excludedDimensions = [];
    for (var e of excluded) {
      this.excludedDimensions.push(e);
    }
    */
    this.excludedDimensions = Object.keys(this.chartData[0]).filter(
      d => !this.numericDimensions.includes(d)
    );
  },
  methods: {
    formatDimensions(dimensions) {
      var result = {};
      dimensions.forEach(dim => {
        result[dim] = {};
      });
      return result;
    },
    prepareDimensions(data, dimensions, chart) {
      let range = this.height ;//- chart.margin().top - chart.margin().bottom;
      var result = {};
      dimensions.forEach(dim => 
      {
        let extents = d3.extent(data,d => d[dim])
        let scale = d3.scaleLinear().domain(extents).range([range, 1]);
        result[dim] = {yscale: scale,  title: dim, tickPadding: 0,
                innerTickSize: 8, type:'number', orient:'right', ticks:10};
      });
        console.log(result)

      return result;
    },
    onDimensionChange(newDimensions) {
      this.excludedDimensions = Object.keys(this.chartData[0]).filter(
        d => !newDimensions.includes(d)
      );
      this.refresh();
    },
    markingChangeHandler: function() {
      this.chart.unhighlight(this.$store.getters.data);
      var result = this.$store.getters.selectedDataInView(this.viewID);
      this.chart.highlight(result);
    },
    Chart: function() {
      const chart = ParCoords({ nullValueSeparator: "bottom" }) //
      (
        "#" + this.viewID
      )
        .data(this.chartData)
        .width(this.width)
        .height(this.height)
        .hideAxis(this.excludedDimensions)
        .alpha(1.0)
        .createAxes()
        //.margin({ top: 40, left: 20, bottom: 20, right: 20 })
        .brushMode("1D-axes") //1D-axes-multi 2D-strums angular 1D-axes
        .alphaOnBrushed(0.1)
        .reorderable()
        .mode("queue")
        .render()
        .on("brushend", (brushed, args) => {
          if (d3.event.selection === null) return;

          //To clear the brush/strum once done
          //d3.select("#"+this.viewID).selectAll('.selection').style("display", "none");

          if (chart.brushed().length == chart.data().length) {
            /*
                console.log("Clearing ",this.viewID)
                    this.$store.commit("update", 
                {view: this.viewID,
                  selection: [], 
                  "operation": operations.REPLACE 
                  })*/
          } else {
            //console.log("Brushing ",this.viewID, d3.event)
            this.chart.brushReset();
            //this.chart.unhighlight( this.$store.getters.data) ;
            this.$store.commit("update", {
              view: this.viewID,
              selection: brushed.map(d => d._id),
              operation: getOperationFromEvent(d3.event.sourceEvent)
            });
          }
        })
       /* .on("brushend", (brushed, args) => {

        })*/
        .on("highlight", e => {
          // console.log("highlighting")
        });

      var colorScale = this.$store.state.colorScale; //d3.scale.ordinal().range(colorRange);
      chart.color(d => colorScale(d[this.colorColumn])).render();
      //chart.brushPredicate("OR");
      
      //To place the zero values at center vertically  https://github.com/BigFatDog/parcoords-es/issues/16
      /* 
      this.numericDimensions.forEach(dim => 
      {
        let extents = d3.extent(this.chartData, d => d[dim])
        
        let x = Math.abs(extents[0])
        let y = Math.abs(extents[1])
        let largest = x > y? x: y;
        console.log(dim, [-largest,largest])
        if(!isNaN(largest))
            chart.scale(dim, [-largest,largest])
      });
      */
      //chart.dimensions(this.prepareDimensions(this.chartData, this.numericDimensions, this.chart))


      return chart;
    }
  }
};
</script>

<style scoped>
/deep/ .multiselect__tag {
  width: 50px;
  display: none;
}

/deep/ .multiselect {
  width: 200px;
}
</style>