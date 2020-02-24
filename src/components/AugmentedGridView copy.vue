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
          {{numSelected}}
          <v-spacer></v-spacer>
          <v-checkbox
            dense
            align-center
            v-model="enableContext"
            icon="large"
            :off-icon="offContextIcon"
            :on-icon="onContextIcon"
          />
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
                :key="item._id"
                :cols="possibleColSpans[colSpan]"
              >
                <!--<v-card :id="item._id" v-if="enableContext || selected.includes(index)"  v-on:click="addSelection(index)">-->
                <v-card :id="'card_'+item._id">
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
.col > .v-card.outlined {
  border: 2px solid red;
}

.col > .v-card:not(.transparent) {
  opacity: 1;
}

.col > .v-card.transparent {
  opacity: 0.4;
}
</style>

<script>
//https://hujiulong.github.io/vue-3d-model/#/demo-gltf
import { ModelGltf } from "vue-3d-model";
import { operations, getOperationFromEvent } from "@/components/operations.js";
import { mapState, mapGetters } from "vuex";
import * as d3 from "d3";

export default {
  name: "AugmentedGridCards",
  components: { ModelGltf },
  props: ["defaultEnableContext"],
  data: function() {
    return {
      filteredChartData: [],
      chartData: [],
      offContextIcon: "mdi-eye-off",
      onContextIcon: "mdi-eye",
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
      enableContext: this.defaultEnableContext,
      numSelected: 0
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
    ...mapState({ rawChartData: state => state.data })
  },
  mounted() {
    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this
    });
    this.chartData = this.rawChartData;
  },
  created() {
    this.viewID = "id" + this._uid;
    this.$store.subscribe((mutation, state) => {
      if (mutation.type === "update" || mutation.type === "resetMarking") {
        this.filteredChartData = this.$store.getters.selectedDataInView(
          this.viewID
        );

        var result = this.$store.getters.selectedInView(this.viewID);
        console.log(result);
        this.unhighlight(this.$store.getters.unselectedInView(this.viewID));
        this.highlight(result);
        /*
        if(this.enableContext)

        {
              
        }
        else
        {
           this.unhighlight(result)
          this.unhighlight(this.$store.getters.unselectedInView(this.viewID))
        }*/
        /*
        this.unhighlight(result)
        this.unhighlight(this.$store.getters.unselectedInView(this.viewID))
        if(this.enableContext)
        {
           
        }
*/

        this.numSelected = result.length;
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
      let count = 0;
      console.log(selection);
      for (var s in selection) {
        console.log(s, d3.select("#card_" + s));
        d3.select("#" + this.viewID)
          .select("#card_" + s)
          .classed("transparent", false)
          .classed("outlined", true);
      }

      /*
      d3.select("#" + this.viewID)
        .selectAll(".v-card")
        .classed("default",false)
        .classed("outlined", function(d, i)
         {
            //console.log(this.id,this.id.substring(5))
          if (this.id.substring(5) in selection) 
          {
            //console.log("Inside ",this.id.substring(5))
            //TODO needed? addSelection?
            //this.addSelection(it);
            count += 1;
            return true;
          } 
          else {
            return false;
          }
        });
      */
    },
    unhighlight(selection) {
      for (var s in selection) {
        d3.select("#card_" + s)
          .classed("outlined", false)
          .classed("transparent", true);
      }
    },
    unhighlightAll() {
      console.log(
        "SIZE",
        d3
          .select("#" + this.viewID)
          .selectAll(".v-card")
          .size()
      );

      d3.select("#" + this.viewID)
        .selectAll(".v-card")
        .classed("outlined", false)
        .classed("transparent", true);
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
    updateContext() {
      //TODO
      if (this.enableContext) {
        this.chartDataProcessed = this.chartData;
      } else {
        this.chartDataProcessed = this.$store.getters.selectedDataInView(
          this.viewID
        );
      }
    }
  },
  watch: {
    enableContext: {
      handler: function(enableContextNewValue, oldValue) {

        console.log("enableContext", this.enableContext);
        if (enableContextNewValue) {
          this.chartData =  this.rawChartData;
        } else {
          //this.unhighlight(this.$store.getters.selectedInView(this.viewID))
          //this.unhighlight(this.$store.getters.unselectedInView(this.viewID))
          this.chartData =  this.filteredChartData;
        }
      }
      //deep: true
    },
    rawChartData: {
      handler: function(newValue, oldValue) {
        if (enableContextNewValue) {
          this.chartData =  newValue;
        } else {
          //this.unhighlight(this.$store.getters.selectedInView(this.viewID))
          //this.unhighlight(this.$store.getters.unselectedInView(this.viewID))
          this.chartData =  this.filteredChartData;
        }
      }
      //deep: true
    },
  }
};
</script>