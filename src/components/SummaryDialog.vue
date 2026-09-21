<template>
  <v-dialog v-model="open" width="96vw" max-width="1560" content-class="sm-dialog" scrollable>
    <v-card v-if="summary" class="sm-card">
      <v-toolbar flat dense class="sm-bar">
        <span class="sm-heading">Summary image</span>
        <span class="sm-meta">Edit the text, then download it or copy it into a slide, an email or a chat.</span>
        <v-spacer />
        <v-btn icon small aria-label="Close" @click="open = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>

      <v-card-text class="sm-body">
        <!-- The card at its real size, scaled down to fit. Exporting reads the
             card itself, so the scale doesn't reach the image. -->
        <div ref="stage" class="sm-stage">
          <div
            class="sm-scaler"
            :style="{
              width: cardWidth * scale + 'px',
              height: cardHeight * scale + 'px',
            }"
          >
            <div :style="{ transform: 'scale(' + scale + ')', transformOrigin: '0 0' }">
              <SummaryCard
                ref="card"
                :summary="summary"
                :title="titleText"
                :sentences="shownSentences"
                :show="show"
                :hidden="hidden"
                :images="images"
              />
            </div>
          </div>
          <div v-if="failedImages > 0" class="sm-note">
            <v-icon small color="orange darken-2">mdi-image-off-outline</v-icon>
            {{ failedImages === 1 ? "1 image" : failedImages + " images" }} couldn't be
            included: {{ failedImages === 1 ? "its host doesn't" : "their host doesn't" }} allow
            copying {{ failedImages === 1 ? "it" : "them" }} into a picture. The option's name
            stands in.
          </div>
        </div>

        <div class="sm-side">
          <v-text-field v-model="titleText" label="Title" dense outlined hide-details class="mb-4" />

          <div class="sm-label">Show</div>
          <div class="sm-toggles">
            <v-checkbox v-model="show.goals" label="Goals" dense hide-details />
            <v-checkbox v-model="show.featured" :label="summary.featured.label" dense hide-details />
            <v-checkbox v-model="show.chart" label="Scatterplot" :disabled="!summary.chart" dense hide-details />
            <v-checkbox
              v-model="show.parallel"
              label="Parallel coordinates"
              :disabled="!summary.parallel"
              dense
              hide-details
            />
            <v-checkbox v-model="show.findings" label="Findings" dense hide-details />
          </div>

          <template v-if="show.featured && summary.featured.items.length > 0">
            <div class="sm-label mt-3">Options on the card</div>
            <div class="sm-options">
              <v-checkbox
                v-for="item in summary.featured.items"
                :key="item.id"
                :input-value="hidden.indexOf(item.id) === -1"
                :label="item.name"
                dense
                hide-details
                @change="toggleItem(item.id, $event)"
              />
            </div>
          </template>

          <template v-if="show.findings">
            <div class="sm-label mt-3">Findings</div>
            <div v-for="s in editable" :key="s.id" class="sm-sentence">
              <v-textarea
                :value="texts[s.id]"
                :placeholder="s.original ? 'Left out' : 'Your finding'"
                rows="2"
                auto-grow
                dense
                outlined
                hide-details
                @input="setText(s.id, $event)"
              />
              <v-btn
                v-if="s.original && texts[s.id] !== s.original"
                icon
                x-small
                class="sm-reset"
                title="Back to what the data says"
                aria-label="Back to what the data says"
                @click="setText(s.id, s.original)"
              >
                <v-icon small>mdi-restore</v-icon>
              </v-btn>
              <v-btn
                v-else-if="!s.original"
                icon
                x-small
                class="sm-reset"
                title="Remove this finding"
                aria-label="Remove this finding"
                @click="removeNote(s.id)"
              >
                <v-icon small>mdi-close</v-icon>
              </v-btn>
            </div>
            <v-btn text small color="primary" class="px-1" @click="addNote">
              <v-icon small left>mdi-plus</v-icon>Add a finding
            </v-btn>
            <div class="sm-hint">
              Findings are worked out from the data. Empty one to leave it out.
            </div>
          </template>
        </div>
      </v-card-text>

      <v-card-actions class="sm-actions">
        <span v-if="error" class="sm-error">{{ error }}</span>
        <v-spacer />
        <v-btn text :disabled="busy || loadingImages" @click="copyImage">
          <v-icon left>mdi-content-copy</v-icon>{{ copied ? "Copied" : "Copy image" }}
        </v-btn>
        <v-btn color="primary" depressed :loading="busy" :disabled="loadingImages" @click="download">
          <v-icon left>mdi-download</v-icon>Download PNG
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import SummaryCard, { CARD_HEIGHT, CARD_WIDTH } from "@/components/SummaryCard.vue";
import { summarize } from "@/story/narrate.js";
import {
  canCopyImages,
  copyPng,
  downloadBlob,
  fileNameFor,
  loadImages,
  renderPng,
} from "@/story/image.js";

const SIDE_WIDTH = 360;

/**
 * Makes the one-image summary of what is on screen (see SummaryCard): the
 * card to preview, its text to edit, and the image to download or copy.
 */
export default {
  name: "SummaryDialog",
  components: { SummaryCard },
  data() {
    return {
      summary: null,
      titleText: "",
      // Sentence id -> its text as shown; notes are the user's own.
      texts: {},
      notes: [],
      noteCounter: 0,
      show: { goals: true, featured: true, chart: true, parallel: false, findings: true },
      hidden: [],
      images: {},
      failedImages: 0,
      loadingImages: false,
      scale: 0.5,
      cardWidth: CARD_WIDTH,
      cardHeight: CARD_HEIGHT,
      busy: false,
      copied: false,
      error: "",
    };
  },
  computed: {
    dialogState() {
      return this.$store.state.summaryDialog;
    },
    open: {
      get() {
        return this.dialogState.open;
      },
      set(value) {
        if (!value) this.$store.dispatch("closeSummary");
      },
    },
    editable() {
      let found = this.summary.sentences.map((s) => ({ id: s.id, original: s.text }));
      return found.concat(this.notes.map((id) => ({ id: id, original: "" })));
    },
    shownSentences() {
      return this.editable
        .map((s) => ({ id: s.id, text: (this.texts[s.id] || "").trim() }))
        .filter((s) => s.text);
    },
  },
  watch: {
    "dialogState.open"(value) {
      if (value) this.start();
    },
  },
  mounted() {
    this.onResize = () => this.measure();
    window.addEventListener("resize", this.onResize);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.onResize);
    if (this.stageObserver) this.stageObserver.disconnect();
    cancelAnimationFrame(this.measureFrame);
    clearTimeout(this.copiedTimer);
  },
  methods: {
    start() {
      let state = this.$store.state;
      let snapshot = this.dialogState.snapshot;
      let summary = summarize(snapshot, state.rawData, state.numericDimensions);
      let texts = {};
      summary.sentences.forEach((s) => (texts[s.id] = s.text));
      // Frozen, so Vue doesn't walk the rows and sets it holds.
      this.summary = Object.freeze(summary);
      this.titleText = this.dialogState.title || summary.title;
      this.texts = texts;
      this.notes = [];
      // A capture's note leads the findings, unless it is still the one the
      // data wrote, which the findings already say.
      let note = (this.dialogState.note || "").trim();
      if (note && !summary.sentences.some((s) => note.indexOf(s.text) !== -1)) {
        this.addNote();
        this.texts["note-" + this.noteCounter] = note;
      }
      this.hidden = [];
      this.show = {
        goals: true,
        featured: true,
        chart: !!summary.chart,
        parallel: false,
        findings: true,
      };
      this.error = "";
      this.copied = false;
      this.$nextTick(() => {
        this.measure();
        this.observeStage();
      });
      this.loadImages(summary.featured.items);
    },
    /** Measures again whenever the preview's room changes, as it does while the dialog opens. */
    observeStage() {
      let stage = this.$refs.stage;
      if (!stage || typeof ResizeObserver === "undefined" || this.observed === stage) return;
      if (this.stageObserver) this.stageObserver.disconnect();
      // A frame later, and only for a new width: rescaling the pages can
      // bring a scrollbar and so change the width within the same frame,
      // which the browser reports as a ResizeObserver loop.
      this.stageObserver = new ResizeObserver(() => {
        cancelAnimationFrame(this.measureFrame);
        this.measureFrame = requestAnimationFrame(() => this.measure());
      });
      this.stageObserver.observe(stage);
      this.observed = stage;
    },
    measure() {
      let stage = this.$refs.stage;
      if (!stage) return;
      let width = stage.clientWidth || window.innerWidth * 0.96 - SIDE_WIDTH - 80;
      this.scale = Math.max(0.2, Math.min(1, (width - 8) / CARD_WIDTH));
    },
    setText(id, text) {
      this.$set(this.texts, id, text);
    },
    addNote() {
      this.noteCounter += 1;
      let id = "note-" + this.noteCounter;
      this.notes.push(id);
      this.$set(this.texts, id, "");
    },
    removeNote(id) {
      this.notes = this.notes.filter((other) => other !== id);
      this.$delete(this.texts, id);
    },
    toggleItem(id, shown) {
      this.hidden = shown ? this.hidden.filter((other) => other !== id) : this.hidden.concat([id]);
    },
    /** Copies the featured images in, so they go into the picture. */
    async loadImages(items) {
      this.images = {};
      this.failedImages = 0;
      this.loadingImages = true;
      let loaded = await loadImages(items);
      // A newer opening may have started meanwhile.
      if (this.summary && this.summary.featured.items === items) {
        this.images = loaded.images;
        this.failedImages = loaded.failed;
        this.loadingImages = false;
      }
    },
    render() {
      let card = this.$refs.card;
      if (!card) return Promise.reject(new Error("The card isn't ready yet."));
      return renderPng(card.$el);
    },
    async download() {
      this.busy = true;
      this.error = "";
      try {
        downloadBlob(await this.render(), fileNameFor(this.titleText));
      } catch (e) {
        this.error = "The image couldn't be made: " + (e && e.message ? e.message : e);
      } finally {
        this.busy = false;
      }
    },
    async copyImage() {
      this.error = "";
      if (!canCopyImages()) {
        this.error = "This browser can't copy images. Download the PNG instead.";
        return;
      }
      this.busy = true;
      try {
        await copyPng(this.render());
        this.copied = true;
        clearTimeout(this.copiedTimer);
        this.copiedTimer = setTimeout(() => (this.copied = false), 2000);
      } catch (e) {
        this.error = "The image couldn't be copied. Download the PNG instead.";
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style scoped>
.sm-bar {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.sm-heading {
  font-size: 18px;
  font-weight: 500;
}
.sm-meta {
  margin-left: 14px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
}
.sm-body {
  display: flex;
  gap: 24px;
  padding-top: 16px !important;
  scrollbar-gutter: stable;
}
.sm-stage {
  flex: 1 1 auto;
  min-width: 0;
}
.sm-scaler {
  overflow: hidden;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.18);
  border-radius: 2px;
}
.sm-note {
  margin-top: 10px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.7);
}
.sm-side {
  flex: 0 0 360px;
  min-width: 0;
}
.sm-label {
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.55);
}
.sm-toggles,
.sm-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}
.sm-sentence {
  position: relative;
  margin-bottom: 8px;
}
.sm-sentence ::v-deep textarea {
  font-size: 13px;
  line-height: 1.4;
}
.sm-reset {
  position: absolute;
  top: 2px;
  right: 2px;
  background: #fff;
}
.sm-hint {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
}
.sm-actions {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}
.sm-error {
  font-size: 13px;
  color: #c62828;
}
</style>
