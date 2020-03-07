<template>
  <vdr
    class="v-card v-card--outlined v-sheet theme--light"
    :minWidth="300"
    :minHeight="200"
    :w="this.width"
    :h="this.height"
    @dragging="onDrag"
    @resizing="onResize"

    :parent="true"
    :is-conflict-check="true"
    :snap="true"
    v-bind:handles = "this.currentEditingMode ? ['br', 'tr', 'tl', 'bl'] : []"
    :draggable="this.currentEditingMode"
:resizable="this.currentEditingMode"

    v-bind:grid="[this.gridSize, this.gridSize]"
    :x="this.x"
    :y="this.y"
  >
    <ScatterplotView v-if="type == 'ScatterPlot'" :width="this.width" :height="this.height" />
    <ParCoordsView
      v-if="type == 'ParallelCoordinatesPlot'"
      :width="this.width"
      :height="this.height"
    />
    <AugmentedGridView v-if="type == 'Grid'" :width="this.width" :height="this.height" />
    <SetsView v-if="type == 'Sets'" :width="this.width" :height="this.height" />
    <ClusterView v-if="type == 'Clusters'" :width="this.width" :height="this.height" />
  </vdr>
</template>

<script>
import vdr from "vue-draggable-resizable-gorkys";
import { mapState, mapGetters } from "vuex";

import ParCoordsView from "@/components/ParCoordsView.vue";
import GridView from "@/components/GridView.vue";
import AugmentedGridView from "@/components/AugmentedGridView.vue";

import SPLOMView from "@/components/SPLOMView.vue";
import DendrogramView from "@/components/DendrogramView.vue";

import ScatterplotView from "@/components/ScatterplotView.vue";
import TSNEView from "@/components/TSNEView.vue";

import SetsView from "@/components/SetsView.vue";
import ClusterView from "@/components/ClusterView.vue";

export default {
  components: {
    ParCoordsView,
    GridView,
    AugmentedGridView,
    SPLOMView,
    DendrogramView,
    ScatterplotView,
    TSNEView,
    SetsView,
    ClusterView
  },
  props: ["initX", "initY", "initW", "initH", "type"],
  data: function() {
    return {
      width: 800,
      height: 400,
      x: 0,
      y: 0,
      gridSize: 50,
    };
  },
  computed: {
    /*computedHandles() {
      let val = this.currentEditingMode ? ["br", "tr", "tl", "bl"] : [];
      console.log(val)
      return val;
    }*/
       ...mapState({currentEditingMode: state => state.editingMode})
  },
  created() {
    console.log("editingMode", this.currentEditingMode)
    this.x = this.initX * this.gridSize;
    this.y = this.initY * this.gridSize;
    this.width = this.initW * this.gridSize;
    this.height = this.initH * this.gridSize;

    document.addEventListener("keyup", function(e) 
    {
     /* if (e.keyCode === 192) {
        this.currentEditingMode = !this.currentEditingMode;
        console.log("Ahaa", this.currentEditingMode, e);
      }*/
    });
  },
  methods: {
    onResize: function(x, y, width, height) {
      if (this.currentEditingMode) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
      }
    },
    onDrag: function(x, y) {
      if (this.currentEditingMode) {
        this.x = x;
        this.y = y;
      }
    }
  }
};
</script>