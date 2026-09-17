<template>
  <div class="toolbar-group">
    <div class="toolbar-group-buttons">
      <v-tooltip v-for="name in names" :key="name" bottom>
        <template v-slot:activator="{ on }">
          <!-- A disabled button swallows pointer events, so the span carries the tooltip. -->
          <span v-on="on">
            <v-btn
              icon
              :disabled="disabled(name)"
              :color="color(actions[name].type)"
              @click="actions[name].clickAction"
            >
              <v-icon>{{ actions[name].icon }}</v-icon>
            </v-btn>
          </span>
        </template>
        <span>{{ actions[name].tooltip() }}</span>
      </v-tooltip>
      <slot />
    </div>
    <div v-if="label" class="toolbar-group-label">{{ label }}</div>
  </div>
</template>

<script>
/** A labelled row of toolbar buttons, each drawn from Demo's `actions`. */
export default {
  name: "ToolbarGroup",
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
.toolbar-group-buttons {
  display: flex;
  align-items: center;
  height: 40px;
}
.toolbar-group-buttons .v-btn.v-btn--icon {
  width: 40px;
  height: 40px;
}
.toolbar-group-label {
  font-size: 11px;
  line-height: 12px;
  opacity: 0.7;
  white-space: nowrap;
}
</style>
