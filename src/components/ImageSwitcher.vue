<template>
  <div class="switcher" :class="'switcher--' + size">
    <TipButton
      small-icon
      icon="mdi-chevron-left"
      tooltip="Previous view"
      @click="step(-1)"
    />
    <!-- Dots while they stay countable at a glance; a counter beyond that. -->
    <div v-if="images.length <= DOT_LIMIT" class="switcher-dots">
      <button
        v-for="(src, i) in images"
        :key="i"
        type="button"
        class="switcher-dot"
        :class="{ 'switcher-dot--on': i === index }"
        :title="'View ' + (i + 1)"
        :aria-label="'View ' + (i + 1)"
        @click="$emit('change', i)"
      />
    </div>
    <span v-else class="switcher-count">{{ index + 1 }} / {{ images.length }}</span>
    <TipButton
      small-icon
      icon="mdi-chevron-right"
      tooltip="Next view"
      @click="step(1)"
    />
  </div>
</template>

<script>
import TipButton from "@/components/TipButton.vue";

// More dots than this and counting them is slower than reading a number.
const DOT_LIMIT = 8;

/**
 * Steps through an option's views. It holds nothing: the index comes in as a
 * prop and changes go out as an event, so the gallery, the inspector and the
 * compare view can each remember their own place without writing to the row.
 */
export default {
  name: "ImageSwitcher",
  components: { TipButton },
  props: {
    images: { type: Array, required: true },
    index: { type: Number, default: 0 },
    size: { type: String, default: "normal" },
  },
  data() {
    return { DOT_LIMIT: DOT_LIMIT };
  },
  methods: {
    step(by) {
      let count = this.images.length;
      if (count < 2) return;
      this.$emit("change", (this.index + by + count) % count);
    },
  },
};
</script>

<style scoped>
.switcher {
  display: flex;
  align-items: center;
  gap: 2px;
}
.switcher-dots {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 2px;
}
.switcher-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #cfd8dc;
  border: 1px solid #b0bec5;
  cursor: pointer;
}
.switcher-dot--on {
  background: #1565c0;
  border-color: #1565c0;
}
.switcher-count {
  font-size: 12px;
  color: #546e7a;
  white-space: nowrap;
}
</style>
