<template>
  <v-app>
    <v-app-bar app dark dense flat short color=" red--text text--lighten-1" height="30">
      <v-toolbar-title>DesignSense</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn icon @click="$store.dispatch('createSet')">
        <v-icon>mdi-content-save</v-icon>
      </v-btn>
      <v-btn icon @click="$store.dispatch('resetAllMarkings')">
        <v-icon>mdi-select-off</v-icon>
      </v-btn>
      <v-btn icon @click="$store.dispatch('undoDataTransformation')">
        <v-icon>mdi-undo</v-icon>
      </v-btn>
      <v-btn icon @click="$store.dispatch('zoomToSelection')">
        <v-icon>mdi-selection-search</v-icon>
      </v-btn>
      <v-btn icon @click="$store.dispatch('excludeSelection')">
        <v-icon>mdi-filter-remove-outline</v-icon>
      </v-btn>
      <v-btn icon @click="$store.dispatch('resetData')">
        <v-icon>mdi-cached</v-icon>
      </v-btn>
    </v-app-bar>

    <v-content>
      <v-container fluid grid-list-sm align-start justify-start pt-0>
        <!-- TOP -->
        <v-layout row>
          <v-flex md7>
            <v-layout row>
              <v-flex md12>
                <v-card height="500px">
                  <!-- pcoords -->
                  <ParCoordsView />
                </v-card>
              </v-flex>
            </v-layout>
            <!-- BOTTOM -->
            <v-layout row>
              <v-flex md3>
                <v-card height="450px">
                  <!-- Similarity-->
                  <!--  <DendrogramView /> -->
                  <!--   <AugmentedGridView v-bind:defaultEnableContext="true" />-->
                  <SetsView />
                </v-card>
              </v-flex>
              <v-flex md9>
                <v-card height="450px">
                  <!-- Grid -->
                  <ScatterplotView />
                </v-card>
              </v-flex>
            </v-layout>
          </v-flex>
          <v-flex md5>
            <v-card height="1000px">
              <!-- Scatterplot -->
              <!-- <SPLOMView /> -->
              <AugmentedGridView v-bind:defaultEnableContext="true" />

              <!--
                 <ScatterplotView 
                :chartData="this.$store.state.data"
                :xColumn="TotalFlrArea"
                :yColumn="NetSolar"
                :colorColumn="collection">
              </ScatterplotView>  
              -->
              <!-- <TSNEView /> -->
            </v-card>
          </v-flex>
        </v-layout>
      </v-container>
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
    SetsView
  }
};

// TODO create refs here in the app to the other charts so that charts can refer to each other using this.$parent.pcoords
// Or have a method in parent called highlight() which is invoked from charts to which the parent App then responds by highlighting the other charts accordingly..
//This could take into account
</script>

