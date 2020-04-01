<template>
  <v-app>
    <v-app-bar app dark dense flat short color=" white--text text--lighten-1" height="50">
      <v-toolbar-title>DesignSense</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-divider vertical />

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['help'].clickAction">
            <v-icon>{{actions['help'].icon}}</v-icon>
          </v-btn>
        </template>
        <span>{{actions['help'].tooltip()}}</span>
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
            <v-icon>{{actions['toggleEditingMode'].icon}}</v-icon>
          </v-btn>
        </template>
        <span>{{actions['toggleEditingMode'].tooltip()}}</span>
      </v-tooltip>

      <v-divider vertical />    
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-chip  outlined v-on="on" :ripple="false" label class="ma-2" color="grey darken-2" text-color="white">
            {{selectionOperation()}}
            <v-avatar right class="grey lighten-2">
              <v-icon small color="black">mdi-vector-selection</v-icon>
            </v-avatar>
          </v-chip>
        </template>
        <span>Shows how new selections will impact the existing selection.</span>
      </v-tooltip>

      <v-divider vertical />
      <!--
     
     <v-spacer></v-spacer>
      
      <v-text-field
          v-model="cloudURL"
          label="URL"
        ></v-text-field>
      <v-btn icon @click="onCloudUrlChange">
            <v-icon>mdi-cloud-upload-outline</v-icon>
            
      </v-btn>
      -->
      <v-spacer></v-spacer>
      <!--
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-file-input label="File input" outlined dense @change="loadFromCSV($event)"></v-file-input>
        </template>
        <span>Load</span>
      </v-tooltip>
      -->
      <span>Pick a Dataset:&emsp;</span>
      <v-select v-model="url" :items="URLs" item-text="name" return-object @change="onUrlChange">
        <v-icon>mdi-select-off</v-icon>
      </v-select>

      <v-spacer></v-spacer>
      <v-divider vertical />

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn
            v-on="on"
            :color="actionType2Color(actions['toggleInspectionMode'].type)"
            icon
            @click="actions['toggleInspectionMode'].clickAction"
          >
            <v-icon>{{actions['toggleInspectionMode'].icon}}</v-icon>
          </v-btn>
        </template>
        <span>{{actions['toggleInspectionMode'].tooltip()}}</span>
      </v-tooltip>

      <v-divider vertical />

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['createSet'].clickAction">
            <v-icon>{{actions['createSet'].icon}}</v-icon>
          </v-btn>
        </template>
        <span>{{actions['createSet'].tooltip()}}</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['resetAllMarkings'].clickAction">
            <v-icon>{{actions['resetAllMarkings'].icon}}</v-icon>
          </v-btn>
        </template>
        <span>{{actions['resetAllMarkings'].tooltip()}}</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['invertSelection'].clickAction">
            <v-icon>{{actions['invertSelection'].icon}}</v-icon>
          </v-btn>
        </template>
        <span>{{actions['invertSelection'].tooltip()}}</span>
      </v-tooltip>

      <v-divider vertical />

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['undoDataTransformation'].clickAction">
            <v-icon>{{actions['undoDataTransformation'].icon}}</v-icon>
          </v-btn>
        </template>
        <span>{{actions['undoDataTransformation'].tooltip()}}</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['zoomToSelection'].clickAction">
            <v-icon>{{actions['zoomToSelection'].icon}}</v-icon>
          </v-btn>
        </template>
        <span>{{actions['zoomToSelection'].tooltip()}}</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['excludeSelection'].clickAction">
            <v-icon>{{actions['excludeSelection'].icon}}</v-icon>
          </v-btn>
        </template>
        <span>{{actions['excludeSelection'].tooltip()}}</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="actions['resetData'].clickAction">
            <v-icon>{{actions['resetData'].icon}}</v-icon>
          </v-btn>
        </template>
        <span>{{actions['resetData'].tooltip()}}</span>
      </v-tooltip>
    </v-app-bar>

    <v-content style="padding: 50px 0px 0px;">
      <div
        @contextmenu="showContextMenuHandler"
        style="height: 100%; width: 100%; border: 1px solid red; position: relative;"
      >
        <template v-for="(item,index) in layouts">
          <Card
            :key="index"
            :initX="item.x"
            :initY="item.y"
            :initW="item.w"
            :initH="item.h"
            :type="item.type"
          />
        </template>
      </div>
    </v-content>

    <radial-menu
      ref="contextMenu"
      v-show="showContextMenu"
      :style="{'position':'absolute','left': `${rightClickPos.x}px`, 'top': `${rightClickPos.y}px`}"
      style="margin: auto; margin-top: -15px; margin-left: -15px; background-color: white"
      :itemSize="50"
      :radius="65"
      :angle-restriction="360"
    >
      <radial-menu-item
        v-for="(item, index) in contextMenuItems"
        :key="index"
        style="background-color: white"
        @click="() => showContextMenu = false"
      >
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn
              :color="actionType2Color(actions[item].type)"
              v-on="on"
              icon
              @click="actions[item].clickAction"
            >
              <v-icon>{{actions[item].icon}}</v-icon>
            </v-btn>
          </template>
          <span>{{actions[item].tooltip()}}</span>
        </v-tooltip>
      </radial-menu-item>
    </radial-menu>
  </v-app>
</template>


<style>
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

import { loadDataFromURL, loadDataFromCloudURL } from "./main.js";
import * as d3 from "d3";

import { RadialMenu, RadialMenuItem } from "vue-radial-menu";

import { getOperation } from "@/components/operations.js";

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
    RadialMenuItem
  },

  data: function() {
    return {
      URLs: [
        {
          name: "P+W Solar",
          url: "https://1drv.ms/u/s!AsGWrbL1DmbagakFTScT6VocK9ELbw",
          type: "cloud"
        },
        {
          name: "Malaeeb",
          url: "https://1drv.ms/f/s!AsGWrbL1DmbagaggJpgic85d0z3Sgw",
          type: "cloud"
        },
        {
          name: "SmartGeometry",
          url: "http://142.58.183.69:5051",
          type: "server"
        },
        { name: "DreamLens", url: "http://142.58.183.69:5050", type: "server" }
      ],
      url: "",
      cloudURL: "",
      actions: {
        createSet: {
          clickAction: () => this.$store.dispatch("createSet"),
          icon: "mdi-contain",
          tooltip: () => "Create Set",
          type: "selection"
        },
        resetAllMarkings: {
          clickAction: () => this.$store.dispatch("resetAllMarkings"),
          icon: "mdi-select-off",
          tooltip: () => "Reset Selection",
          type: "selection"
        },
        invertSelection: {
          clickAction: () => this.$store.dispatch("invertSelection"),
          icon: "mdi-select-compare",
          tooltip: () => "Invert Selection",
          type: "selection"
        },
        undoDataTransformation: {
          clickAction: () => this.$store.dispatch("undoDataTransformation"),
          icon: "mdi-undo",
          tooltip: () => "Undo",
          type: "data"
        },
        zoomToSelection: {
          clickAction: () => this.$store.dispatch("zoomToSelection"),
          icon: "mdi-selection-search",
          tooltip: () => "Zoom on the Selected",
          type: "data"
        },
        excludeSelection: {
          clickAction: () => this.$store.dispatch("excludeSelection"),
          icon: "mdi-filter-remove-outline",
          tooltip: () => "Exclude the Selected",
          type: "data"
        },
        resetData: {
          clickAction: () => this.$store.dispatch("resetData"),
          icon: "mdi-cached",
          tooltip: () => "Reset Data",
          type: "data"
        },
        toggleInspectionMode: {
          clickAction: () => this.$store.dispatch("toggleInspectionMode"),
          icon: "mdi-selection-ellipse-arrow-inside",
          tooltip: () =>
            this.isInspectionMode
              ? "Disable inspection on hovering"
              : "Enable inspection on hovering",
          type: "inspecting"
        },
        help: {
          clickAction: () => console.log("TODO"),
          icon: "mdi-help-circle-outline",
          tooltip: () => "Help.. to come.",
          type: "misc"
        },
        toggleEditingMode: {
          clickAction: () => this.$store.dispatch("toggleEditingMode"),
          icon: "mdi-table-edit",
          tooltip: () =>
            this.isEditingMode
              ? "Disable Editing Mode."
              : "Enable Editing Mode. (to resize and move the panels)",
          type: "editing"
        }
      },
      contextMenuItems: [
        "toggleInspectionMode",
        "resetAllMarkings",
        "createSet",
        "invertSelection",
        "excludeSelection",
        "zoomToSelection",
        "undoDataTransformation"
      ],

      showContextMenu: false,
      rightClickPos: { x: 0, y: 0 },
      selectionOperation: () =>
        getOperation({
          altKey: this.$store.state.isAltKey,
          shiftKey: this.$store.state.isShiftKey,
          ctrlKey: this.$store.state.isCtrlKey
        })
    };
  },
  computed: {},
  destroyed() {},
  created() {
    //To close the context menu when a click happens anywhere
    document.addEventListener("click", e => {
      //To prevent the context menu from closing when the click is on it
      let contextMenuNode = d3.select(".vue-radial-menu-container")
        ._groups[0][0];
      if (e.target !== contextMenuNode) {
        this.showContextMenu = false;
      }
    });
    // this.url =  this.URLs[0];
    //  this.onUrlChange(this.url);
  },
  mounted() {
    //   this.onUrlChange(this.URLs[0]);
  },
  computed: {
    ...mapState({
      layouts: state => state.layouts,
      isEditingMode: state => state.isEditingMode,
      isInspectionMode: state => state.isInspectionMode
    })
  },
  methods: {
    actionType2Color: function(type) {
      return {
        data: "red",
        selection: "blue",
        misc: "black",
        inspecting: this.isInspectionMode ? "green accent-4" : "grey",
        editing: this.isEditingMode ? "green accent-4" : "grey"
      }[type];
    },
    showContextMenuHandler(e) {
      //TODO: change this.
      //A cheap trick to make sure the context menu does not appear on the 3D viewer DOM.
      if (!e.target.id.includes("inspector")) {
        e.preventDefault();
        this.rightClickPos = { x: e.clientX, y: e.pageY };
        this.showContextMenu = true;
        this.$refs.contextMenu.isOpen = true;
      }
    },
    handleContextMenuClick(item) {
      console.log(item);
    },
    onUrlChange(value) {
      if (value.type === "server") {
        loadDataFromURL(value.url, "/alternatives");
      } else if (value.type === "cloud") {
        loadDataFromCloudURL(value.url);
      }
    },
    onCloudUrlChange() {
      loadDataFromCloudURL(this.cloudURL);
    },
    loadFromCSV(file) {
      console.log(file);
      var reader = new FileReader();

      reader.onload = function(e) {
        var inputString = e.target.result;

        // I need to add some defense here
        // separateInputOutputs(e);

        var data = d3.csvParse(inputString);
        loadData(data);
      };
      reader.readAsText(file);
    }
  }
};

// TODO create refs here in the app to the other charts so that charts can refer to each other using this.$parent.pcoords
// Or have a method in parent called highlight() which is invoked from charts to which the parent App then responds by highlighting the other charts accordingly..
//This could take into account
</script>

