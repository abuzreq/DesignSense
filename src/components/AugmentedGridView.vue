<template>
  <v-container :id="viewID" justify-start align-start>
    <v-data-iterator
      :items="chartData"
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
            <v-checkbox  v-model="enableContext"  :off-icon="offIcon" :on-icon="onIcon"/>
          <v-spacer></v-spacer>
          <v-slider min="0" max="5" step="1" :tick-labels="labels" v-model="colSpan"></v-slider>
          <v-spacer></v-spacer>
          <v-btn-toggle dense v-model="isSortDesc" mandatory>
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
                <!--<v-card :id="item._id" v-if="enableContext || selected.includes(index)"  v-on:click="addSelection(index)">-->
                <v-card :id="item._id">
                  <v-img v-if="true" :src="item.image" v-on:click="toggle(item)" />
                  <!--:id='"card_"+item._id' -->
                  <!--<router-link :to="{ name: 'AltView', params: { item } }">-->

                  <!--:id='"card_"+item._id'
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
  </v-container>
</template>

<style scoped>
.v-card.outlined {
  border: 2px solid red;
}
.v-card:not(.outlined) {
  opacity: 0.3;
}
</style>

<script>
//https://hujiulong.github.io/vue-3d-model/#/demo-gltf
import { ModelGltf } from "vue-3d-model";
import { operations, getOperationFromEvent } from "@/components/operations.js";
import { mapState } from "vuex";
import * as d3 from "d3";

export default {
  name: "AugmentedGridCards",
  components: { ModelGltf },
  data: function() {
    return {
      //   chartData: [],
      offIcon: 'mdi-eye-off',
      onIcon: 'mdi-eye',
      viewID: null,
      keys: ["Height", "NetSolar", "collection"],
      colSpan: 0,
      possibleColSpans: [1, 2, 3, 4, 6, 12],
      labels: ["12", "6", "4", "3", "2", "1"],
      maxPerPage: 10000,
      // gradient: "to bottom, rgba(50,50,50, .7), rgba(25,32,72, .1)",
      selected: [],
      sortByVar: "height",
      isSortDesc: false,
      enableContext: true
    };
  },
  computed: {
    chartDataLength() {
      return this.chartData.length;
    },
    headers() {
      return Object.keys(this.chartData);
    },
    values() {
      return Object.values(this.chartData);
    },
    ...mapState({ chartData: state => state.data })
  },
  mounted() {
    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this
    });
  },
  created() {
    this.viewID = "id" + this._uid;
    this.$store.subscribe((mutation, state) => {
      if (mutation.type === "update") {
        var result = this.$store.getters.selectedInView(this.viewID);
        this.highlight(result);
      }
    });
  },
  methods: {
    toggle(item) {
      this.$store.commit("update", {
        view: this.viewID,
        selection: [item._id],
        operation: operations.TOGGLE
      });
    },

    highlight(selection) {
      d3.select("#" + this.viewID)
        .selectAll(".v-card")
        .classed("outlined", function(d, i) {
          if (this.id in selection) {
            //TODO needed? addSelection?
            //this.addSelection(it);
            return true;
          } else {
            return false;
          }
        });

      //var it = 0;
      //d3.select("#"+this.viewID).selectAll('.v-card').classed('outlined', function(){if(mask[it]) this.addSelection(it); return mask[it++]});//function() { return selection.includes(this.id.substring(5));})
      //class="{'outlined':selected.includes(index)}
    },
    unhighlightAll() {
      d3.select("#" + this.viewID)
        .selectAll(".v-card")
        .classed("outlined", false);
    },
    addSelection(id) {
      if (!this.selected.includes(id)) this.selected.push(id);
      else this.selected.splice(this.selected.indexOf(id), 1);
    },
    getCompareData() {
      let res = [];
      this.selected.forEach(e => {
        res.push(this.chartData[e]);
      });
      return res;
    },
    destroyChart: function() {
      let node = d3.select("#" + this.viewID)._groups[0][0]; //this.$refs["parcoords"];
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    },
    updateContext()
    {
        //TODO
        if(this.enableContext)
        {
            this.chartDataProcessed =  this.chartData;
        }
        else
        {
           this.chartDataProcessed = this.$store.getters.selectedDataInView(this.viewID);
        }
    }
  },
  watch: {
    chartData: {
      handler: function(newValue, oldValue) {
        //this.chart = this.createChart();
      }
      //deep: true
    }
  }
};
</script>