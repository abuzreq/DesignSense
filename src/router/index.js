import Vue from "vue";
import VueRouter from "vue-router";
import App from "@/App.vue";
import Demo from "@/Demo.vue";
import { guideHref } from "@/guide.js";

Vue.use(VueRouter);

const routes = [
  {
    path: "/",
    name: "home",
    component: Demo,
  },
  {
    // Where the guide used to be. It is a page of its own now (wiki/, see
    // guide.js), so an old link to it, or to one of its sections, is sent on.
    path: "/about/:section?",
    name: "about",
    beforeEnter(to) {
      window.location.replace(guideHref(to.params.section));
    },
  },
  {
    path: "/demo",
    name: "demo",
    component: Demo,
  },
  { path: "*", component: Demo},
];

const router = new VueRouter({
    routes,
});

export default router;
