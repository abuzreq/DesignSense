import Vue from 'vue';
import App from './App';
import router from "./router";
import store from "./store";
import vuetify from "./plugins/vuetify";
import * as d3 from "d3";
import vdr from "./plugins/vdr";
import layouts from './layout.js'
import Papa from 'papaparse'
import {generateID} from "@/components/utils.js";


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

      //data = data.slice(0,50)    

      Papa.parse("https://gist.githubusercontent.com/abuzreq/41784c98a70e36619d046877e0df8c02/raw/cb52f39c7f0f1c526d5c1bf0dea61993d368fe68/smart_hausdorff_ids.csv", {
        download: true,
        complete: function (results) {
          let similarity_map = {}
          let similarity = results.data;
          let headers = similarity[0];
          similarity.forEach((row, i) => {
            if (i > 0) {
              let entry = {}
              row.forEach((x, j) => {
                if (j > 0) {
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
            store: store(data, dataTypesMap, layouts, similarity_map),
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
 
  if (e.key === 'Control') 
  {
    if (!app.$store.state.isCtrlKey) 
    {
      app.$store.dispatch('updateCtrlKey', { value: true })
      /*
        //console.log(app.$store.state)
        let views = Object.keys(app.$store.state.viewsMap)
        console.log(views, app.$store.state.viewsMap)
        //console.log("views ", views)
        app.$store.dispatch('createDetailsView',{master_view: views[0], details_view: views[1]})
      */
    }
  }
})
document.addEventListener('keyup', function (e) {
  if (e.key === 'Control') {
    app.$store.dispatch('updateCtrlKey', { value: false })
    app.$store.commit("hover", { hovered: null });
  }

  if (e.keyCode === 192) {
    app.$store.commit('toggleEditingMode');
  }
})


let globalURL = "http://sr-02645.iat.sfu.ca:5052"
globalURL = "http://142.58.183.69:5051"
//globalURL = "http://142.58.183.69:5050"
//loadDataFromURL(globalURL, "/alternatives")


function loadData(data) {

  var dataTypesMap = {}
  for (var column of Object.keys(data[0])) {
    if (isNaN(data[0][column]) || column == '_id' || column == 'ID') {
      dataTypesMap[column] = 'string'
    }
    else {
      dataTypesMap[column] = 'Float'
    }

    // dataTypesMap[column] = typeof data[0][column]//json_data.valueBands[column].type
  }
  console.log(dataTypesMap)
  console.log(data)

  //data = data.slice(0,25)
  app = new Vue({
    vuetify,
    vdr,
    router,
    store: store(data, dataTypesMap, layouts, {}),
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
//export default {loadDataFromURL, loadDataFromCloudURL}
//exports.loadDataFromURL = opeloadDataFromURLrations;
//exports.loadDataFromCloudURL = loadDataFromCloudURL;
export { loadDataFromURL, loadDataFromCloudURL }

/*******************        Design Explorer ********************** */

function loadDataFromCloudURL(rawUrl) {
  console.log("Hello  Worlds")
  checkInputLink(rawUrl, function (d) {
    // _folderInfo = d; //set global fodler obj
    console.log("url, ", d)
    if (d.type === "userServerLink") {
      //this is a user's server link, and load csv directly
      readyToLoad(d.url + "data.csv");
    } else {
      //this is from Google or MS
      prepareGFolder(d);
    }
  })
}
function prepareGFolder(folderLink) {

  let _googleReturnObj = { //{"fileName":Google Drive ID}
    csvFiles: {},
    imgFiles: {},
    jsonFiles: {},
    settingFiles: {}
  };

  var folder = {
    "DE_PW": "", // short code from google or base64 coded inLink
    "inLink": "", //raw url
    "url": "",  //url to load the list item inside the folder
    "type": "" //folder type : GoogleDrive, OneDrive, or userServerLink
  }
  //_folderInfo = folderLink;

  folder = folderLink;

  d3.json(folder.url).then(function (data) {

    var csvFiles = {};
    var imgFiles = {};
    var jsonFiles = {};
    var settingFiles = {};

    if (folder.type === "GoogleDrive") { //this is google returned obj
      data.files.forEach(function (item) {
        var GLink = "";
        //googleReturnObj[item.name]=item.id

        if (item.mimeType === "text/csv") {
          GLink = "https://www.googleapis.com/drive/v3/files/" + item.id + "?alt=media&key=" + Gkey;
          //this item is a data csv file
          csvFiles[item.name] = GLink;

        } else if (item.mimeType.startsWith("image")) {
          GLink = "https://docs.google.com/uc?id=" + item.id + "&export=download";
          //this item is a image file
          imgFiles[item.name] = GLink;

        } else if (item.mimeType === "application/json") {
          GLink = "https://www.googleapis.com/drive/v3/files/" + item.id + "?alt=media&key=" + Gkey;

          if (item.name.startsWith("setting")) {
            //this item is a Design Explore's setting file 
            settingFiles[item.name] = GLink;
          } else {
            //this item is a json model
            jsonFiles[item.name] = GLink;
          }
        }

      });

    } else if (folder.type === "OneDrive") { //this is OneDrive returned obj
      var files = [];

      if (data.children !== undefined) {
        files = data.children;
      } else if (data.value !== undefined) {
        files = data.value;
      }

      files.forEach(function (item) {
        //googleReturnObj[item.name]=item.id
        var fileName = item.name;
        var fileType = item.file.mimeType;
        var fileLink = item["@content.downloadUrl"];

        if (fileName.toLowerCase().endsWith(".csv")) {
          //this item is a data csv file
          csvFiles[fileName] = fileLink;//{"fileName":"fileURL"}

        } else if (fileType.startsWith("image")) {
          //this item is a image file
          imgFiles[fileName] = fileLink;

        } else if (fileType === "application/json") {

          if (fileName.startsWith("setting")) {
            //this item is a Design Explore's setting file 
            settingFiles[fileName] = fileLink;
          } else {
            //this item is a json model
            jsonFiles[fileName] = fileLink;
          }
        }

      });
    }
    _googleReturnObj.csvFiles = { ..._googleReturnObj.csvFiles, ...csvFiles }
    _googleReturnObj.imgFiles = { ..._googleReturnObj.imgFiles, ...imgFiles }
    _googleReturnObj.jsonFiles = { ..._googleReturnObj.jsonFiles, ...jsonFiles }
    _googleReturnObj.settingFiles = { ..._googleReturnObj.settingFiles, ...settingFiles }

    console.log(_googleReturnObj);

    if (data.nextPageToken !== undefined) {

      if (folder.url.search("&pageToken=") > 0) {
        folder.url = folder.url.split("&pageToken=", 1)[0];
      }

      folder.url += "&pageToken=" + data.nextPageToken

      prepareGFolder(folder);

    } else if (data["children@odata.nextLink"] !== undefined) {

      folder.url = data["children@odata.nextLink"];

      prepareGFolder(folder);

    } else if (data["@odata.nextLink"] !== undefined) {

      folder.url = data["odata.nextLink"];

      prepareGFolder(folder);

    } else { //this is the last page, so return googleReturnObj directly

      var csvFile = _googleReturnObj.csvFiles["data.csv"];

      if (csvFile === undefined) {
        alert("Could not find the data.csv file in this folder, please double check!");
      } else {
        readyToLoad(csvFile, _googleReturnObj.imgFiles, _googleReturnObj.jsonFiles);
      }

    }
  });
}

function readyToLoad(csvFilePathLink, imgFiles, jsonFiles) {

  if (csvFilePathLink.length > 0) {
    // remove the current selection
    d3.csv(csvFilePathLink).then(function (data) {
      data = data.map(x => {
        if (!x._id) {
          if (x.ID) {
            x._id = x.ID;
          }
          else {
            x._id = generateID();
          }

        }

        x.image = imgFiles[x.img]
        x.json = jsonFiles[x.threeD]
        return x
      });

      loadData(data)

    });

  } else {
    alert("You have to put Google Drive Folder information first!");
  }

}
function checkInputLink(link, callback) {
  var folderLinkObj = {
    "DE_PW": "",
    "inLink": "",
    "url": "",
    "type": ""
  };

  if (link.includes("google.com")) {

    var GFolderID = getGFolderID(link);
    //folderLinkObj.DE_PW = "DE_G"; 
    folderLinkObj.url = "https://www.googleapis.com/drive/v3/files?q=%27" + GFolderID + "%27+in+parents&key=" + Gkey;
    folderLinkObj.type = "GoogleDrive";

  } else if (link.includes("1drv.ms")) {

    //"https://1drv.ms/f/s!Avr4WH-N5Us-hNEf3V-AWTUuvsVZBQ"; 
    //document.getElementById("folderLinkID").value = serverFolderLink;
    //folderLinkObj.DE_PW = "DE_O";
    folderLinkObj.url = "https://api.onedrive.com/v1.0/shares/u!" + encodeUrl(link) + "/root?expand=children";
    folderLinkObj.type = "OneDrive";

  } else {
    //folderLinkObj.DE_PW = "DE_S";
    if (link.slice(-1) !== "/") {
      link += "/";
    }

    folderLinkObj.url = link;
    folderLinkObj.type = "userServerLink";
  }


  folderLinkObj.inLink = link;
  // console.log(folderLinkObj);
  callback(folderLinkObj);

}


function encodeUrl(url) {
  // var link = btoa(url).slice(0, -1).replace('/','_').replace('+','-');
  var link = btoa(url);
  return link;
}

function decodeUrl(encodedString) {
  // var url = atob(encodedString.replace('_','/').replace('-','+')+"=");
  var url = "";
  try {
    url = atob(encodedString);
  } catch (err) {
    console.log(err.message + " But fixed:>");
    url = atob(encodedString.replace('_', '/').replace('-', '+') + "=");
  }

  return url;
}

function getGFolderID(link) {
  var linkID;

  if (link.includes("google.com")) {

    if (link.includes("?usp=sharing")) {
      linkID = link.replace("?usp=sharing", "");
    } else if (link.includes("open?id=")) {
      linkID = link.replace("open?id=", "");
    } else {
      linkID = link;
    }

    linkID = linkID.split("/");
    linkID = linkID[linkID.length - 1];

  } else {
    //server link or ms
    linkID = link;
  }

  return linkID;
}

function CopyToClipboard(element) {
  var $temp = $("<input>");
  $("body").append($temp);
  $temp.val($(element).text()).select();
  document.execCommand("copy");
  $temp.remove();
}

function makeUrlId(rawUrl, callback) {
  var longUrl = rawUrl;

  $.ajax({
    type: 'POST',
    contentType: 'application/json',
    url: "https://api-ssl.bitly.com/v4/shorten",
    data: JSON.stringify({
      "long_url": longUrl
    }),
    headers: {
      'Authorization': BitlyKey,
      'Content-Type': 'application/json'
    },
    error: function (e) {
      callback(encodeUrl(longUrl));
    },
    dataType: 'json',
    success: function (response) {
      var UrlID = "";
      if (response.id != null) {
        //response.id:  https://goo.gl/bMOO
        UrlID = response.id.split("/");
        UrlID = UrlID[UrlID.length - 1];  //UrlID: bMOO

      }
      callback("BL_" + UrlID);
    }
  });
}

function getUrlID(urlID, callback) {
  $.ajax({
    url: "https://api-ssl.bitly.com/v4/expand",
    type: 'POST',
    dataType: 'json',
    data: JSON.stringify({
      "bitlink_id": "bit.ly/" + urlID
    }),
    headers: {
      'Authorization': BitlyKey
    },
    contentType: 'application/json',
    success: function (result) {
      callback(result.long_url);
    },
    error: function (error) {

    }
  });
}

function decodeUrlID(rawUrl, callback) {
  var serverFolderLink = "";
  var urlVars = getUrlVars(rawUrl);
  var GfolderORUrl = urlVars.GFOLDER;
  var DEID = urlVars.ID;

  //old GFOLDER
  if (GfolderORUrl !== undefined) {

    if (GfolderORUrl.search("/") == -1) {
      //GfolderORUrl is google folder ID
      serverFolderLink = "https://drive.google.com/drive/folders/" + GfolderORUrl;
    } else {
      serverFolderLink = GfolderORUrl;
    }

    callback(serverFolderLink);

  } else if (DEID !== undefined) {

    //linkID = rawUrl.split("/");
    //linkID = linkID[linkID.length - 1];
    linkID = DEID;
    //console.log(linkID)

    if (linkID.length === 6) {
      d3.json("https://www.googleapis.com/urlshortener/v1/url?key=" + Gkey + "&shortUrl=http://goo.gl/" + linkID,
        function (d) {
          var GID = (getUrlVars(d.longUrl).ID);
          serverFolderLink = decodeUrl(GID);
          callback(serverFolderLink);
        }
      )
    } else if (linkID.startsWith("BL_")) {
      getUrlID(linkID.replace("BL_", ""), function (d) {
        var GID = (getUrlVars(d).ID);
        serverFolderLink = decodeUrl(GID);
        callback(serverFolderLink);
      })
    } else {
      serverFolderLink = decodeUrl(linkID);
      callback(serverFolderLink);
    }


  } else {

  }


}
