<template>
  <v-app>
    <v-content>
      <v-container 
        fluid
        grid-list-xl
      >
        <!-- TOP -->
        <v-layout row>
          <v-flex md8>
            <v-card height="500px">
              <!-- pcoords -->
              <ParCoordsView />
            </v-card>
          </v-flex>
          <v-flex md4>
            <v-card height="500px">
              <!-- Scatterplot -->
               <!-- <SPLOMView /> -->
              <ScatterplotView />
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
              <GridView />
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
import SPLOMView from "@/components/SPLOMView.vue";
import DendrogramView from "@/components/DendrogramView.vue";

import ScatterplotView from "@/components/ScatterplotView.vue";

export default {
  name: "App",
  components: {
    ParCoordsView,
    GridView,
    SPLOMView,
    DendrogramView,
    ScatterplotView
  }
};

// TODO create refs here in the app to the other charts so that charts can refer to each other using this.$parent.pcoords
// Or have a method in parent called highlight() which is invoked from charts to which the parent App then responds by highlighting the other charts accordingly..
//This could take into account
</script>

