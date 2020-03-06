import Vue from 'vue';
import App from './App';
import router from "./router";
import store from "./store";
import vuetify from "./plugins/vuetify";
import * as d3 from "d3";
import vdr from "./plugins/vdr";
import layouts from './layout.js'


Vue.config.productionTip = false;


function getParallelDataFromAlternatives(url, altsInCollection) {
  const temp = [];
  const parallelData = [];
  let mergedObject = {};


  altsInCollection.map((alt) => {
    //var blob = b64toBlob(alt.image, { type: 'image/png' })
    //var url = window.URL.createObjectURL(blob)
    var imgURL = url + "/" + alt.image
    var gltfURL = url + "/" + alt.gltf
    var geometryURL = url +"/" + alt.geometry;
    temp.push({ '_id': alt._id,'ID': alt.tags[0] ,'image': imgURL,'gltf': gltfURL,'geometry': geometryURL, 'collection': alt.collectionName, ...alt.attributes });
  });

  temp.map((obj) => {
    Object.values(obj).map((o) => {
      if (o) {

        const eachPoint = { [o.key]: o.value };

        mergedObject = Object.assign(mergedObject, { '_id': obj._id },{ 'ID': obj.ID }, { 'image': obj.image },{ 'gltf': obj.gltf },{ 'geometry': obj.geometry }, { 'collection': obj.collection }, eachPoint);
      }
    });
    parallelData.push(mergedObject);
    mergedObject = {};
  });

  parallelData.map((obj) => delete obj.undefined);

  return parallelData;
}

let globalURL = "http://sr-02645.iat.sfu.ca:5052"
 globalURL = "http://142.58.183.69:5051"
 //globalURL = "http://142.58.183.69:5050"
 
    //var collection = "feas";//"c-ZNTs0"
  d3.json(globalURL + "/alternatives",
  function(d)
  {
      return d._id;
  })
  .then( (json_data, error) =>
  {
      var dataTypesMap = {}
      for(var column in json_data.valueBands)
      {
        dataTypesMap[column] = json_data.valueBands[column].type
      }

      console.log(dataTypesMap)
      console.log(json_data,error)
      json_data = json_data.alternatives
      const data = getParallelDataFromAlternatives(globalURL, json_data)
      var app = new Vue({
        vuetify,
        vdr,
        router,
        store: store(data, dataTypesMap, layouts),
        el: '#app',
        render: h => h(App),
      });

      
      document.addEventListener('keydown',  function(e)
      {
        if(!app.$store.shiftOn && e.shiftKey)
        {
          app.$store.shiftOn = true;
        }
        if(!app.$store.altOn && e.altKey)
        {
          app.$store.altOn = e.altKey;
        }
        if(e.ctrlKey)
        {
          app.$store.editingMode = !app.$store.editingMode ;
          console.log("edit= ",app.$store.editingMode)
          /*
            //console.log(app.$store.state)
            let views = Object.keys(app.$store.state.viewsMap)
            console.log(views, app.$store.state.viewsMap)
            //console.log("views ", views)
            app.$store.dispatch('createDetailsView',{master_view: views[0], details_view: views[1]})
          */
        }
      })
      document.addEventListener('keyup',  function(e)
      {
        if(e.keyCode === 16)
        {
          app.$store.shiftOn = false;
        }
           
        if(e.keyCode === 18)
        {
          app.$store.altOn = false;
        }
      })
      let args = {}
      //Creates the default marking
      app.$store.commit('createMarkingEntry', args)
      console.log(args)

  

  })



