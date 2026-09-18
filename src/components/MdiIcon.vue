<script>
import { iconPath } from "@/icons.js";

/**
 * Draws one icon as inline SVG. Vuetify renders every v-icon through this
 * (see plugins/vuetify.js), with `icon` set to what the template named:
 * "mdi-plus", or the path data of one of Vuetify's own icons. Functional, so
 * a screen of icons adds no component instances.
 */
export default {
  name: "MdiIcon",
  functional: true,
  props: {
    icon: { type: String, required: true },
  },
  render(h, { props, data }) {
    return h(
      "svg",
      {
        staticClass: data.staticClass,
        class: data.class,
        style: data.style,
        attrs: {
          xmlns: "http://www.w3.org/2000/svg",
          viewBox: "0 0 24 24",
          role: "img",
          "aria-hidden": "true",
        },
      },
      [h("path", { attrs: { d: iconPath(props.icon) } })]
    );
  },
};
</script>

<style>
/* An icon is as big as its v-icon's font size, as the font's glyphs were, so
   what sizes icons by font size (Vuetify's dense icons and small chips, a
   size prop) sizes these too. Vuetify's own rule fixes them at 24px. */
.v-icon > .v-icon__component {
  width: 1em;
  height: 1em;
  fill: currentColor;
}
</style>
