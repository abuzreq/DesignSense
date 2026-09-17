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
      height="60"
    >
      <v-toolbar-title id="designsense-title" class="ds-title">
        <router-link to="/about"
          >DesignSense
          <span class="ds-alpha" style="font-size: 14px; color: deepskyblue"
            >alpha</span
          ></router-link
        >
      </v-toolbar-title>
      <v-divider vertical class="ds-divider" />

      <!-- Getting data in and out -->
      <LoadDataModal id="loading-data-bar"> </LoadDataModal>
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['saveToFile'].clickAction">
            <v-icon>{{ actions["saveToFile"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["saveToFile"].tooltip() }}</span>
      </v-tooltip>
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <!-- A disabled button swallows pointer events, so the span carries the tooltip. -->
          <span v-on="on">
            <v-btn
              :disabled="!isStudySharable"
              icon
              @click="actions['shareStaticLink'].clickAction"
            >
              <v-icon>{{ actions["shareStaticLink"].icon }}</v-icon>
            </v-btn>
          </span>
        </template>
        <span>{{ actions["shareStaticLink"].tooltip() }}</span>
      </v-tooltip>
      <v-divider vertical class="ds-divider" />

      <v-tooltip bottom max-width="340">
        <template v-slot:activator="{ on }">
          <div v-on="on" id="ui-mode-toggle" class="ui-mode-toggle">
            <v-btn-toggle
              :value="uiMode"
              mandatory
              dense
              rounded
              @change="setUiMode"
            >
              <v-btn small value="lite">Lite</v-btn>
              <v-btn small value="expert">Expert</v-btn>
            </v-btn-toggle>
          </div>
        </template>
        <span v-if="isLite"
          >Lite: brush the charts to filter the collection. Each filter is
          listed in the bar and can be removed. Switch to Expert for selection
          operations, inspection controls, and layout editing.</span
        >
        <span v-else
          >Expert: expressive selection (Replace, Add, Subtract, Toggle,
          Intersect), inspection controls, and layout editing. Switch to Lite
          to simply filter and browse.</span
        >
      </v-tooltip>
      <v-divider vertical class="ds-divider" />

      <!-- How the collection is narrowed: filters in Lite, a selection in Expert -->
      <div class="ds-narrowing">
        <SelectionOperationsBar
          v-if="can('selectionOperations')"
          id="selection-operations-bar"
        />
        <FilterBar v-else id="filter-bar" />
      </div>

      <!-- Ask or command, in the same row: the list of suggestions floats
           below, so the bar stays one row tall. -->
      <AssistantBar ref="assistant" id="assistant-bar" />

      <v-divider vertical class="ds-divider" />
      <ToolbarGroup
        id="sets-operations-bar"
        :label="isLite ? 'Results' : 'Selection'"
        :names="selectionActions"
        :actions="actions"
        :disabled="isActionDisabled"
      />
      <v-divider vertical class="ds-divider" />
      <ToolbarGroup
        id="data-operations-bar"
        label="Zoom"
        :names="dataActions"
        :actions="actions"
        :disabled="isActionDisabled"
      />
      <template v-if="can('inspectionControls')">
        <v-divider vertical class="ds-divider" />
        <ToolbarGroup
          id="inspection-bar"
          label="Inspection"
          :names="inspectionActions"
          :actions="actions"
          :color="toolbarColor"
        />
      </template>
      <v-divider vertical class="ds-divider" />
      <ToolbarGroup id="view-bar" label="View" :actions="actions">
        <ColorSelectionModal id="color-selection-bar" />
        <v-tooltip v-if="can('layoutEditing')" bottom>
          <template v-slot:activator="{ on }">
            <v-btn
              id="editing-mode"
              v-on="on"
              :color="toolbarColor(actions['toggleEditingMode'].type)"
              icon
              @click="actions['toggleEditingMode'].clickAction"
            >
              <v-icon>{{ actions["toggleEditingMode"].icon }}</v-icon>
            </v-btn>
          </template>
          <span>{{ actions["toggleEditingMode"].tooltip() }}</span>
        </v-tooltip>
      </ToolbarGroup>
      <v-divider vertical class="ds-divider" />
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['help'].clickAction">
            <v-icon>{{ actions["help"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["help"].tooltip() }}</span>
      </v-tooltip>

    </v-app-bar>
    <v-dialog :key="456" v-model="isShareLinkModalOn" width="750px">
      <template>
        <v-card
        style="z-index: 300; padding: 15px"
          height="200px"
          max-width="650">
          <v-card-title style="font-size: xx-large;">
            Share Link
          </v-card-title>
          <v-row no-gutters style="padding: 25px;" >
            <div v-if="shareLink">
            {{shareLink}}
          </div>
          <div v-else>There is no static link for you if you are not using online shared folder. </div>
          </v-row>
          <div style="position: absolute; top: 5%;right: 5%;">
            <v-btn
              icon
              @click="isShareLinkModalOn = false"
            >
              <v-icon>{{ "mdi-close" }}</v-icon></v-btn
            >
          </div>
      </v-card>
      </template>
    </v-dialog>

    <v-dialog :key="123" v-model="isOpeningDialogOn" width="650px">
      <template>
        <v-card
          style="z-index: 300; padding: 15px"
          height="400px"
          max-width="650"
        >
          <v-card-title style="font-size: xx-large;">
            Welcome to DesignSense!
          </v-card-title>
          <div style="position: absolute; top: 5%;right: 5%;">
            <v-btn
              icon
              @click="$store.commit('setIsOpeningDialogOn', { value: false })"
            >
              <v-icon>{{ "mdi-close" }}</v-icon></v-btn
            >
          </div>
          <div
            style="font-size: large; display: flex; flex-direction: column; padding: 10px 20px;"
          >
            <p>
              DesignSense is a tool for navigating and making sense of
              parametric design spaces.
            </p>
            <div style="display: flex; flex-direction: row;">
            <div style="display: flex; flex-direction: column; width: 300px; align-items: center;justify-content: space-between;">
              <p>
                First time here? we suggest starting with the
                onboarding tour.
              </p>

              <v-btn
                color="blue lighten-2"
                dark
                style="align-self: center;"
                @click="
                  $store.commit('setIsOpeningDialogOn', { value: false });
                  actions.help.clickAction();
                "
              >
                Start On-boarding</v-btn
              >
            </div>
            <div style="display: flex; flex-direction: column; width: 300px; align-items: center;justify-content: space-between;">
              <p>
                Been here before?
              </p>
              <LoadDataModal> </LoadDataModal>
            </div>
          </div>
          <p style="margin-top:20px; font-size: medium;"><em> This is an ongoing research project, so we would appreciate your feedback!</em></p>
          <div
            style="display: flex; flex-direction: row;   justify-content: center; border-bottom: 1px solid #00000057;  "
          >
            <div><router-link to="/about">About </router-link></div>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <div><a href="mailto:abuzreq@gmail.com">Contact</a></div>
          </div>
          </div>


          <div
            style="width: 600px; font-size: small; position: absolute; bottom: 2%;left: 5%;text-align: left;"
          >
            <p style="margin-bottom: 0px;">
              Built by
              <a href="https://abuzreq.netlify.app/" target="_blank"
                >Ahmed Abuzuraiq</a
              >
            </p>
            <div>v1.1.2</div>
          </div>
        </v-card>
      </template>
    </v-dialog>
    <v-main id="designsense-workspace" style="padding: 60px 0px 0px">
      <div
        ref="workspace"
        class="ds-workspace"
        @contextmenu="showContextMenuHandler"
      >
        <Card
          v-for="(item, index) in layouts"
          :key="index"
          :initX="item.x"
          :initY="item.y"
          :initW="item.w"
          :initH="item.h"
          :unitW="unitW"
          :unitH="unitH"
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
      :steps="onboardingStudyTourSteps"
      :options="{
        highlight: true,
        labels: {
          buttonSkip: 'Skip tour',
          buttonPrevious: 'Back',
          buttonNext: 'Next',
          buttonStop: 'Done',
        },
      }"
      :callbacks="onboardingCallbacks"
    ></v-tour>
    <v-snackbar
      v-model="showLoadNotice"
      :color="loadState.error ? 'error' : 'grey darken-3'"
      :timeout="loadState.error ? -1 : 8000"
      bottom
      left
    >
      {{ loadNotice }}
      <template v-slot:action="{ attrs }">
        <v-btn text v-bind="attrs" @click="showLoadNotice = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<style>
.v-tour {
  z-index: 8000;
}

/* Tour steps: short, left-aligned and comfortable to read. */
.v-tour .v-step {
  max-width: 340px;
  padding: 14px 16px;
  border-radius: 8px;
}
.v-tour .v-step__header {
  margin: -14px -16px 10px;
  padding: 8px 16px;
  border-radius: 8px 8px 0 0;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}
.v-tour .v-step__content {
  font-size: 14px;
  line-height: 1.5;
  text-align: left;
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

.ui-mode-toggle {
  margin: 0 2px;
}
.ds-title {
  flex: 0 0 auto;
  margin-right: 4px;
}
.v-app-bar .v-divider--vertical.ds-divider {
  align-self: center;
  min-height: 32px;
  max-height: 32px;
  margin: 0 8px;
}
/* The filters or selection operations take whatever room the groups leave. */
.ds-narrowing {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  justify-content: center;
}
.ds-workspace {
  position: relative;
  width: 100%;
  height: calc(100vh - 60px);
}
/* Below 1500px Expert's toolbar needs every pixel, so labels give way to icons. */
@media (max-width: 1500px) {
  .v-app-bar .v-toolbar__content {
    padding-left: 8px;
    padding-right: 8px;
  }
  .ds-alpha {
    display: none;
  }
  #loading-data-bar .load-data-label {
    display: none;
  }
  #loading-data-bar .load-data-icon.v-icon {
    margin: 0;
  }
  #loading-data-bar .load-data-button.v-btn {
    min-width: 0 !important;
    padding: 0 10px !important;
  }
  .v-app-bar .v-divider--vertical.ds-divider {
    margin: 0 2px;
  }
  .v-app-bar .v-btn.v-btn--icon.v-size--default {
    width: 34px !important;
    height: 34px !important;
  }
}

/* Expert mode: the pointer shows which operation a brush will apply. */
body[data-selection-op] .scatter-svg .overlay,
body[data-selection-op] .scatter-svg .lasso-area,
body[data-selection-op] .parcoords .brush .overlay,
body[data-selection-op] .scroll-container {
  cursor: var(--ds-selection-cursor) !important;
}
</style>
<script>
import Vue from "vue";

import ParCoordsView from "@/components/ParCoordsView.vue";
import GridView from "@/components/GridView.vue";
import AugmentedGridView from "@/components/AugmentedGridView.vue";

import SPLOMView from "@/components/SPLOMView.vue";
import DendrogramView from "@/components/DendrogramView.vue";

import ScatterplotView from "@/components/ScatterplotView.vue";
import TSNEView from "@/components/TSNEView.vue";

import SetsView from "@/components/SetsView.vue";

import Card from "@/components/Card.vue";

import { mapState, mapGetters } from "vuex";

import * as d3 from "d3";

import { RadialMenu, RadialMenuItem } from "vue-radial-menu";
import LoadDataModal from "@/components/LoadDataModal.vue";
import ColorSelectionModal from "@/components/ColorSelectionModal.vue";
import { operations } from "@/components/operations.js";

import SelectionOperationsBar from "@/components/SelectionOperationsBar.vue";
import FilterBar from "@/components/FilterBar.vue";
import ToolbarGroup from "@/components/ToolbarGroup.vue";
import { LAYOUT_COLUMNS, LAYOUT_ROWS } from "@/layout.js";
import { applySelectionCursor } from "@/components/selectionCursors.js";

import AssistantBar from "@/components/AssistantBar.vue";
import {
  DEFAULT_DATASET_URL,
  loadDataset,
  loadState,
} from "@/data/loader.js";

/**
 * One onboarding step. `mode` is the UI mode whose controls the step points
 * at; the tour switches to it first, so stepping back and forth still finds
 * its target. `setup` prepares an example for the step.
 */
function tourStep(vm, mode, target, title, content, placement, setup) {
  return {
    target: target,
    header: { title: title },
    content: content,
    params: { enableScrolling: false, placement: placement },
    before: () => vm.prepareTourStep(mode, setup),
  };
}

export default {
  name: "Demo",
  components: {
    AssistantBar,
    ParCoordsView,
    GridView,
    AugmentedGridView,
    SPLOMView,
    DendrogramView,
    ScatterplotView,
    TSNEView,
    SetsView,
    Card,
    RadialMenu,
    RadialMenuItem,
    LoadDataModal,
    ColorSelectionModal,
    SelectionOperationsBar,
    FilterBar,
    ToolbarGroup,
  },

  data: function() {
    return {
      onboardingCallbacks: {
        onStart: () => (document.body.style.pointerEvents = "all"),
        onSkip: () => (document.body.style.pointerEvents = "all"),
        onFinish: () => (document.body.style.pointerEvents = "all"),
      },
      // Lite first, then what Expert adds. Each step names the mode it needs.
      onboardingStudyTourSteps: [
        tourStep(this, "lite", "#designsense-title", "Welcome to DesignSense",
          "Explore a collection of design options through their images and their data. This tour takes about two minutes. Use the arrow keys or the buttons below.",
          "bottom"),
        tourStep(this, "lite", "#ui-mode-toggle", "Lite and Expert",
          "<b>Lite</b> keeps things simple: you narrow the options with filters. <b>Expert</b> adds precise selection, clustering, and a layout you can rearrange. The tour starts in Lite.",
          "bottom"),
        tourStep(this, "lite", "#loading-data-bar", "Load your data",
          "Open a collection from your computer or from a shared folder. This tour uses a small set of used cars.",
          "bottom"),
        tourStep(this, "lite", '.v-card[type="Grid"]', "Gallery",
          "Every option appears here as an image. Sort them from the menu at the top and change the image size on the right. Click an image to inspect it, and click it again to stop.",
          "right"),
        tourStep(this, "lite", ".v-card[type='ScatterPlot']", "Scatterplot",
          "Each dot is an option. Drag a box to filter by both axes, and choose the axes at the top. Click a dot to inspect it.",
          "left", () => this.showTourFilter()),
        tourStep(this, "lite", '.v-card[type="ParallelCoordinatesPlot"]', "Parallel coordinates",
          "Each line is an option and each axis is a dimension. Drag along an axis to filter it. Drag a title to reorder the axes, or pick them under Axes.",
          "left"),
        tourStep(this, "lite", "#filter-bar", "Your filters",
          "Each filter becomes a chip, and the count shows how many options match. Remove a chip to drop its filter, or press Esc to clear them all.",
          "bottom"),
        tourStep(this, "lite", "#data-operations-bar", "Zoom",
          "Zoom in on the matching options to focus on them, or exclude them instead. Reset brings back the whole collection.",
          "bottom"),
        tourStep(this, "lite", '.v-card[type="Sets"]', "Saved sets",
          "Save the current results along with their filters. Restore a set later to bring those filters back.",
          "right", () => this.saveTourSet()),
        tourStep(this, "expert", "#ui-mode-toggle", "Expert mode",
          "Expert keeps everything you have seen and adds more control. Instead of filtering, you build a selection.",
          "bottom"),
        tourStep(this, "expert", "#selection-operations-bar", "Selection operations",
          "Choose how a new selection combines with the current one: replace, add, subtract, toggle, or intersect. Hold Shift to add, Ctrl to subtract, or both to intersect.",
          "bottom"),
        tourStep(this, "expert", "#sets-operations-bar", "Selection tools",
          "Undo, redo, clear, or invert the selection.",
          "bottom"),
        tourStep(this, "expert", ".v-card[type='ScatterPlot'] div.cluster-view", "Clusters",
          "Clusters group options that are similar on the dimensions you choose. Each image stands for a group. Click it to select the whole group.",
          "left", () => this.$store.commit("setClusteringPanelOpen", { value: true })),
        tourStep(this, "expert", "#inspection-bar", "Inspection",
          "Hold Space and move over any option to inspect it. Pin keeps it inspected after you let go, and the last button inspects without holding Space.",
          "bottom"),
        tourStep(this, "expert", "#editing-mode", "Your layout",
          "Turn on editing to move and resize the panels.",
          "bottom"),
        tourStep(this, "lite", "#designsense-title", "You're ready",
          "You're back in Lite. Switch to Expert whenever you need more control, and right-click anywhere for quick actions. Feedback is welcome at abuzreq@gmail.com.",
          "bottom", () => this.$store.dispatch("clearFilters")),
      ],
      operationsList: operations,
      actions: {
        undo: {
          clickAction: () => this.$store.dispatch("undo"),
          icon: "mdi-undo",
          tooltip: () =>
            this.isLite
              ? "Undo the last filter change [Ctrl+Z]"
              : "Undo the last selection change [Ctrl+Z]",
          type: "selection",
        },
        redo: {
          clickAction: () => this.$store.dispatch("redo"),
          icon: "mdi-redo",
          tooltip: () => "Redo [Ctrl+Y]",
          type: "selection",
        },
        createSet: {
          clickAction: () => this.$store.dispatch("createSet"),
          icon: "mdi-contain",
          tooltip: () =>
            this.isLite
              ? "Save the matching options and their filters as a set"
              : "Create Set",
          type: "selection",
        },
        resetAllMarkings: {
          clickAction: () => this.$store.dispatch("resetAllMarkings"),
          icon: "mdi-select-off",
          tooltip: () =>
            this.isLite ? "Clear all filters [Esc]" : "Reset Selection [ESC]",
          type: "selection",
        },
        invertSelection: {
          clickAction: () => this.$store.dispatch("invertSelection"),
          icon: "mdi-select-inverse",
          tooltip: () =>
            this.isLite
              ? "Invert: show everything the filters leave out"
              : "Invert Selection",
          type: "selection",
        },
        undoDataTransformation: {
          clickAction: () => this.$store.dispatch("undoDataTransformation"),
          icon: "mdi-magnify-minus-outline",
          tooltip: () => "Step back out of the last zoom or exclusion",
          type: "data",
        },
        zoomToSelection: {
          clickAction: () => this.$store.dispatch("zoomToSelection"),
          icon: "mdi-magnify-plus-outline",
          tooltip: () =>
            this.isLite
              ? "Zoom in on the matching options. Charts rescale to them and you can filter again inside them."
              : "Zoom on the selected",
          type: "data",
        },
        excludeSelection: {
          clickAction: () => this.$store.dispatch("excludeSelection"),
          icon: "mdi-filter-remove-outline",
          tooltip: () =>
            this.isLite
              ? "Exclude the matching options from the collection"
              : "Filter out the selected",
          type: "data",
        },
        resetData: {
          clickAction: () => this.$store.dispatch("resetData"),
          icon: "mdi-restart",
          tooltip: () =>
            this.isLite
              ? "Show the full collection again. Your filters stay."
              : "Show all the data again",
          type: "data",
        },
        toggleInspectionMode: {
          clickAction: () => this.$store.dispatch("toggleInspectionMode"),
          icon: "mdi-selection-ellipse-arrow-inside",
          tooltip: () =>
            this.isInspectionMode
              ? "Disable inspection on hovering ['Space' to disable inspection]"
              : "Enable continuous inspection on hovering. ['Space' to enable on-spot inspection]",
          type: "inspecting",
        },
        clearInspection: {
          clickAction: () => this.$store.dispatch("clearInspection"),
          icon: "mdi-cancel",
          tooltip: () => "Cancel the currently inspected item [ESC]",
          type: "inspecting",
        },
        togglePinInspection: {
          clickAction: () => this.$store.dispatch("togglePinInspection"),
          icon: "mdi-pin",
          tooltip: () =>
            this.isInspectionPinned
              ? "Unpin the currently inspected item [P]"
              : "Pin the currently inspected item [P]",
          type: "inspectionPin",
        },
        help: {
          clickAction: () => {
            // The tour starts in Lite, then introduces Expert.
            this.$store.dispatch("setUiMode", "lite");
            // The tour walks through the used-car dataset, so it loads first.
            loadDataset(DEFAULT_DATASET_URL, { source: "tour" })
              .then((dataset) => {
                if (dataset) this.$tours["onboardingTour"].start();
              })
              .catch(() => {
                /* loadState.error carries the message */
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
        saveToFile: {
          clickAction: () => this.$store.dispatch("saveSelectedToFile"),
          icon: "mdi-download",
          tooltip: () =>
            this.isLite
              ? "Download the matching options (.csv)"
              : "Download the selected options to file (.csv)",
          type: "misc",
        },
        shareStaticLink: {
          clickAction: () => this.isShareLinkModalOn = true,
          icon: "mdi-share-variant-outline",
          tooltip: () => "Creates a static link to share this session if the data was hosted on a cloud service.",
          type: "misc",
        },
      },
      showContextMenu: false,
      rightClickPos: { x: 0, y: 0 },
      isShareLinkModalOn: false,
      dismissedNotice: "",
      // The page minus its scrollbar gutter and the 60px app bar, so panels
      // mount at their final size. Re-measured on mount and on window resize.
      workspaceWidth: document.documentElement.clientWidth,
      workspaceHeight: Math.max(0, document.documentElement.clientHeight - 60),
    };
  },
  destroyed() {},
  beforeDestroy() {
    if (this.workspaceObserver) this.workspaceObserver.disconnect();
    window.removeEventListener("resize", this.onWorkspaceResize);
    document.removeEventListener("click", this.onDocumentClick);
    clearTimeout(this.resizeTimer);
  },
  created() {
    document.title = "DesignSense";
    //To close the context menu when a click happens anywhere
    this.onDocumentClick = (e) => {
      //To prevent the context menu from closing when the click is on it
      let contextMenuNode = d3.select(".vue-radial-menu-container")
        ._groups[0][0];
      if (e.target !== contextMenuNode) {
        this.showContextMenu = false;
      }
    };
    document.addEventListener("click", this.onDocumentClick);

    this.track();
    let shown = localStorage.getItem("wasOpeningDialogShown");
    console.log("SHOWN", shown, typeof shown);
    if (shown !== "true") {
      this.$store.commit("setIsOpeningDialogOn", { value: true });

      localStorage.setItem("wasOpeningDialogShown", "true");
    } else {
      this.$store.commit("setIsOpeningDialogOn", { value: false });
    }
  },
  mounted() {
    this.measureWorkspace();
    // The observer also catches size changes no window resize event reports;
    // both feed the same delayed measurement.
    window.addEventListener("resize", this.onWorkspaceResize);
    if (window.ResizeObserver) {
      this.workspaceObserver = new ResizeObserver(this.onWorkspaceResize);
      this.workspaceObserver.observe(this.$refs.workspace);
    }

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
      isInspectionPinned: (state) => state.isInspectionPinned,
      isOpeningDialogOn: (state) => state.isOpeningDialogOn,
      shareLink:  (state) => state.shareLink,
      isStudySharable: (state) => state.isStudySharable,
      uiMode: (state) => state.uiMode,
      shownCount: (state) => state.data.length,
      dataStack: (state) => state.dataStack,
      filterHistory: (state) => state.filterHistory,
      filterFuture: (state) => state.filterFuture,
      selectionHistory: (state) => state.selectionHistory,
      selectionFuture: (state) => state.selectionFuture,
    }),
    ...mapGetters([
      "can",
      "isLite",
      "isFilterActive",
      "hasScope",
      "selectionCount",
    ]),
    loadState() {
      return loadState;
    },
    /**
     * What the last load left to say. The load dialog shows its own errors, so
     * only a load nobody watched reports one here.
     */
    loadNotice() {
      if (loadState.error) {
        let unwatched =
          loadState.source === "startup" || loadState.source === "tour";
        return unwatched ? loadState.error : "";
      }
      return loadState.warnings.join(" ");
    },
    showLoadNotice: {
      get() {
        return this.loadNotice !== "" && this.loadNotice !== this.dismissedNotice;
      },
      set(value) {
        if (!value) this.dismissedNotice = this.loadNotice;
      },
    },
    // Panels sit on a grid stretched over the workspace, so they fill any screen.
    unitW() {
      return this.workspaceWidth / LAYOUT_COLUMNS;
    },
    unitH() {
      return this.workspaceHeight / LAYOUT_ROWS;
    },
    selectionActions() {
      // Lite's undo, redo and clear already sit in the filter bar; what it
      // lacks is inverting the result and saving it as a set.
      return this.isLite
        ? ["invertSelection", "createSet"]
        : ["undo", "redo", "resetAllMarkings", "invertSelection"];
    },
    dataActions() {
      return [
        "zoomToSelection",
        "excludeSelection",
        "undoDataTransformation",
        "resetData",
      ];
    },
    inspectionActions() {
      return ["togglePinInspection", "clearInspection", "toggleInspectionMode"];
    },
    contextMenuItems() {
      if (this.isLite) {
        return [
          "clearInspection",
          "resetAllMarkings",
          "createSet",
          "zoomToSelection",
          "excludeSelection",
          "undo",
        ];
      }
      return [
        "togglePinInspection",
        "clearInspection",
        "resetAllMarkings",
        "createSet",
        "excludeSelection",
        "zoomToSelection",
        "undoDataTransformation",
      ];
    },
  },
  watch: {
    currentSelectionOperation: {
      immediate: true,
      handler() {
        this.updateSelectionCursor();
      },
    },
    uiMode() {
      this.updateSelectionCursor();
    },
  },
  methods: {
    track() {
      console.log("tracking", this.$gtag);
      this.$gtag.pageview("/");
    },
    setUiMode(mode) {
      if (mode) this.$store.dispatch("setUiMode", mode);
    },
    /** Puts the workspace in `mode` for a tour step, then runs its setup. */
    prepareTourStep(mode, setup) {
      let store = this.$store;
      store.commit("toggleEditingMode", { value: false });
      let switching = store.state.uiMode !== mode;
      if (switching) store.dispatch("setUiMode", mode);
      if (setup) setup();
      // Give the panels time to re-render, so the step finds its target.
      return new Promise((resolve) => setTimeout(resolve, switching ? 400 : 50));
    },
    /** Filters the tour's used-car data, so the filter chips have something to show. */
    showTourFilter() {
      let dims = this.$store.state.numericDimensions;
      if (!dims.includes("price") || !dims.includes("year")) return;
      this.$store.dispatch("setRangeFilters", {
        ranges: { price: [4000, 12000], year: [2006, 2015] },
      });
    },
    saveTourSet() {
      if (this.$store.state.setsIDs.length === 0) {
        this.$store.dispatch("createSet");
      }
    },
    measureWorkspace() {
      let el = this.$refs.workspace;
      if (!el) return;
      this.workspaceWidth = el.clientWidth;
      this.workspaceHeight = el.clientHeight;
    },
    // Resizing rebuilds every chart, so wait until the size settles.
    onWorkspaceResize() {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(this.measureWorkspace, 150);
    },
    /** Greys out toolbar actions that would do nothing right now. */
    isActionDisabled(name) {
      // Zoom and exclude act on the filter result in Lite, the selection in Expert.
      let count = this.isLite
        ? this.isFilterActive
          ? this.selectionCount
          : 0
        : this.selectionCount;
      switch (name) {
        case "undo":
          return (
            (this.isLite ? this.filterHistory : this.selectionHistory)
              .length === 0
          );
        case "redo":
          return (
            (this.isLite ? this.filterFuture : this.selectionFuture).length ===
            0
          );
        case "zoomToSelection":
        case "excludeSelection":
          return count === 0 || count >= this.shownCount;
        case "undoDataTransformation":
          return this.isLite ? !this.hasScope : this.dataStack.length === 0;
        case "resetData":
          return !this.hasScope;
        case "invertSelection":
          // Nothing to invert until something is filtered out.
          return this.isLite ? !this.isFilterActive : false;
        default:
          return false;
      }
    },
    // Toggles light up while on; other toolbar buttons keep the bar's color.
    toolbarColor(type) {
      if (
        type === "inspecting" ||
        type === "inspectionPin" ||
        type === "editing"
      ) {
        return this.actionType2Color(type);
      }
      return undefined;
    },
    updateSelectionCursor() {
      applySelectionCursor(
        document.body,
        this.can("selectionOperations") ? this.currentSelectionOperation : null
      );
    },
    moveToNextOperation() {
      if (!this.can("selectionOperations")) return;
      console.log("move");
      let current = this.$store.state.currentSelectionOperation;
      let allOperationsValues = Object.values(operations);
      let index = allOperationsValues.findIndex((x) => x == current);
      let newOperation =
        allOperationsValues[(index + 1) % allOperationsValues.length];
      this.$store.commit("changeSelectionOperation", newOperation);
    },
    actionType2Color: function(type) {
      return {
        data: "red",
        selection: "blue",
        misc: "black",
        inspecting: this.isInspectionMode ? "green accent-4" : "grey",
        inspectionPin: this.isInspectionPinned ? "green accent-4" : "grey",
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
