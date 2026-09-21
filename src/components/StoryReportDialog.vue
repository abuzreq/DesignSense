<template>
  <v-dialog v-model="open" width="96vw" max-width="1180" scrollable>
    <v-card v-if="pages.length > 0" class="sr-card">
      <v-toolbar flat dense class="sr-bar">
        <span class="sr-heading">Story report</span>
        <span class="sr-meta"
          >A PDF: a cover with the contents, then a page for each view with its note, charts and
          options.</span
        >
        <v-spacer />
        <v-btn icon small aria-label="Close" @click="open = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>
      <v-card-text class="sr-body">
        <v-text-field v-model="titleText" label="Title" dense outlined hide-details class="sr-title" />
        <div ref="stage" class="sr-stage">
          <div
            v-for="(page, i) in pages"
            :key="page.id"
            class="sr-page"
            :style="{ width: cardWidth * scale + 'px', height: cardHeight * scale + 'px' }"
          >
            <div :style="{ transform: 'scale(' + scale + ')', transformOrigin: '0 0' }">
              <ReportCover
                v-if="page.cover"
                :title="titleText"
                :subtitle="subtitle"
                :goals="goals"
                :views="views"
                :footer="footerFor(i)"
              />
              <SummaryCard
                v-else
                :summary="page.summary"
                :title="page.title"
                :sentences="page.sentences"
                :show="page.show"
                :images="images"
                :footer="footerFor(i)"
              />
            </div>
          </div>
        </div>
        <div v-if="failedImages > 0" class="sr-note">
          {{ failedImages === 1 ? "1 image" : failedImages + " images" }} couldn't be included: their
          host doesn't allow copying them into a picture. The option's name stands in.
        </div>
        <div class="sr-note">
          Each page's text is the view's note in the story, followed by what the data says. Edit the
          notes in the story to change it.
        </div>
      </v-card-text>
      <v-card-actions class="sr-actions">
        <span v-if="error" class="sr-error">{{ error }}</span>
        <span v-else-if="progress" class="sr-progress">{{ progress }}</span>
        <v-spacer />
        <v-btn color="primary" depressed :loading="busy" :disabled="loadingImages" @click="download">
          <v-icon left>mdi-file-pdf-box</v-icon>Download PDF
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import ReportCover from "@/components/ReportCover.vue";
import SummaryCard, { CARD_HEIGHT, CARD_WIDTH } from "@/components/SummaryCard.vue";
import { summarize } from "@/story/narrate.js";
import { downloadBlob, fileNameFor, loadImages, pdfOf } from "@/story/image.js";

/**
 * The story as a PDF report: a cover (ReportCover), then each captured view
 * as a SummaryCard with its note leading the findings, both charts shown.
 */
export default {
  name: "StoryReportDialog",
  components: { ReportCover, SummaryCard },
  data() {
    return {
      titleText: "",
      subtitle: "",
      goals: [],
      views: [],
      pages: [],
      images: {},
      failedImages: 0,
      loadingImages: false,
      scale: 0.5,
      cardWidth: CARD_WIDTH,
      cardHeight: CARD_HEIGHT,
      busy: false,
      progress: "",
      error: "",
    };
  },
  computed: {
    dialogState() {
      return this.$store.state.storyReportDialog;
    },
    open: {
      get() {
        return this.dialogState.open;
      },
      set(value) {
        if (!value) this.$store.dispatch("closeStoryReport");
      },
    },
  },
  watch: {
    "dialogState.open"(value) {
      if (value) this.start();
    },
  },
  beforeDestroy() {
    if (this.stageObserver) this.stageObserver.disconnect();
    cancelAnimationFrame(this.measureFrame);
  },
  methods: {
    start() {
      let state = this.$store.state;
      let captures = state.story.captures;
      let goals = new Map();
      let pages = [{ id: "cover", cover: true }];
      captures.forEach((capture) => {
        let summary = summarize(capture.snapshot, state.rawData, state.numericDimensions);
        summary.goals.forEach((goal) => goals.set(goal.dim, goal));
        let note = (capture.note || "").trim();
        // The note leads; what the data says follows, less what the note
        // already says (a first note is made of those sentences).
        let sentences = (note ? [{ id: "note", text: note }] : []).concat(
          summary.sentences.filter((s) => note.indexOf(s.text) === -1)
        );
        pages.push(
          Object.freeze({
            id: capture.id,
            cover: false,
            summary: summary,
            title: capture.title,
            sentences: sentences,
            show: {
              goals: true,
              featured: true,
              chart: !!summary.chart,
              parallel: !!summary.parallel,
              findings: true,
            },
          })
        );
      });
      this.pages = pages;
      this.goals = Array.from(goals.values());
      this.views = captures.map((c) => ({ id: c.id, title: c.title, note: c.note }));
      this.titleText = "What we found";
      this.subtitle =
        (captures.length === 1 ? "1 view" : captures.length + " views") +
        " of " +
        state.rawData.length.toLocaleString("en-US") +
        " design options · " +
        new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      this.error = "";
      this.progress = "";
      this.measuredWidth = 0;
      this.$nextTick(() => {
        this.measure();
        this.observeStage();
      });
      this.loadImages();
    },
    footerFor(index) {
      return "Made with DesignSense · " + (index + 1) + " / " + this.pages.length;
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
      let width = stage.clientWidth;
      if (Math.abs(width - (this.measuredWidth || 0)) < 2) return;
      this.measuredWidth = width;
      this.scale = Math.max(0.2, Math.min(1, (width - 8) / CARD_WIDTH));
    },
    async loadImages() {
      let pages = this.pages;
      this.images = {};
      this.failedImages = 0;
      this.loadingImages = true;
      let items = [].concat(...pages.filter((p) => !p.cover).map((p) => p.summary.featured.items));
      let loaded = await loadImages(items);
      if (this.pages !== pages) return;
      this.images = loaded.images;
      this.failedImages = loaded.failed;
      this.loadingImages = false;
    },
    async download() {
      this.busy = true;
      this.error = "";
      try {
        // In the document's order, the cover first; refs in a loop don't
        // promise an order.
        let nodes = Array.from(this.$refs.stage.querySelectorAll(".report-cover, .summary-card"));
        let blob = await pdfOf(nodes, this.titleText, (i) => {
          this.progress = "Making page " + (i + 1) + " of " + nodes.length + "…";
        });
        downloadBlob(blob, fileNameFor(this.titleText, "pdf"));
        this.progress = "";
      } catch (e) {
        this.error = "The report couldn't be made: " + (e && e.message ? e.message : e);
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style scoped>
.sr-bar {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.sr-heading {
  font-size: 18px;
  font-weight: 500;
}
.sr-meta {
  margin-left: 14px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
}
.sr-body {
  padding-top: 16px !important;
  /* The scrollbar's room is kept either way, so the pages' scale doesn't
     change the width they are scaled to. */
  scrollbar-gutter: stable;
}
.sr-title {
  max-width: 480px;
  margin-bottom: 14px !important;
}
.sr-page {
  overflow: hidden;
  margin-bottom: 14px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.18);
}
.sr-note {
  margin-top: 6px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.7);
}
.sr-actions {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}
.sr-error {
  font-size: 13px;
  color: #c62828;
}
.sr-progress {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.7);
}
</style>
