<template>
  <v-container>
    <v-row justify="space-between">
      <v-col cols="4">
        <v-row>
          <v-col cols="12">
            <v-row justify="space-between">
              <v-col cols="1">
                <v-icon>mdi-view-grid</v-icon>
              </v-col>
              <v-col cols="8">
                <v-slider min="0" max="5" step="1" :tick-labels="labels" v-model="colSpan"></v-slider>
              </v-col>
              <v-col cols="1">
                <v-icon>mdi-square</v-icon>
              </v-col>
            </v-row>
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="3" v-if="selected.length > 1">
        <v-row justify="end">
          <v-col cols="3" class="mt-2">{{ selected.length }} selected</v-col>
          <v-col cols="3">
            <v-btn
              color="primary"
              :to="{
                name: 'CompareView',
                params: { alternative: getCompareData() }
              }"
            >Compare</v-btn>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
    <v-row>
      <v-data-iterator :items="csvData" hide-default-footer :items-per-page="maxPerPage">
        <template v-slot:default="props">
          <v-row>
            <v-col
              v-for="(item, index) in props.items"
              :key="index"
              :cols="possibleColSpans[colSpan]"
            >
              <v-card>
                <!--<router-link :to="{ name: 'AltView', params: { item } }">-->
                <v-img :src="item.img" :gradient="gradient">
                  <v-row justify="space-between" class="mx-5">
                    <v-btn icon :to="{ name: 'AltView', params: { item } }">
                      <v-icon color="white" large>mdi-information</v-icon>
                    </v-btn>
                    <v-rating color="white" v-if="colSpan > 1"></v-rating>
                    <v-btn icon v-on:click="addSelection(index)">
                      <v-icon
                        :color="selected.includes(index) ? '#ffe119' : 'white'"
                        large
                        dark
                      >mdi-copyright</v-icon>
                    </v-btn>
                  </v-row>
                </v-img>
                <!--</router-link>-->
                <v-expansion-panels v-if="possibleColSpans[colSpan] > 1">
                  <v-expansion-panel>
                      <!--TODO No hard coding!-->
                    <v-expansion-panel-header>{{ item["ID"] }}</v-expansion-panel-header>
                    <v-expansion-panel-content>
                      <v-list dense>
                        <v-list-item v-for="(param, j) in Object.keys(item)" :key="j">
                          <v-list-item-content>{{ param }}</v-list-item-content>
                          <v-list-item-content class="align-end">
                            {{
                            Object.values(item)[j]
                            }}
                          </v-list-item-content>
                        </v-list-item>
                      </v-list>
                    </v-expansion-panel-content>
                  </v-expansion-panel>
                </v-expansion-panels>
              </v-card>
            </v-col>
          </v-row>
        </template>
      </v-data-iterator>
    </v-row>
  </v-container>
</template>

<script>
import * as d3 from "d3";
export default {
  name: "GridCards",
  mounted() {
    this.csvData = this.$store.state.highlighted;

    /*
    d3.csv("./data2.csv").then(data => {
      this.csvData = data;
    });*/
  },
  data: function() {
    return {
      csvData: [],
      colSpan: 2,
      possibleColSpans: [1, 2, 3, 4, 6, 12],
      labels: ["12", "6", "4", "3", "2", "1"],
      maxPerPage: 10000,
      gradient: "to bottom, rgba(50,50,50, .7), rgba(25,32,72, .1)",
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
    this.$store.watch((state, getters) => getters.highlighted,
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