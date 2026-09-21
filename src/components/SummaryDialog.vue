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
                :picked="picked"
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

          <!-- Where the card's options come from: the shortlist, the selected
               options or a saved set. -->
          <v-select
            :value="focusValue"
            :items="focusChoices"
            item-text="text"
            item-value="value"
            label="Options from"
            :placeholder="focusChoices.length === 0 ? 'Nothing shortlisted or saved' : undefined"
            :disabled="focusChoices.length === 0"
            persistent-placeholder
            dense
            outlined
            hide-details
            :menu-props="{ offsetY: true }"
            class="mb-1"
            @change="chooseFocus"
          />
          <div class="sm-hint mb-3">{{ focusHint }}</div>

          <!-- Which of them are pictured, picked from a checkbox list as the
               clusters' dimensions are. The box stays empty: the card shows
               what is picked. -->
          <template v-if="show.featured && summary.featured.items.length > 0">
            <v-autocomplete
              :value="shownIds"
              :items="optionChoices"
              item-text="text"
              item-value="value"
              label="Options on the card"
              multiple
              dense
              outlined
              hide-details
              :menu-props="{ offsetY: true, maxHeight: 320 }"
              class="sm-picker"
              @change="pickOptions"
            >
              <template v-slot:selection></template>
              <template v-slot:item="{ item, attrs, parent }">
                <v-list-item-action>
                  <v-simple-checkbox
                    :value="attrs.inputValue"
                    :disabled="attrs.disabled"
                    color="primary"
                    :ripple="false"
                    @input="parent.$emit('select', item)"
                  />
                </v-list-item-action>
                <v-list-item-content>
                  <v-list-item-title v-html="parent.genFilteredText(item.text)" />
                </v-list-item-content>
              </template>
            </v-autocomplete>
            <div class="sm-hint mb-4">
              {{ pickHint }}
              <a v-if="picked" href="#" @click.prevent="picked = null">Back to the first {{ capacity }}</a>
            </div>
          </template>

          <!-- Which options the charts draw: data, so it sits with the options
               above rather than with the sections below. -->
          <SummaryShowControls :summary="summary" only="data" class="mb-4" />

          <div class="sm-label">Show</div>
          <SummaryShowControls :summary="summary" only="views" />
          <div class="sm-shared">
            <v-icon x-small class="sm-shared-icon">mdi-sync</v-icon>
            <span>
              Remembered, and the same for every summary image and every page
              of the story report.
            </span>
          </div>

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
import SummaryCard, {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardCapacity,
  cardItems,
} from "@/components/SummaryCard.vue";
import SummaryShowControls from "@/components/SummaryShowControls.vue";
import { summarize } from "@/story/narrate.js";
import { shownFor } from "@/story/summarySettings.js";
import { AUTO_FOCUS, focusChoices, focusValue, resolveFocus } from "@/story/focus.js";
import {
  canCopyImages,
  copyPng,
  downloadBlob,
  fileNameFor,
  loadImages,
  renderPng,
} from "@/story/image.js";

const SIDE_WIDTH = 360;
// The finding a set's note is put in, when the card pictures that set.
const SET_NOTE = "set-note";

/**
 * Makes the one-image summary of what is on screen (see SummaryCard): the
 * card to preview, its text to edit, and the image to download or copy.
 */
export default {
  name: "SummaryDialog",
  components: { SummaryCard, SummaryShowControls },
  data() {
    return {
      summary: null,
      // Where the card's options come from (see story/focus.js).
      focusSpec: AUTO_FOCUS,
      titleText: "",
      // Sentence id -> its text as shown; notes are the user's own.
      texts: {},
      notes: [],
      noteCounter: 0,
      // The options the user picked for the card, in order; null for the
      // first of the candidates, as many as there is room for.
      picked: null,
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
    focusChoices() {
      return focusChoices(this.$store.state, this.dialogState.snapshot);
    },
    focusValue() {
      return focusValue(this.focusSpec, this.dialogState.snapshot);
    },
    focusHint() {
      let source = this.summary.featured.source;
      if (source === "set") return "Its options are pictured and ringed in the charts; its note leads the findings.";
      if (source === "shortlist") return "Its options are pictured and ringed in the charts.";
      if (source === "selected") return "What the filters or the selection leave; the first ones are pictured and ringed in the charts.";
      return "Shortlist options, or save a set, to picture them on the card.";
    },
    capacity() {
      if (!this.summary) return 0;
      return cardCapacity(this.show, this.summary, this.shownSentences.length);
    },
    // Watched, so it must read without a summary too: a watcher whose first
    // reading throws never runs again, and the pictures never loaded.
    shownItems() {
      if (!this.summary) return [];
      return cardItems(this.summary, this.picked, this.capacity);
    },
    shownIds() {
      return this.shownItems.map((item) => item.id);
    },
    /** Every candidate; once the card is full, the rest wait greyed out. */
    optionChoices() {
      let full = this.shownIds.length >= this.capacity;
      let shown = new Set(this.shownIds);
      return this.summary.featured.items.map((item) => ({
        value: item.id,
        text: item.name,
        disabled: full && !shown.has(item.id),
      }));
    },
    pickHint() {
      let n = this.summary.featured.items.length;
      let room = "Room for " + this.capacity + " on the card";
      let more = n > this.capacity && this.show.pictures !== "small" ? "; smaller pictures fit more" : "";
      return room + more + (n > this.capacity ? ". " + n + " to choose from." : ".");
    },
    // Shared with every summary image and the report (summarySettings.js).
    show() {
      let settings = this.$store.state.summarySettings;
      return this.summary ? shownFor(settings, this.summary) : settings;
    },
    editable() {
      let found = this.summary.sentences.map((s) => ({ id: s.id, original: s.text }));
      let own = (id) => ({ id: id, original: "" });
      // The pictured set's note leads; the user's own findings follow the data's.
      let lead = this.notes.filter((id) => id === SET_NOTE).map(own);
      let rest = this.notes.filter((id) => id !== SET_NOTE).map(own);
      return lead.concat(found, rest);
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
    // Whatever changes what is pictured: a pick, a focus, more room.
    shownItems(items) {
      if (this.dialogState.open) this.loadImages(items);
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
      this.focusSpec = this.dialogState.focus || AUTO_FOCUS;
      let summary = this.summarizeFor(this.focusSpec);
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
      this.putSetNote(resolveFocus(this.focusSpec, state));
      this.picked = null;
      this.error = "";
      this.copied = false;
      this.images = {};
      this.failedImages = 0;
      this.$nextTick(() => {
        this.measure();
        this.observeStage();
      });
    },
    summarizeFor(spec) {
      let state = this.$store.state;
      return summarize(
        this.dialogState.snapshot,
        state.rawData,
        state.numericDimensions,
        resolveFocus(spec, state)
      );
    },
    /**
     * Pictures another shortlist or set. What the user wrote is kept: their findings,
     * their rewording of one the data wrote, and a title of their own.
     */
    chooseFocus(value) {
      let choice = this.focusChoices.find((c) => c.value === value);
      if (!choice) return;
      let old = this.summary;
      this.focusSpec = choice.spec;
      let summary = this.summarizeFor(choice.spec);
      let before = {};
      old.sentences.forEach((s) => (before[s.id] = s.text));
      let texts = {};
      this.notes.forEach((id) => (texts[id] = this.texts[id]));
      summary.sentences.forEach((s) => {
        let edited = before[s.id] !== undefined && this.texts[s.id] !== before[s.id];
        texts[s.id] = edited ? this.texts[s.id] : s.text;
      });
      this.texts = texts;
      if (this.titleText === old.title) this.titleText = summary.title;
      this.summary = Object.freeze(summary);
      this.putSetNote(resolveFocus(choice.spec, this.$store.state));
      this.picked = null;
      this.images = {};
      this.failedImages = 0;
      // A captured view keeps where its options come from, for the report too.
      if (this.dialogState.captureId) {
        this.$store.commit("updateCapture", { id: this.dialogState.captureId, focus: choice.spec });
      }
    },
    /** A pictured set's note leads the findings; another choice drops it. */
    putSetNote(focus) {
      if (this.notes.indexOf(SET_NOTE) !== -1) this.removeNote(SET_NOTE);
      let note = focus && focus.kind === "set" ? (focus.note || "").trim() : "";
      if (!note) return;
      this.notes.unshift(SET_NOTE);
      this.$set(this.texts, SET_NOTE, note);
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
    /** The options picked in the multi-select, as many as there is room for. */
    pickOptions(ids) {
      this.picked = ids.slice(0, this.capacity);
    },
    /**
     * Copies in the pictures of the options on the card that aren't in yet,
     * so they go into the image. Only those: the list can run to dozens.
     */
    async loadImages(items) {
      let missing = items.filter((item) => !(item.id in this.images));
      if (missing.length === 0) return;
      let summary = this.summary;
      this.loadingImages = true;
      let loaded = await loadImages(missing);
      // Another focus, or a new opening, may have started meanwhile.
      if (this.summary !== summary) return;
      let images = Object.assign({}, this.images);
      missing.forEach((item) => (images[item.id] = loaded.images[item.id] || null));
      this.images = images;
      this.failedImages += loaded.failed;
      this.loadingImages = false;
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
.sm-shared {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.35;
  color: rgba(0, 0, 0, 0.55);
}
.sm-shared-icon {
  margin-top: 2px;
}
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
