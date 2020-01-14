

<template>
 <v-container>
<v-row>
      <v-col cols="12">
          <div 
              class="parcoords"
              id="parcoords"
              ref="parcoords"
          
              
          ></div >
    </v-col>
    </v-row>
     </v-container>
</template>


<script>
import 'parcoord-es/dist/parcoords.css';
import ParCoords from 'parcoord-es';
import * as d3 from "d3";

let colorRange = d3.scaleOrdinal(d3.schemeCategory10).range();

export default {
  name: "CompareView",
  props: ["chartData", "width", "height", "excluded_dimensions", "colorColumn"],
  mounted() 
  {
    //    style="height:400px;position:absolute"
     this.createChart();
    /*
    let globalURL = "http://sr-02645.iat.sfu.ca:5052"
    var collection = "feas";//"c-ZNTs0"
        d3.json(globalURL + "/alternatives").then( (json_data, error) =>
        {
            console.log(json_data,error)
            json_data = json_data.alternatives
            this.chartData = getParallelDataFromAlternatives(globalURL, json_data)
            this.width = 1400;
            this.height = 450;
            this.colorColumn = 'collection';

            var excluded = ['img','ID'] //'GeometryHash'
            this.excluded_dimensions = []
            for(var e of excluded)
            {
                this.excluded_dimensions.push(e)
            }
            this.createChart();

        })*/
  }, 
  computed:
  {

  },
  methods: {
    createChart: function() 
    {

        ParCoords()(this.$refs["parcoords"])
            .data([
            [0,-0,0,0,0,1],
            [1,-1,1,2,1,1],
            [2,-2,4,4,0.5,1],
            [3,-3,9,6,0.33,1],
            [4,-4,16,8,0.25,1]
            ]).width(1200).height(400)
            .render()
            .createAxes()
            // .reorderable() allows axes to move but does not seem to redraw connections
            .reorderable()
            .brushMode("1D-axes")
    /*
        //this.destroyPrCoords()
        //console.log(d3.select('#parcoords'))
        const chart = ParCoords()("#parcoords")
        .data(this.chartData)
       // .width(this.width)
      //  .height(this.height)
        .hideAxis(this.excluded_dimensions)
        .alpha(1)
        //.margin({ top: 40, left: 20, bottom: 20, right: 20 })
        .brushMode("1D-axes")
        .alphaOnBrushed(0.2) 
        .reorderable().mode("queue")
        .render()
        .createAxes()
        //1D-axes  2D-strums   angular
        var colors = d3.scaleOrdinal(d3.schemeCategory10)//d3.scale.ordinal().range(colorRange);
        chart.color(d => colors(d[this.colorColumn])).render()
*/
    }, 
    destroyPrCoords: function() {
      let node = this.$refs["parcoords"];
      console.log(node)
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    }
  },
  created(){
     this.$store.watch(
      (state, getters) => getters.data,
      (newValue, oldValue) => 
      {
            this.chartData = newValue;
            //this.createBarChart();
      })
  },
  watch: {
    chartData: {
        handler: function() 
        {
           // this.createChart();
        }, deep :true
    }
  }
};

    function getParallelDataFromAlternatives(url, altsInCollection) {
      const temp = [];
      const parallelData = [];
      let mergedObject = {};


      altsInCollection.map((alt) => {
        //var blob = b64toBlob(alt.image, { type: 'image/png' })
        //var url = window.URL.createObjectURL(blob)
        var imgURL = url + "/" + alt.image
        //console.log(url)
        temp.push({ '_id': alt._id,'ID': alt.tags[0] ,'img': imgURL, 'collection': alt.collectionName, ...alt.attributes });
      });

      temp.map((obj) => {
        Object.values(obj).map((o) => {
          if (o) {

            const eachPoint = { [o.key]: o.value };

            mergedObject = Object.assign(mergedObject, { '_id': obj._id },{ 'ID': obj.ID }, { 'img': obj.img }, { 'collection': obj.collection }, eachPoint);
          }
        });
        parallelData.push(mergedObject);
        mergedObject = {};
      });

      parallelData.map((obj) => delete obj.undefined);

      return parallelData;
    }

</script>

