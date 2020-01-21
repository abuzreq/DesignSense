<template>
  <v-container  fill-height grid-list-xl justify-center >
    <v-row>
      <v-data-iterator :items="csvData" hide-default-footer :items-per-page="maxPerPage">
        <template v-slot:default="props" >
          <v-row>
            <v-col  
              v-for="(item, index) in props.items"
              :key="index"
              :cols="possibleColSpans[colSpan]"            
            >
              <v-card >
                <v-img v-if="true" :src="item.image" ></v-img>
                <!--<router-link :to="{ name: 'AltView', params: { item } }">-->
                <model-gltf v-else  :src="item.gltf" ></model-gltf >
                <!--</router-link>-->
              </v-card>
            </v-col>
          </v-row>
        </template>
      </v-data-iterator>
    </v-row>
  </v-container>
</template>

<style scoped>
.col-1{
     padding:3px;
     min-width: 300px;
  }
</style>

<script>
//https://hujiulong.github.io/vue-3d-model/#/demo-gltf
import { ModelGltf  } from 'vue-3d-model';

import * as d3 from "d3";
export default {
  name: "GridCards",
  components: { ModelGltf  },
  mounted() {
    console.log(d3.select("model-obj"))
    this.csvData = this.$store.state.highlighted;
  },
  data: function() {
    return {
      csvData: [],
      colSpan: 0,
      possibleColSpans: [1, 2, 3, 4, 6, 12],
      labels: ["12", "6", "4", "3", "2", "1"],
      maxPerPage: 10000,
      // gradient: "to bottom, rgba(50,50,50, .7), rgba(25,32,72, .1)",
      selected: []
    };
  },
  methods: {
    addSelection(id) {
      if (!this.selected.includes(id)) this.selected.push(id);
      else this.selected.splice(this.selected.indexOf(id), 1);
    },
    getCompareData() {
      let res = [];
      this.selected.forEach(e => {
        res.push(this.csvData[e]);
      });
      return res;
    }
  },
  computed: {
    csvDataLength() {
      return this.csvData.length;
    },
    headers() {
      return Object.keys(this.csvData);
    },
    values() {
      return Object.values(this.csvData);
    }
  },
  created() {
    this.$store.watch(
      (state, getters) => getters.highlighted,
      (newValue, oldValue) => {
        this.csvData = newValue;
      },
      {
        deep: true //add this if u need to watch object properties change etc.
      }
    );
  }
};
</script>