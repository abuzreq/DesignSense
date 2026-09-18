<template>
  <div :id="viewID" class="clusters-panel" :style="{ height: `${height}px` }">
    <PanelHeader icon="mdi-chart-bubble" title="Clusters" :compact="width < 420">
      <template v-if="useKMeans">
        <span class="ph-label">Count</span>
        <v-select
          v-model="numClusters"
          :items="numClustersLabels"
          dense
          outlined
          hide-details
          class="ph-select ph-select--narrow"
        />
      </template>
      <template v-else>
        <span class="ph-label">Detail</span>
        <v-select
          :value="epsilonLabel"
          :items="epsilonValues"
          dense
          outlined
          hide-details
          class="ph-select"
          @change="onEpsilonChange"
        />
      </template>

      <template v-slot:actions>
        <v-tooltip bottom max-width="280">
          <template v-slot:activator="{ on }">
            <v-btn
              v-on="on"
              icon
              small
              class="ph-btn"
              :aria-label="
                useKMeans
                  ? 'Grouping with k-means; switch to DBSCAN'
                  : 'Grouping with DBSCAN; switch to k-means'
              "
              @click="useKMeans = !useKMeans"
            >
              <v-icon small>{{
                useKMeans ? "mdi-shimmer" : "mdi-google-circles"
              }}</v-icon>
            </v-btn>
          </template>
          <span>{{
            useKMeans
              ? "Grouping with k-means into a set number of groups. Click to use DBSCAN, which finds the groups itself."
              : "Grouping with DBSCAN. Click to use k-means with a set number of groups."
          }}</span>
        </v-tooltip>
        <span class="ph-divider" />
        <v-tooltip
          v-for="(size, index) in thumbnailSizes"
          :key="size.icon"
          bottom
        >
          <template v-slot:activator="{ on }">
            <v-btn
              v-on="on"
              icon
              small
              class="ph-btn"
              :class="{ 'ph-btn--on': colSpan === index }"
              :aria-label="size.label"
              :aria-pressed="String(colSpan === index)"
              @click="colSpan = index"
            >
              <v-icon small>{{ size.icon }}</v-icon>
            </v-btn>
          </template>
          <span>{{ size.label }}</span>
        </v-tooltip>
        <v-tooltip bottom max-width="300">
          <template v-slot:activator="{ on }">
            <v-icon v-on="on" small class="clusters-info"
              >mdi-information-outline</v-icon
            >
          </template>
          <span
            >Clusters group options that are similar on the chosen dimensions.
            Each image is the option closest to the centre of its group. Start
            with the plotted dimensions, then add others. With DBSCAN, Detail
            sets how fine the groups are.</span
          >
        </v-tooltip>
      </template>
    </PanelHeader>

    <div class="clusters-dimensions">
      <v-autocomplete
        :value="dimensions"
        :items="dimensionChoices"
        multiple
        small-chips
        deletable-chips
        dense
        outlined
        hide-details
        placeholder="Dimensions to group by"
        class="clusters-dims-select"
        @change="onDimensionChange"
      />
    </div>
    <p class="clusters-hint">
      Click a group to {{ clickPhrase }}.
      <v-icon v-if="showsOperation" x-small class="clusters-hint-icon">{{
        operationIcon
      }}</v-icon>
    </p>

    <div class="clusters-grid">
      <div v-if="sortedReps.length === 0" class="clusters-empty">
        {{
          !areDimensionsValid()
            ? "Choose at least one dimension to group options."
            : clusterError
            ? "Grouping failed. Try other dimensions."
            : "Not enough options to form groups."
        }}
      </div>
      <v-row dense class="ma-0">
        <v-col
          v-for="(item, index) in sortedReps"
          :key="cardSelector + item._id"
          :cols="possibleColSpans[colSpan]"
        >
          <div
            :id="cardSelector + item._id"
            class="cluster-card"
            :class="{
              outlined: numSelected > 0 && selectionMap[item._id],
              transparent:
                enableContext && numSelected > 0 && !selectionMap[item._id],
            }"
            @click="toggle(item, $event, index)"
            @mouseover="hover(item)"
          >
            <!-- Clicking a group applies the current selection operation, the
                 same as brushing a chart, so the card shows which one. -->
            <v-tooltip v-if="showsOperation" bottom>
              <template v-slot:activator="{ on }">
                <span v-on="on" class="cluster-op">
                  <v-icon x-small>{{ operationIcon }}</v-icon>
                </span>
              </template>
              <span>{{ currentSelectionOperation }}: click to {{ clickPhrase }}</span>
            </v-tooltip>
            <v-img
              contain
              :src="item.image"
              :alt="'Group ' + (index + 1) + ' representative'"
              :aspect-ratio="4 / 3"
              class="cluster-image"
            />
            <div class="cluster-meta">
              <span class="cluster-index">#{{ index + 1 }}</span>
              <span class="cluster-size"
                >{{ clustersSize[item._id] }}
                {{ clustersSize[item._id] === 1 ? "option" : "options" }}</span
              >
            </div>
          </div>
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<style scoped>
.clusters-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border-left: 1px solid #e3e8ee;
  user-select: none;
}
.clusters-info.v-icon {
  margin: 0 4px 0 2px;
  color: #78909c;
  cursor: help;
}
.clusters-dimensions {
  flex: 0 0 auto;
  padding: 8px 8px 0;
}
.clusters-dims-select {
  font-size: 13px;
}
.clusters-dims-select.v-input--dense ::v-deep .v-input__slot {
  min-height: 32px !important;
}
.clusters-dims-select ::v-deep .v-input__append-inner {
  margin-top: 4px !important;
}
.clusters-dims-select ::v-deep fieldset {
  border-color: #d5dce4;
}
.clusters-dims-select ::v-deep .v-chip {
  margin: 3px 4px 3px 0 !important;
}
.clusters-hint {
  flex: 0 0 auto;
  margin: 6px 10px 2px;
  font-size: 12px;
  color: #546e7a;
}
.clusters-grid {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0 4px 8px;
}
.clusters-empty {
  margin: 16px 8px;
  font-size: 13px;
  color: #546e7a;
  text-align: center;
}
.cluster-card {
  position: relative;
  overflow: hidden;
  border: 1px solid #e3e8ee;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
}
.cluster-card:hover {
  border-color: #90caf9;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.cluster-card.outlined {
  border: 2px solid rgb(33, 119, 180);
}
.cluster-card.transparent {
  opacity: 0.35;
}
.cluster-card.hovered {
  outline: 2px dashed rgb(33, 119, 180);
  outline-offset: -2px;
}
.cluster-image {
  background: #f5f7fa;
}
/* The operation badge sits over the image, and firms up on hover. */
.cluster-op {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: rgba(21, 101, 192, 0.75);
  opacity: 0.8;
}
.cluster-op .v-icon {
  color: #fff;
}
.cluster-card:hover .cluster-op {
  opacity: 1;
}
.clusters-hint-icon.v-icon {
  color: #546e7a;
}
.cluster-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 3px 8px;
  border-top: 1px solid #eef1f4;
  font-size: 12px;
  color: #455a64;
  white-space: nowrap;
}
.cluster-index {
  font-weight: 600;
}
.cluster-size {
  overflow: hidden;
  text-overflow: ellipsis;
  color: #546e7a;
}
</style>

<script>
import { mapState, mapGetters } from "vuex";
import * as d3 from "d3";
import * as kmeans from "node-kmeans";

import PanelHeader from "@/components/PanelHeader.vue";
import { dimensionItems } from "@/columns.js";
import { RATING_DIMENSION } from "@/ratings.js";
import { operationIcon, operationPhrase } from "@/components/operationIcons.js";

import * as pixelmatch from "pixelmatch";

// DBSCAN neighbourhood radii, finest first, matching epsilonValues.
const EPSILONS = [0.05, 0.1, 0.2, 0.4];

export default {
  name: "ClusterView",
  components: {
    PanelHeader,
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
      viewID: null,
      colSpan: 1,
      possibleColSpans: [4, 6],
      // One per entry of possibleColSpans: three, then two groups per row.
      thumbnailSizes: [
        { icon: "mdi-view-comfy-outline", label: "Smaller images" },
        { icon: "mdi-view-grid-outline", label: "Larger images" },
      ],
      numClustersLabels: [3, 4, 5, 6, 7, 8],
      epsilonValues: ["Finest", "Fine", "Coarse", "Coarsest"],
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
      // Why the last grouping failed, or null. Shown as a generic message.
      clusterError: null,
    };
  },
  computed: {
    chartDataLength() {
      return this.chartData.length;
    },
    ...mapState({
      rawChartData: (state) => state.data,
      dimensionValuesVersion: (state) => state.dimensionValuesVersion,
      numericDimensions: (state) => state.numericDimensions,
      dimensionChoices: (state) => dimensionItems(state.numericDimensions),
      hovered: (state) => state.hovered,
      currentSelectionOperation: (state) => state.currentSelectionOperation,
    }),
    ...mapGetters(["isHoveringEnabled", "can"]),
    // Only Expert combines selections, so only there does an operation apply.
    showsOperation() {
      return this.can("selectionOperations");
    },
    operationIcon() {
      return operationIcon(this.currentSelectionOperation);
    },
    clickPhrase() {
      return this.showsOperation
        ? operationPhrase(this.currentSelectionOperation)
        : "select its options";
    },
    epsilonLabel() {
      return this.epsilonValues[EPSILONS.indexOf(this.epsilon)];
    },
    // In order along the scatterplot's x dimension.
    sortedReps() {
      let key = this.sortByVar;
      return this.clusterReps.slice().sort((a, b) => a[key] - b[key]);
    },
    cardSelector() {
      return "cluster_card_" + this.viewID + "_" + this.useKMeans + "_";
    },
  },
  mounted() {
    console.log(this.dimensions);
    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this,
    });
    this.chartData = this.rawChartData;
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
      // An option missing any clustering dimension can't be placed in a group.
      let rows = this.chartData.filter((d) =>
        this.dimensions.every((dim) => Number.isFinite(d[dim]))
      );
      var matrix = to2DMatrix(rows, this.dimensions, true);

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
      // Set again below if this attempt fails too.
      this.clusterError = null;

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
          this.clusterReps.push(rows[centroidIndex]);
          const id = rows[centroidIndex]._id;
          this.clustersMap[id] = clusterIndices.map((idx) => rows[idx]);
          this.clustersSize[id] = this.clustersMap[id].length;
        });
      } else {
        if (matrix.length < this.numClusters) return;
        // k-means can't place rows holding NaN or infinite values.
        if (
          matrix.some(
            (row) => !Array.isArray(row) || row.some((v) => !Number.isFinite(v))
          )
        ) {
          this.clusterError = "invalid-values";
          return;
        }
        console.log(matrix)

        kmeans.clusterize(matrix, { k: this.numClusters }, (err, res) => {
          if (err) {
            console.error(err);
            this.clusterError = String((err && err.message) || err);
          } else {
            var centroids = res.map((c) => c.centroid);
            var closest = res.map((c, i) => {
              let smallestInClusterIndex = indexOfSmallest(
                c.cluster.map((d) => distance(centroids[i], d))
              );
              return c.clusterInd[smallestInClusterIndex];
            });

            for (var i = 0; i < closest.length; i++) {
              // With few options to group (a sparsely filled custom
              // dimension, say), a group can come back empty or share its
              // representative with another.
              if (!rows[closest[i]] || this.clustersMap[rows[closest[i]]._id]) {
                continue;
              }
              this.clusterReps.push(rows[closest[i]]);
              const id = rows[closest[i]]._id;
              this.clustersMap[id] = res[i].clusterInd.map((idx) => rows[idx]);
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
    onEpsilonChange(label) {
      this.epsilon = EPSILONS[this.epsilonValues.indexOf(label)];
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
      return this.dimensions && this.dimensions.length > 0 && !this.dimensions.includes(undefined);
    },
    hover(item, forced) {
      if (forced || this.isHoveringEnabled) {
        this.$store.commit("hover", { hovered: item });
      }
    },
    unhover(item) {
      this.$store.commit("hover", { hovered: null });
    },
    toggle(item, event, index) {
      let memberIDs = this.clustersMap[item._id].map((d) => d._id);
      // Clicking the inspected representative stops inspecting it.
      if (this.hovered && this.hovered._id === item._id) {
        this.$store.dispatch("inspectByClick", { item: item });
      }
      this.$store.dispatch("update", {
        view: this.viewID,
        selection: memberIDs,
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
    // Ratings change in place; regroup when they are grouped by. Custom
    // values are left alone, since dragging a knob changes them continuously.
    dimensionValuesVersion: function() {
      if (this.dimensions && this.dimensions.includes(RATING_DIMENSION)) {
        this.compute();
      }
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
