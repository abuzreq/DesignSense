<template>
  <v-container
    :id="viewID"
    justify-start
    align-start
    class="pt-0"
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
        <v-container class="pa-0" fluid>
          <div style="display: flex">
            <v-select
              v-if="useKMeans"
              id="num_clusters_select"
              density="compact"
              style="margin-top: 15px;"
              label="Num Clusters"
              v-model="numClusters"
              hide-details
              :items="numClustersLabels"
            ></v-select>
            <v-select
              v-else
              id="num_clusters_select"
              density="compact"
              style="margin-top: 15px;"
              label="Clusters Granularity"
              :value="epsilonValues[1]"
              hide-details
              :items="epsilonValues"
              @change="onEpsilonChange"
            ></v-select>

            <div style="display: flex; flex-direction: column;">
              <div
                style="display: flex; flex-direction: row; justify-content: space-between; position: relative; top: 12px"
              >
                <span><SmallGridIcon /></span>
                <span><MediumGridIcon /></span>
              </div>
              <v-slider
                id="size-slider"
                min="0"
                max="1"
                step="1"
                style="width: 150px;"
                ticks="always"
                tick-size="4"
                v-model="colSpan"
                hide-details
              ></v-slider>
            </div>
            <v-tooltip :max-width="300" bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  size="x-small"
                  v-on="on"
                  icon
                  color="white"
                  style="align-items: flex-end;"
                  ><v-icon
                    style="border: 1px solid currentColor; border-radius:50%;"
                    >{{ "mdi-exclamation" }}</v-icon
                  ></v-btn
                >
              </template>
              <span
                >This shows clusters in the design space. Each cluster
                represents a group of items that are similar to each other with
                respect to chosen data dimensions. You can choose the clustering
                dimensions from the dropdown at the bottom, we recommend using
                the same dimensions used in the scatterplot as a start. The
                clusters granularity decides how fine (small value) or course
                (large value) the clusters will be.</span
              >
            </v-tooltip>
          </div>
        </v-container>
      </template>
      <template v-slot:default="items">
        <v-layout grid-list-sm column style="height: 75vh">
          <v-card color="primary" class="clusters-note">
            Click to select clusters.
          </v-card>
          <v-flex md6 style="overflow-y: auto; overflow-x: hidden">
            <v-row dense>
              <v-col
                v-for="(item, index) in items.items"
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
                  <span style="padding: 2px; position: relative; left: 3%;"
                    >{{ "#" + (index + 1) }}
                  </span>

                  <v-tooltip bottom>
                    <template v-slot:activator="{ on }">
                      <v-chip
                        small
                        style="position: absolute; right: 3%;padding: 8px;"
                        v-on="on"
                        color="blue darken-3"
                        text-color="white"
                      >
                        {{ clustersSize[item._id] }}
                      </v-chip>
                    </template>
                    <span>Number of items in the cluster</span>
                  </v-tooltip>

                  <v-img
                    contain
                    :src="item.image"
                    v-on:click="toggle(item, $event)"
                    v-on:mouseover="hover(item)"
                    style="min-height: 120px;"
                  />
                </v-card>
              </v-col>
            </v-row>
          </v-flex>
        </v-layout>
      </template>
    </v-data-iterator>

    <v-toolbar
      v-show="showMultiselect"
      dense
      fixed
      dark
      color="blue darken-3"
      class="mb-1"
      style="margin-top: -35px"
    >
      <v-tooltip bottom>
        <template v-slot:activator="{ on, attrs }">
          <v-simple-checkbox
            :ripple="false"
            style="float: left"
            dense
            v-on="on"
            v-bind="attrs"
            v-model="useKMeans"
            icon="x-small"
            off-icon="mdi-google-circles"
            on-icon="mdi-shimmer"
          />
        </template>
        <span v-if="useKMeans">Switch to clustering with DBScan</span>
        <span v-else>Switch to clustering with Kmeans</span>
      </v-tooltip>
      <MultiDimensionSelect
        :initialValue="dimensions"
        :keys="numericDimensions"
        :width="(4 / 5) * width"
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
body {
  user-select: none; /* Standard syntax */
}

::v-deep label.v-label {
  color: white;
}

::v-deep div.v-select__selections {
  color: white;
}
::v-deep .v-list .v-list-item--active {
  background-color: white !important;
}
::v-deep .v-list .v-list-item--active .v-list-item__title {
  color: white !important;
}
.clusters-note {
  position: relative;
  transform: translateX(-50%);
  left: 50%;
  text-align: center;
  margin-left: 0px;
  margin-right: 32px;
  margin-top: 4px;
  margin-bottom: 4px;
  color: white;
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
  border: 3px dashed rgb(33, 119, 180); /*#82b1ff;*/
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

import LargeGridIcon from "-!vue-svg-loader!/src/assets/large_grid_icon.svg";
import MediumGridIcon from "-!vue-svg-loader!/src/assets/medium_grid_icon.svg";
import SmallGridIcon from "-!vue-svg-loader!/src/assets/small_grid_icon.svg";

export default {
  name: "AugmentedGridCards",
  components: {
    ModelGltf,
    MultiDimensionSelect,
    LargeGridIcon,
    MediumGridIcon,
    SmallGridIcon,
  },
  props: [
    "defaultEnableContext",
    "width",
    "height",
    "x",
    "y",
    "type",
    "showMultiselect",
    "parentDimensions",
    "sortByVar",
  ],

  data: function() {
    return {
      chartData: [],
      selectionMap: {},
      useKMeans: true,
      offContextIcon: "mdi-eye-off",
      onContextIcon: "mdi-eye",
      viewID: null,
      colSpan: 1,
      possibleColSpans: [4, 6],
      labels: ["M", "XL"],
      numClustersLabels: [3, 4, 5, 6, 7, 8],
      epsilonValues: ["2 x granular", " granular", "coarse", "2 x coarse"],
      maxPerPage: 10000,
      // gradient: "to bottom, rgba(50,50,50, .7), rgba(25,32,72, .1)",
      isSortDesc: false,
      enableContext: this.defaultEnableContext,
      numSelected: 0,
      clustersMap: {},
      clusterReps: [],
      clustersSize: {},
      dimensions: this.parentDimensions,
      epsilon: 0.1,
      numClusters: 4,
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
      return "cluster_card_" + this.viewID + "_";
    },
  },
  mounted() {
    console.log(this.dimensions);
    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this,
    });
    this.chartData = this.rawChartData;

    this.compute();
  },
  created() {
    this.dimensions =
      this.numericDimensions.length >= 2
        ? [this.numericDimensions[0], this.numericDimensions[1]]
        : [this.numericDimensions[0]];
    this.viewID = "id" + this._uid;
    this.$store.subscribe((mutation, state) => {
      if (
        mutation.type === "update" ||
        mutation.type === "reverseUpdate" ||
        mutation.type === "resetMarking"
      ) {
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
      if (!this.areDimensionsValid()) {
        return;
      }
      console.log("clustering dimensions", this.dimensions);
      var matrix = to2DMatrix(this.chartData, this.dimensions, true); //['TotalFlrArea']

      /*
      var clustering = require("density-clustering");
      var dbscanAlgo1 = new clustering.OPTICS();
      // parameters: 5 - neighborhood radius, 2 - number of points in neighborhood to form a cluster
      var clusters1 = dbscanAlgo1.run(matrix, 0.1, 3);
      console.log("density", clusters1, dbscanAlgo1.noise);

      var dbscanAlgo2 = new clustering.DBSCAN();
      // parameters: 5 - neighborhood radius, 2 - number of points in neighborhood to form a cluster
      var clusters2 = dbscanAlgo2.run(matrix, this.numClusters, 5);
      console.log("density2", clusters2, dbscanAlgo2.noise);
      */
      this.clusterReps.splice(0, this.clusterReps.length);
      this.clustersMap = {};
      this.clustersSize = {};

      if (!this.useKMeans) {
        const dbscan = require("@cdxoo/dbscan");

        let clustersRes = dbscan({
          dataset: matrix,
          epsilon: this.epsilon,
          distanceFunction: this.euclideanDistance,
          minimumPoints: 4,
        });

        let clusters = clustersRes.clusters;

        clusters.forEach((clusterIndices) => {
          const clusterData = clusterIndices.map((i) => matrix[i]);

          const centroidRes = this.findClosestVector(
            clusterData,
            clusterIndices
          );
          const centroidIndex = centroidRes.closestIndex;
          this.clusterReps.push(this.chartData[centroidIndex]);
          const id = this.chartData[centroidIndex]._id;
          this.clustersMap[id] = clusterIndices.map((idx) => this.chartData[idx]);
          this.clustersSize[id] = this.clustersMap[id].length;
        });
      } else {
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

            for (var i = 0; i < closest.length; i++) {
              this.clusterReps.push(this.chartData[closest[i]]);
              const id = this.chartData[closest[i]]._id;
              this.clustersMap[id] = res[
                i
              ].clusterInd.map((idx) => this.chartData[idx]);
              this.clustersSize[id] = this.clustersMap[id].length;
            }
          }
        });
      }
    
      this.clusterReps.sort((x,y) => (x[this.sortByVar] - y[this.sortByVar]) * (this.isSortDesc?1:-1))
      
      /*
      if(this.isComputingVisualSimilarity)
      {
            var matrix2 = to2DVisualSimilarityMatrix(this.chartData, "image", true); //['TotalFlrArea']
            console.log("matrix2", matrix2)
            //need to compute  to2DVisualSimilarityMatrix in a sync way or async with promise
      }
      */
    },
    onEpsilonChange(x, y)
    {
      let index = this.epsilonValues.indexOf(x)
      const epsilonNumericValues = [0.05, 0.1, 0.2, 0.4]
      this.epsilon = epsilonNumericValues[index];
    },
    calculateCentroid(vectors) {
      if (vectors.length === 0) {
        throw new Error("The array of vectors is empty");
      }

      const numVectors = vectors.length;
      const vectorLength = vectors[0].length;

      const centroid = new Array(vectorLength).fill(0);

      vectors.forEach((vector) => {
        if (vector.length !== vectorLength) {
          throw new Error("All vectors must have the same length");
        }
        for (let i = 0; i < vectorLength; i++) {
          centroid[i] += vector[i];
        }
      });

      for (let i = 0; i < vectorLength; i++) {
        centroid[i] /= numVectors;
      }

      return centroid;
    },
    findClosestVector(vectors, indices) {
      const centroid = this.calculateCentroid(vectors);
      let closestVector = null;
      let closestIndex = -1;
      let closestDistance = Infinity;

      vectors.forEach((vector, index) => {
        const distance = this.euclideanDistance(vector, centroid);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestVector = vector;
          closestIndex = indices[index];
        }
      });

      return { closestVector, closestIndex };
    },
    euclideanDistance(arr1, arr2) {
      if (arr1.length !== arr2.length) {
        return Infinity;
      }

      let sum = 0;

      for (let i = 0; i < arr1.length; i++) {
        sum += Math.pow(arr1[i] - arr2[i], 2);
      }

      return Math.sqrt(sum);
    },
    onDimensionChange(newDimensions) {
      this.dimensions = newDimensions;
      /*Object.keys(this.chartData[0]).filter(
        d => !newDimensions.includes(d)
      );*/
      this.compute();
    },
    areDimensionsValid() {
      return this.dimensions && this.dimensions.length > 0;
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
      this.$store.dispatch("update", {
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
    destroyChart: function() {
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
    parentDimensions: {
      immediate: true,
      deep: true,
      handler: function(newValue) {
        console.log("dims parent");
        this.onDimensionChange(newValue);
      },
    },
    enableContext: {
      handler: function(enableContextNewValue, oldValue) {
        this.updateContext();
        this.compute();
      },
      //deep: true
    },
    rawChartData: {
      handler: function(newValue, oldValue) {
        this.updateContext();
        this.compute();
      },
      //deep: true
    },
    useKMeans: {
      handler: function(newValue, oldValue) {
        this.compute();
      },
    },
    numClusters: {
      handler: function(newValue, oldValue) {
        this.compute();
      },
    },
    epsilon: {
      handler: function(newValue, oldValue) {
        this.compute();
      },
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
    },
    isComputingVisualSimilarity: function(newValue, oldValue) {
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
