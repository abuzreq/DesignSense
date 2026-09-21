<template>
  <div v-if="capture" class="story-presenter" role="region" aria-label="Presenting the story">
    <v-btn icon dark :disabled="index === 0" aria-label="Previous view" title="Previous [←]" @click="step(-1)">
      <v-icon>mdi-chevron-left</v-icon>
    </v-btn>
    <div class="spr-text">
      <div class="spr-title">
        <span class="spr-count">{{ index + 1 }} of {{ total }}</span>
        {{ capture.title }}
      </div>
      <div v-if="capture.note" class="spr-note">{{ capture.note }}</div>
    </div>
    <v-btn
      icon
      dark
      :disabled="index === total - 1"
      aria-label="Next view"
      title="Next [→]"
      @click="step(1)"
    >
      <v-icon>mdi-chevron-right</v-icon>
    </v-btn>
    <v-btn icon dark small aria-label="Stop presenting" title="Stop presenting [Esc]" @click="stop">
      <v-icon small>mdi-close</v-icon>
    </v-btn>
  </div>
</template>

<script>
import { mapState } from "vuex";

/**
 * While the story is presented: the view's title and note along the bottom
 * of the screen, and the way to the next one. The arrow keys step, Esc stops.
 */
export default {
  name: "StoryPresenter",
  computed: {
    ...mapState({
      index: (state) => state.presenting,
      captures: (state) => state.story.captures,
    }),
    total() {
      return this.captures.length;
    },
    capture() {
      return this.index === null ? null : this.captures[this.index] || null;
    },
  },
  watch: {
    // Every capture deleted while presenting ends it.
    capture(value) {
      if (!value && this.index !== null) this.stop();
    },
  },
  mounted() {
    this.onKey = (event) => {
      if (this.index === null) return;
      let target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      let delta = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }[event.key];
      if (delta) this.step(delta);
      else if (event.key === "Escape") this.stop();
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    // Capturing, so the workspace's own shortcuts don't act on these keys too.
    window.addEventListener("keydown", this.onKey, true);
  },
  beforeDestroy() {
    window.removeEventListener("keydown", this.onKey, true);
  },
  methods: {
    step(delta) {
      this.$store.dispatch("stepStory", { delta: delta });
    },
    stop() {
      this.$store.dispatch("stopPresenting");
    },
  },
};
</script>

<style scoped>
.story-presenter {
  position: fixed;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  z-index: 210;
  display: flex;
  align-items: center;
  gap: 8px;
  width: min(960px, calc(100vw - 32px));
  padding: 12px 12px 12px 8px;
  border-radius: 10px;
  background: rgba(38, 50, 56, 0.94);
  color: #fff;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
}
.spr-text {
  flex: 1 1 auto;
  min-width: 0;
}
.spr-title {
  font-size: 18px;
  font-weight: 500;
}
.spr-count {
  margin-right: 10px;
  font-size: 13px;
  font-weight: 400;
  opacity: 0.7;
}
.spr-note {
  margin-top: 4px;
  font-size: 15px;
  line-height: 1.45;
  opacity: 0.92;
  white-space: pre-line;
}
</style>
