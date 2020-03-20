<template>
  <v-app>
    <v-app-bar app dark dense flat short color=" white--text text--lighten-1" height="50">
      <v-toolbar-title>DesignSense</v-toolbar-title>
       <v-spacer></v-spacer>
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
      <v-select v-model="url" :items="URLs"  item-text="name" return-object
            @change="onUrlChange">
        <v-icon>mdi-select-off</v-icon>
      </v-select>


      <v-spacer></v-spacer>
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="$store.dispatch('createSet')">
            <v-icon>mdi-contain</v-icon>
            <!-- -->
          </v-btn>
        </template>
        <span>Create Set</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="$store.dispatch('resetAllMarkings')">
            <v-icon>mdi-select-off</v-icon>
          </v-btn>
        </template>
        <span>Reset Selection</span>
      </v-tooltip>

        <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="$store.dispatch('invertSelection')">
            <v-icon>mdi-select-compare</v-icon>
          </v-btn>
        </template>
        <span>Invert Selection</span>
      </v-tooltip>

      <v-divider vertical />

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="$store.dispatch('undoDataTransformation')">
            <v-icon>mdi-undo</v-icon>
          </v-btn>
        </template>
        <span>Undo</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="$store.dispatch('zoomToSelection')">
            <v-icon>mdi-selection-search</v-icon>
          </v-btn>
        </template>
        <span>Zoom on the Selected</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="$store.dispatch('excludeSelection')">
            <v-icon>mdi-filter-remove-outline</v-icon>
          </v-btn>
        </template>
        <span>Exclude the Selected</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="$store.dispatch('resetData')">
            <v-icon>mdi-cached</v-icon>
          </v-btn>
        </template>
        <span>Reset Data</span>
      </v-tooltip>
    </v-app-bar>

    <v-content style="padding: 50px 0px 0px;">
      <div style="height: 100%; width: 100%; border: 1px solid red; position: relative;">
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
  </v-app>
</template>

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
    Card
  },
  data: function() {
    return {
      URLs: [{name:"P+W Solar", url:"https://1drv.ms/u/s!AsGWrbL1DmbagakFTScT6VocK9ELbw", type:"cloud"}, {name:"Malaeeb", url:"https://1drv.ms/f/s!AsGWrbL1DmbagaggJpgic85d0z3Sgw", type:"cloud"},{name:"SmartGeometry", url:"http://142.58.183.69:5051", type:"server"}, {name:"DreamLens", url:"http://142.58.183.69:5050", type:"server"}],
      url: "",
      cloudURL: ""
    }
  },
  created() {
     // this.url =  this.URLs[0];
    //  this.onUrlChange(this.url);
  },
  mounted(){
 //   this.onUrlChange(this.URLs[0]);
  },
  computed: {
    ...mapState({ layouts: state => state.layouts })
  },
  methods: {
    onUrlChange(value)
    {
      if(value.type === 'server')
      {
          loadDataFromURL(value.url, "/alternatives")
      }
      else if(value.type === 'cloud')
      {
          loadDataFromCloudURL(value.url)
      }   
    },
    onCloudUrlChange()
    {
      loadDataFromCloudURL(this.cloudURL)
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

