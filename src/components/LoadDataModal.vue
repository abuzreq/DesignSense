<template>
  <v-container style="width: 200px">
    <div class="text-center">
      <v-dialog v-model="dialog" width="800" overlay-opacity="0.5">
        <template v-slot:activator="{ on, attrs }">
          <v-btn color="red lighten-2" dark v-bind="attrs" v-on="on">
            Load Data
          </v-btn>
        </template>

        <v-card>
          <v-card-title class="headline grey lighten-2">
            Data Loading
          </v-card-title>
          <v-row no-gutters class="row-margins">
            <v-col :cols="11">
              <v-row no-gutters>
                <v-col :cols="2">
                  <span>Enter a URL:&emsp;</span>
                </v-col>
                <v-col :cols="8">
                  <v-text-field v-model="url" clearable> </v-text-field>
                </v-col>
                <v-col :cols="2">
                  <v-btn @click="onInputUrlSubmit">
                    Load
                    <v-icon>mdi-cloud-upload-outline</v-icon>
                  </v-btn>
                </v-col>
              </v-row>
 
            </v-col>
            <v-col :cols="1">
              <v-icon
                v-if="isValid"
                color="green"
                large
                style="display: inline-block"
                >mdi-check</v-icon
              >
            </v-col>
                         <h5 style="color: #9d9d9d; text-align:center;">
                Please put data.csv, images, and 3D-json files into the same
                folder. (<a
                  href="https://tt-acm.github.io/DesignExplorer/design_explorer_data/example/online/example.zip"
                  target="_blank"
                  >example.zip</a
                >)
              </h5>
          </v-row>
          <v-divider></v-divider>
          <v-row no-gutters class="row-margins">
            <v-col :cols="2">
              <span>Pick a Preset Dataset:&emsp;</span>
            </v-col>
            <v-col :cols="10">
              <v-select
                :items="URLs"
                item-text="name"
                return-object
                @change="onUrlChange"
              >
                <v-icon>mdi-select-off</v-icon>
              </v-select>
            </v-col>
            <h5 style="color: #9d9d9d; text-align: center;">
                Please put data.csv, images, and 3D-json files into the same
                folder. (<a href="https://tt-acm.github.io/DesignExplorer/design_explorer_data/example/LocalCSV_example.csv" target="_blank">data.csv</a>)
              </h5>
          </v-row>

          <v-divider></v-divider>
          <v-row no-gutters class="row-margins">
            <v-col :cols="2">
              <span>Upload a Local File:&emsp;</span>
            </v-col>
            <v-col :cols="10">
              <v-tooltip bottom>
                <template v-slot:activator="{ on }">
                  <v-file-input
                    label="File input"
                    outlined
                    dense
                    @change="loadFromCSV($event)"
                  ></v-file-input>
                </template>
                <span>Load</span>
              </v-tooltip>
            </v-col>
          </v-row>

          <!--
            <v-divider></v-divider>
         <v-card-actions>
            <v-btn color="red" text @click="dialog = false"> Close </v-btn>
          </v-card-actions>
      -->
        </v-card>
      </v-dialog>
    </div>
  </v-container>
</template>


<script>
import {
  loadDataFromURL,
  loadDataFromCloudURL,
  loadData,
  prepareData,
} from "../main.js";
const isUrl = require("is-valid-http-url");
import * as d3 from "d3";

export default {
  name: "LoadDataModal",
  data() {
    return {
      dialog: false,
      URLs: [
        {
          name: "Facade (johnmsloane)",
          url:
            "https://drive.google.com/drive/folders/1tXPQpiF3nLAfM7v4tDeG1w2hMAogsuJa?usp=sharing",
          type: "cloud",
        },
        {
          name: "P+W Crofton",
          url:
            "https://drive.google.com/open?id=1QBanCG1t4xak_5lj0Nwazhy5ANHAX_x7",
          type: "cloud",
        },
        {
          name: "P+W Crofton Optimized",
          url:
            "https://drive.google.com/drive/folders/1lH8DYa6y8sinaSDTohfjQ5apyIFFlxF4",
          type: "cloud",
        },
        {
          name: "P+W Solar",
          url: "https://1drv.ms/u/s!AsGWrbL1DmbagakFTScT6VocK9ELbw",
          type: "cloud",
        },
        {
          name: "SmartGeometry",
          url: "http://142.58.183.69:5051",
          type: "server",
        },
        { name: "DreamLens", url: "http://142.58.183.69:5050", type: "server" },
        {
          name: "Malaeeb",
          url: "https://1drv.ms/f/s!AsGWrbL1DmbagaggJpgic85d0z3Sgw",
          type: "cloud",
        },
        {
          name: "Malaeeb_New",
          url:
            "https://drive.google.com/open?id=1LNFH92UGzsLbP07JJJ3fvwMAKlf6FE2h",
          type: "cloud",
        },
        { name: "D*", url: "http://sr-02645.iat.sfu.ca:5052", type: "server" },
        {
          name: "Cars",
          url: "https://1drv.ms/u/s!AsGWrbL1DmbagapOAQDFpMAheHksZw",
          type: "cloud",
        },
        {
          name: "Covid",
          url:
            "https://drive.google.com/drive/folders/1FtHuhukPhaD8Fk9o8cjUH65Pr8ryBmcY?usp=sharing",
          type: "cloud",
        },
        { name: "Local", url: "http://localhost:5050", type: "server" },
      ],
      url: "",
      cloudURL: "",
      // validURLRegex = new RegExp(/^[a-z](?:[-a-z0-9\+\.])*:(?:\/\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:])*@)?(?:\[(?:(?:(?:[0-9a-f]{1,4}:){6}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|::(?:[0-9a-f]{1,4}:){5}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|v[0-9a-f]+\.[-a-z0-9\._~!\$&'\(\)\*\+,;=:]+)\]|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3}|(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=])*)(?::[0-9]*)?(?:\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@]))*)*|\/(?:(?:(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@]))+)(?:\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@]))*)*)?|(?:(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@]))+)(?:\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@]))*)*|(?!(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@])))(?:\?(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@])|[\x{E000}-\x{F8FF}\x{F0000}-\x{FFFFD}\x{100000}-\x{10FFFD}\/\?])*)?(?:\#(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@])|[\/\?])*)?$/i),
    };
  },
  computed: {
    isValid() {
      if (!this.url) return false;

      return isUrl(this.url);
    },
  },
  methods: {
    onInputUrlSubmit() {
      loadDataFromCloudURL(this.url);
    },
    onUrlChange(value) {
      if (value.type === "server") {
        loadDataFromURL(value.url, "/alternatives");
      } else if (value.type === "cloud") {
        loadDataFromCloudURL(value.url);
      }
    },
    onCloudUrlChange() {
      loadDataFromCloudURL(this.cloudURL);
    },
    loadFromCSV(file) {
      console.log(file);
      var reader = new FileReader();

      reader.onload = function (e) {
        var inputString = e.target.result;

        // I need to add some defense here
        // separateInputOutputs(e);

        var data = d3.csvParse(inputString);
        loadData(prepareData(data));
      };
      reader.readAsText(file);
    },
  },
};
</script>

<style scoped>
.row-margins {
  margin: 25px 25px 25px 25px;
}
</style>