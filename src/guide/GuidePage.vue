<template>
  <div id="guide" class="gp">
    <header class="gp-bar">
      <a class="gp-brand" :href="appHref">DesignSense</a>
      <span class="gp-name">Guide</span>
      <span class="gp-space"></span>
      <a class="gp-open" :href="appHref">Open DesignSense</a>
    </header>
    <div class="gp-body">
      <GuideDoc
        ref="doc"
        layout="folds"
        :html="html"
        :section="section"
        @navigate="onNavigate"
        @app-link="onAppLink"
      >
        <footer slot="foot" class="gp-foot">
          DesignSense v{{ version }}. This guide is
          <a :href="sourceUrl" target="_blank" rel="noopener">docs/guide.md</a>
          in the repository, where it can be read and corrected.
        </footer>
      </GuideDoc>
    </div>
  </div>
</template>

<script>
/* global __APP_VERSION__ */
import GuideDoc from "./GuideDoc.vue";

/** The heading the address names: "#decide" is the Decide section. */
function sectionOf(location) {
  try {
    return decodeURIComponent(location.hash.replace(/^#/, ""));
  } catch (e) {
    return "";
  }
}

export default {
  name: "GuidePage",
  components: { GuideDoc },
  props: {
    // The guide, as the page already holds it (see page.js).
    html: { type: String, required: true },
  },
  data() {
    return {
      section: sectionOf(window.location),
      version: __APP_VERSION__,
      // The app, a folder up from this page wherever the two are served.
      appHref: "../",
      sourceUrl:
        "https://github.com/abuzreq/DesignSense/blob/master/docs/guide.md",
    };
  },
  created() {
    this.onHash = () => {
      this.section = sectionOf(window.location);
    };
    // A printed guide is the whole guide, folded sections and all.
    this.unfoldToPrint = () => {
      if (this.$refs.doc) this.$refs.doc.setAllOpen(true);
    };
    window.addEventListener("hashchange", this.onHash);
    window.addEventListener("beforeprint", this.unfoldToPrint);
  },
  beforeDestroy() {
    window.removeEventListener("hashchange", this.onHash);
    window.removeEventListener("beforeprint", this.unfoldToPrint);
  },
  methods: {
    /** Names the heading in the address, so the link can be kept. */
    onNavigate(id) {
      this.section = id;
      let address =
        window.location.pathname + window.location.search + (id ? "#" + id : "");
      window.history.replaceState(null, "", address);
    },
    /**
     * A link into the app is written with the app's public address; here it
     * goes to the app this page was served with, which is the same thing
     * once published and the build at hand before that.
     */
    onAppLink(link) {
      window.location.href = this.appHref + link.query;
    },
  },
};
</script>
