

<template>
  <v-container fluid>
      <v-row  align="center" justify="center">
        <v-btn class="ma-1" v-on:click="dotrain = false">Stop</v-btn>
        <v-btn class="ma-1" v-on:click="onStart()">Train</v-btn>
        <v-text-field v-model="learningRate" class="ma-1" label="Learning Rate"></v-text-field>
        <v-text-field v-model="perplexity"  class="ma-1" label="Perplexity"></v-text-field>
        <v-text-field v-model="iteration"  class="ma-1" ></v-text-field>
        <v-text-field v-model="cost"  class="ma-1" ></v-text-field>

    </v-row>
    <div id="tsne" ref="tsne" class="tsne" />
  </v-container>
</template>

<style scoped>
</style>

<script>
import * as d3 from "d3";
import * as tsnejs from '@jwalsh/tsnejs';

let vueThis;
export default {
  name: "TSNEView",
  props: ["chart", "chartData", "width", "learningRate", "perplexity", "numbers","labels","data","models","images","iteration",
  "cost","dotrain"],
  computed: {},
  mounted() {
    vueThis = this;
    this.width = 650;
    this.height = 350;
    this.learningRate = 10;
    this.perplexity = 30;
    //this.initEmbedding();

    var project = "smart";

   
  },
  created() {},
  methods: {
    toarrays: function(json)
    {
        var result = [];

        for(var i in json)
        {
           // if(i != 0)
            {

                result.push(this.toarray(json[i]));
            }  
        }
        return result;
    },
    toarray: function(json)
    {
        var result = [];

        for(var i in json)
        {
            if(i != 0)
            {

                result.push(json[i]);
            }  
        }
        return result;
    },
    onStart: function() {
        this.dotrain = true;
      this.initEmbedding();
        var my_data = this.$store.state.data;
            var distURL = "https://gist.githubusercontent.com/abuzreq/6c606acee28f218621b6ca79996cd2a1/raw/6a95738c47cd76e683236b6b383354619f9e5fb4/smart_hausdorff.csv"
            //"https://gist.githubusercontent.com/abuzreq/12a234c5e1d85b40cb5c9fd1ee796fe5/raw/121e7e50de37ceab06e5cf55820aa22fe81d4e28/smart_hausdorff_raw.csv"
          d3.csv(distURL).
          then((distances) => {
            
            distances = this.toarrays(distances)
            
            distances.pop()
            distances.splice(0,1);
            console.log(distances)
/*
             distances =
              distances
             .slice(1)
              .map(function(d) {
                 console.log(d)
                return d.slice(1, d.length).map(Number);
              });
*/
            // set global
            //var as = JSON.parse(data);

            var all = this.json2data(my_data); // Object.keys(data[0]).map(function(_) { return data[0][_]; })
            //console.log(distances)
            this.numbers = all[0];
            this.labels = all[1];
            this.models = all[2];
            this.images = all[3];

            console.log(all)
      
            this.data = distances;
            //console.log(distances)
            //var colorRange = d3.scale.category10().range();
            var colorRange = d3.scaleOrdinal(d3.schemeCategory10).range();
/*
            var colors = d3.scale
              .ordinal()
              .domain(models)
              .range(colorRange);
*/
            dataok = true;

            if (!dataok) {
              // this is so terrible... globals everywhere #fasthacking #sosorry
              alert(
                "there was trouble with data, probably rows had different number of elements. See console for output."
              );
              return;
            }
            //preProLabels();
            if (this.labels.length > 0) {
              if (this.data.length !== this.labels.length) {
                alert(
                  "number of rows in Text labels (" +
                    this.labels.length +
                    ") does not match number of rows in Data (" +
                    this.data.length +
                    ")! Aborting."
                );
                return;
              }
            }

            // ok lets do this
            opt = {
              epsilon: this.learningRate,
              perplexity: this.perplexity ,
              dim: this.data[0].length
            };
            T = new tsnejs.tSNE(opt); // create a tSNE instance
            //TODO was there to handle both types of inputs,, may adjust later to propoerly choose the right data format and subset
            ///var dfv = $("input[name=rdata]:checked", "#datatypeform").val(); 
            var dfv = "dist";

            if (dfv === "raw") {
              console.log("raw");
              T.initDataRaw(this.data);
            }
            if (dfv === "dist") {
              console.log("dist");
              T.initDataDist(this.data);
            }
            this.drawEmbedding();
            iid = setInterval(this.step, 10);
            this.dotrain = true;
          });
    },
    updateEmbedding: function() {
      // get current solution
      var Y = T.getSolution();
      console.log(T)
      // move the groups accordingly
      gs.attr("transform", function(d, i) {
        return (
          "translate(" +
          (Y[i][0] * 20 * ss + tx + 400) +
          "," +
          (Y[i][1] * 20 * ss + ty + 400) +
          ")"
        );
      });
    },
    initEmbedding: function() {
      d3.select("#tsne").empty();
      var div = d3.select("#tsne");
      svg = div
        .append("svg") // svg is global
        .attr("width", this.width)
        .attr("height", this.height);
    },
    drawEmbedding: function() {
        console.log(this.data)
      gs = svg
        .selectAll(".b")
        .data(this.data)
        .enter()
        .append("g")
        .attr("class", "u");
        /*
        .attr("ID", function(d, i) {
          return labels[i];
        });*/

      cs = gs
        .append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 5)
        .attr("stroke-width", 1)
        .attr("stroke", "black")
        .attr('fill','rgb(100,100,255)')
       /* .attr("fill", (d, i) => {
          return colors(models[i]);
        }); //TODO*/
      console.log(cs);

      var imgs = gs
        .append("svg:image")
        .attr("xlink:href", function(d, i) {
          return vueThis.images[i];
        })
        .attr("x", function(d) {
          return -25;
        })
        .attr("y", function(d) {
          return -25;
        })
        .attr("height", 50)
        .attr("width", 50)
        .on("mouseover", function(d, i) {
          d3.select(this).attr({ width: 200, height: 200 });
        })
        .on("mouseout", function(d, i) {
          d3.select(this).attr({ width: 50, height: 50 });
        });

      if (this.labels.length > 0) {
        ts = gs
          .append("text")
          .attr("text-anchor", "top")
          .attr("transform", "translate(5, -5)")
          .attr("font-size", 10)
          .attr("fill", "#333")
          .text(function(d, i) {
            return vueThis.labels[i];
          });
      }

      var zoomListener = d3
        .zoom()
       // .scaleExtent([0.1, 20])
       // .center([0, 0])
        .on("zoom", this.zoomHandler);
    
    svg.call(zoomListener);
      //zoomListener(svg);
    },
    json2data: function(json) {
      var labels = [];
      var result = [];
      var models = [];
      var images = [];
      for (var item of json) {
        var arr = [];
        var keys = Object.keys(item);
        keys.forEach(function(key) {
          if (key == "ID") {
            labels.push(item[key]);
          } else if (key == "collection") {
            models.push(item[key]);
          } else if (key == "image") {
            images.push(item.image);
          } else if (key != "GeometryHash") {
            arr.push(item[key]);
          }
        });
        result.push(arr);
      }
      return [result, labels, models, images];
    },
    step: function() {
      if (this.dotrain) {
        var cost = T.step(); // do a few steps
        this.iteration = T.iter;
        this.cost = cost;
        //$("#cost").html("iteration " + T.iter + ", cost: " + cost);
      }
      this.updateEmbedding();
    },
    zoomHandler: function() {
      tx = d3.event.translate[0];
      ty = d3.event.translate[1];
      ss = d3.event.scale;
    }
  }
};

var T, opt;
var Y; // tsne result stored here
var data;
var svg;
var gs;
var cs;
var ts;

var tx = 0,
  ty = 0;
var ss = 1;

var stepnum = 0;

var dataok = false;

var iid = -1;

</script>

