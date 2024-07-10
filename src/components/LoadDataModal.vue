<template>
  <v-container style="width: 300px">
    <div class="text-center">
      <v-dialog v-model="dialog" width="800" overlay-opacity="0.5">
        <template v-slot:activator="{ on, attrs }">
          <v-btn color="red lighten-2" dark v-bind="attrs" v-on="on">
            Load Data (Start Here!)
          </v-btn>
        </template>

        <v-card style="height: 480px">
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
                  <v-btn
                    style="margin-left: 80px; margin-top: 12px"
                    :disabled="!isValid"
                    @click="onInputUrlSubmit"
                  >
                    Load
                    <v-icon>mdi-cloud-upload-outline</v-icon>
                  </v-btn>
                </v-col>
              </v-row>
            </v-col>
            <h5 style="color: #9d9d9d; text-align: center">
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
            <v-col :cols="8">
              <v-select :items="URLs" item-text="name" return-object>
                <template v-slot:item="data" ripple>
                  <span style="width: 100%" @click="onUrlChange(data.item)">
                    {{ data.item.name }}
                    <h5
                      style="
                        color: #9d9d9d;
                        word-wrap: break-word;
                        width: 600px;
                      "
                    >
                      {{ data.item.info }}
                    </h5>
                  </span>
                </template>
              </v-select>
            </v-col>
            <v-col :cols="2">
              <v-btn
                style="margin-left: 32px; margin-top: 12px"
                :disabled="!currentPresetURL || currentPresetURL == ''"
                @click="onPresetURSubmit"
              >
                Load
                <v-icon>mdi-cloud-upload-outline</v-icon>
              </v-btn>
            </v-col>
          </v-row>

          <v-divider></v-divider>
          <v-row no-gutters class="row-margins">
            <v-col :cols="2">
              <span>Upload a Local File:&emsp;</span>
            </v-col>
            <v-col :cols="10">
              <v-file-input
                label="File input"
                outlined
                dense
                @change="loadFromCSV($event)"
              ></v-file-input>
            </v-col>
            <h5 style="color: #9d9d9d; text-align: center">
              Make sure that the images column in the csv file you upload
              contains public URLs (<a
                href="https://tt-acm.github.io/DesignExplorer/design_explorer_data/example/LocalCSV_example.csv"
                target="_blank"
                >data.csv</a
              >)
            </h5>
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
  readyToLoad,
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
          name: "Simple Box",
          url: "https://raw.githubusercontent.com/tt-acm/DesignExplorer/gh-pages/design_explorer_data/LittleRedBox.csv",
          type: "csv",
          info: "A simple red box (from https://tt-acm.github.io/DesignExplorer/)",
        },
        {
          name: "AIA Building",
          url: "https://raw.githubusercontent.com/tt-acm/DesignExplorer/gh-pages/design_explorer_data/AIA%20building.csv",
          type: "csv",
          info: "The AIA building dataset (from https://tt-acm.github.io/DesignExplorer/)",
        },
        {
          name: "Windows Exploration",
          url: "https://raw.githubusercontent.com/tt-acm/DesignExplorer/gh-pages/design_explorer_data/default_onload.csv",
          type: "csv",
          info: "Exploring impact of windows on lighting/heating (from https://tt-acm.github.io/DesignExplorer/)",
        },
        {
          name: "Massing Study",
          url: "https://raw.githubusercontent.com/Zohrehhasanpur/GalleryDesignDataset/main/data.csv",
          type: "csv",
          info: "A generative design dataset exploring different massing for an arts gallery project.",
        },
        {
          name: "Craiglist - Used Cars",
          url: "https://1drv.ms/u/s!AsGWrbL1DmbagbBL3fsvmKxlMU4TwA",
          type: "cloud",
        },

        /*{
          name: "Rezoning Project (unoptimized)",//P+W Crofton
          url:
            "https://drive.google.com/open?id=1QBanCG1t4xak_5lj0Nwazhy5ANHAX_x7",
          type: "cloud",
          info: "Form exploration for a rezoning project (images not optimized before uploading)",
        },*/
        {
          name: "Rezoning Project",
          url: "https://1drv.ms/u/s!AsGWrbL1DmbagbZU9qBVr1RfDJeDQg", //https://drive.google.com/drive/folders/1lH8DYa6y8sinaSDTohfjQ5apyIFFlxF4
          type: "cloud",
          info: "Form exploration for a rezoning project",
        },
        {
          name: "Solar",
          url: "https://1drv.ms/u/s!AsGWrbL1DmbagakFTScT6VocK9ELbw",
          type: "cloud",
          info: "Solar analysis for a tower placement",
        },
        /*{
          name: "SmartGeometry",
          url: "http://142.58.183.69:5051",
          type: "server",
          info: "Results of a form exploration exercise during Smart Geometry 2018 by multiple designers",
        },*/
        /*{
          name: "DreamLens",
          url: "https://drive.google.com/drive/folders/1L1cxJAXS6AJ0t1q9mIvvpfjC-PXITaw8",
          type: "cloud",
          info: "The dataset from the paper by Autodesk: 'Dream Lens: Exploration and Visualization of Large-Scale Generative Design Datasets'",
        },
        {
          name: "Facade Exploration",
          url: "https://drive.google.com/drive/folders/1tXPQpiF3nLAfM7v4tDeG1w2hMAogsuJa?usp=sharing",
          type: "cloud",
          info: "Performance exploration for facade structures by johnmsloane (big dataset!)",
        },*/
        {
          name: "Malaeeb",
          url: "https://drive.google.com/open?id=1LNFH92UGzsLbP07JJJ3fvwMAKlf6FE2h",
          type: "cloud",
          info: "Procedurally generated game puzzles",
        },
        /*{
          name: "D*",
          url: "http://sr-02645.iat.sfu.ca:5052",
          type: "server",
          info: "",
        },*/

        {
          name: "Covid",
          url: "https://drive.google.com/drive/folders/1FtHuhukPhaD8Fk9o8cjUH65Pr8ryBmcY?usp=sharing",
          type: "cloud",
          info: "Molecular designs from the Postera.ai crowdsourcing project",
        },
        /*{
          name: "Local Host",
          url: "http://localhost:5050",
          type: "server",
          info: "",
        },*/
      ],
      url: "",
      cloudURL: "",
      currentPresetURL: ""
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
      this.currentPresetURL = value;
    },
    onPresetURSubmit() {
      if (this.currentPresetURL.type === "server") {
        loadDataFromURL(this.currentPresetURL.url, "/alternatives");
      } else if (this.currentPresetURL.type === "cloud") {
        loadDataFromCloudURL(this.currentPresetURL.url);
      } else if (this.currentPresetURL.type === "csv") {
        readyToLoad(this.currentPresetURL.url);
      }
    },
    loadFromCSV(file) {
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
