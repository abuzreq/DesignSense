<template>
  <grid-item
    style="touch-action: none"
    class="v-card v-card--outlined v-sheet theme--light"
    :w="this.iw"
    :h="this.ih"
    @moved="onMove"
    @resize="onResize"
     @container-resized="onResize"
    :is-draggable="this.currentEditingMode"
    :is-resizable="this.currentEditingMode"
    :x="this.ix"
    :y="this.iy"
    :i="this.i"
  >
    <ScatterplotView
      v-if="type == 'ScatterPlot'"
      :ref="'cardChart'"
      :width="this.width"
      :height="this.height"
      :x="this.x"
      :y="this.y"
    />
    <ParCoordsView
      v-else-if="type == 'ParallelCoordinatesPlot'"
      :ref="'cardChart'"
      :width="this.width"
      :height="this.height"
      :x="this.x"
      :y="this.y"
    />
    <AugmentedGridView
      v-else-if="type == 'Grid'"
      :ref="'cardChart'"
      :width="this.width"
      :height="this.height"
      :defaultEnableContext="true"
      :x="this.x"
      :y="this.y"
    />
    <SetsView
      v-else-if="type == 'Sets'"
      :ref="'cardChart'"
      :width="this.width"
      :height="this.height"
      :x="this.x"
      :y="this.y"
    />
    <ClusterView
      v-else-if="type == 'Clusters'"
      :ref="'cardChart'"
      :width="this.width"
      :height="this.height"
      :defaultEnableContext="true"
      :x="this.x"
      :y="this.y"
    />
    <SPLOMView
      v-else-if="type == 'SPLOM'"
      :ref="'cardChart'"
      :width="this.width"
      :height="this.height"
      :x="this.x"
      :y="this.y"
    />
  </grid-item>
</template>

<script>
import { GridLayout, GridItem } from "vue-grid-layout";
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
  props: ["i", "ix", "iy", "iw", "ih", "type"],
  data: function () {
    return {
      width: 1,
      height: 1,
      x: 0,
      y: 0,
      gridSizeX: 160,
      gridSizeY: 160,
    };
  },
  computed: {
    ...mapGetters({ currentEditingMode: "getEditingMode" }),
  },
  mounted() {
  

    document.addEventListener("keyup", function (e) {
      /* if (e.keyCode === 192) {
        this.currentEditingMode = !this.currentEditingMode;
        console.log("Ahaa", this.currentEditingMode, e);
      }*/
    });
  },
  methods: {
    onResize: function (i, newH, newW, newHPx, newWPx) {
    //  if (this.currentEditingMode)
    {
      /*  this.$store.commit("updateLayoutItem", {
          i: i,
          x: this.ix,
          y: this.iy,
          w: newW,
          h: newH,
        });  */
        this.width = newWPx;
        this.height = newHPx;
      }
    },
    onMove: function (i, newX, newY) {
      console.log(this.$parent);
      if (this.currentEditingMode) {
        /*      this.$store.commit("updateLayoutItem", {
          i: i,
          x: newX,
          y: newY,
          w: this.iw,
          h: this.ih,
        }); */
      }

      /*  if (this.currentEditingMode) {
        let layout = this.$store.state.layouts;
        // console.log("Before ", layout);
        let inX = layout[i]["x"];
        var p;
        for (p = 0; p < layout.length; p++) {
          //Horizontal swapping
          console.log(layout[i].type, layout[p].type, layout[i]["y"] , layout[p]["y"],  newX >= layout[p]["x"],  newX < layout[p]["x"] + layout[p]["w"],  layout[i]["y"] === layout[p]["y"],  i !== layout[p]["i"])
          if (
            newX >= layout[p]["x"] &&
            newX < layout[p]["x"] + layout[p]["w"] &&
            layout[i]["y"] === layout[p]["y"] &&
            i !== layout[p]["i"]
          ) {
            console.log('hello')
            let initialX = layout[i]["x"];
            let finalX = layout[p]["x"];
            layout[i]["x"] = finalX;
            layout[p]["x"] = initialX;
          }
          //Vertical swapping
          else if (
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
          this.$store.commit("updateLayoutItem", {
            i: i,
            x: layout[i]["x"],
            y: layout[i]["y"],
            w: layout[i]["w"],
            h: layout[i]["h"],
          });

          this.$store.commit("updateLayoutItem", {
            i: layout[p]["i"],
            x: layout[p]["x"],
            y: layout[p]["y"],
            w: layout[p]["w"],
            h: layout[p]["h"],
          });
        }
      } */
    },
  },
};
</script>