
<template>
  <div>
    <h1>{{name}}</h1>
    
    <svg id = "version"> </svg>
  </div>

</template>

<script lang="ts">
  import Vue from "vue";
  import * as d3 from 'd3'


  export default Vue.extend({
    data: function() {
      return {
        name: 'Hello Worlds 4!',
      }
    },
    created: function(){
      console.log(d3.select("svg"))

      d3.select('svg').append('h5')
      .append('text')
      .text('D3 version:')
    }
  });
</script>

<style>
h1 {
  color: white;
  background-color: black;
}
</style>
