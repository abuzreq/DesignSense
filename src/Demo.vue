<template>
  <v-app>
    <span
      id="designsense-center"
      style="display: none; position: relative; left: 50%; top: 50%"
    ></span>
    <v-app-bar
      app
      dark
      dense
      flat
      short
      color=" white--text text--lighten-1"
      height="50"
    >
      <v-toolbar-title id="designsense-title" style="width: 15vw"
        > <router-link to="/about">DesignSense
        <span style="font-size: 14px; color: deepskyblue"
          >alpha</span
        ></router-link> </v-toolbar-title
      >

      <v-divider vertical />
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['saveToFile'].clickAction">
            <v-icon>{{ actions["saveToFile"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["saveToFile"].tooltip() }}</span>
      </v-tooltip>
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
            id="editing-mode"
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

      <v-spacer></v-spacer>
      <LoadDataModal id="loading-data-bar"> </LoadDataModal>
      <v-spacer></v-spacer>
      <v-divider vertical />
      <SelectionOperationsBar id="selection-operations-bar" />
      <v-divider vertical />

      <v-divider vertical />
     <!--<ColorSelectionModal id="color-selection-bar"> </ColorSelectionModal>--> 

      <v-divider vertical />
      <span id="inspection-bar" style="box-shadow: none !important">
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
      </span>
      <v-divider vertical />
      <span id="sets-operations-bar">
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn v-on="on" icon @click="actions['reverseUpdate'].clickAction">
              <v-icon>{{ actions["reverseUpdate"].icon }}</v-icon>
            </v-btn>
          </template>
          <span>{{ actions["reverseUpdate"].tooltip() }}</span>
        </v-tooltip>
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
            <v-btn
              v-on="on"
              icon
              @click="actions['invertSelection'].clickAction"
            >
              <v-icon>{{ actions["invertSelection"].icon }}</v-icon>
            </v-btn>
          </template>
          <span>{{ actions["invertSelection"].tooltip() }}</span>
        </v-tooltip>
      </span>
      <v-divider vertical />
      <span id="data-operations-bar">
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
            <v-btn
              v-on="on"
              icon
              @click="actions['zoomToSelection'].clickAction"
            >
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
      </span>
    </v-app-bar>

    <v-main id="designsense-workspace" style="padding: 50px 0px 0px">
      <div
        @contextmenu="showContextMenuHandler"
        style="height: 100%; width: 100%; border: 1px solid red"
      >
          <Card
             v-for="(item, index) in layouts"
            :key="index"
            :initX="item.x"
            :initY="item.y"
            :initW="item.w"
            :initH="item.h"
            :type="item.type"
          />
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
    <v-tour
      name="onboardingTour"
      :steps="onboardingTourSteps"
      :options="{ highlight: true }"
      :callbacks="onboardingCallbacks"
    ></v-tour>
  </v-app>
</template>


<style>
.v-tour {
  z-index: 8000;
}
.v-tour .v-step__header {
  color: deepskyblue;
}
.v-tour__target--highlighted {
  box-shadow: 0 0 0 99999px rgba(0, 0, 0, 0.4) !important;
  z-index: 30 !important;
  /*   z-index: 8000 !important;  */
}
.v-tour--active .v-card.vdr.v-tour__target--relative {
  position: absolute !important;
}

body {
  overflow: hidden; /* Hide scrollbars */
}

.v-tooltip__content,
.v-tooltip__content--fixed {
  z-index: 8002 !important;
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

import Card from "@/components/Card.vue";

import { mapState, mapGetters } from "vuex";

import * as d3 from "d3";

import { RadialMenu, RadialMenuItem } from "vue-radial-menu";
import LoadDataModal from "@/components/LoadDataModal.vue";
import ColorSelectionModal from "@/components/ColorSelectionModal.vue";
import { operations } from "@/components/operations.js";

import SelectionOperationsBar from "@/components/SelectionOperationsBar.vue";

import { readyToLoad } from "./main.js";

export default {
  name: "Demo",
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
  },

  data: function () {
    return {
      onboardingCallbacks: {
        onStart: () => (document.body.style.pointerEvents = "all"),
        onSkip: () => (document.body.style.pointerEvents = "all"),
        onFinish: () => (document.body.style.pointerEvents = "all"),
      },
      onboardingTourSteps: [
        {
          target: "#designsense-title", // We're using document.querySelector() under the hood
          header: {
            title: "Welcome to DesignSense!",
          },
          content: "DesignSense is a shopping interface augmented with data visualizations and analysis! The interface was designed to allow users to navigate through a large number of options while considering both the visual appearance and the multidimensional metrics of those options. [Next: &rarr;, Previous: &larr; ]",
          params: {
            enableScrolling: false,
            placement: "bottom",
          },
        },
        {
          target: "#loading-data-bar",
          header: {
            title: "Let's Get Started!",
          },
          content: `First, we need to load a dataset. DSense supports loading data by uploading local files or by loading them from a cloud folder. For now, we will use a simple dataset of boxes.`,
          params: {
            enableScrolling: false,
            placement: "bottom",
          },
        },
        {
          target: "#designsense-center",
          header: {
            title: "Your Workspace",
          },
          content:
            "This is your workspace. Each component plays a different role in the process of navigation as we will see. We will learn later how to configure this workspace to suit our needs.",
          params: {
            enableScrolling: false,
            placement: "top",
          },
        },
        {
          target: ".v-card[type='ScatterPlot']",
          header: {
            title: "2D Scatterplot",
          },
          content:
            "The scatterplot is a basic but very effective visualization of 2-dimensional data. It can be used to identify patterns like correlations, outliers, and clusters. You can drag and hold on the scatterplot to draw a selection box. All the options falling in this box are selected as a result. The scatterplot supports other operations too, feel free to place your cursor over any of the icons to get tooltips on what they can do. By default, any new selection will replace the current one. Let's see how to change that.",
          before: () => {
            let selectedData = this.$store.state.data.filter(
              (d) =>
                d["in:width"] > 3 &&
                d["in:width"] <= 5 &&
                d["in:length"] > 2 &&
                d["in:length"] <= 4
            );

            this.$store.dispatch("update", {
              markingID: this.$store.state.defaultMarkingID,
              selection: selectedData.map((x) => x._id),
              operation: operations.REPLACE,
            });
          },
          params: {
            enableScrolling: false,
            placement: "left",
          },
        },
        {
          target: "#selection-operations-bar",
          header: {
            title: "Selection Operations",
          },
          content:
            "DSense supports 5 different selection operations (i.e. how a newly made selection relates to the current one). You can press on the buttons here to change the operation or press on the numbers from 1 to 5 to easily change it. </br> You will also notice that when you make a selection on any component in the workspace then other components will respond by highlighting the same options. This coordination allows us to combine the best that each component offers.",
          params: {
            enableScrolling: false,
            placement: "bottom",
          },
        },
        {
          target: '.v-card[type="ParallelCoordinatesPlot"]',
          header: {
            title: "The Multidimentional Detective",
          },
          content:
            "The second data visualization is the parallel coordinates plot (PCP). In contrast to the scatterplot, this chart can be used to visualize more than 2 dimensions. Here each vertical axis is a different dimension. Each option is represented by a sequence of lines that touch those axes exactly at the value of the option for that axes. You can also select options on the PCP by dragging a rectangle along any of the axes. You may also re-order the axes or flip them vertically by dragging and double-clicking on their titles respectively. Finally, you can also change the dimensions visualized via the wrench icon.",
          before: () => {
            let selectedData = this.$store.state.data.filter(
              (d) =>
                d["in:width"] > 3 &&
                d["in:width"] <= 5 &&
                d["in:length"] > 2 &&
                d["in:length"] <= 4
            );

            this.$store.dispatch("update", {
              markingID: this.$store.state.defaultMarkingID,
              selection: selectedData.map((x) => x._id),
              operation: operations.REPLACE,
            });
          },
          params: {
            enableScrolling: false,
            placement: "left",
          },
        },
        {
          target: '.v-card[type="Grid"]',
          header: {
            title: "The Augmented Gallery",
          },
          content:
            "Many aspects of the options we navigate may not be adequately judged through data alone and require us to examine a graphical representation of them instead. The Augmented Gallery can be used to view images of the options we are navigating. The big image at the top represents the single option we are currently inspecting (more on inspection shortly). We can sort the images based on a data dimension. We can select options by dragging a rectangle that touches their images or by simply clicking on them. Clicking on the eye icon will show only the options currently selected.",
          params: {
            enableScrolling: false,
            placement: "left",
          },
        },

        {
          target: "#data-operations-bar",
          header: {
            title: "Zooming/Filtering",
          },
          content:
            "Once you have selected a set of options there are few things you can do. You can choose to zoom on that set to examine it closely or exclude that set from your consideration. Both zooming and exclusion operations can be reverted.",
          params: {
            enableScrolling: false,
            placement: "bottom",
          },
        },
        {
          target: "#sets-operations-bar",
          header: {
            title: "Saving to Sets",
          },
          content:
            "On this panel, you can also invert your current selection, unselect everything or save your selection as a Set. You can also undo any selection operation (shortcut: Control-Z)",
          params: {
            enableScrolling: false,
            placement: "bottom",
          },
        },
        {
          target: '.v-card[type="Sets"]',
          header: {
            title: "The Sets Panel",
          },
          content:
            "Sets are a great mechanism for storing the progress we make during navigation. You can restore a set at any time by incorporating its members into the current selection. This will be based on the current selection operation, for example, if you choose to restore a set while the ADD operation is on then the set will be added to the current selection. You can choose to create different sets and combine them or update any of the existing sets.",
          before: () => {
            let selectedData = this.$store.state.data.filter(
              (d) => d["in:width"] <= 2
            );

            this.$store.dispatch("createSet", {
              setName: "SetName",
              members: selectedData.map((x) => x._id),
              comment: "Skinny boxes",
            });
          },
          params: {
            enableScrolling: false,
            placement: "right",
          },
        },
        {
          target: "#inspection-bar",
          header: {
            title: "Continuous Inspection",
          },
          content:
            "Sometimes we will want to examine a single option in detail instead of sifting through options. This can be done in two ways, the first is by enabling the Continuous Inspection mode which allows us to examine any option the cursor passes by through any of its representations (e.g. its image in the gallery, dot in the scatterplot or line in the parallel coordinates plot). Once we do that the option is highlighted in special ways. Notably, a large image of it is shown on the Augmented Gallery (3D views of the inspected option are also supported if DSense can find 3D files in the dataset with the right formats).",
          params: {
            enableScrolling: false,
            placement: "bottom",
          },
        },
        {
          target: '.v-card[type="Grid"]',
          header: {
            title: "On-Demand Inspection",
          },
          content:
            "The second way to inspect options happens by holding the Shift button and releasing it once the target option is found. This way allows us to maintain that inspection even if we move the cursor around. For example, we may be interested in an alternative that is outlying in the scatterplot but then wish to examine its appearance in detail without losing focus.",
          params: {
            enableScrolling: false,
            placement: "left",
          },
          before: () => {
            this.$store.commit("toggleInspectionMode", { value: false });
          },
        },
        {
          target: '.v-card[type="Clusters"]',
          header: {
            title: "Clusters",
          },
          content:
            "DSense automatically clusters the current options we are considering to groups based on their similarity (i.e. it responds to zooming/filtering operations). We can choose the dimensions to group options based on and the number of groups to form. This panel shows a representative sample from each of the formed groups (i.e. it lies at the center of group). By examining those representatives we can gain a bird-view of the dataset. Finally, we can inspect any of the representatives.",
          params: {
            enableScrolling: false,
            placement: "top",
          },
        },
        {
          target: "#designsense-center",
          header: {
            title: "At Your Fingertips!",
          },
          content:
            "By right-clicking anywhere we can summon a fast-access menu that has some of the operations we mentioned earlier. This is especially effective when using DSense across multiple screens.",
          params: {
            enableScrolling: false,
            placement: "top",
          },
        },
        {
          target: "#editing-mode",
          header: {
            title: "Your Workspace, Your Process",
          },
          content:
            "We can adjust the workspace to suit our needs through the inspection mode. This mode allows us to move or resize any of the panels in our workspace. </br>[Pro Tip]: zoom out in your browser before moving panels around.",
          params: {
            enableScrolling: false,
            placement: "bottom",
          },
        },
        {
          target: "#designsense-title",
          header: {
            title: "Thanks!!",
          },
          content: `This marks the end of our tour of DesignSense! Feel free to reach us on TODO or read more on TODO`,
          params: {
            enableScrolling: false,
            placement: "bottom",
          },
          before: () => {
            this.$store.commit("toggleEditingMode", { value: false });
          },
        },
      ],
      operationsList: operations,
      actions: {
        reverseUpdate: {
          clickAction: () => this.$store.dispatch("reverseUpdate"),
          icon: "mdi-undo",
          tooltip: () => "Reverse the last selection update",
          type: "selection",
        },
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
          icon: "mdi-magnify-minus-outline",
          tooltip: () => "Undo zooming or filtering operations",
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
              ? "Disable inspection on hovering ['Shift' to disable inspection]"
              : "Enable continious inspection on hovering. ['Shift' to enable on-spot inspection]",
          type: "inspecting",
        },
        clearInspection: {
          clickAction: () => this.$store.dispatch("clearInspection"),
          icon: "mdi-cancel",
          tooltip: () => "Clear the current inspection",
          type: "inspecting",
        },
        help: {
          clickAction: () => {
            readyToLoad(
              "https://raw.githubusercontent.com/tt-acm/DesignExplorer/gh-pages/design_explorer_data/LittleRedBox.csv"
            ).then((data) => {
              //TODO get skinny boxes then create a set from them + debug this
              this.$tours["onboardingTour"].start();
            });
          },
          icon: "mdi-help-circle-outline",
          tooltip: () => "Start the on-boarding tour!",
          type: "misc",
        },
        toggleEditingMode: {
          clickAction: () => this.$store.dispatch("toggleEditingMode"),
          icon: "mdi-table-edit",
          tooltip: () =>
            this.isEditingMode
              ? "Disable Editing Mode.  [`]"
              : "Enable Editing Mode. (to resize and move the panels)   [`]",
          type: "editing",
        },
        saveToFile:
        {
          clickAction: () => this.$store.dispatch("saveSelectedToFile"),
          icon: 'mdi-download',
          tooltip: () => "Save the selected options to file",
          type: "misc"
        }
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
    };
  },
  computed: {},
  destroyed() {},
  created() {
    document.title = "DesignSense";
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
     // console.log(item);
    },
  },
};

// TODO create refs here in the app to the other charts so that charts can refer to each other using this.$parent.pcoords
// Or have a method in parent called highlight() which is invoked from charts to which the parent App then responds by highlighting the other charts accordingly..
//This could take into account
</script>

