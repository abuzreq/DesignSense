/*
 * The guide's live examples, by the name the Markdown gives them:
 * "<!-- live: patterns -->" before a picture puts the example registered here
 * as "patterns" in that picture's place (see GuideDoc.vue). Each is fetched
 * when the guide first shows, and none may lean on the app's store, router
 * or Vuetify: the wiki page mounts them too, without any of those.
 */
export default {
  patterns: () =>
    import(/* webpackChunkName: "guide-live" */ "./PatternsLive.vue"),
  weights: () =>
    import(/* webpackChunkName: "guide-live" */ "./WeightsLive.vue"),
};
