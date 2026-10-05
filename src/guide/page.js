/*
 * The guide as a page of its own, wiki/: what a search engine finds, and
 * what a link from outside the app opens. The page's HTML already holds the
 * guide (see public/wiki.html); this takes it from there and puts it back
 * with what a script adds -- its contents by part, the search, tabs and live
 * examples -- so the guide's text is sent once. The app itself is not loaded.
 */
import Vue from "vue";
import GuidePage from "./GuidePage.vue";

Vue.config.productionTip = false;

const article = document.querySelector("#guide .gd-doc");

new Vue({
  render: (h) =>
    h(GuidePage, { props: { html: article ? article.innerHTML : "" } }),
}).$mount("#guide");
