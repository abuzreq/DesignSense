

<template>
  <v-container fluid>
    <div :id="viewID" ref="cluster" class="cluster" />
  </v-container>
</template>

<style scoped>
div >>> .axis,
.frame {
  shape-rendering: crispEdges;
}

div >>> .axis line {
  stroke: #ddd;
}

div >>> .axis path {
  display: none;
}

div >>> .cell text {
  font-weight: bold;
  text-transform: capitalize;
}

div >>> .frame {
  fill: none;
  stroke: #aaa;
}

div >>> circle {
  fill-opacity: 0.7;
}

div >>> circle.hidden {
  fill: #ccc !important;
}

div >>> .extent {
  fill: #000;
  fill-opacity: 0.125;
  stroke: #fff;
}
</style>
<script>
import * as d3 from "d3";
//import ScatterPlot from "@/components/Scatterplot.js";
import views from "@/components/constants.js";
import { operations, getOperationFromEvent } from "@/components/operations.js";
import { mapState } from "vuex";

export default {
  name: "ClusterView",
  //props: ["chartData"],
  data: function() {
    return {
      data: null,
      viewID: null,
      chart: null,
      xColumn: "TotalFlrArea",
      yColumn: "EnergyUse",
      colorColumn: "collection",
    /*  xColumn: "overhang_area_fraction",
      yColumn: "objective_value",*/

      width: 600,
      height: 450,
      clusterReps: []
    };
  },
  computed: {
    ...mapState({ chartData: state => state.data }),
  },
  mounted()
   {


    //this.chart = this.createChart();
    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this
    });

    var clusters = kmeans(this.chartData,4, function(d) {return d['TotalFlrArea']})
    var centroids = clusters.map(c => d3.mean(c, d => d['TotalFlrArea']))
    var closest = clusters.map((c,i) => 
        {
            return indexOfSmallest(c.map( d =>  Math.abs(centroids[i] - d['TotalFlrArea'])))
        }
    )
    clusterReps = [];
    for(var i = 0; i < closest.length;i++)
    {
        clusterReps.push(this.chartData[closest[i]])
    }
 
   
  },
  watch: {
    width: function(newValue, oldValue) {
      this.createChart();
    },
    height: function(newValue, oldValue) {
      this.createChart();
    },
    chartData: {
      handler: function(newValue, oldValue) {
        this.chart = this.createChart();

      }
    }
  },
  created() {
    this.viewID = "id" + this._uid;

    this.$store.subscribe((mutation, state) => {
      if (mutation.type === "update" || mutation.type === 'resetMarking') {
        var result = this.$store.getters.selectedInView(this.viewID);

       this.chart.highlight(result);

      }
    });
  },
  methods: {
    createChart: function() {
    

    },
    destroyChart: function() {
      let node = d3.select("#"+this.viewID)._groups[0][0];//this.$refs["parcoords"];
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    }
  }
};

function indexOfSmallest(a) {

 var lowest = 0;
 for (var i = 1; i < a.length; i++) {
      
  if (a[i] < a[lowest]) lowest = i;
 }
 return lowest;
}
function kmeans(arrayToProcess, numberOfClusters, accessor) {
  var groups = new Array();
  var centroids = new Array();
  var oldCentroids = new Array();
  var changed = false;
  /*
   * 1. no accessor provided
   * 2. accessor returns a single value (1-dimensional)
   * 3. accessor returns an array (multi-dimentioanl)
   */
  if (!accessor) {
    accessor = function (d) { return [d]; };
  }

  var dist = function (a, b) {
    a = (typeof a === Array) ? a : [a];
    b = (typeof b === Array) ? b : [b];
    if (a.length !== b.length) {
      throw "Number of dimensions not aligned between data points."
    }

    var ds = 0;
    for (var i = 0; i < a.length; i++) {
      ds += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(ds);
  };

  var calCentroid = function (group) {
    var centroid = [];
    var dim = group[0].length;
    for (var i = 0; i < dim; i++) {
      centroid.push(
        group.map(function (p) { return p[i]; })
          .reduce(function (prevVal, currVal) {
            return prevVal + currVal;
          }, 0) / group.length);
    }
    return centroid;
  };

  var moveCentroids = function (groups) {
    return groups.map(calCentroid);
  };

  var identicalCoordinate = function(a, b) {
     
    for (var d = 0; d <= a.length; d++) 
    {
        
      if (a[d] !== b[d]) return false;
    }
    return true;
  };

  var existsIn = function(basket, p) 
  {
    for(var j = 0; j <= basket.length; j++) {
      if (identicalCoordinate(basket[j], p)) {
        return true;
      }
    }
    return false;
  };

  var centroidsChanged = function (oldSet, currSet) {
    // every old centroid should be found in new set, otherwise consider centroids changed
    for (var i = 0;i < oldSet.length; i++) {
      if (!existsIn(currSet, oldSet[i])) return true;
    }
    return false;
  };

  // initialise group arrays
  for (var initGroups = 0; initGroups < numberOfClusters; initGroups++) {
    groups[initGroups] = new Array();
  }

  // hop for systemical sampling
  var hop = Math.round(arrayToProcess.length / (numberOfClusters + 1));
  var i, j, idx;

  for (i = 0; i < numberOfClusters; i++) {
    idx = hop * (i + 1);
    centroids[i] = accessor(arrayToProcess[idx]);
  }

  do {
    for (j = 0; j < numberOfClusters; j++) {
      groups[j] = [];
    }

    changed = false;

    for (i = 0; i < arrayToProcess.length; i++) {
      var distance = -1;
      var oldDistance = -1
      var newGroup;
      for (j = 0; j < numberOfClusters; j++) {
        distance = dist(centroids[j], accessor(arrayToProcess[i]));
        if (oldDistance == -1) {
          oldDistance = distance;
          newGroup = j;
        } else if (distance <= oldDistance) {
          newGroup = j;
          oldDistance = distance;
        }
      }
      groups[newGroup].push(arrayToProcess[i]);
    }

    oldCentroids = centroids;
    centroids = moveCentroids(groups);
    changed = centroidsChanged(oldCentroids, centroids);
  } while (changed == true);

  return groups;
}
if (typeof d3 !== "undefined") {
  d3.kmeans = kmeans;
}
</script>

