<template>
  <v-app>
    <v-content>
      <v-container grid-list-xl>
        <v-layout row >
          <v-flex md12>
            <v-card height="500px" width="1200px">
              <ParCoordsView></ParCoordsView>
            </v-card>
          </v-flex>
        </v-layout>
        <v-layout row  >
          <v-flex md12>
            <v-card height="450px" scroll-y>
              <GridView></GridView>
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

export default {
  name: "App",
  components: {
    ParCoordsView,
    GridView
  }
};

// TODO create refs here in the app to the other charts so that charts can refer to each other using this.$parent.pcoords
// Or have a method in parent called highlight() which is invoked from charts to which the parent App then responds by highlighting the other charts accordingly..
//This could take into account
</script>

