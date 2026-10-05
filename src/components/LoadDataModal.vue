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

        <!-- A file or a folder can be dropped anywhere on the dialog. Enter
             and leave fire for every element crossed, so a depth count says
             when it has really left. -->
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
                rel="noopener"
                >Design Explorer example</a
              >). Keep everything in one folder on a web server, such as a
              GitHub repository — for a file on GitHub, the address of its
              page works. Google Drive folders can't be read, and OneDrive
              folders only from some accounts; download those and choose the
              folder below.
            </p>
            <p class="load-hint">
              Made in Grasshopper with Colibri? The guide has
              <a
                :href="guide.generate"
                target="_blank"
                @click.prevent="openGuide('generate')"
                >how a study is made</a
              >,
              <a
                :href="guide.format"
                target="_blank"
                @click.prevent="openGuide('format')"
                >the file format</a
              >
              and
              <a
                :href="guide.link"
                target="_blank"
                @click.prevent="openGuide('link')"
                >putting a study on GitHub</a
              >.
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
                  <p>
                    <strong>Everything else</strong> is kept as it is: numbers
                    become axes to filter by, text shows in the details and in
                    Compare. An <code>ID</code> column identifies each option,
                    and a <code>name:</code> column says what to call it.
                  </p>
                  <p class="mb-0">
                    <a
                      :href="guide.format"
                      target="_blank"
                      @click.prevent="openGuide('format')"
                      >The file format, in the guide</a
                    >
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
                    In a folder from your computer or from OneDrive, where
                    DesignSense can read the list of files, you can skip the
                    extra image columns: a file named
                    <code>12_2.png</code> beside
                    <code>12.png</code> becomes that option's second view.
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
                  <p>
                    <strong>Grasshopper</strong> — bake the geometry into Rhino
                    first (right-click ▸ Bake), then export as above. Export one
                    file per option and name it like that option's image.
                  </p>
                  <p class="mb-0">
                    <a
                      :href="guide.models"
                      target="_blank"
                      @click.prevent="openGuide('models')"
                      >3D models, in the guide</a
                    >
                  </p>
                </v-expansion-panel-content>
              </v-expansion-panel>
            </v-expansion-panels>

            <v-divider class="my-4" />

            <div class="load-label">From your computer</div>
            <div class="load-row">
              <v-btn
                color="primary"
                outlined
                class="load-folder-button"
                :disabled="loadState.loading"
                :loading="isLoading('folder')"
                @click="$refs.folderInput.click()"
              >
                <v-icon left small>mdi-folder-open-outline</v-icon>Choose a
                folder
              </v-btn>
              <!-- The browser's own folder picker; the button above is its
                   face. -->
              <input
                ref="folderInput"
                type="file"
                webkitdirectory
                multiple
                hidden
                @change="onFolderChosen"
              />
              <v-file-input
                :key="fileInputKey"
                accept=".csv,.tsv,.txt,text/csv"
                dense
                outlined
                hide-details
                prepend-icon=""
                prepend-inner-icon="mdi-paperclip"
                :placeholder="
                  dragDepth > 0 ? 'Drop it to load' : 'or a CSV file on its own'
                "
                :disabled="loadState.loading"
                :loading="isLoading('file')"
                @change="loadFile"
              />
            </div>
            <p class="load-hint">
              Choose the folder that holds data.csv, or drop it here, and the
              images and 3D files it names come with it: a Colibri folder
              opens as it is. Your browser may call this an upload; the files
              are read where they are and stay on this computer. A CSV file
              on its own shows images only where its cells hold full links (<a
                href="https://tt-acm.github.io/DesignExplorer/design_explorer_data/example/LocalCSV_example.csv"
                target="_blank"
                rel="noopener"
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
import {
  entriesOfDrop,
  filesOfDrop,
  filesOfInput,
  filesOfList,
} from "@/data/localFolder.js";
import { GUIDE_SECTIONS, guideHref } from "@/guide.js";

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
      // Where the guide says more: its address, for opening it elsewhere.
      // A click shows the same section over this dialog (see openGuide).
      guide: {
        generate: guideHref(GUIDE_SECTIONS.generate),
        format: guideHref(GUIDE_SECTIONS.format),
        models: guideHref(GUIDE_SECTIONS.models),
        link: guideHref(GUIDE_SECTIONS.link),
      },
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
    /** The guide's section named `key` in guide.js, over this dialog. */
    openGuide(key) {
      this.$store.dispatch("openGuide", { section: GUIDE_SECTIONS[key] });
    },
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
    /**
     * What is dropped on the dialog loads as if it had been chosen: one file
     * as a CSV on its own, a folder -- or its files, dropped together -- as
     * a folder.
     */
    onDrop(event) {
      this.dragDepth = 0;
      let transfer = event.dataTransfer;
      if (!transfer) return;
      let entries = entriesOfDrop(transfer);
      if (entries.some((entry) => entry.isDirectory)) {
        filesOfDrop(entries).then(this.loadFolder, () => {
          loadState.error = "That folder couldn't be read.";
        });
        return;
      }
      let files = transfer.files;
      if (!files || files.length === 0) return;
      if (files.length === 1) this.loadFile(files[0]);
      else this.loadFolder(filesOfList(files));
    },
    onFolderChosen(event) {
      let files = filesOfInput(event.target.files);
      // Emptied so that choosing the same folder again is still a change.
      event.target.value = "";
      this.loadFolder(files);
    },
    loadFile(file) {
      // Clearing the input reports no file.
      if (!file || loadState.loading) return;
      this.load({ file: file }, "file");
    },
    /** `files` as localFolder.js lists them: `[{ path, file }]`. */
    loadFolder(files) {
      // Cancelling the folder picker reports no files.
      if (!files || files.length === 0 || loadState.loading) return;
      this.load({ folder: files }, "folder");
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
.load-folder-button {
  flex: 0 0 auto;
  height: 40px !important;
  text-transform: none;
  letter-spacing: 0;
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
