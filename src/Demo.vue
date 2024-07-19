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
      <v-toolbar-title id="designsense-title" style="width: 10vw">
        <router-link to="/about"
          >DesignSense
          <span style="font-size: 14px; color: deepskyblue"
            >alpha</span
          ></router-link
        >
      </v-toolbar-title>
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
      <LoadDataModal id="loading-data-bar"> </LoadDataModal>
      <v-divider vertical />
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
          <v-btn :disabled="!isStudySharable" v-on="on" icon @click="actions['shareStaticLink'].clickAction">
            <v-icon>{{ actions["shareStaticLink"].icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ actions["shareStaticLink"].tooltip() }}</span>
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
      <SelectionOperationsBar id="selection-operations-bar" />
      <v-spacer></v-spacer>
      <!--<ColorSelectionModal id="color-selection-bar"> </ColorSelectionModal>-->

      <v-divider vertical />
      <v-spacer></v-spacer>
      <div
        id="inspection-bar"
        style="box-shadow: none !important; display: flex;  flex-direction: column;"
      >

        <div style="margin-top: 0px;">
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn
                v-on="on"
                :color="actionType2Color(actions['togglePinInspection'].type)"
                icon
                @click="actions['togglePinInspection'].clickAction"
              >
                <v-icon>{{ actions["togglePinInspection"].icon }}</v-icon>
              </v-btn>
            </template>
            <span>{{ actions["togglePinInspection"].tooltip() }}</span>
          </v-tooltip>
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
        </div>
        <div style="align-self: center; margin-bottom: 5px;  margin-top: -5px; font-size: small;">
          Inspection
        </div>
      </div>
      <v-spacer></v-spacer>
      <v-divider vertical />
      <v-spacer></v-spacer>
        <div id="sets-operations-bar" style="box-shadow: none !important; display: flex;  flex-direction: column;">
        <div style="margin-top: 0px;">
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
      </div>
      <div style="align-self: center; margin-bottom: 5px;  margin-top: -5px; font-size: small;">
           Selection
        </div>
    </div>
    <v-spacer></v-spacer>
      <v-divider vertical />
      <v-spacer></v-spacer>
      <div id="data-operations-bar" style="box-shadow: none !important; display: flex;  flex-direction: column;">

        <div style="margin-top: 0px;">
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
      </div>
      <div style="align-self: center; margin-bottom: 5px;  margin-top: -5px; font-size: small;">
        Zoom/Filter
      </div>
    </div>
    <v-spacer></v-spacer>
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
                  $tours['onboardingTour'].start();
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
            <div><a href="mailto:aabuzura@sfu.ca">Contact</a></div>
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
      :steps="onboardingStudyTourSteps"
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

import { readyToLoad, loadDataFromCloudURL} from "./main.js";

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
    Card,
    RadialMenu,
    RadialMenuItem,
    LoadDataModal,
    ColorSelectionModal,
    SelectionOperationsBar,
  },

  data: function() {
    return {
      onboardingCallbacks: {
        onStart: () => (document.body.style.pointerEvents = "all"),
        onSkip: () => (document.body.style.pointerEvents = "all"),
        onFinish: () => (document.body.style.pointerEvents = "all"),
      },
      onboardingStudyTourSteps: [
        {
          target: "#designsense-title", // We're using document.querySelector() under the hood
          header: {
            title: "Welcome to DesignSense!",
          },
          content:
            "A tool for exploring, narrowing and understanding design spaces. DesignSense is designed to allow users to navigate through a large number of options while considering both the visual appearance and the data associated with those options. In short, <em>DesignSense </em> is a shopping interface that is augmented with advanced data visualizations and analysis! [Next: &rarr;, Previous: &larr; ]",
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
          content: `First, we need to load a dataset. <em>DesignSense</em> supports loading data by uploading local files or by loading them from a cloud folder. For now, we will use a simple dataset of used cars. `,
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
            "This is your workspace. Each component plays a different role in the process of navigation as we will see. As a general tip, if you hover your mouse over any of the icons in the interface you will be presented with information on what these icons do.",
          params: {
            enableScrolling: false,
            placement: "top",
          },
        },
        {
          target: '.v-card[type="Grid"]',
          header: {
            title: "Images Gallery",
          },
          content:
            "Many aspects of the options we navigate may not be adequately judged through data alone and require us to examine a graphical representation of them instead. The Augmented Gallery can be used to view images of the options we are navigating. The big image at the top represents the single option we are currently inspecting (more on <i>inspection</i> shortly), whbile the grid of images below show all the options we are exploring. We can sort the images based on a data dimension (top left). We can select options by dragging a rectangle that touches their images or by simply clicking the checkbox to the top left of an option's image. Clicking on the eye icon (top-center) switch the grid to show only the currently selected options. You can change the size of the images on the grid using the size slider (top-right). If you pick the largest size, you become able to expand on the details of each option which makes it easier to compare them side-by-side",
          params: {
            enableScrolling: false,
            placement: "left",
          },
        },
        {
          target: ".v-card[type='ScatterPlot']",
          header: {
            title: "2D Scatterplot",
          },
          content:
            "The scatter plot is a simple but very effective visualization of 2-dimensional data. For example you can plot the price vs. year of manufacturing for each car. The scatterplot can be used to visually identify patterns like correlations, outliers, and clusters. By clicking then dragging on the scatterplot you create a selection box. All the options falling in this box are selected as a result. By default, any new selection will replace the current one. Let's see how to change that.",
          before: () => {
            console.log(this.$store.state.data)
            let selectedData = this.$store.state.data.filter(
              (d) =>
                d["year"] > 2005 &&
                d["year"] <= 2015 &&
                d["price"] > 4000 &&
                d["price"] <= 12000
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
          target: '.v-card[type="ParallelCoordinatesPlot"]',
          header: {
            title: "The Parallel Coordinates Plot (PCP)",
          },
          content:
            "The second data visualization is the parallel coordinates plot (PCP). In contrast to the scatterplot, this chart can be used to visualize more than 2 dimensions. Here each vertical axis is a different data dimension. Each option is represented by a string of lines that touch those axes exactly at the value of that the option for that axis/dimension. You can select options on the PCP by dragging a rectangle along any of the axes. You may also re-order the axes or flip them vertically by dragging and double-clicking on their titles respectively. Finally, you can also change the data dimensions shown using the wrench icon.",
          before: () => {
            console.log(this.$store.state.data)
            let selectedData = this.$store.state.data.filter(
              (d) =>
                d["year"] > 2005 &&
                d["year"] <= 2015 &&
                d["price"] > 4000 &&
                d["price"] <= 12000
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
            "<em>DesignSense</em> supports 5 different selection operations (i.e. how the newly selected options will relate to the currently selected ones). You may click on those icons or use shortcuts: hold Shift for addition, hold Ctrl for subtraction, hold both for intersection. </br> You will also notice that when you make a selection on any component in the workspace then other components will respond by highlighting the same selected options. This coordination allows us to combine the best of what each component offers.",
          params: {
            enableScrolling: false,
            placement: "bottom",
          },
        },

        {
          target: "#data-operations-bar",
          header: {
            title: "Zooming/Filtering",
          },
          content:
            "Once you have selected a set of options there are few things you can do. You can choose to zoom on that set to examine it closely or exclude that set from your consideration. Both zooming and exclusion operations can be reverted back or reset completely.",
          params: {
            enableScrolling: false,
            placement: "bottom",
          },
        },

        {
          target: "#sets-operations-bar",
          header: {
            title: "Selection",
          },
          content:
            "On this panel, you can unselect everthing (shortcut: ESC), or invert your current selection. You may also revert the last selection operation you made (shortcut: Ctrl-Z)",
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
            "Sets are a great mechanism for storing the progress we make during navigation. To create a set, click on 'New Set'. Once you create a set, you can bring it back it back by simplying clicking on it. Note that the current selection operation will apply when you do, e.g. if you had Add on then the set will be added to your current selection. Finally, you can add/remove from a set using the +/- icons.",
          before: () => {
            let selectedData = this.$store.state.data.filter(
              (d) => d["year"] > 2015
            );

            this.$store.dispatch("createSet", {
              setName: "Set #1",
              members: selectedData.map((x) => x._id),
              comment: "Recent cars",
            });
          },
          params: {
            enableScrolling: false,
            placement: "right",
          },
        },
        {
          target: '.v-card[type="Grid"]',
          header: {
            title: "Inspection: A Closer Look (hold Space)",
          },
          content:
            "Sometimes we want to examine a single option in detail. This can be done by holding the Space button and moving the mouse over an option through any of its graphical representations, e.g. through its image in the gallery, its dot on the scatterplot, or its line on PCP. Doing so highlights that item everywhere and shows a large image of it on the Augmented Gallery. By clicking on the details button (top-left of the large image in the Gallery), you can find a data breakdown of the inspected option",
          params: {
            enableScrolling: false,
            placement: "left-end",
          },
        },
        {
          target: '#inspection-bar',
          header: {
            title: "Pinning/Unpinning Inspection (P)",
          },
          content:
            "By default, the inspected option remains highlighted unless it was canceled through the Cancel button or pressing ESC. Alternativly, you can choose to unpin (shortcut: P) the inspection which makes it go away once you release the Space keyboard button. The Continuous Inspection mode allows us to examine any option the mouse cursor passes by without holding Space.",
          params: {
            enableScrolling: false,
            placement: "left",
          },
          before: () => {
            this.$store.commit("toggleInspectionMode", { value: false });
          },
        },
        {
          target: ".v-card[type='ScatterPlot'] div.cluster-view",
          header: {
            title: "Clusters",
          },
          content:
            "On the scatterplot, you can enable the advanced feature of automated clustering (by clicking on the icon at the top-right). <em>DesignSense</em> automatically clusters the current options into to groups based on their similarity. We can choose any number of dimensions to group options based on through the pull down at the bottom. We can also control the number of cluster/groups to find. Each image here shows a representative sample from each of the formed groups (i.e. the option closest to the center of the cluster). By examining those representatives we can gain a bird-view of the data. To get a better grasp of this feature we suggest setting the clustering dimensions to be the same as those you have on the scatterplot. Finally, clustering responds to zooming and filtering operations, meaning you can cluster-->zoom-->cluster as a way to drill down into the dataset.",
          params: {
            enableScrolling: false,
            placement: "left",
          },
          before: () => {
            this.$store.commit("setClusteringPanelOpen", { value: true });
          },
        },
        {
          target: "#designsense-center",
          header: {
            title: "At Your Fingertips!",
          },
          content:
            "By right-clicking anywhere we can summon a fast-access menu that has some of the operations we mentioned earlier. This is especially effective when using <em>DesignSense</em> across multiple screens.",
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
            "We can adjust the workspace to suit our needs through the Editing mode. This mode allows us to move or resize any of the panels in our workspace. </br>[Pro Tip]: zoom out in your browser before moving panels around.",
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
          content: `This marks the end of our tour of <em>DesignSense</em>! Feel free to reach us on aabuzura@sfu.ca`,
          params: {
            enableScrolling: false,
            placement: "bottom",
          },
          before: () => {
            this.$store.commit("toggleEditingMode", { value: false });
          },
        },
      ],
      onboardingTourSteps: [
        {
          target: "#designsense-title", // We're using document.querySelector() under the hood
          header: {
            title: "Welcome to DesignSense!",
          },
          content:
            "A tool for exploring, narrowing and understanding design spaces. DesignSense is designed to allow users to navigate through a large number of options while considering both the visual appearance and the data associated with those options. In short, <em>DesignSense </em> is a shopping interface that is augmented with advanced data visualizations and analysis! [Next: &rarr;, Previous: &larr; ]",
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
          content: `First, we need to load a dataset. <em>DesignSense</em> supports loading data by uploading local files or by loading them from a cloud folder. For now, we will use a simple dataset of used cars. `,
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
            "This is your workspace. Each component plays a different role in the process of navigation as we will see. As a general tip, if you hover your mouse over any of the icons in the interface you will be presented with information on what these icons do.",
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
            "The scatter plot is a simple but very effective visualization of 2-dimensional data. For example you can plot the price vs. year of manufacturing for each car. The scatterplot can be used to visually identify patterns like correlations, outliers, and clusters. By clicking then dragging on the scatterplot you create a selection box. All the options falling in this box are selected as a result. By default, any new selection will replace the current one. Let's see how to change that.",
          before: () => {
            console.log(this.$store.state.data)
            let selectedData = this.$store.state.data.filter(
              (d) =>
                d["year"] > 2005 &&
                d["year"] <= 2015 &&
                d["price"] > 4000 &&
                d["price"] <= 12000
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
            "<em>DesignSense</em> supports 5 different selection operations (i.e. how the newly selected options will relate to the currently selected ones). You may click on those icons or use shortcuts: hold Shift for addition, hold Ctrl for subtraction, hold both for intersection. </br> You will also notice that when you make a selection on any component in the workspace then other components will respond by highlighting the same selected options. This coordination allows us to combine the best of what each component offers.",
          params: {
            enableScrolling: false,
            placement: "bottom",
          },
        },
        {
          target: '.v-card[type="ParallelCoordinatesPlot"]',
          header: {
            title: "The Parallel Coordinates Plot (PCP)",
          },
          content:
            "The second data visualization is the parallel coordinates plot (PCP). In contrast to the scatterplot, this chart can be used to visualize more than 2 dimensions. Here each vertical axis is a different data dimension. Each option is represented by a string of lines that touch those axes exactly at the value of that the option for that axis/dimension. You can select options on the PCP by dragging a rectangle along any of the axes. You may also re-order the axes or flip them vertically by dragging and double-clicking on their titles respectively. Finally, you can also change the data dimensions shown using the wrench icon.",
          before: () => {
            console.log(this.$store.state.data)
            let selectedData = this.$store.state.data.filter(
              (d) =>
                d["year"] > 2005 &&
                d["year"] <= 2015 &&
                d["price"] > 4000 &&
                d["price"] <= 12000
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
            "Many aspects of the options we navigate may not be adequately judged through data alone and require us to examine a graphical representation of them instead. The Augmented Gallery can be used to view images of the options we are navigating. The big image at the top represents the single option we are currently inspecting (more on <i>inspection</i> shortly), whbile the grid of images below show all the options we are exploring. We can sort the images based on a data dimension (top left). We can select options by dragging a rectangle that touches their images or by simply clicking the checkbox to the top left of an option's image. Clicking on the eye icon (top-center) switch the grid to show only the currently selected options. You can change the size of the images on the grid using the size slider (top-right). If you pick the largest size, you become able to expand on the details of each option which makes it easier to compare them side-by-side",
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
            "Once you have selected a set of options there are few things you can do. You can choose to zoom on that set to examine it closely or exclude that set from your consideration. Both zooming and exclusion operations can be reverted back or reset completely.",
          params: {
            enableScrolling: false,
            placement: "bottom",
          },
        },
        {
          target: "#sets-operations-bar",
          header: {
            title: "Selection",
          },
          content:
            "On this panel, you can unselect everthing (shortcut: ESC), or invert your current selection. You may also revert the last selection operation you made (shortcut: Ctrl-Z)",
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
            "Sets are a great mechanism for storing the progress we make during navigation. To create a set, click on 'New Set'. Once you create a set, you can bring it back it back by simplying clicking on it. Note that the current selection operation will apply when you do, e.g. if you had Add on then the set will be added to your current selection. Finally, you can add/remove from a set using the +/- icons.",
          before: () => {
            let selectedData = this.$store.state.data.filter(
              (d) => d["year"] > 2015
            );

            this.$store.dispatch("createSet", {
              setName: "Set #1",
              members: selectedData.map((x) => x._id),
              comment: "Recent cars",
            });
          },
          params: {
            enableScrolling: false,
            placement: "right",
          },
        },
        {
          target: '.v-card[type="Grid"]',
          header: {
            title: "Inspection: A Closer Look (hold Space)",
          },
          content:
            "Sometimes we want to examine a single option in detail. This can be done by holding the Space button and moving the mouse over an option through any of its graphical representations, e.g. through its image in the gallery, its dot on the scatterplot, or its line on PCP. Doing so highlights that item everywhere and shows a large image of it on the Augmented Gallery. By clicking on the details button (top-left of the large image in the Gallery), you can find a data breakdown of the inspected option",
          params: {
            enableScrolling: false,
            placement: "left-end",
          },
        },
        {
          target: '#inspection-bar',
          header: {
            title: "Pinning/Unpinning Inspection (P)",
          },
          content:
            "By default, the inspected option remains highlighted unless it was canceled through the Cancel button or pressing ESC. Alternativly, you can choose to unpin (shortcut: P) the inspection which makes it go away once you release the Space keyboard button. The Continuous Inspection mode allows us to examine any option the mouse cursor passes by without holding Space.",
          params: {
            enableScrolling: false,
            placement: "left",
          },
          before: () => {
            this.$store.commit("toggleInspectionMode", { value: false });
          },
        },
        {
          target: ".v-card[type='ScatterPlot'] div.cluster-view",
          header: {
            title: "Clusters",
          },
          content:
            "On the scatterplot, you can enable the advanced feature of automated clustering (by clicking on the icon at the top-right). <em>DesignSense</em> automatically clusters the current options into to groups based on their similarity. We can choose any number of dimensions to group options based on through the pull down at the bottom. We can also control the number of cluster/groups to find. Each image here shows a representative sample from each of the formed groups (i.e. the option closest to the center of the cluster). By examining those representatives we can gain a bird-view of the data. To get a better grasp of this feature we suggest setting the clustering dimensions to be the same as those you have on the scatterplot. Finally, clustering responds to zooming and filtering operations, meaning you can cluster-->zoom-->cluster as a way to drill down into the dataset.",
          params: {
            enableScrolling: false,
            placement: "left",
          },
          before: () => {
            this.$store.commit("setClusteringPanelOpen", { value: true });
          },
        },
        {
          target: "#designsense-center",
          header: {
            title: "At Your Fingertips!",
          },
          content:
            "By right-clicking anywhere we can summon a fast-access menu that has some of the operations we mentioned earlier. This is especially effective when using <em>DesignSense</em> across multiple screens.",
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
            "We can adjust the workspace to suit our needs through the Editing mode. This mode allows us to move or resize any of the panels in our workspace. </br>[Pro Tip]: zoom out in your browser before moving panels around.",
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
          content: `This marks the end of our tour of <em>DesignSense</em>! Feel free to reach us on aabuzura@sfu.ca`,
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
          tooltip: () => "Reverse the last selection update [Ctrl-z]",
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
          tooltip: () => "Reset Selection [ESC]",
          type: "selection",
        },
        invertSelection: {
          clickAction: () => this.$store.dispatch("invertSelection"),
          icon: "mdi-select-inverse",
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
          icon: "mdi-magnify-plus-outline",
          tooltip: () => "Zoom on the selected",
          type: "data",
        },
        excludeSelection: {
          clickAction: () => this.$store.dispatch("excludeSelection"),
          icon: "mdi-filter-remove-outline",
          tooltip: () => "Filter out the selected",
          type: "data",
        },
        resetData: {
          clickAction: () => this.$store.dispatch("resetData"),
          icon: "mdi-restart",
          tooltip: () => "Reset Data",
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
            loadDataFromCloudURL("https://1drv.ms/u/s!AsGWrbL1DmbagbBL3fsvmKxlMU4TwA", () => {
              this.$tours["onboardingTour"].start();
            })
            
            //loadDataFromCloudURL("https://raw.githubusercontent.com/tt-acm/DesignExplorer/gh-pages/design_explorer_data/LittleRedBox.csv"
            //).then((data) => {
            //TODO get skinny boxes then create a set from them + debug this
            //   this.$tours["onboardingTour"].start();
            // });
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
          tooltip: () => "Download the selected options to file (.csv)",
          type: "misc",
        },
        shareStaticLink: {
          clickAction: () => this.isShareLinkModalOn = true,
          icon: "mdi-share-variant-outline",
          tooltip: () => "Creates a static link to share this session if the data was hosted on a cloud service.",
          type: "misc",
        },
      },
      contextMenuItems: [
        "togglePinInspection",
        "clearInspection",
        "resetAllMarkings",
        "createSet",
        "excludeSelection",
        "zoomToSelection",
        "undoDataTransformation",
      ],

      showContextMenu: false,
      rightClickPos: { x: 0, y: 0 },
      isShareLinkModalOn: false,
    };
  },
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
    let contextMenuCenter = this.$el.getElementsByClassName(
      "vue-radial-menu-container"
    )[0];

    contextMenuCenter.addEventListener("wheel", () => {
      this.moveToNextOperation();
    });

    Vue.nextTick(() => {
      let dialogs = document.getElementsByClassName("v-dialog");
      if (dialogs.length > 1) {
        dialogs[1].parentElement.remove();
      }

      let overlays = document.getElementsByClassName("v-overlay");
      if (overlays) {
        Array.from(overlays).sort((a, b) => a.style.zIndex - b.style.zIndex);

        if (overlays.length > 1) {
          overlays[0].remove();
          console.log("over over", overlays);
        }
      }
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
    }),
  },
  methods: {
    track() {
      console.log("tracking", this.$gtag);
      this.$gtag.pageview("/");
    },
    moveToNextOperation() {
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
