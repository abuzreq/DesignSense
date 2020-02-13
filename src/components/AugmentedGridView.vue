<template>
  <v-container  justify-start align-start>
    <v-layout >
    <v-data-iterator
      :items="csvData"
      hide-default-footer
      :items-per-page="maxPerPage"
      :sort-by="sortByVar"
      :sort-desc="isSortDesc"
    >
      <template v-slot:header>
        <v-toolbar dense fixed dark color="blue darken-3" class="mb-1">
          <v-select
          dense
            v-model="sortByVar"
            flat
            solo-inverted
            hide-details
            prepend-inner-icon="search"
            :items="keys"
            label="Sort by"
          ></v-select>
          <v-spacer></v-spacer>
            <v-slider
              min="0"
              max="5"
              step="1"
              :tick-labels="labels"
              v-model="colSpan"
            ></v-slider>
          <v-spacer></v-spacer>
          <v-btn-toggle  dense v-model="isSortDesc" mandatory>
            <v-btn medium depressed color="blue" :value="false">
              <v-icon>mdi-arrow-up</v-icon>
            </v-btn>
            <v-btn medium depressed color="blue" :value="true">
              <v-icon>mdi-arrow-down</v-icon>
            </v-btn>
          </v-btn-toggle>
        </v-toolbar>
      </template>
      <template v-slot:default="props">
        <v-layout grid-list-sm column style="height: 75vh">
          <v-flex md6 style="overflow-y: auto; overflow-x: hidden">
            <v-row dense>
              <v-col
                v-for="(item, index) in props.items"
                :key="index"
                :cols="possibleColSpans[colSpan]"
              >
                <v-card>
                  <v-img v-if="true" :src="item.image" />
                  <!--<router-link :to="{ name: 'AltView', params: { item } }">-->
                  <!--
                  <model-gltf 
                    v-else
                    :src="item.gltf" 
                  />
                  -->
                  <!--</router-link>-->
                </v-card>
              </v-col>
            </v-row>
          </v-flex>
        </v-layout>
      </template>
    </v-data-iterator>
    </v-layout>
  </v-container>
</template>

<style scoped>
/*
.col-1{
     padding:3px;
     
  }*/
</style>

<script>
//https://hujiulong.github.io/vue-3d-model/#/demo-gltf
import { ModelGltf } from "vue-3d-model";

import * as d3 from "d3";
export default {
  name: "AugmentedGridCards",
  components: { ModelGltf },
  data: function() {
    return {
      csvData: [],
      keys: ["Height", "NetSolar", "collection"],
      colSpan: 0,
      possibleColSpans: [1, 2, 3, 4, 6, 12],
      labels: ["12", "6", "4", "3", "2", "1"],
      maxPerPage: 10000,
      // gradient: "to bottom, rgba(50,50,50, .7), rgba(25,32,72, .1)",
      selected: [],
      sortByVar: "height",
      isSortDesc: false
    };
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
  mounted() {
    //console.log(d3.select("model-obj"))
    this.csvData = this.$store.state.highlighted_forms;
  },
  created() {
    this.$store.watch(
      (state, getters) => getters.highlighted_forms,
      (newValue, oldValue) => {
        this.csvData = newValue;
      },
      {
        deep: true //add this if u need to watch object properties change etc.
      }
    );
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
  }
};
</script>