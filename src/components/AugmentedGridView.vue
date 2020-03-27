<template>
  <v-container :id="viewID" justify-start align-start>
    <v-container class="pa-0 ma-0">
      <v-data-iterator
        :items="chartData"
        hide-default-footer
        :items-per-page="maxPerPage"
        :sort-by="sortByVar"
        :sort-desc="isSortDesc"
      >
        <template v-slot:header>
          <v-toolbar dense dark color="blue darken-3" class="mb-1">
            <v-select
              dense
              v-model="sortByVar"
              solo-inverted
              hide-details
              prepend-inner-icon="search"
              :items="keys"
              label="Sort by"
            ></v-select>
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-checkbox
                  v-on="on"
                  dense
                  v-model="isSortDesc"
                  icon="large"
                  :off-icon="arrowUpIcon"
                  :on-icon="arrowDownIcon"
                />
              </template>
              <span v-if="isSortDesc">change to ascending order</span>
              <span v-else>change to descending order</span>
            </v-tooltip>
            <v-spacer></v-spacer>
            # Selected {{numSelected}}
            <v-spacer></v-spacer>
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-checkbox
                  v-on="on"
                  dense
                  align-center
                  v-model="enableContext"
                  icon="large"
                  :off-icon="offContextIcon"
                  :on-icon="onContextIcon"
                />
              </template>
              <span v-if="enableContext">Show only selection</span>
              <span v-else>Show selection in context</span>
            </v-tooltip>
            <v-spacer></v-spacer>

            <v-slider
              min="0"
              max="3"
              step="1"
              :tick-labels="labels"
              ticks="always"
              tick-size="4"
              v-model="colSpan"
            ></v-slider>

            <!--
            <v-btn-toggle x-small dense v-model="isSortDesc" mandatory>
              <v-btn x-small depressed color="blue" :value="false">
                <v-icon>mdi-arrow-up</v-icon>
              </v-btn>
              <v-btn x-small depressed  :value="true">
                <v-icon>mdi-arrow-down</v-icon>
              </v-btn>
            </v-btn-toggle>
            -->
          </v-toolbar>
        </template>
        <template v-slot:default="items">
          <drag-select-container :selectableItems="getAllCards" :scrollAccessor="(el) => el.firstChild.firstChild" @select="onMouseUp($event)">
            <v-layout grid-list-sm column :style="{'height': `${height}px`}">
              <v-flex
                md6
                style="overflow-y: auto; overflow-x: hidden"
                :style="{'min-height': `calc(${height}px - 100px)`}"
              >
                <v-row dense>
                  <v-col
                    v-for="(item) in items.items"
                    v-bind:key="cardSelector+item._id"
                    :cols="possibleColSpans[colSpan]"
                  >
                    <!--<v-card :id="item._id" v-if="enableContext || selected.includes(index)"  v-on:click="addSelection(index)">-->
                    <v-card
                      v-bind:class="{ outlined: enableContext && numSelected > 0 && selectionMap[item._id], transparent: enableContext &&  numSelected > 0 &&  !selectionMap[item._id] }"
                      v-bind:id="cardSelector+item._id"
                    >
                      <v-img v-if="true" :src="item.image" v-on:click="toggle(item)" v-on:mouseover="hover(item)" v-on:mouseleave="unhover(item)" />
                      <!--  -->
                      <!--:id='"card_"+item._id' -->
                      <!--<router-link :to="{ name: 'AltView', params: { item } }">-->
                      <!--
                      <model-three
                        v-else
                        :src="item.json" 

                      />-->

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
          </drag-select-container>
        </template>
      </v-data-iterator>
    </v-container>
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

/deep/ .v-slider--horizontal {
  min-width: 5vw;
}
</style>

<script>
//    "vue-drag-select": "git+https://github.com/JochenLutz/vue-drag-select.git",

//https://hujiulong.github.io/vue-3d-model/#/demo-gltf
import { ModelThree  } from "vue-3d-model";
import { operations, getOperationFromEvent } from "@/components/operations.js";
import { mapState, mapGetters } from "vuex";
import * as d3 from "d3";
import DragSelect from "@/plugins/DragSelect.vue";

export default {
  name: "AugmentedGridCards",
  components: { ModelThree , "drag-select-container": DragSelect },
  props: ["defaultEnableContext", "width", "height"],
  data: function() {
    return {
      chartData: [],
      cards: [],
      selectionMap: {},
      offContextIcon: "mdi-eye-off",
      onContextIcon: "mdi-eye",
      arrowUpIcon: "mdi-arrow-up",
      arrowDownIcon: "mdi-arrow-down",
      viewID: null,
      //keys: ["Height", "NetSolar", "collection", "selected"],
      colSpan: 1,
      possibleColSpans: [1, 2, 3, 4],
      labels: ["S", "M", "L", "XL"],
      icons: ["mdi-snowflake", "mdi-leaf", "mdi-fire", "mdi-water"],
      maxPerPage: 10000,
      // gradient: "to bottom, rgba(50,50,50, .7), rgba(25,32,72, .1)",
      sortByVar: "height",
      isSortDesc: true,
      enableContext: this.defaultEnableContext,
      numSelected: 0,
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
    ...mapState({
      rawChartData: state => state.data,
      keys: state => state.numericDimensions.concat(["selected"])
    }),
    cardSelector() {
      return "card_" + this.viewID + "_";
    },

  },
  mounted() {
    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this
    });
    this.updateContext();
    //this.chartData = this.rawChartData;
  },
  updated()
  {       
      this.cards.splice(0, this.cards.length)
      this.cards.push(...this.getAllCards())      
  },
  created() {
    this.viewID = "id" + this._uid;
    this.sortByVar =this.keys[0];


    this.$store.subscribe((mutation, state) => {
      if (mutation.type === "update" || mutation.type === "resetMarking") {
        this.updateContext();
        this.selectionMap = this.$store.getters.getMarking(this.viewID);
        this.chartData.forEach(d => {
          d.selected = this.selectionMap[d._id];
        });
        this.numSelected = this.countSelected(this.selectionMap);
      }
    });
    
  },
  methods: {
   getAllCards() 
    {
        let cards = Array.prototype.slice.call(
            d3.select("#" + this.viewID).selectAll(".v-card")._groups[0]
          );
      return cards
    },
    onMouseUp(selectedItems) {
      let selectedIDs = selectedItems.map(s => {
        let start = s.id.indexOf("_");
        let secondPart = s.id.substring(start + 1)
        let secondStart = secondPart.indexOf("_") //finding the 2nd occurance of _ , accounting for ids that start with _
        return secondPart.substring(secondStart + 1);
      });
      //console.log(selectedIDs)
      //selectedIDs.forEach(s => this.update({ _id: s }, event));

      this.$store.commit("update", {
        view: this.viewID,
        selection: selectedIDs,  
        operation: getOperationFromEvent(event)
      });

    },
    hover(item) 
    {
        this.$store.commit("hover", {hovered: item})
    },
    unhover(item)
    {
          this.$store.commit("hover", {hovered: null})
    },
    toggle(item) 
    {
      //this.$store.commit("hover", {hovered: item})
      
      this.$store.commit("update", {
        view: this.viewID,
        selection: [item._id],
        operation: operations.TOGGLE
      });
    },
    update(item, event) {
      console.log("A", event)
      //if(!event.altKey)
      //  event.shiftKey = true;
      //console.log("B", event)
      this.$store.commit("update", {
        view: this.viewID,
        selection: [item._id],
     
        operation: getOperationFromEvent(event)
      });
    },
    highlight(selection) {
      let count = 0;
      for (var s in selection) {
        d3.select("#" + this.viewID)
          .select("#" + this.cardSelector + s)
          .classed("transparent", false)
          .classed("outlined", true);
      }
    },
    unhighlight(selection) {
      for (var s in selection) {
        d3.select("#" + this.cardSelector + s)
          .classed("outlined", false)
          .classed("transparent", true);
      }
    },
    unhighlightAll() {
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
      //console.log("Updating Context");
      if (this.enableContext) {
        this.chartData = this.rawChartData;
        
      } else {
        this.chartData = this.$store.getters.selectedDataInView(this.viewID);
      }

    },
    countSelected(selectionMap) {
      let count = 0;
      for (var alt in selectionMap) {
        if (selectionMap[alt] == 1) {
          count += 1;
        }
      }
      return count;
    }
  },
  watch: {
    enableContext: {
      handler: function(enableContextNewValue, oldValue) {
        this.updateContext();
      }
      //deep: true
    },
    rawChartData: {
      handler: function(newValue, oldValue) {
        this.updateContext();
      }
      //deep: true
    }
  }
};
</script>