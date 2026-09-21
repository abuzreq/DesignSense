<template>
  <div class="toolbar-group">
    <div class="toolbar-group-buttons">
      <slot name="start" />
      <TipButton
        v-for="name in names"
        :key="name"
        :icon="actions[name].icon"
        :tooltip="actions[name].tooltip()"
        :disabled="disabled(name)"
        :color="color(actions[name].type)"
        @click="actions[name].clickAction"
      />
      <slot />
    </div>
    <div v-if="label" class="toolbar-group-label">{{ label }}</div>
  </div>
</template>

<script>
import TipButton from "@/components/TipButton.vue";

/**
 * A labelled row of toolbar buttons, each drawn from Demo's `actions`.
 * `disabled(name)` says whether an action would do nothing now.
 */
export default {
  name: "ToolbarGroup",
  components: { TipButton },
  props: {
    label: { type: String, default: "" },
    names: { type: Array, default: () => [] },
    actions: { type: Object, required: true },
    disabled: { type: Function, default: () => false },
    color: { type: Function, default: () => undefined },
  },
};
</script>

<style scoped>
.toolbar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
/* 32px buttons and a 10px label: the pair fits the 52px bar with room above
   and below, where 40px buttons and an 11px label needed 60. */
.toolbar-group-buttons {
  display: flex;
  align-items: center;
  height: 32px;
}
.toolbar-group-buttons ::v-deep .v-btn.v-btn--icon {
  width: 32px !important;
  height: 32px !important;
}
.toolbar-group-label {
  font-size: 10px;
  line-height: 11px;
  letter-spacing: 0.02em;
  color: #b0bec5;
  white-space: nowrap;
}
</style>
