import Vue from 'vue';
import App from './App';
import router from "./router";
import store from "./store";
import * as d3 from "d3";


Vue.config.productionTip = false;


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

let globalURL = "http://sr-02645.iat.sfu.ca:5052"
    var collection = "feas";//"c-ZNTs0"
        d3.json(globalURL + "/alternatives").then( (json_data, error) =>
        {
            console.log(json_data,error)
            json_data = json_data.alternatives
            const data = getParallelDataFromAlternatives(globalURL, json_data)
            new Vue({
              router,
              store: store(data),
              el: '#app',
              render: h => h(App),
            });
        })



