<template>
  <div id="guide" class="gp">
    <header class="gp-bar">
      <!-- The app's own title (see Demo.vue's ds-title): the mark, in the
           bar's colours, and the name in two weights. The same markup is in
           public/wiki.html, which shows it until this mounts. -->
      <a class="gp-brand" :href="appHref" aria-label="DesignSense">
        <svg
          class="gp-mark"
          viewBox="0 0 48 48"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4.5 3 H24 A21 21 0 0 1 24 45 H4.5 Z"
            fill="none"
            stroke="#5b9bd0"
            stroke-width="3.5"
            stroke-linejoin="round"
          />
          <g fill="#4a5b68">
            <rect x="9" y="7.75" width="23.5" height="2.5" rx="1.25" />
            <rect x="9" y="15.25" width="30.5" height="2.5" rx="1.25" />
            <rect x="9" y="22.75" width="32.25" height="2.5" rx="1.25" />
            <rect x="9" y="30.25" width="30.5" height="2.5" rx="1.25" />
            <rect x="9" y="37.75" width="23.5" height="2.5" rx="1.25" />
          </g>
          <g fill="#f57c00">
            <rect x="18" y="6" width="14" height="6" rx="1" />
            <rect x="10" y="13.5" width="6" height="6" rx="1" />
            <rect x="10" y="21" width="22" height="6" rx="1" />
            <rect x="26" y="28.5" width="6" height="6" rx="1" />
            <rect x="10" y="36" width="14" height="6" rx="1" />
          </g>
        </svg>
        <span class="gp-wordmark"
          ><span class="gp-brand-strong">design</span
          ><span class="gp-brand-light">sense</span></span
        >
      </a>
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

<style>
/* The name's face, the app's own (see App.vue). guide.css is put into the
   page as plain text, where the build can't find the font file, so the face
   is declared here, where it can; until the script arrives the name is set
   in the page's face. DM Sans, SIL Open Font License 1.1 (see
   assets/DM-Sans-OFL.txt). */
@font-face {
  font-family: "DM Sans";
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url("~@/assets/dm-sans-latin.woff2") format("woff2");
}
</style>
