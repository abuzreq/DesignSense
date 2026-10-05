<template>
  <v-dialog
    v-model="open"
    width="96vw"
    max-width="1180"
    content-class="gdlg-dialog"
    scrollable
  >
    <v-card class="gdlg-card">
      <v-card-title class="gdlg-title">
        <v-icon left>mdi-book-open-page-variant-outline</v-icon>
        Guide
        <v-spacer />
        <v-btn
          text
          small
          color="primary"
          :href="pageHref"
          target="_blank"
          rel="noopener"
        >
          Open as a page
        </v-btn>
        <v-btn icon aria-label="Close" @click="open = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-divider />
      <v-card-text class="gdlg-body">
        <!-- Made when the guide is first opened, and kept: closing and
             opening again finds it where it was. -->
        <GuideDoc
          v-if="everOpen"
          ref="doc"
          layout="single"
          :html="guide"
          :section="section"
          :base="pageBase"
          @navigate="onNavigate"
          @app-link="$emit('app-link', $event)"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
/*
 * The guide over the workspace: what is on screen stays as it is behind it,
 * which leaving for a page of its own would not allow. One section shows at a
 * time. The store's `guideDialog` says whether it is open and at which
 * heading (see openGuide).
 */
import guide from "../../docs/guide.md";
import GuideDoc from "./GuideDoc.vue";
import { guideHref } from "@/guide.js";

export default {
  name: "GuideDialog",
  components: { GuideDoc },
  data() {
    return { guide: guide, everOpen: false, pageBase: guideHref("") + "#" };
  },
  computed: {
    state() {
      return this.$store.state.guideDialog;
    },
    section() {
      return this.state.section || "";
    },
    open: {
      get() {
        return this.state.open;
      },
      set(value) {
        if (!value) this.$store.dispatch("closeGuide");
      },
    },
    pageHref() {
      return guideHref(this.section);
    },
  },
  watch: {
    "state.open": {
      immediate: true,
      handler(value) {
        if (value) this.everOpen = true;
      },
    },
  },
  methods: {
    onNavigate(id) {
      this.$store.commit("setGuideDialog", { section: id });
    },
  },
};
</script>

<style>
/* Not scoped: the dialog is drawn outside this component's element. */
.gdlg-dialog {
  height: 90vh;
}
.gdlg-card {
  height: 100%;
}
.gdlg-title {
  flex: 0 0 auto;
  padding: 10px 12px 10px 20px !important;
  font-size: 18px !important;
}
.gdlg-body.v-card__text {
  padding: 24px 28px 28px !important;
  background: #fafbfc;
}
/* Vuetify's own rules for text in a card would otherwise reach the guide. */
.gdlg-body .gd-doc {
  color: #37474f;
}
.gdlg-body .gd {
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 32px;
}
@media (max-width: 1000px) {
  .gdlg-body.v-card__text {
    padding: 0 16px 20px !important;
  }
}
</style>
