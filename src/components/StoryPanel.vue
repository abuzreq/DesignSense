<template>
  <!-- Over the workspace, like the sets' drawer, so the panels keep their size. -->
  <v-navigation-drawer
    id="story-panel"
    :value="open"
    absolute
    right
    stateless
    hide-overlay
    :mobile-breakpoint="0"
    width="340"
    class="story-panel"
    style="position: absolute"
  >
    <div class="sp-head">
      <span class="sp-title">Story</span>
      <span v-if="captures.length > 0" class="sp-count">{{ captures.length }}</span>
      <v-spacer />
      <v-btn
        icon
        small
        :disabled="captures.length === 0"
        title="Present: step through the views one by one"
        aria-label="Present the story"
        @click="present(0)"
      >
        <v-icon small>mdi-presentation-play</v-icon>
      </v-btn>
      <v-btn
        icon
        small
        :disabled="captures.length === 0"
        title="The whole story as a PDF report"
        aria-label="The whole story as a PDF report"
        @click="$store.dispatch('openStoryReport')"
      >
        <v-icon small>mdi-file-pdf-box</v-icon>
      </v-btn>
      <v-btn icon small title="Hide" aria-label="Hide the story" @click="close">
        <v-icon small>mdi-close</v-icon>
      </v-btn>
    </div>

    <v-btn block depressed small color="primary" class="sp-capture" @click="capture">
      <v-icon small left>mdi-camera-outline</v-icon>Capture this view
    </v-btn>

    <div v-if="captures.length === 0" class="sp-empty">
      Capture views as you go. Each one keeps what was filtered or selected, the
      goals and the shortlist, with a note on what it shows. Step through them in
      a meeting, or make them into a PDF report.
    </div>

    <ol class="sp-list">
      <li v-for="(c, i) in captures" :key="c.id" class="sp-item">
        <div class="sp-item-head">
          <span class="sp-number">{{ i + 1 }}</span>
          <input
            class="sp-name"
            :value="c.title"
            aria-label="The view's title"
            @change="update(c.id, { title: $event.target.value })"
          />
          <v-btn icon x-small :disabled="i === 0" title="Earlier" aria-label="Move earlier" @click="move(c.id, -1)">
            <v-icon small>mdi-chevron-up</v-icon>
          </v-btn>
          <v-btn
            icon
            x-small
            :disabled="i === captures.length - 1"
            title="Later"
            aria-label="Move later"
            @click="move(c.id, 1)"
          >
            <v-icon small>mdi-chevron-down</v-icon>
          </v-btn>
          <v-btn icon x-small title="Delete this view" aria-label="Delete this view" @click="remove(c)">
            <v-icon small>mdi-delete-outline</v-icon>
          </v-btn>
        </div>
        <div class="sp-meta">{{ meta(c) }}</div>
        <textarea
          class="sp-note"
          :value="c.note"
          rows="3"
          placeholder="What this view shows"
          aria-label="The view's note"
          @change="update(c.id, { note: $event.target.value })"
        ></textarea>
        <div class="sp-actions">
          <v-btn text x-small color="primary" @click="show(c)">Show</v-btn>
          <v-btn text x-small @click="present(i)">Present from here</v-btn>
          <v-btn text x-small @click="summary(c)">Summary image</v-btn>
        </div>
      </li>
    </ol>
  </v-navigation-drawer>
</template>

<script>
import { mapState } from "vuex";

/**
 * The story: views captured along the way, each with a title and a note, in
 * the order they are told. A view can be put back on screen, presented from,
 * or made into a summary image of its own.
 */
export default {
  name: "StoryPanel",
  computed: {
    ...mapState({
      open: (state) => state.storyPanel.open,
      captures: (state) => state.story.captures,
    }),
  },
  methods: {
    close() {
      this.$store.commit("setStoryPanel", { open: false });
    },
    capture() {
      this.$store.dispatch("captureView");
    },
    update(id, change) {
      this.$store.commit("updateCapture", Object.assign({ id: id }, change));
    },
    move(id, delta) {
      this.$store.commit("moveCapture", { id: id, delta: delta });
    },
    remove(capture) {
      this.$store.commit("removeCapture", { id: capture.id });
      this.$store.commit("showNotice", { text: "Deleted " + (capture.title || "the view") + " from the story." });
    },
    show(capture) {
      this.$store.dispatch("restoreCapture", { id: capture.id });
    },
    present(index) {
      this.$store.dispatch("presentStory", { index: index });
    },
    summary(capture) {
      this.$store.dispatch("openSummary", {
        snapshot: capture.snapshot,
        title: capture.title,
        note: capture.note,
        focus: capture.focus || null,
        captureId: capture.id,
      });
    },
    meta(capture) {
      let s = capture.snapshot;
      let parts = [s.mode === "lite" ? "Lite" : "Expert"];
      parts.push(
        s.selected
          ? s.counts.selected + " of " + s.counts.total + " options"
          : "all " + s.counts.total + " options"
      );
      if (s.cart.length > 0) parts.push(s.cart.length + " shortlisted");
      return parts.join(" · ");
    },
  },
};
</script>

<style scoped>
.story-panel {
  z-index: 5;
}
.sp-head {
  display: flex;
  align-items: center;
  padding: 8px 8px 4px 14px;
}
.sp-title {
  font-size: 16px;
  font-weight: 500;
}
.sp-count {
  margin-left: 8px;
  padding: 0 7px;
  border-radius: 10px;
  background: #eceff1;
  font-size: 12px;
}
.sp-capture {
  width: calc(100% - 24px) !important;
  margin: 4px 12px 8px;
}
.sp-empty {
  padding: 8px 16px;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.6);
}
.sp-list {
  list-style: none;
  margin: 0;
  padding: 0 12px 16px;
}
.sp-item {
  margin-top: 10px;
  padding: 8px 8px 4px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
}
.sp-item-head {
  display: flex;
  align-items: center;
  gap: 2px;
}
.sp-number {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  margin-right: 6px;
  border-radius: 50%;
  background: #263238;
  color: #fff;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
}
.sp-name {
  flex: 1 1 auto;
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid transparent;
  border-radius: 3px;
  font-size: 14px;
  font-weight: 500;
}
.sp-name:hover,
.sp-name:focus {
  border-color: rgba(0, 0, 0, 0.2);
  outline: none;
}
.sp-meta {
  margin: 2px 0 6px 26px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
}
.sp-note {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.4;
  resize: vertical;
}
.sp-note:focus {
  border-color: #1976d2;
  outline: none;
}
.sp-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 2px;
  margin: 2px -4px 0;
}
/* Plain case and tight padding, so the three fit in one row. */
.sp-actions .v-btn {
  min-width: 0 !important;
  padding: 0 6px !important;
  font-size: 12px;
  letter-spacing: normal;
  text-transform: none;
}
</style>
