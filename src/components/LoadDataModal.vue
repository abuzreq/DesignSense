<template>
  <v-container style="width: auto; padding: 0 4px">
    <div class="text-center">
      <v-dialog v-model="dialog" width="760" overlay-opacity="0.5">
        <template v-slot:activator="{ on, attrs }">
          <v-btn
            color="red lighten-2"
            dark
            class="load-data-button"
            title="Load data"
            v-bind="attrs"
            v-on="on"
          >
            <v-icon left class="load-data-icon">mdi-folder-open-outline</v-icon>
            <span class="load-data-label">Load Data</span>
          </v-btn>
        </template>

        <v-card>
          <v-card-title class="headline grey lighten-2">Load data</v-card-title>
          <v-progress-linear
            :active="loadState.loading"
            indeterminate
            height="3"
            color="primary"
          />

          <v-card-text class="pt-4">
            <v-alert
              v-if="loadState.error"
              type="error"
              dense
              outlined
              dismissible
              class="mb-4"
              @input="dismissError"
              >{{ loadState.error }}</v-alert
            >

            <div class="load-label">From a link</div>
            <div class="load-row">
              <v-text-field
                v-model="url"
                dense
                outlined
                hide-details
                clearable
                :disabled="loadState.loading"
                placeholder="Link to a CSV file, or to a folder holding data.csv"
                @keydown.enter="loadUrl"
              />
              <v-btn
                color="primary"
                depressed
                :disabled="!isValidUrl || loadState.loading"
                :loading="isLoading('url')"
                @click="loadUrl"
                >Load</v-btn
              >
            </div>
            <p class="load-hint">
              A folder should hold data.csv together with its images and 3D json
              files (<a
                href="https://tt-acm.github.io/DesignExplorer/design_explorer_data/example/online/example.zip"
                target="_blank"
                >example.zip</a
              >). Google Drive and OneDrive folders work too. For files on
              GitHub, use the Raw link.
            </p>

            <v-divider class="my-4" />

            <div class="load-label">A prepared dataset</div>
            <div class="load-row">
              <v-select
                v-model="selectedPreset"
                :items="presets"
                item-text="name"
                return-object
                dense
                outlined
                hide-details
                placeholder="Choose a dataset"
                :disabled="loadState.loading"
              >
                <template v-slot:item="{ item }">
                  <v-list-item-content>
                    <v-list-item-title>{{ item.name }}</v-list-item-title>
                    <v-list-item-subtitle v-if="item.info" class="preset-info">{{
                      item.info
                    }}</v-list-item-subtitle>
                  </v-list-item-content>
                </template>
              </v-select>
              <v-btn
                color="primary"
                depressed
                :disabled="!selectedPreset || loadState.loading"
                :loading="isLoading('preset')"
                @click="loadPreset"
                >Load</v-btn
              >
            </div>

            <v-divider class="my-4" />

            <div class="load-label">From your computer</div>
            <v-file-input
              :key="fileInputKey"
              accept=".csv,.tsv,.txt,text/csv"
              dense
              outlined
              hide-details
              prepend-icon=""
              prepend-inner-icon="mdi-paperclip"
              placeholder="Choose a CSV file"
              :disabled="loadState.loading"
              :loading="isLoading('file')"
              @change="loadFile"
            />
            <p class="load-hint">
              The image columns of a local file need public links (<a
                href="https://tt-acm.github.io/DesignExplorer/design_explorer_data/example/LocalCSV_example.csv"
                target="_blank"
                >example data.csv</a
              >).
            </p>
          </v-card-text>

          <v-card-actions>
            <v-spacer />
            <v-btn text @click="dialog = false">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </v-container>
</template>

<script>
import { loadDataset, loadState } from "@/data/loader.js";
const isUrl = require("is-valid-http-url");

const PRESETS = [
  {
    name: "Craigslist - Used Cars",
    url:
      "https://raw.githubusercontent.com/abuzreq/ds_datasets/refs/heads/main/used_cars/data.csv",
    info: "Used cars with their price, year and mileage",
  },
  {
    name: "Simple Box",
    url:
      "https://raw.githubusercontent.com/tt-acm/DesignExplorer/gh-pages/design_explorer_data/LittleRedBox.csv",
    info: "A simple red box (from https://tt-acm.github.io/DesignExplorer/)",
  },
  {
    name: "Façade Design",
    url:
      "https://raw.githubusercontent.com/abuzreq/ds_datasets/refs/heads/main/facade/data.csv",
    info: "Façade panel variations",
  },
  {
    name: "AIA Building",
    url:
      "https://raw.githubusercontent.com/tt-acm/DesignExplorer/gh-pages/design_explorer_data/AIA%20building.csv",
    info:
      "The AIA building dataset (from https://tt-acm.github.io/DesignExplorer/)",
  },
  {
    name: "Windows Exploration",
    url:
      "https://raw.githubusercontent.com/tt-acm/DesignExplorer/gh-pages/design_explorer_data/default_onload.csv",
    info:
      "Exploring impact of windows on lighting/heating (from https://tt-acm.github.io/DesignExplorer/)",
  },
  {
    name: "Massing Study",
    url:
      "https://raw.githubusercontent.com/Zohrehhasanpur/GalleryDesignDataset/main/data.csv",
    info:
      "A generative design dataset exploring different massing for an arts gallery project.",
  },
  {
    name: "Rezoning Project",
    url:
      "https://raw.githubusercontent.com/abuzreq/ds_datasets/refs/heads/main/rezoning/data.csv",
    info: "Form exploration for a rezoning project",
  },
  {
    name: "Solar",
    url:
      "https://raw.githubusercontent.com/abuzreq/ds_datasets/refs/heads/main/solar/data.csv",
    info: "Solar analysis for a tower placement",
  },
  {
    name: "Malaeeb",
    url: "https://drive.google.com/open?id=1LNFH92UGzsLbP07JJJ3fvwMAKlf6FE2h",
    info: "Procedurally generated game puzzles",
  },
  {
    name: "Covid",
    url:
      "https://drive.google.com/drive/folders/1FtHuhukPhaD8Fk9o8cjUH65Pr8ryBmcY?usp=sharing",
    info: "Molecular designs from the Postera.ai crowdsourcing project",
  },
];

export default {
  name: "LoadDataModal",
  data() {
    return {
      dialog: false,
      presets: PRESETS,
      selectedPreset: null,
      url: "",
      // Remounting the file input lets the same file be chosen again.
      fileInputKey: 0,
    };
  },
  computed: {
    loadState() {
      return loadState;
    },
    trimmedUrl() {
      return (this.url || "").trim();
    },
    isValidUrl() {
      return this.trimmedUrl !== "" && isUrl(this.trimmedUrl);
    },
  },
  methods: {
    isLoading(source) {
      return loadState.loading && loadState.source === source;
    },
    loadUrl() {
      if (!this.isValidUrl || loadState.loading) return;
      this.load(this.trimmedUrl, "url");
    },
    loadPreset() {
      if (!this.selectedPreset || loadState.loading) return;
      this.load(this.selectedPreset.url, "preset");
    },
    loadFile(file) {
      // Clearing the input reports no file.
      if (!file || loadState.loading) return;
      this.load({ file: file }, "file");
    },
    /**
     * A load that succeeds mounts a new app, which replaces this dialog; one
     * that fails leaves the dialog open, with the error shown above.
     */
    load(input, source) {
      loadDataset(input, { source: source }).catch(() => {
        this.fileInputKey += 1;
      });
    },
    dismissError() {
      loadState.error = null;
    },
  },
};
</script>

<style scoped>
.load-label {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #37474f;
}
.load-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.load-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #78909c;
}
.preset-info {
  max-width: 620px;
  white-space: normal;
}
</style>
