<template>
  <grid-item
    style="touch-action: none"
    class="v-card v-card--outlined v-sheet theme--light"
    :w="this.iw"
    :h="this.ih"
    @move="onMove"
    @resize="onResize"
    @container-resized="onContainerResize"
    :is-draggable="this.currentEditingMode"
    :is-resizable="this.currentEditingMode"
    :x="this.ix"
    :y="this.iy"
    :i="this.i"
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
  </grid-item>
</template>

<script>
import { GridLayout, GridItem } from "vue-grid-layout";

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
    GridLayout,
    GridItem,
  },
  props: ["ix", "iy", "iw", "ih", "type"],
  data: function () {
    return {
      iw: 1,
      ih: 1,
      ix: 0,
      iy: 0,
      width: 1,
      height: 1,
      x: 0,
      y: 0,
      i: 0,
      gridSizeX: 160,
      gridSizeY: 160,
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
  mounted() {
    this.width = this.iw * this.$parent.rowHeight;
    this.height = this.ih * this.$parent.rowHeight;

    document.addEventListener("keyup", function (e) {
      /* if (e.keyCode === 192) {
        this.currentEditingMode = !this.currentEditingMode;
        console.log("Ahaa", this.currentEditingMode, e);
      }*/
    });
  },
  methods: {
    onResize: function (i, newH, newW, newHPx, newWPx) {
      if (this.currentEditingMode) {
        this.iw = newW;
        this.ih = newH;
        this.width = newWPx;
        this.height = newHPx;
      }
    },
    onMove: function (i, newX, newY) {
      if (this.currentEditingMode) {
        this.ix = newX;
        this.iy = newY;

      /*   let layout = this.$parent.layout;
       // console.log("Before ", layout);
        let inX = layout[i]['x'];
        var p;
        for (p = 0; p < layout.length; p++) {
          // console.log(layout[p])
          //Horizontal swapping
          if (
            newX >= layout[p]["x"] &&
            newX < layout[p]["x"] + layout[p]["w"] &&
            layout[i]["y"] === layout[p]["y"] &&
            i !== layout[p]["i"]
          ) {
            let initialX = layout[i]["x"];
            let finalX = layout[p]["x"];
            layout[i]["x"] = finalX;
            layout[p]["x"] = initialX;
          }
          //Vertical swapping
          if (
            newY >= layout[p]["y"] &&
            newY < layout[p]["y"] + 1 &&
            layout[i]["x"] === layout[p]["x"] &&
            i !== layout[p]["i"]
          ) {
            let initialY = layout[i]["y"];
            let finalY = layout[p]["y"];
            layout[i]["y"] = finalY;
            layout[p]["y"] = initialY;
          }
        }
        this.$emit("layoutUpdate", layout);
        if( layout[i]['x'] != inX){
                console.log("After ",);

        }
       */
      }
    },
  },
};
</script>