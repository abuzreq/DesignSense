

<template>
  <v-container>
    <div :id="viewID" />
  </v-container>
</template>


<script>
import * as d3 from "d3";
import { mapState } from "vuex";

export default {
  props: ["width", "height"],
  data() {
    return {
      chart: null,
      viewID: null
    };
  },
  computed: {
    ...mapState({ chartData: state => state.data ,
          numericDimensions: state => state.numericDimensions.concat(["selected"]),
          allDimensions: state => state.allDimensions.concat(["selected"]),
          hovered: state => state.hovered}),
          isCtrlKey: state => state.isCtrlKey
  },
  mounted() {
    this.chart = this.createChart();
    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this
    });
  },
  created() {
    this.viewID = "id" + this._uid;

    this.$store.subscribe((mutation, state) => {
      if (mutation.type === "update" || mutation.type === "resetMarking") 
      {
          //if(this.hasOwnProperty("markingChangeHandler"))
          this.markingChangeHandler();
      }
    });
  },
  methods: {
    createChart: function() {
      this.destroyChart();
      const chart = this.Chart();
      return chart;
    },
    destroyChart: function() {
      let node = d3.select("#" + this.viewID)._groups[0][0]; //this.$refs["parcoords"];
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    },
    highlight(selection) {
      this.chart.highlight(selection);
    },
    refresh: function()
    {
        this.chart = this.createChart();
        var selection = this.$store.getters.selectedDataInView(this.viewID);
        this.highlight(selection);
    }
  },
  watch: {
    hovered: function(newValue, oldValue)
    {
      if(this.hasOwnProperty("hoverHandler"))
          this.hoverHandler();     
    },
    isCtrlKey: function()
    {
       

    },
    width: function(newValue, oldValue) {
          this.refresh();
    },
    height: function(newValue, oldValue) {
       this.refresh();
    },
    chartData: {
      handler: function(newValue, oldValue) {
          this.refresh();
      }
    }
  }
};
</script>

