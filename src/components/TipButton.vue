<template>
  <!-- The tooltip renders its button beside itself rather than inside, so a
       wrapper keeps the two together wherever the button moves. -->
  <div class="tip-button">
    <v-tooltip bottom :max-width="maxWidth">
      <template v-slot:activator="{ on }">
        <!-- A disabled button swallows pointer events, so the span carries the tooltip. -->
        <span v-on="on" class="tip-button-activator">
          <v-btn
            icon
            :small="small"
            :disabled="disabled"
            :color="color"
            :class="btnClass"
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
};
</script>

<style scoped>
.tip-button,
.tip-button-activator {
  display: inline-flex;
  align-items: center;
}
</style>
