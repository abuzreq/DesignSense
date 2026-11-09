<template>
  <v-container style="width: auto; padding: 0 4px">
    <div class="text-center">
      <v-dialog v-model="dialog" width="min(calc(760px * var(--ds-text-scale)), 94vw)" overlay-opacity="0.5">
        <template v-slot:activator="{ on, attrs }">
          <v-btn
            :color="outlined ? 'teal darken-1' : 'red lighten-2'"
            :dark="!outlined"
            :outlined="outlined"
            :depressed="outlined"
            :small="compact"
            class="load-data-button"
            :title="label"
            v-bind="attrs"
            v-on="on"
          >
            <v-icon left :small="compact" class="load-data-icon"
              >mdi-folder-open-outline</v-icon
            >
            <span class="load-data-label">{{ label }}</span>
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
          <v-card-title class="load-title">
            Load data
            <v-spacer />
            <v-btn icon aria-label="Close" @click="dialog = false">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-card-title>
          <v-progress-linear
            :active="loadState.loading"
            indeterminate
            height="3"
            color="primary"
          />

          <v-card-text class="load-body">
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

            <!-- Three ways in, each a card of its own: a sample first, as the
                 quickest way to something to explore; then your own, from
                 this computer, which is where most studies are; then a link,
                 for one already online. -->
            <section class="load-section">
              <h3 class="load-label">
                <v-icon small color="#546e7a">mdi-database-outline</v-icon>
                A prepared dataset
              </h3>
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
                  class="load-go"
                  :disabled="!selectedPreset || loadState.loading"
                  :loading="isLoading('preset')"
                  @click="loadPreset"
                  >Load</v-btn
                >
              </div>
            </section>

            <section class="load-section">
              <h3 class="load-label">
                <v-icon small color="#546e7a">mdi-laptop</v-icon>
                From your computer
              </h3>
              <!-- Two of a kind: a folder, with its images and 3D files, or a
                   CSV file on its own. The browser's own pickers sit behind
                   them. Either can also be dropped anywhere on the dialog. -->
              <div class="load-pair">
                <v-btn
                  color="primary"
                  outlined
                  class="load-pick"
                  :disabled="loadState.loading"
                  :loading="isLoading('folder')"
                  @click="$refs.folderInput.click()"
                >
                  <v-icon left small>mdi-folder-open-outline</v-icon>Choose a
                  folder
                </v-btn>
                <v-btn
                  color="primary"
                  outlined
                  class="load-pick"
                  :disabled="loadState.loading"
                  :loading="isLoading('file')"
                  @click="$refs.fileInput.click()"
                >
                  <v-icon left small>mdi-file-delimited-outline</v-icon>Choose a
                  CSV file
                </v-btn>
                <input
                  ref="folderInput"
                  type="file"
                  webkitdirectory
                  multiple
                  hidden
                  @change="onFolderChosen"
                />
                <input
                  ref="fileInput"
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv"
                  hidden
                  @change="onFileChosen"
                />
              </div>
              <p class="load-hint">
                {{
                  dragDepth > 0
                    ? "Drop it to load."
                    : "Or drop either one here."
                }}
                A folder brings the images and 3D files its data.csv names, as
                a Colibri folder does. A CSV file on its own shows only images
                its cells link to in full (<a
                  href="https://tt-acm.github.io/DesignExplorer/design_explorer_data/example/LocalCSV_example.csv"
                  target="_blank"
                  rel="noopener"
                  >example</a
                >).
              </p>
            </section>

            <section class="load-section">
              <h3 class="load-label">
                <v-icon small color="#546e7a">mdi-link-variant</v-icon>
                From a link
              </h3>
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
                  class="load-go"
                  :disabled="!isValidUrl || loadState.loading"
                  :loading="isLoading('url')"
                  @click="loadUrl"
                  >Load</v-btn
                >
              </div>
              <p class="load-hint">
                A web folder, such as a GitHub repository, with data.csv beside
                its images and 3D files.
                <button
                  type="button"
                  class="load-more"
                  :aria-expanded="String(linkHelpOpen)"
                  @click="linkHelpOpen = !linkHelpOpen"
                >
                  {{ linkHelpOpen ? "Less" : "Which links work" }}
                  <v-icon x-small>{{
                    linkHelpOpen ? "mdi-chevron-up" : "mdi-chevron-down"
                  }}</v-icon>
                </button>
              </p>
              <div v-if="linkHelpOpen" class="load-more-text">
                <p>
                  For a file on GitHub, the address of its page works. The
                  <a
                    href="https://tt-acm.github.io/DesignExplorer/design_explorer_data/example/online/example.zip"
                    target="_blank"
                    rel="noopener"
                    >Design Explorer example</a
                  >
                  shows a folder laid out this way.
                </p>
                <p v-if="readsDriveFolders">
                  A Google Drive folder works too, shared so anyone with the
                  link can view it, and a OneDrive folder from some accounts. If
                  a folder is refused, download it and choose it above.
                </p>
                <p v-else>
                  This copy can't read Google Drive folders (the one at
                  designsense.app can), and OneDrive folders only from some
                  accounts; download those and choose the folder above.
                </p>
              </div>
            </section>

            <!-- Everything about making a study, folded into one place. -->
            <v-expansion-panels flat class="load-help">
              <v-expansion-panel>
                <v-expansion-panel-header>
                  <span class="load-help-title">
                    <v-icon small color="#1565c0">mdi-help-circle-outline</v-icon>
                    Help &amp; guidelines
                  </span>
                </v-expansion-panel-header>
                <v-expansion-panel-content>
                  <p>
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

                  <h4>How the columns are read</h4>
                  <p>
                    <strong>Inputs and outputs</strong> — start a design
                    parameter's column with <code>in:</code> and a result's
                    with <code>out:</code>, as in <code>in:width</code> or
                    <code>out:cost</code>. The prefix doesn't show in the
                    interface. The parallel coordinates draw outputs in blue,
                    and the Analysis panel reads how the inputs move the
                    outputs; without the prefixes it asks you to pick them
                    each time.
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

                  <h4>Naming images and 3D files</h4>
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
                  <p>
                    In a folder from your computer, Google Drive or OneDrive,
                    where DesignSense can read the list of files, you can skip
                    the extra image columns: a file named
                    <code>12_2.png</code> beside
                    <code>12.png</code> becomes that option's second view.
                  </p>

                  <h4>Exporting 3D from Rhino and Grasshopper</h4>
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
                    More in the guide:
                    <a
                      :href="guide.format"
                      target="_blank"
                      @click.prevent="openGuide('format')"
                      >the file format</a
                    >,
                    <a
                      :href="guide.models"
                      target="_blank"
                      @click.prevent="openGuide('models')"
                      >3D models</a
                    >.
                  </p>
                </v-expansion-panel-content>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>

          <!-- What happens to the files, said once, beside the way out. -->
          <v-card-actions class="load-footer">
            <span class="load-privacy">
              <v-icon small color="green darken-2">mdi-shield-check-outline</v-icon>
              Files are read in your browser and stay on this computer, even
              where the browser calls it an upload.
            </span>
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
import { READS_DRIVE_FOLDERS } from "@/data/sources.js";
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
    // What the button says. The welcome calls it "Load own data", where it
    // stands beside the sample; the dialog offers both a sample and your own,
    // so everywhere else keeps the shorter name.
    label: { type: String, default: "Load Data" },
    // Outlined in the welcome's colour, beside the sample's button there,
    // so neither of the two outweighs the other.
    outlined: { type: Boolean, default: false },
  },
  data() {
    return {
      dialog: false,
      presets: PRESETS,
      // Only a build with a Google API key reads a Drive folder; the hint
      // under the link says which this is.
      readsDriveFolders: READS_DRIVE_FOLDERS,
      selectedPreset: null,
      url: "",
      // Whether the details of which links work are showing.
      linkHelpOpen: false,
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
    onFileChosen(event) {
      let file = event.target.files && event.target.files[0];
      // Emptied so that choosing the same file again is still a change.
      event.target.value = "";
      this.loadFile(file);
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
      // A failure is shown in the dialog (loadState.error).
      loadDataset(input, { source: source }).catch(() => {});
    },
    dismissError() {
      loadState.error = null;
    },
  },
};
</script>

<style scoped>
.load-title {
  padding: 20px 24px 8px !important;
  font-size: var(--ds-fs-3xl) !important;
}
.load-body {
  padding: 8px 24px 4px !important;
}
/* Each way in a card of its own, apart from the next. */
.load-section {
  padding: 16px 18px;
  border: 1px solid #e3e8eb;
  border-radius: 10px;
}
.load-section + .load-section {
  margin-top: 14px;
}
.load-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  font-size: var(--ds-fs-base);
  font-weight: 600;
  color: #263238;
}
.load-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
/* The same height as the fields beside them. */
.load-go {
  flex: 0 0 auto;
  height: 40px !important;
  min-width: 80px !important;
}
.load-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 520px) {
  .load-pair {
    grid-template-columns: 1fr;
  }
}
.load-pick {
  height: 40px !important;
  text-transform: none;
  letter-spacing: 0;
}
.load-hint {
  margin: 10px 0 0 !important;
  font-size: var(--ds-fs-sm);
  line-height: 1.5;
  color: #546e7a;
}
.load-more {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: #1565c0;
  cursor: pointer;
}
.load-more:hover,
.load-more:focus-visible {
  text-decoration: underline;
}
.load-more .v-icon {
  color: inherit;
}
.load-more-text {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  background: #f5f7f8;
  font-size: var(--ds-fs-sm);
  line-height: 1.5;
  color: #455a64;
}
.load-more-text p:last-child {
  margin-bottom: 0;
}
.load-help {
  margin-top: 14px;
}
.load-help ::v-deep .v-expansion-panel-header {
  min-height: 40px;
  padding: 0 4px;
  font-size: var(--ds-fs-md);
}
.load-help-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #1565c0;
  font-weight: 500;
}
.load-help ::v-deep .v-expansion-panel-content__wrap {
  padding: 0 4px 8px;
  font-size: var(--ds-fs-md);
  color: #37474f;
}
.load-help h4 {
  margin: 14px 0 6px;
  font-size: var(--ds-fs-md);
  font-weight: 600;
  color: #263238;
}
.load-help code {
  background: #eceff1;
  color: #263238;
  box-shadow: none;
  font-size: var(--ds-fs-sm);
}
.load-footer {
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 12px 16px 12px 24px !important;
  border-top: 1px solid #eceff1;
  background: #fafbfc;
}
.load-privacy {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--ds-fs-sm);
  color: #2e7d32;
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
