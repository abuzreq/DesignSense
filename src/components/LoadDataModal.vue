<template>
  <v-container style="width: auto; padding: 0 4px">
    <div class="text-center">
      <v-dialog v-model="dialog" width="760" overlay-opacity="0.5">
        <template v-slot:activator="{ on, attrs }">
          <v-btn
            color="red lighten-2"
            dark
            :small="compact"
            class="load-data-button"
            title="Load data"
            v-bind="attrs"
            v-on="on"
          >
            <v-icon left :small="compact" class="load-data-icon"
              >mdi-folder-open-outline</v-icon
            >
            <span class="load-data-label">Load Data</span>
          </v-btn>
        </template>

        <!-- A file can be dropped anywhere on the dialog. Enter and leave
             fire for every element crossed, so a depth count says when the
             file has really left. -->
        <v-card
          :class="{ 'load-card--drop': dragDepth > 0 }"
          @dragenter.prevent="dragDepth += 1"
          @dragleave="dragDepth = Math.max(0, dragDepth - 1)"
          @dragover.prevent
          @drop.prevent="onDrop"
        >
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

            <!-- First, as the quickest way to something to explore. -->
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
              A folder holds data.csv next to the images and 3D files it names
              (<a
                href="https://tt-acm.github.io/DesignExplorer/design_explorer_data/example/online/example.zip"
                target="_blank"
                >Design Explorer example</a
              >). Keep everything in one folder on a web server, such as a
              GitHub repository — for files on GitHub, use the Raw link. Google
              Drive folders can't be read, and OneDrive folders only from some
              accounts; download those and load the CSV from your computer.
            </p>

            <v-expansion-panels flat class="load-help">
              <v-expansion-panel>
                <v-expansion-panel-header>
                  How the columns are read
                </v-expansion-panel-header>
                <v-expansion-panel-content>
                  <p>
                    <strong>Inputs and outputs</strong> — start a design
                    parameter's column with <code>in:</code> and a result's
                    with <code>out:</code>, as in <code>in:width</code> or
                    <code>out:cost</code>. The prefix doesn't show in the
                    interface. The parallel coordinates draw outputs in blue,
                    and the Analysis panel reads how the inputs move the
                    outputs;
                    without the prefixes it asks you to pick them each time.
                  </p>
                  <p>
                    <strong>Goals</strong> — start an output with
                    <code>min:</code> when lower is better, or
                    <code>max:</code> when higher is, as in
                    <code>min:cost</code> or <code>max:daylight</code>. Pareto
                    fronts, weighted dimensions and the analysis read which way
                    is better, and the parallel coordinates put better at the
                    top. You can also set goals, or change them, in the
                    Dimensions dialog.
                  </p>
                  <p>
                    <strong>Your own criteria</strong> — <code>custom:</code>
                    and <code>weighted:</code> columns come back as custom and
                    weighted dimensions, which is how DesignSense writes them
                    when it saves a file.
                  </p>
                  <p class="mb-0">
                    <strong>Everything else</strong> is kept as it is: numbers
                    become axes to filter by, text shows in the details and in
                    Compare. An <code>ID</code> column names each option.
                  </p>
                </v-expansion-panel-content>
              </v-expansion-panel>
              <v-expansion-panel>
                <v-expansion-panel-header>
                  Naming images and 3D files
                </v-expansion-panel-header>
                <v-expansion-panel-content>
                  <p>
                    <strong>Images</strong> — <code>img</code> (or
                    <code>image</code>) is the first view; <code>img_2</code>,
                    <code>img_3</code> … are the others. Upper or lower case
                    doesn't matter. A column called <code>image_url</code> is
                    not picked up.
                  </p>
                  <p>
                    <strong>3D</strong> — <code>model3d</code> (or
                    <code>3d</code>, or Design Explorer's
                    <code>threeD</code>) is the first model, then
                    <code>model3d_2</code> and so on.
                  </p>
                  <p>
                    <strong>Formats</strong> — .glb, .gltf, .obj and the .json
                    scenes Design Explorer shows, as Spectacles exports them
                    from Grasshopper. A .obj picks up a .mtl of the same name
                    from the same folder; a .glb is one self-contained file, so
                    it is the one that always works.
                  </p>
                  <p class="mb-0">
                    In a OneDrive folder, where DesignSense can read the list
                    of files, you can skip the extra columns: a file named
                    <code>12_2.png</code> beside
                    <code>12.png</code> becomes that option's second view, and
                    <code>12.glb</code> becomes its model.
                  </p>
                </v-expansion-panel-content>
              </v-expansion-panel>
              <v-expansion-panel>
                <v-expansion-panel-header>
                  Exporting 3D from Rhino and Grasshopper
                </v-expansion-panel-header>
                <v-expansion-panel-content>
                  <p>
                    <strong>Rhino 8</strong> — select the geometry, then
                    <em>File ▸ Export Selected</em> and choose glTF from the
                    file-type list (Options sets materials and compression).
                  </p>
                  <p>
                    <strong>Rhino 7</strong> — install McNeel's glTF exporter
                    from the Package Manager, or export
                    <em>Wavefront (.obj)</em> instead, ticking
                    <em>Map Rhino Z to OBJ Y</em> so the model stands upright.
                  </p>
                  <p class="mb-0">
                    <strong>Grasshopper</strong> — bake the geometry into Rhino
                    first (right-click ▸ Bake), then export as above. Export one
                    file per option and name it like that option's image.
                  </p>
                </v-expansion-panel-content>
              </v-expansion-panel>
            </v-expansion-panels>

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
              :placeholder="
                dragDepth > 0 ? 'Drop it to load' : 'Choose a CSV file, or drop one here'
              "
              :disabled="loadState.loading"
              :loading="isLoading('file')"
              @change="loadFile"
            />
            <p class="load-hint">
              The image and 3D columns of a local file need public links (<a
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
import { PRESETS } from "@/data/presets.js";

export default {
  name: "LoadDataModal",
  props: {
    // A smaller button, for the app bar.
    compact: { type: Boolean, default: false },
  },
  data() {
    return {
      dialog: false,
      presets: PRESETS,
      selectedPreset: null,
      url: "",
      // Remounting the file input lets the same file be chosen again.
      fileInputKey: 0,
      // How many elements of the dialog a dragged file is over; above zero
      // while it is over the dialog at all.
      dragDepth: 0,
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
    /** A file dropped on the dialog loads as one chosen with the input would. */
    onDrop(event) {
      this.dragDepth = 0;
      let files = event.dataTransfer && event.dataTransfer.files;
      if (files && files.length > 0) this.loadFile(files[0]);
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
.load-help {
  margin-top: 8px;
}
.load-help ::v-deep .v-expansion-panel-header {
  min-height: 36px;
  padding: 0;
  font-size: 13px;
  color: #1565c0;
}
.load-help ::v-deep .v-expansion-panel-content__wrap {
  padding: 0 0 8px;
  font-size: 13px;
  color: #37474f;
}
.load-help code {
  background: #eceff1;
  color: #263238;
  box-shadow: none;
  font-size: 12px;
}
.load-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #546e7a;
}
/* A file is being dragged over the dialog. */
.load-card--drop {
  outline: 2px dashed #1976d2;
  outline-offset: -6px;
}
.preset-info {
  max-width: 620px;
  white-space: normal;
}
</style>
