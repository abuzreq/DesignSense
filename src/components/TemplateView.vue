

<template>
  <v-container>
    <div :id="viewID" />
  </v-container>
</template>


<script>
import * as d3 from "d3";
import { mapState, mapGetters } from "vuex";

export default {
  props: ["width", "height", "x", "y"],
  data() {
    return {
      chart: null,
      viewID: null,
    };
  },
  computed: {
    ...mapGetters(["colorScale", "colorize", "isHoveringEnabled"]),
    ...mapState({
      currentSelectionOperation: (state) => state.currentSelectionOperation,
      chartData: (state) => state.data,
      numericDimensions: (state) => state.numericDimensions,
      allDimensions: (state) => state.allDimensions,
      hovered: (state) => state.hovered,
      colorColumn: (state) => state.colorColumn,
    }),
  },
  mounted() {
    this.chart = this.createChart();
    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this,
    });
  },
  created() {
    this.viewID = "id" + this._uid;

    this.$store.subscribe((mutation, state) => {
      if (mutation.type === "update" || mutation.type === "resetMarking") {
        if (this.hasOwnProperty("markingChangeHandler"))
          this.markingChangeHandler(mutation.type === "resetMarking");
      }
    });
  },
  methods: {
    createChart: function () {
      this.destroyChart();
      const chart = this.Chart();
      return chart;
    },
    destroyChart: function () {
      let node = d3.select("#" + this.viewID)._groups[0][0];
      while (node && node.firstChild) {
        node.removeChild(node.firstChild);
      }
    },
    highlight(selection) {
      this.chart.highlight(selection);
    },
    refresh: function () {
      this.chart = this.createChart();
      var selection = this.$store.getters.selectedDataInView(this.viewID);
      this.highlight(selection);
    },
  },
  watch: {
    hovered: function (newValue, oldValue) {
      if (this.hasOwnProperty("hoverHandler")) {
        this.hoverHandler();
      }
    },
    width: function (newValue, oldValue) {
      console.log("new width");
      this.refresh();
    },
    height: function (newValue, oldValue) {
      this.refresh();
    },
    chartData: {
      handler: function (newValue, oldValue) {
        this.refresh();
      },
    },
  },
  colorColumn: function (newValue, oldValue) {
    this.refresh();
  },
  colorScale: function (newValue, oldValue) {
    this.refresh();
  },
};
</script>

