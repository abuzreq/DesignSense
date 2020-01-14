<template>
<v-app>
    <v-content>
        <CompareView ref = "bar1">
        </CompareView>
     </v-content>
  </v-app>
</template>

<script>
import CompareView from "@/components/CompareView.vue";

export default {
  name: "App",
  components: {
    CompareView
  }
};

// TODO create refs here in the app to the other charts so that charts can refer to each other using this.$parent.pcoords
// Or have a method in parent called highlight() which is invoked from charts to which the parent App then responds by highlighting the other charts accordingly.. 
//This could take into account 
</script>

