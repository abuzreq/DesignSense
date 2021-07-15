<template >
    <vdr
      :type="type"
      class="v-card v-card--outlined v-sheet theme--light"
      
      :minWidth="
        type == 'Grid'
          ? 500
          : type == 'ScatterPlot'
          ? 400
          : type == 'ParallelCoordinatesPlot'
          ? 600
          : 300
      "
      :minHeight="type == 'Grid' ? 600 : 300"
      :w="this.width"
      :h="this.height"
      @activated="onActivated"
      @dragging="onDrag"
      @dragstop="onDragstop"
      @resizing="onResize"
      @resizestop="onResizestop"
      :parent="true"
      :is-conflict-check="false"
      :snap="true"
      v-bind:handles="this.currentEditingMode ? ['br', 'tr', 'tl', 'bl'] : []"
      :draggable="this.currentEditingMode"
      :resizable="this.currentEditingMode"
      v-bind:grid="[this.gridSize, this.gridSize]"
      :x="this.x"
      :y="this.y"
    >
      

      <ScatterplotView
        v-if="type == 'ScatterPlot'"
        :width="this.width"
        :height="this.height"
        :x="this.x"
        :y="this.y"
      />
      <ParCoordsView
        v-if="type == 'ParallelCoordinatesPlot'"
        :width="this.width"
        :height="this.height"
        :x="this.x"
        :y="this.y"
      />
      <AugmentedGridView
        v-if="type == 'Grid'"
        :width="this.width"
        :height="this.height"
        :defaultEnableContext="true"
        :x="this.x"
        :y="this.y"
      />
      <SetsView
        v-if="type == 'Sets'"
        :width="this.width"
        :height="this.height"
        :x="this.x"
        :y="this.y"
      />
      <ClusterView
        v-if="type == 'Clusters'"
        :width="this.width"
        :height="this.height"
        :defaultEnableContext="true"
        :x="this.x"
        :y="this.y"
      />
      <SPLOMView
        v-if="type == 'SPLOM'"
        :width="this.width"
        :height="this.height"
        :x="this.x"
        :y="this.y"
      />
    
    </vdr>
</template>
<style scoped>


/* .v-tour--active .card-panel {
  height: 100%;
  width: 100%;
  position: absolute;
} */
.top-card {
  z-index: 25 !important;
}
</style>
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
    ClusterView,
  },
  props: ["initX", "initY", "initW", "initH", "type"],
  data: function () {
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
    ...mapGetters({ currentEditingMode: "getEditingMode" }),
  },
  created() {
    console.log("editingMode", this.currentEditingMode);
    this.x = this.initX * this.gridSize;
    this.y = this.initY * this.gridSize;
    this.width = this.initW * this.gridSize;
    this.height = this.initH * this.gridSize;

    document.addEventListener("keyup", function (e) {
      /* if (e.keyCode === 192) {
        this.currentEditingMode = !this.currentEditingMode;
        console.log("Ahaa", this.currentEditingMode, e);
      }*/
    });
  },
  methods: {
    onResize: function (x, y, width, height) {
      if (this.currentEditingMode) {
        if (
          this.x !== x ||
          this.y !== y ||
          this.width !== width ||
          this.height !== height
        ) {
          this.assignTopCard(this.$el);
          this.x = x;
          this.y = y;
          this.width = width;
          this.height = height;
        }
      }
    },
    onDrag: function (x, y) {
      if (this.currentEditingMode) {
        if (this.x !== x || this.y !== y) {
          this.assignTopCard(this.$el);
          this.x = x;
          this.y = y;
        }
      }
    },
    onDragstop: function (x, y) {
      this.assignTopCard(this.$el);
    },
    onResizestop: function (x, y) {
      // this.$el.classList.remove("top-card");
    },
    onActivated: function () {
      //  console.log('ahaa', this.$el)
      //    this.assignTopCard(this.$el);
    },
    assignTopCard: function (el) {
      var currentTopCard = document.getElementsByClassName("top-card");
      if (currentTopCard.length > 0) {
        if (!el.isEqualNode(currentTopCard[0])) {
          currentTopCard[0].classList.remove("top-card");
        }
      }
      el.classList.add("top-card");
    },
  },
};
</script>