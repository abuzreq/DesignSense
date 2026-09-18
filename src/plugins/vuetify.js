import Vue from "vue";
import Vuetify from "vuetify/lib";
import "@mdi/font/css/materialdesignicons.css";

Vue.use(Vuetify);

/*
 * Vuetify's own icons (dropdown arrows, chip close buttons, checkboxes, alert
 * signs) come from the same Material Design Icons font as the app's. They
 * used Google's Material Icons font before, which draws an icon from a word:
 * a second font to download, and until it arrived, or wherever it was
 * blocked, the words themselves -- "arrow_drop_down", "cancel" -- showed in
 * place of the icons.
 */
export default new Vuetify({
  icons: {
    iconfont: "mdi",
  },
});
