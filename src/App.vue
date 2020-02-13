<template>
  <v-app >
      <!--
    <v-app-bar app dark dense flat  color=" red--text text--lighten-1">
       DesignSense
      </v-app-bar>
      -->
    <v-content>
      <v-container 
        fluid
        grid-list-sm
        align-start
        justify-start
        pt-0
      >
        <!-- TOP -->
        <v-layout row>
          <v-flex md8>
            <v-card height="500px">
              <!-- pcoords -->
              <ParCoordsView :chartData="this.$store.state.data" />
            </v-card>
          </v-flex>
          <v-flex md4>
            <v-card height="500px">
              <!-- Scatterplot -->
               <!-- <SPLOMView /> -->
               <ScatterplotView 
                  :chartData="this.$store.state.data">
               </ScatterplotView>

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

        <!-- BOTTOM -->
        <v-layout row>
          <v-flex md3>
            <v-card height="450px">
              <!-- Similarity-->
              <DendrogramView />
            </v-card>
          </v-flex>
          <v-flex md9>
            <v-card height="450px">
              <!-- Grid -->
              <AugmentedGridView />
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


export default {
  name: "App",
  components: {
    ParCoordsView,
    GridView,
    AugmentedGridView,
    SPLOMView,
    DendrogramView,
    ScatterplotView,
    TSNEView
  }
};

// TODO create refs here in the app to the other charts so that charts can refer to each other using this.$parent.pcoords
// Or have a method in parent called highlight() which is invoked from charts to which the parent App then responds by highlighting the other charts accordingly..
//This could take into account
</script>

