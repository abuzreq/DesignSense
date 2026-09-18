import Vue from "vue";
import Vuetify from "vuetify/lib";
import MdiIcon from "@/components/MdiIcon.vue";

Vue.use(Vuetify);

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
