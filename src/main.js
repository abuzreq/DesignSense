import Vue from 'vue';
import App from './App';
import router from "./router";
import store from "./store";
import vuetify from "./plugins/vuetify";
import * as d3 from "d3";
import vdr from "./plugins/vdr";
import layouts from './layout.js'
import Papa from 'papaparse'

Vue.config.productionTip = false;
function loadDataFromURL(url, request) {
  //var collection = "feas";//"c-ZNTs0"
  d3.json(url + request,
    function (d) {
      return d._id;
    })
    .then((json_data, error) => {
      var dataTypesMap = {}
      for (var column in json_data.valueBands) {
        dataTypesMap[column] = json_data.valueBands[column].type
      }



      //console.log("similarity ",similarity)
      console.log(json_data, error)
      json_data = json_data.alternatives
      let data = getParallelDataFromAlternatives(url, json_data)

      data = data.slice(0,100)    

      Papa.parse("https://gist.githubusercontent.com/abuzreq/41784c98a70e36619d046877e0df8c02/raw/cb52f39c7f0f1c526d5c1bf0dea61993d368fe68/smart_hausdorff_ids.csv", {
        download: true,
        complete: function(results) 
        {
          let similarity_map = {}
          let similarity = results.data;
          let headers = similarity[0];
          similarity.forEach((row,i) => {
            if(i > 0)
            {
              let entry = {}
              row.forEach((x,j) => {
                if(j > 0)
                {
                  entry[j] = x; //headers[j]
                }
                
              })
              similarity_map[i] = entry; //row[0]
            }
          })
          app = new Vue({
            vuetify,
            vdr,
            router,
            store: store(data, dataTypesMap, similarity_map, layouts),
            el: '#app',
            render: h => h(App),
          });
    
    
          let args = {}
          //Creates the default marking
          app.$store.commit('createMarkingEntry', args)
          console.log(args)
          console.log(data)
          //app.$store.commit('setSimilarityMap', {'similarity_map': similarity_map});
        }
      })

  

/*
      let sim = Papa.parse("https://gist.githubusercontent.com/abuzreq/6c606acee28f218621b6ca79996cd2a1/raw/6a95738c47cd76e683236b6b383354619f9e5fb4/smart_hausdorff.csv", {
        download: true,
        complete: function(results) 
        {
          let new_similarity = []
          let similarity = results.data;
          similarity.forEach(row => {
            let new_row = []
            row.forEach(x => {
              if (x == "")
              {
                new_row.push(x)
              }
              else if(isNaN(x))
              {
                let item = data.find(d => d.ID === x)
                if(item != undefined)
                {
                  new_row.push(item._id)
                }
                else
                {
                  new_row.push(x)
                }
               
              }
              else
              {
                new_row.push(x)
              }
            })
            new_similarity.push(new_row)
          })
          console.log(new_similarity)
          var csv = Papa.unparse(new_similarity);

          let csvContent = "data:text/csv;charset=utf-8," + csv;
          var encodedUri = encodeURI(csvContent);
            window.open(encodedUri);
        }
      })
    */


    })

}
var app = new Vue({
  vuetify,
  vdr,
  router,
  store: store([{ '_id': 1 }, { '_id': 2 }, { '_id': 3 }, { '_id': 4 }], { '_id': 'String' }, layouts),
  el: '#app',
  render: h => h(App),
});


document.addEventListener('keydown', function (e) {
  if (!app.$store.shiftOn && e.shiftKey) {
    app.$store.shiftOn = true;
  }
  if (!app.$store.altOn && e.altKey) {
    app.$store.altOn = e.altKey;
  }
  if (e.ctrlKey) {
    /*
      //console.log(app.$store.state)
      let views = Object.keys(app.$store.state.viewsMap)
      console.log(views, app.$store.state.viewsMap)
      //console.log("views ", views)
      app.$store.dispatch('createDetailsView',{master_view: views[0], details_view: views[1]})
    */
  }
})
document.addEventListener('keyup', function (e) {
  if (e.keyCode === 16) {
    app.$store.shiftOn = false;
  }

  if (e.keyCode === 18) {
    app.$store.altOn = false;
  }
  if (e.keyCode === 192) {
    app.$store.commit('toggleEditingMode');
  }
})


let globalURL = "http://sr-02645.iat.sfu.ca:5052"
globalURL = "http://142.58.183.69:5051"
//globalURL = "http://142.58.183.69:5050"
loadDataFromURL(globalURL, "/alternatives")


function loadData(data) {

  var dataTypesMap = {}
  for (var column of Object.keys(data[0])) {
    console.log(column)

    dataTypesMap[column] = typeof data[0][column]//json_data.valueBands[column].type
  }
  console.log(dataTypesMap)
  console.log(data)

  app = new Vue({
    vuetify,
    vdr,
    router,
    store: store(data, dataTypesMap, layouts),
    el: '#app',
    render: h => h(App),
  });

  console.log("After", app.$store)
  let args = {}
  //Creates the default marking
  app.$store.commit('createMarkingEntry', args)
  console.log(args)
}



function getParallelDataFromAlternatives(url, altsInCollection) {
  const temp = [];
  const parallelData = [];
  let mergedObject = {};


  altsInCollection.map((alt) => {
    //var blob = b64toBlob(alt.image, { type: 'image/png' })
    //var url = window.URL.createObjectURL(blob)
    var imgURL = url + "/" + alt.image
    var gltfURL = url + "/" + alt.gltf
    var geometryURL = url + "/" + alt.geometry;
    temp.push({ '_id': alt._id, 'ID': alt.tags[0], 'image': imgURL, 'gltf': gltfURL, 'geometry': geometryURL, 'collection': alt.collectionName, ...alt.attributes });
  });

  temp.map((obj) => {
    Object.values(obj).map((o) => {
      if (o) {

        const eachPoint = { [o.key]: o.value };

        mergedObject = Object.assign(mergedObject, { '_id': obj._id }, { 'ID': obj.ID }, { 'image': obj.image }, { 'gltf': obj.gltf }, { 'geometry': obj.geometry }, { 'collection': obj.collection }, eachPoint);
      }
    });
    parallelData.push(mergedObject);
    mergedObject = {};
  });

  parallelData.map((obj) => delete obj.undefined);

  return parallelData;
}
//exports.loadData = loadData;
//exports.loadDataFromURL = loadDataFromURL;
export default loadDataFromURL


