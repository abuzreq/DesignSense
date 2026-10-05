import Vue from "vue";
import VueRouter from "vue-router";
import App from "@/App.vue";
import Demo from "@/Demo.vue";
import VueGtag from "vue-gtag";
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

Vue.use(
  VueGtag,
  {
    config: {
      id: "G-R9H6P1BD0H",
      params: {
        anonymize_ip: true,
      },
      debug: {
        enabled: process.env.NODE_ENV === "development", // default value
        trace: true, // default value
        sendHitTask: true, // default value
      },
    },
  },
  router
);

export default router;
