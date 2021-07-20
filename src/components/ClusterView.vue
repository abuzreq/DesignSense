<template>
  <v-container
    :id="viewID"
    justify-start
    align-start
    :style="{ height: `${height}px` }"
  >
    <v-data-iterator
      style="height: 100%"
      :items="clusterReps"
      hide-default-footer
      :items-per-page="maxPerPage"
      :sort-by="sortByVar"
      :sort-desc="isSortDesc"
    >
      <template v-slot:header>
        <v-toolbar fixed dark color="blue darken-3" class="mb-1">
          <v-container fluid>
            <v-row dense justify="center" style="margin-bottom: -10px">
              <v-toolbar-title>Clusters Panel</v-toolbar-title>
            </v-row>
            <v-row dense style="flex-wrap: nowrap;">
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
            </v-row>
          </v-container>
        </v-toolbar>
      </template>
      <template v-slot:default="items">
        <v-layout grid-list-sm column style="height: 75vh">
          <v-flex md6 style="overflow-y: auto; overflow-x: hidden">
            <v-row dense>
              <v-col
                v-for="item in items.items"
                v-bind:key="cardSelector + item._id"
                :cols="possibleColSpans[colSpan]"
              >
                <v-card
                  v-bind:class="{
                    clusterRep: true,
                    outlined: numSelected > 0 && selectionMap[item._id],
                    transparent:
                      enableContext &&
                      numSelected > 0 &&
                      !selectionMap[item._id],
                  }"
                  v-bind:id="cardSelector + item._id"
                >
                  <v-img
                    v-if="true"
                    contain
                    :src="item.image"
                    v-on:click="toggle(item, $event)"
                    v-on:mouseover="hover(item)"     
                  />
                </v-card>
              </v-col>
            </v-row>
          </v-flex>
        </v-layout>
      </template>
    </v-data-iterator>

    <v-toolbar
      dense
      fixed
      dark
      color="blue darken-3"
      class="mb-1"
      style="margin-top: -35px"
    >
      <MultiDimensionSelect
        :initialValue="dimensions"
        :keys="numericDimensions"
        :width="(3 / 4) * width"
        v-on:update="onDimensionChange($event)"
        initialOpenDirection="above"
      />
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" x-small icon @click="() => (dimensions = [])">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </template>
        <span>Rest the dimensions.</span>
      </v-tooltip>
    </v-toolbar>
  </v-container>
</template>

<style scoped>
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

::v-deep .multiselect__tag {
  width: 50px;
  display: none;
}

::v-deep .multiselect {
  width: 200px;
}

::v-deep .v-slider--horizontal {
  min-width: 5vw;
}
</style>

<script>
//https://hujiulong.github.io/vue-3d-model/#/demo-gltf
import { ModelGltf } from "vue-3d-model";
import { mapState, mapGetters } from "vuex";
import * as d3 from "d3";
import * as kmeans from "node-kmeans";
import * as nj from "numjs";
import MultiDimensionSelect from "@/components/MultiDimensionSelect.vue";

//import  * as PNGImage from 'pngjs-image';
import * as pixelmatch from "pixelmatch";
const PNG = require("pngjs").PNG;

export default {
  name: "AugmentedGridCards",
  components: { ModelGltf, MultiDimensionSelect },
  props: ["defaultEnableContext", "width", "height", "x", "y"],

  data: function () {
    return {
      chartData: [],
      selectionMap: {},
      offContextIcon: "mdi-eye-off",
      onContextIcon: "mdi-eye",
      viewID: null,
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
      numClusters: 3,
      isComputingVisualSimilarity: false,
    };
  },
  computed: {
    chartDataLength() {
      return this.chartData.length;
    },
    ...mapState({
      rawChartData: (state) => state.data,
      numericDimensions: (state) => state.numericDimensions,
      hovered: (state) => state.hovered,
    }),
    ...mapGetters(["isHoveringEnabled"]),
    cardSelector() {
      return "card_" + this.viewID + "_";
    },
  },
  mounted() {
    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this,
    });
    this.chartData = this.rawChartData;
    // this.compute();
  },
  created() {
    this.dimensions = this.numericDimensions.length >= 2? [this.numericDimensions[0],this.numericDimensions[1]] : [this.numericDimensions[0]];
    this.viewID = "id" + this._uid;
    this.$store.subscribe((mutation, state) => {
      if (mutation.type === "update" || mutation.type === "reverseUpdate" || mutation.type === "resetMarking") {
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
    compute()
    {
      
      if (!this.areDimensionsValid()) 
      {
        return;
      }

      var matrix = to2DMatrix(this.chartData, this.dimensions, true); //['TotalFlrArea']

      /*
      if(this.isComputingVisualSimilarity)
      {
            var matrix2 = to2DVisualSimilarityMatrix(this.chartData, "image", true); //['TotalFlrArea']
            console.log("matrix2", matrix2)
            //need to compute  to2DVisualSimilarityMatrix in a sync way or async with promise
      }
      */

      kmeans.clusterize(matrix, { k: this.numClusters }, (err, res) => {
        if (err) console.error(err);
        else {
          var centroids = res.map((c) => c.centroid);
          var closest = res.map((c, i) => {
            let smallestInClusterIndex = indexOfSmallest(
              c.cluster.map((d) => distance(centroids[i], d))
            );
            return c.clusterInd[smallestInClusterIndex];
          });

          this.clusterReps.splice(0, this.clusterReps.length);

          for (var i = 0; i < closest.length; i++) {
            this.clusterReps.push(this.chartData[closest[i]]);
            this.clustersMap[this.chartData[closest[i]]._id] = res[
              i
            ].clusterInd.map((idx) => this.chartData[idx]);
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
    areDimensionsValid()
    {
      return this.dimensions && this.dimensions.length > 0
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
      this.$store.commit("update", {
        view: this.viewID,
        selection: this.clustersMap[item._id].map((d) => d._id),
        operation: this.$store.state.currentSelectionOperation,
      });

      //this.$store.commit("hover", { hovered: item });
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
      this.selected.forEach((e) => {
        res.push(this.chartData[e]);
      });
      return res;
    },
    destroyChart: function () {
      let node = d3.select("#" + this.viewID)._groups[0][0];
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    },
    updateContext() {
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
    },
  },
  watch: {
    enableContext: {
      handler: function (enableContextNewValue, oldValue) {
        this.updateContext();
        this.compute();
      },
      //deep: true
    },
    rawChartData: {
      handler: function (newValue, oldValue) {
        this.updateContext();
        this.compute();
      },
      //deep: true
    },
    numClusters: {
      handler: function (newValue, oldValue) {
        this.compute();
      },
    },
    hovered: function (newValue, oldValue) {
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
    },
    isComputingVisualSimilarity: function (newValue, oldValue) {
      if (newValue) {
        this.compute();
      }
    },
  },
};

function fetchImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = src;
    image.onload = () => resolve(image);
    image.onerror = reject;
  });
}

function get(obj, keys) {
  var newObj = {};
  for (var key of keys) {
    newObj[key] = obj[key];
  }
  return newObj;
}

function to2DVisualSimilarityMatrix(data, imgKey, normalize) {
  var matrix = [];
  var a = document.getElementById("canvas");
  for (var i in data) {
    var obj1 = data[i];
    var row = [];
    fetchImage(obj1[imgKey]).then((img1, err) => {
      for (var j = 0; j < i; j++) {
        var obj2 = data[j];
        console.log(i, j);
        fetchImage(obj2[imgKey]).then((img2, err) => {
          const w = img1.width;
          const h = img1.height;

          var ctx = a.getContext("2d");
          ctx.drawImage(img1, 0, 0);

          const data1 = ctx.getImageData(0, 0, w, h).data;
          ctx.drawImage(img2, 0, 0);
          const data2 = ctx.getImageData(0, 0, w, h).data;
          const diff = ctx.createImageData(w, h);
          //const ctx = a.context2d(width, height, 1);

          let numMistmatch = pixelmatch(data1, data2, diff.data, w, h, {
            threshold: 0.1,
          });
          row.push(numMistmatch);
        });
      }
    });
    matrix.push(row);
  }
  return matrix;
}

function to2DMatrix(data, keys, normalize) {
  if (normalize) {
    var scales = {};
    keys.forEach((key) => {
      scales[key] = d3
        .scaleLinear()
        .domain(
          d3.extent(data, function (d) {
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