<template>
  <v-app>
    <v-app-bar
      app
      dark
      dense
      flat
      short
      color=" white--text text--lighten-1"
      height="50"
    >
      <v-toolbar-title style="width: 15vw">DesignSense</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-divider vertical />

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['help'].clickAction">
            <v-icon>{{ actions["help"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["help"].tooltip() }}</span>
      </v-tooltip>

      <v-divider vertical />

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn
            v-on="on"
            :color="actionType2Color(actions['toggleEditingMode'].type)"
            icon
            @click="actions['toggleEditingMode'].clickAction"
          >
            <v-icon>{{ actions["toggleEditingMode"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["toggleEditingMode"].tooltip() }}</span>
      </v-tooltip>

      <v-divider vertical />
      <SelectionOperationsBar />
      <v-divider vertical />
      <v-spacer></v-spacer>
      <LoadDataModal> </LoadDataModal>
      <v-spacer></v-spacer>
      <v-divider vertical />
      <ColorSelectionModal> </ColorSelectionModal>

      <v-spacer></v-spacer>

      <v-divider vertical />

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn
            v-on="on"
            :color="actionType2Color(actions['clearInspection'].type)"
            icon
            @click="actions['clearInspection'].clickAction"
          >
            <v-icon>{{ actions["clearInspection"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["clearInspection"].tooltip() }}</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn
            v-on="on"
            :color="actionType2Color(actions['toggleInspectionMode'].type)"
            icon
            @click="actions['toggleInspectionMode'].clickAction"
          >
            <v-icon>{{ actions["toggleInspectionMode"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["toggleInspectionMode"].tooltip() }}</span>
      </v-tooltip>

      <v-divider vertical />

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['createSet'].clickAction">
            <v-icon>{{ actions["createSet"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["createSet"].tooltip() }}</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn
            v-on="on"
            icon
            @click="actions['resetAllMarkings'].clickAction"
          >
            <v-icon>{{ actions["resetAllMarkings"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["resetAllMarkings"].tooltip() }}</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['invertSelection'].clickAction">
            <v-icon>{{ actions["invertSelection"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["invertSelection"].tooltip() }}</span>
      </v-tooltip>

      <v-divider vertical />

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn
            v-on="on"
            icon
            @click="actions['undoDataTransformation'].clickAction"
          >
            <v-icon>{{ actions["undoDataTransformation"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["undoDataTransformation"].tooltip() }}</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['zoomToSelection'].clickAction">
            <v-icon>{{ actions["zoomToSelection"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["zoomToSelection"].tooltip() }}</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn
            v-on="on"
            icon
            @click="actions['excludeSelection'].clickAction"
          >
            <v-icon>{{ actions["excludeSelection"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["excludeSelection"].tooltip() }}</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['resetData'].clickAction">
            <v-icon>{{ actions["resetData"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["resetData"].tooltip() }}</span>
      </v-tooltip>
    </v-app-bar>

    <v-main style="padding: 50px 0px 0px">
      <div
        @contextmenu="showContextMenuHandler"
        style="
          height: 100%;
          width: 100%;
          border: 1px solid red;
          position: relative;
        "
      >
        <grid-layout
          :layout.sync="layout"
          :col-num="24"
          :is-draggable="true"
          :is-resizable="true"
          :is-mirrored="false"
          :responsive="false"
          :vertical-compact="false"
          :prevent-collision="false"
          :margin="[5, 5]"
          :use-css-transforms="true"
          :autoSize="false"
        >
          <template v-for="(item, index) in layout">
            <Card
              :key="item.i"
              :ix="item.x"
              :iy="item.y"
              :iw="item.w"
              :ih="item.h"
              :i="item.i"
              :type="item.type"
            />
          </template>
        </grid-layout>
      </div>
    </v-main>

    <radial-menu
      ref="contextMenu"
      v-show="showContextMenu"
      :style="{
        position: 'absolute',
        left: `${rightClickPos.x}px`,
        top: `${rightClickPos.y}px`,
      }"
      style="
        margin: auto;
        margin-top: -15px;
        margin-left: -15px;
        background-color: white;
      "
      :itemSize="50"
      :radius="70"
      :angle-restriction="360"
    >
      <radial-menu-item
        v-for="(item, index) in contextMenuItems"
        :key="index"
        style="background-color: white"
      >
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn
              :color="actionType2Color(actions[item].type)"
              v-on="on"
              icon
              @click="actions[item].clickAction"
            >
              <v-icon>{{ actions[item].icon }}</v-icon>
            </v-btn>
          </template>
          <span>{{ actions[item].tooltip() }}</span>
        </v-tooltip>
      </radial-menu-item>
    </radial-menu>
  </v-app>
</template>


<style>
body {
  overflow: hidden; /* Hide scrollbars */
}

.v-toolbar {
  margin-top: -5px;
}
</style>
<script>
import ParCoordsView from "@/components/ParCoordsView.vue";
import GridView from "@/components/GridView.vue";
import AugmentedGridView from "@/components/AugmentedGridView.vue";

import SPLOMView from "@/components/SPLOMView.vue";
import DendrogramView from "@/components/DendrogramView.vue";

import ScatterplotView from "@/components/ScatterplotView.vue";
import TSNEView from "@/components/TSNEView.vue";

import SetsView from "@/components/SetsView.vue";
import ClusterView from "@/components/ClusterView.vue";

import { GridLayout, GridItem } from "vue-grid-layout";
import Card from "@/components/Card.vue";

import { mapState, mapGetters } from "vuex";

import * as d3 from "d3";

import { RadialMenu, RadialMenuItem } from "vue-radial-menu";
import LoadDataModal from "@/components/LoadDataModal.vue";
import ColorSelectionModal from "@/components/ColorSelectionModal.vue";
import { operations } from "@/components/operations.js";

import SelectionOperationsBar from "@/components/SelectionOperationsBar.vue";

export default {
  name: "App",
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
    Card,
    RadialMenu,
    RadialMenuItem,
    LoadDataModal,
    ColorSelectionModal,
    SelectionOperationsBar,
    GridLayout,
    GridItem,
  },

  data: function () {
    return {
      layout: [
        { type: "ParallelCoordinatesPlot", x: 6, y: 0, w: 6, h: 3, i: 1 },
        { type: "ScatterPlot", x: 8, y: 3, w: 4, h: 3, i: 2 },
        //   {type:"ScatterPlot", x: 12, y: 9, w: 12, h: 9},
        //   {type:"ScatterPlot", x: 12, y: 9, w: 12, h: 9},

        // {type:"SPLOM", x: 38, y: 0, w: 16, h: 18},
        { type: "Grid", x: 2, y: 0, w: 4, h: 6, i: 3 },
        { type: "Sets", x: 0, y: 0, w: 2, h: 6, i: 4 },
        { type: "Clusters", x: 6, y: 3, w: 2, h: 3, i: 5 },
      ],

      operationsList: operations,
      actions: {
        createSet: {
          clickAction: () => this.$store.dispatch("createSet"),
          icon: "mdi-contain",
          tooltip: () => "Create Set",
          type: "selection",
        },
        resetAllMarkings: {
          clickAction: () => this.$store.dispatch("resetAllMarkings"),
          icon: "mdi-select-off",
          tooltip: () => "Reset Selection",
          type: "selection",
        },
        invertSelection: {
          clickAction: () => this.$store.dispatch("invertSelection"),
          icon: "mdi-select-compare",
          tooltip: () => "Invert Selection",
          type: "selection",
        },
        undoDataTransformation: {
          clickAction: () => this.$store.dispatch("undoDataTransformation"),
          icon: "mdi-undo",
          tooltip: () => "Undo",
          type: "data",
        },
        zoomToSelection: {
          clickAction: () => this.$store.dispatch("zoomToSelection"),
          icon: "mdi-selection-search",
          tooltip: () => "Zoom on the Selected",
          type: "data",
        },
        excludeSelection: {
          clickAction: () => this.$store.dispatch("excludeSelection"),
          icon: "mdi-filter-remove-outline",
          tooltip: () => "Exclude the Selected",
          type: "data",
        },
        resetData: {
          clickAction: () => this.$store.dispatch("resetData"),
          icon: "mdi-cached",
          tooltip: () => "Reset Data",
          type: "data",
        },
        toggleInspectionMode: {
          clickAction: () => this.$store.dispatch("toggleInspectionMode"),
          icon: "mdi-selection-ellipse-arrow-inside",
          tooltip: () =>
            this.isInspectionMode
              ? "Disable inspection on hovering"
              : "Enable inspection on hovering",
          type: "inspecting",
        },
        clearInspection: {
          clickAction: () => this.$store.dispatch("clearInspection"),
          icon: "mdi-cancel",
          tooltip: () => "Clear the current inspection",
          type: "inspecting",
        },
        help: {
          clickAction: () => console.log("TODO"),
          icon: "mdi-help-circle-outline",
          tooltip: () => "Help.. to come.",
          type: "misc",
        },
        toggleEditingMode: {
          clickAction: () => this.$store.dispatch("toggleEditingMode"),
          icon: "mdi-table-edit",
          tooltip: () =>
            this.isEditingMode
              ? "Disable Editing Mode."
              : "Enable Editing Mode. (to resize and move the panels)",
          type: "editing",
        },
      },
      contextMenuItems: [
        "toggleInspectionMode",
        "clearInspection",
        "resetAllMarkings",
        "createSet",
        "excludeSelection",
        "zoomToSelection",
        "undoDataTransformation",
      ],

      showContextMenu: false,
      rightClickPos: { x: 0, y: 0 },
      selectionOperation: () =>
        getOperation({
          altKey: this.$store.state.isAltKey,
          shiftKey: this.$store.state.isShiftKey,
          ctrlKey: this.$store.state.isCtrlKey,
        }),
    };
  },
  computed: {},
  destroyed() {},
  created() {
    //To close the context menu when a click happens anywhere
    document.addEventListener("click", (e) => {
      //To prevent the context menu from closing when the click is on it
      let contextMenuNode = d3.select(".vue-radial-menu-container")
        ._groups[0][0];
      if (e.target !== contextMenuNode) {
        this.showContextMenu = false;
      }
    });
  },
  mounted() {
    let contextMenuCenter = this.$el.getElementsByClassName(
      "vue-radial-menu-container"
    )[0];

    contextMenuCenter.addEventListener("wheel", () => {
      this.moveToNextOperation();
    });
  },
  computed: {
    ...mapState({
      currentSelectionOperation: (state) => state.currentSelectionOperation,
      layouts: (state) => state.layouts,
      isEditingMode: (state) => state.isEditingMode,
      isInspectionMode: (state) => state.isInspectionMode,
    }),
  },
  methods: {
    moveToNextOperation() {
      console.log("move");
      let current = this.$store.state.currentSelectionOperation;
      let allOperationsValues = Object.values(operations);
      let index = allOperationsValues.findIndex((x) => x == current);
      let newOperation =
        allOperationsValues[(index + 1) % allOperationsValues.length];
      this.$store.commit("changeSelectionOperation", newOperation);
    },
    actionType2Color: function (type) {
      return {
        data: "red",
        selection: "blue",
        misc: "black",
        inspecting: this.isInspectionMode ? "green accent-4" : "grey",
        editing: this.isEditingMode ? "green accent-4" : "grey",
      }[type];
    },
    showContextMenuHandler(e) {
      //TODO: change this.
      //A cheap trick to make sure the context menu does not appear on the 3D viewer DOM.
      //console.log(e.target)
      if (
        !e.target.id.includes("inspector") &&
        e.target.localName != "canvas" &&
        e.target.localName != "textarea"
      ) {
        e.preventDefault();
        this.rightClickPos = { x: e.clientX, y: e.pageY };
        this.showContextMenu = true;
        this.$refs.contextMenu.isOpen = true;
      }
    },
    handleContextMenuClick(item) {
      console.log(item);
    },
  },
};

// TODO create refs here in the app to the other charts so that charts can refer to each other using this.$parent.pcoords
// Or have a method in parent called highlight() which is invoked from charts to which the parent App then responds by highlighting the other charts accordingly..
//This could take into account
</script>

