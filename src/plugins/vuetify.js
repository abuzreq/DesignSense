import Vue from "vue";
import Vuetify, { VIcon } from "vuetify/lib";
import MdiIcon from "@/components/MdiIcon.vue";
import { iconSizeCss } from "@/textSize.js";

Vue.use(Vuetify);

/*
 * Icon sizes follow the reader's text size. Vuetify writes a size given as
 * a prop (x-small, small, large, size="18") into the icon's style in pixels,
 * where no stylesheet can reach it, so the one method that works it out is
 * replaced: the same sizes, times --ds-icon-scale, which App.vue sets to the
 * text's own rate or, on icon-only controls, to half of it. Icons with no
 * size are Vuetify's 24px (20px dense), rescaled in App.vue the same way.
 * The exported VIcon is a functional wrapper; the component is behind it.
 * Both its options and the extendOptions they are built from are patched:
 * Vue rebuilds the first from the second when a plugin adds a global mixin
 * later (Vuex does), and a patch on the options alone is lost then.
 */
const SIZE_PROPS = { xSmall: 12, small: 16, medium: 28, large: 36, xLarge: 40 };
function getSize() {
  let named = Object.keys(SIZE_PROPS).find((key) => this[key]);
  return iconSizeCss(named ? SIZE_PROPS[named] : this.size);
}
const IconComponent = VIcon.options.$_wrapperFor || VIcon;
IconComponent.options.methods.getSize = getSize;
if (IconComponent.extendOptions && IconComponent.extendOptions.methods) {
  IconComponent.extendOptions.methods.getSize = getSize;
}

/*
 * Icons are inline SVG, not a font. Vuetify's own (dropdown arrows, chip
 * close buttons, checkboxes, alert signs) come from its Material Design Icons
 * SVG set, and every v-icon, the app's included, is drawn by MdiIcon, which
 * looks the app's "mdi-..." names up in src/icons.js. There is no font to
 * download, and nothing stands in for an icon while one loads or where one is
 * blocked.
 */
export default new Vuetify({
  icons: {
    iconfont: "mdiSvg",
    component: MdiIcon,
  },
});
