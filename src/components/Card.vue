<template >
    <vdr
      :type="type"
      class="v-card v-card--outlined v-sheet theme--light"
      style="border: 1px #80808047 solid;"
      :minWidth="minPanelWidth"
      :minHeight="minPanelHeight"
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
      ref="panel"
      v-bind:grid="currentEditingMode ? [unitW, unitH] : [1, 1]"
      :x="this.x"
      :y="this.y"
    >
      

      <ScatterplotView
        v-if="type == 'ScatterPlot'"
        :width="this.width"
        :height="this.height"
        :x="this.x"
        :y="this.y"
        :type="type"
      />
      <ParCoordsView
        v-if="type == 'ParallelCoordinatesPlot'"
        :width="this.width"
        :height="this.height"
        :x="this.x"
        :y="this.y"
        :type="type"
      />
      <AugmentedGridView
        v-if="type == 'Grid'"
        :width="this.width"
        :height="this.height"
        :defaultEnableContext="true"
        :x="this.x"
        :y="this.y"
        :type="type"
      />
      <SPLOMView
        v-if="type == 'SPLOM'"
        :width="this.width"
        :height="this.height"
        :x="this.x"
        :y="this.y"
        :type="type"
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
import { mapGetters } from "vuex";

import ParCoordsView from "@/components/ParCoordsView.vue";
import AugmentedGridView from "@/components/AugmentedGridView.vue";

import SPLOMView from "@/components/SPLOMView.vue";

import ScatterplotView from "@/components/ScatterplotView.vue";

export default {
  components: {
    ParCoordsView,
    AugmentedGridView,
    SPLOMView,
    ScatterplotView,
  },
  // initX..initH are grid cells; unitW and unitH are a cell's size in pixels.
  props: ["initX", "initY", "initW", "initH", "unitW", "unitH", "type"],
  data: function () {
    return {
      width: 800,
      height: 400,
      x: 0,
      y: 0,
    };
  },
  computed: {
    /*computedHandles() {
      let val = this.currentEditingMode ? ["br", "tr", "tl", "bl"] : [];
      console.log(val)
      return val;
    }*/
    ...mapGetters({ currentEditingMode: "getEditingMode" }),
    // Minimum sizes only guard resizing by hand. Otherwise they would push a
    // panel over its neighbour whenever the screen gives it less room.
    minPanelWidth() {
      if (!this.currentEditingMode) return 1;
      return (
        { Grid: 500, ScatterPlot: 400, ParallelCoordinatesPlot: 600 }[
          this.type
        ] || 300
      );
    },
    minPanelHeight() {
      if (!this.currentEditingMode) return 1;
      return this.type == "Grid" ? 600 : 300;
    },
  },
  watch: {
    // A resized window or a saved layout change moves the panel.
    unitW: "applyLayout",
    unitH: "applyLayout",
    initX: "applyLayout",
    initY: "applyLayout",
    initW: "applyLayout",
    initH: "applyLayout",
  },
  created() {
    this.applyLayout();
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
      this.x = x;
      this.y = y;
      this.persistLayout();
    },
    onResizestop: function (x, y, width, height) {
      if (typeof width === "number") this.width = width;
      if (typeof height === "number") this.height = height;
      this.x = x;
      this.y = y;
      this.persistLayout();
    },
    /** Maps grid cells to pixels. Edges are rounded, so neighbours meet exactly. */
    applyLayout: function () {
      let left = Math.round(this.initX * this.unitW);
      let top = Math.round(this.initY * this.unitH);
      this.x = left;
      this.y = top;
      // At least a pixel each way: the panel is laid out before the
      // workspace has been measured, and a zero fails vue-draggable-
      // resizable's own check on `h` as well as sizing the chart inside it.
      let width = Math.max(
        1,
        Math.round((this.initX + this.initW) * this.unitW) - left
      );
      let height = Math.max(
        1,
        Math.round((this.initY + this.initH) * this.unitH) - top
      );
      this.width = width;
      this.height = height;

      // The panel clamps each changed prop against its old size and position,
      // which misplaces it when the window shrinks. Setting its geometry first
      // leaves those prop updates nothing to clamp.
      let panel = this.$refs.panel;
      if (!panel || !this.$el.parentNode) return;
      let parentWidth = this.$el.parentNode.clientWidth;
      let parentHeight = this.$el.parentNode.clientHeight;
      Object.assign(panel, {
        parentWidth: parentWidth,
        parentHeight: parentHeight,
        left: left,
        top: top,
        width: width,
        height: height,
        right: parentWidth - width - left,
        bottom: parentHeight - height - top,
      });
    },
    persistLayout: function () {
      this.$store.commit("updateLayout", {
        type: this.type,
        x: Math.round(this.x / this.unitW),
        y: Math.round(this.y / this.unitH),
        w: Math.max(1, Math.round(this.width / this.unitW)),
        h: Math.max(1, Math.round(this.height / this.unitH)),
      });
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