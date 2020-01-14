<template>
  <div>
  <BarChart ref = "bar1">
  </BarChart>
    <BarChart ref = "bar2">
  </BarChart>
  </div>
</template>

<script>
import BarChart from "@/components/BarChart.vue";

export default {
  name: "App",
  components: {
    BarChart
  }
};
// TODO create refs here in the app to the other charts so that charts can refer to each other using this.$parent.pcoords
// Or have a method in parent called highlight() which is invoked from charts to which the parent App then responds by highlighting the other charts accordingly.. 
//This could take into account 
</script>