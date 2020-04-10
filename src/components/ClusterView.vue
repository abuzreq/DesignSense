<template>
  <v-container :id="viewID" justify-start align-start :style="{'height': `${height}px`}">
    <v-data-iterator
      style="height:100%;"
      :items="clusterReps"
      hide-default-footer
      :items-per-page="maxPerPage"
      :sort-by="sortByVar"
      :sort-desc="isSortDesc"
    >
      <template v-slot:header>
        <!--<MultiDimensionSelect
            :initialValue="numericDimensions"
            v-on:update="onDimensionChange($event)"
          />
          <v-spacer></v-spacer>
        -->
        <!--
          <v-select
            dense
            v-model="sortByVar"
            flat
            solo-inverted
            hide-details
            prepend-inner-icon="search"
            :items="numericDimensions"
            label="Sort by"
          ></v-select>
          <v-spacer></v-spacer>
        
          {{numSelected}}
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
        -->
        <v-toolbar dense fixed dark color="blue darken-3" class="mb-1">
          <v-slider
            min="4"
            max="16"
            step="4"
            :tick-labels="numClustersLabels"
            ticks="always"
            tick-size="4"
            v-model="numClusters"
          ></v-slider>
          <v-slider
            min="0"
            max="2"
            step="1"
            :tick-labels="labels"
            ticks="always"
            tick-size="4"
            v-model="colSpan"
          ></v-slider>
        </v-toolbar>

        <!--
          <v-btn-toggle dense v-model="isSortDesc" mandatory>
            <v-btn medium depressed color="blue" :value="false">
              <v-icon>mdi-arrow-up</v-icon>
            </v-btn>
            <v-btn medium depressed color="blue" :value="true">
              <v-icon>mdi-arrow-down</v-icon>
            </v-btn>
          </v-btn-toggle>
        -->
      </template>
      <template v-slot:default="items">
        <v-layout grid-list-sm column style="height: 75vh">
          <v-flex md6 style="overflow-y: auto; overflow-x: hidden">
            <v-row dense>
              <v-col
                v-for="(item) in items.items"
                v-bind:key="cardSelector+item._id"
                :cols="possibleColSpans[colSpan]"
              >
                <!--<v-card :id="item._id" v-if="enableContext || selected.includes(index)"  v-on:click="addSelection(index)">-->
                <v-card
                  v-bind:class="{ clusterRep: true, outlined: numSelected > 0 && selectionMap[item._id], transparent: enableContext &&  numSelected > 0 &&  !selectionMap[item._id] }"
                  v-bind:id="cardSelector+item._id"
                >
                  <v-img
                    v-if="true"
                    contain
                    :src="item.image"
                    v-on:click="toggle(item, $event)"
                    v-on:mouseover="hover(item)"
                    v-on:mouseleave="unhover(item)"
                  />
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
    <v-toolbar dense fixed dark color="blue darken-3" class="mb-1" style="margin-top:-35px">
      <MultiDimensionSelect
        :initialValue="dimensions"
        :keys="numericDimensions"
        :width="(3/4)*width"
        v-on:update="onDimensionChange($event)"
        initialOpenDirection="above"
      />
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" x-small icon @click="() => dimensions = []">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </template>
        <span>Rest the dimensions.</span>
      </v-tooltip>
    </v-toolbar>
  </v-container>
</template>

<style scoped>
.col > .v-card.clusterRep .v-image {
  filter: sepia() saturate(4) hue-rotate(295deg);
}
.col > .v-card.outlined {
  border: 2px solid rgb(33, 119, 180);
}
.col > .v-card:not(.transparent) {
  opacity: 1;
}
.col > .v-card.transparent {
  opacity: 0.4;
}

.col > .v-card.hovered {
  border: 4px solid rgb(33, 119, 180); /*#82b1ff;*/
}

/deep/ .multiselect__tag {
  width: 50px;
  display: none;
}

/deep/ .multiselect {
  width: 200px;
}

/deep/ .v-slider--horizontal {
  min-width: 5vw;
}
</style>

<script>
//https://hujiulong.github.io/vue-3d-model/#/demo-gltf
import { ModelGltf } from "vue-3d-model";
import { operations, getOperationFromEvent } from "@/components/operations.js";
import { mapState, mapGetters } from "vuex";
import * as d3 from "d3";
import * as kmeans from "node-kmeans";
import * as nj from "numjs";
import MultiDimensionSelect from "@/components/MultiDimensionSelect.vue";

export default {
  name: "AugmentedGridCards",
  components: { ModelGltf, MultiDimensionSelect },
  props: ["defaultEnableContext", "width", "height", "x", "y"],

  data: function() {
    return {
      chartData: [],
      selectionMap: {},
      offContextIcon: "mdi-eye-off",
      onContextIcon: "mdi-eye",
      viewID: null,
      // keys: this.$store.numericDimensions.concat(["selected"]),
      colSpan: 0,
      possibleColSpans: [6, 8, 12],
      labels: ["S", "M", "XL"],
      numClustersLabels: ["4", "8", "12", "16"],
      maxPerPage: 10000,
      // gradient: "to bottom, rgba(50,50,50, .7), rgba(25,32,72, .1)",
      sortByVar: "height",
      isSortDesc: true,
      enableContext: this.defaultEnableContext,
      numSelected: 0,
      clustersMap: {},
      clusterReps: [],
      dimensions: [],
      numClusters: 3
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
      numericDimensions: state => state.numericDimensions,
      hovered: state => state.hovered
    }),
    ...mapGetters(["isHoveringEnabled"]),
    cardSelector() {
      return "card_" + this.viewID + "_";
    }
    /*  clustersReps()
    {
      console.log("clusters ", this.clustersMap)
      console.log(this.clustersMap[0])
      for(var rep in this.clustersMap)
      {
        console.log(rep)
      }
      console.log("clusters map", Object.keys(this.clustersMap.value))
      return Object.keys(this.clustersMap.value);
    }*/
  },
  mounted() {
    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this
    });
    this.chartData = this.rawChartData;

    this.compute();
    /*
    var clusters = kmeans(this.chartData, 4, function(d) {return d.TotalFlrArea})
    var centroids = clusters.map(c => d3.mean(c, d => values(d, ['TotalFlrArea'])))
    var closest = clusters.map((c,i) => 
        {
            return indexOfSmallest(c.map( d =>  Math.abs(centroids[i] - values(d, ['TotalFlrArea']))))
        }
    )
    var clusterReps = [];
    for(var i = 0; i < closest.length;i++)
    {
        clusterReps.push(this.chartData[closest[i]])
        
        this.clustersMap[this.chartData[closest[i]]._id] = clusters[i]
    }
    this.chartData = clusterReps;
    */
  },
  created() {
    this.dimensions = this.numericDimensions;
    this.viewID = "id" + this._uid;
    this.$store.subscribe((mutation, state) => {
      if (mutation.type === "update" || mutation.type === "resetMarking") {
        /*
        this.updateContext();
        this.selectionMap = this.$store.getters.getMarking(this.viewID);
        this.chartData.forEach(d => {
          d.selected = this.selectionMap[d._id];
        });
        console.log("this.chartData ", this.chartData);
        this.numSelected = this.countSelected(this.selectionMap);
        */
      }
    });
  },
  methods: {
    compute() {
      var matrix = to2DMatrix(this.chartData, this.dimensions, true); //['TotalFlrArea']

      kmeans.clusterize(matrix, { k: this.numClusters }, (err, res) => {
        if (err) console.error(err);
        else {
          var centroids = res.map(c => c.centroid);
          var closest = res.map((c, i) => {
            let smallestInClusterIndex = indexOfSmallest(
              c.cluster.map(d => distance(centroids[i], d))
            );
            return c.clusterInd[smallestInClusterIndex];
          });

          this.clusterReps.splice(0, this.clusterReps.length);

          for (var i = 0; i < closest.length; i++) {
            this.clusterReps.push(this.chartData[closest[i]]);
            this.clustersMap[this.chartData[closest[i]]._id] = res[
              i
            ].clusterInd.map(idx => this.chartData[idx]);
          }
        }
      });
    },
    onDimensionChange(newDimensions) {
      this.dimensions = newDimensions;
      /*Object.keys(this.chartData[0]).filter(
        d => !newDimensions.includes(d)
      );*/
      this.compute();
    },
    hover(item, forced) {
      if (forced || this.isHoveringEnabled) {
        this.$store.commit("hover", { hovered: item });
      }
    },
    unhover(item) {
      this.$store.commit("hover", { hovered: null });
    },
    toggle(item, event) {
      //console.log("Toggle", this.clustersMap[item._id]._id);

      this.$store.commit("update", {
        view: this.viewID,
        selection: this.clustersMap[item._id].map(d => d._id),
        operation: getOperationFromEvent(event)
      });
    },
    highlight(selection) {
      let count = 0;
      console.log(selection);
      for (var s in selection) {
        console.log(s, d3.select("#" + this.cardSelector + s));
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
      console.log("Updating Context");
      if (this.enableContext) {
        this.chartData = this.rawChartData;
      } else {
        this.chartData = this.$store.getters.selectedDataInView(this.viewID);
      }
      /*
      let selected = this.$store.getters.selectedInView(this.viewID);
      this.unhighlight(this.$store.getters.unselectedInView(this.viewID));
      this.unhighlight(selected);
      this.highlight(selected);
*/
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
        this.compute();
      }
      //deep: true
    },
    rawChartData: {
      handler: function(newValue, oldValue) {
        this.updateContext();
        this.compute();
      }
      //deep: true
    },
    numClusters: {
      handler: function(newValue, oldValue) {
        this.compute();
      }
    },
    hovered: function(newValue, oldValue) {
      if (oldValue) {
        d3.select("#" + this.viewID)
          .select("#" + this.cardSelector + oldValue._id)
          .classed("hovered", false);
      }
      if (newValue) {
        d3.select("#" + this.viewID)
          .select("#" + this.cardSelector + newValue._id)
          .classed("hovered", true);
      }
    }
  }
};
function get(obj, keys) {
  var newObj = {};
  for (var key of keys) {
    newObj[key] = obj[key];
  }
  return newObj;
}
function values(obj, keys) {
  let v = Object.values(get(obj, keys));
  return v;
}
function to2DMatrix(data, keys, normalize) {
  if (normalize) {
    var scales = {};
    keys.forEach(key => {
      scales[key] = d3
        .scaleLinear()
        .domain(
          d3.extent(data, function(d) {
            return d[key];
          })
        )
        .range([0, 1]);
    });
  }

  var matrix = [];
  for (var obj of data) {
    var newObj = {};
    for (var key of keys) {
      newObj[key] = normalize ? scales[key](obj[key]) : obj[key];
    }
    matrix.push(Object.values(newObj));
  }
  return matrix;
}
function indexOfSmallest(a) {
  var lowest = 0;
  for (var i = 1; i < a.length; i++) {
    if (a[i] < a[lowest]) lowest = i;
  }
  return lowest;
}
function distance(arr1, arr2) {
  if (arr1.length !== arr2.length)
    console.error("The two arrays must have the same length");
  var sum = 0;
  for (var i in arr1) {
    sum += Math.pow(arr1[i] - arr2[i], 2);
  }
  return Math.sqrt(sum);
}
</script>