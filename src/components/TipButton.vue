<template>
  <!-- The tooltip renders its button beside itself rather than inside, so a
       wrapper keeps the two together wherever the button moves. -->
  <div class="tip-button">
    <v-tooltip bottom :max-width="maxWidth">
      <template v-slot:activator="{ on }">
        <!-- A disabled button swallows pointer events, so the span carries the
             tooltip. Focus doesn't reach a span, so focusin and focusout are
             passed on: the tooltip opens for the keyboard too. -->
        <span
          v-on="on"
          class="tip-button-activator"
          @focusin="on.focus"
          @focusout="on.blur"
        >
          <v-btn
            icon
            :small="small"
            :disabled="disabled"
            :color="color"
            :class="btnClass"
            :aria-label="label"
            :aria-keyshortcuts="shortcut"
            @click="$emit('click', $event)"
          >
            <v-icon :small="smallIcon" :color="iconColor">{{ icon }}</v-icon>
          </v-btn>
        </span>
      </template>
      <span>{{ tooltip }}</span>
    </v-tooltip>
  </div>
</template>

<script>
import { accessibleName, keyShortcut } from "@/components/a11y.js";

/**
 * An icon button with a tooltip, taking only plain values. A Vuetify tooltip
 * re-renders whenever the component around it does; inside a component of its
 * own it re-renders only when its icon, text or state change, which keeps
 * toolbars and panel headers cheap while the collection is filtered, scrolled
 * or inspected. Pass `btnClass` as a string: an object made while rendering is
 * new every time, and would re-render the button anyway.
 */
export default {
  name: "TipButton",
  props: {
    icon: { type: String, required: true },
    tooltip: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
    small: { type: Boolean, default: false },
    smallIcon: { type: Boolean, default: false },
    color: { type: String, default: undefined },
    iconColor: { type: String, default: undefined },
    btnClass: { type: String, default: undefined },
    maxWidth: { type: [String, Number], default: undefined },
  },
  computed: {
    // The button's name for a screen reader: the tooltip without its shortcut.
    label() {
      return accessibleName(this.tooltip);
    },
    shortcut() {
      return keyShortcut(this.tooltip);
    },
  },
};
</script>

<style scoped>
.tip-button,
.tip-button-activator {
  display: inline-flex;
  align-items: center;
}
</style>
