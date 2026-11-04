<template>
  <!-- Most of the window, so the pairs are large enough to read and brush. -->
  <v-dialog
    v-model="open"
    width="92vw"
    max-width="none"
    content-class="mx-dialog"
    eager
  >
    <div ref="body" class="mx-body">
      <!-- Built only while open: it is a view of its own, registered with
           the store for its selection, and needs its size to draw. -->
      <ScatterMatrix
        v-if="open && size.width > 0"
        expanded
        :width="size.width"
        :height="size.height"
        :x-column="scatterX"
        :y-column="scatterY"
        @close="open = false"
      />
    </div>
  </v-dialog>
</template>

<script>
import { mapState } from "vuex";
import ScatterMatrix from "@/components/ScatterMatrix.vue";

/**
 * The scatterplot's overview of dimension pairs, expanded: the same
 * ScatterMatrix with axes, more dimensions and brushes. Opened from the
 * overview's expand button; what is chosen here (the dimensions, their
 * order, the pair shown in the scatterplot) is the overview's too.
 */
export default {
  name: "MatrixDialog",
  components: { ScatterMatrix },
  data() {
    return { size: { width: 0, height: 0 } };
  },
  computed: {
    ...mapState({
      dialog: (state) => state.matrixDialog,
      scatterX: (state) => state.viewSettings.scatterX,
      scatterY: (state) => state.viewSettings.scatterY,
    }),
    open: {
      get() {
        return this.dialog.open;
      },
      set(value) {
        this.$store.commit("setMatrixDialog", { open: value });
      },
    },
  },
  // Eager, so the body is there to watch from the start; it measures zero
  // while the dialog is closed, and its size once it opens.
  mounted() {
    this.observe();
  },
  watch: {
    // Measured once as it opens as well: an observer reports on the next
    // frame, which a window in the background may not draw for a while.
    open(value) {
      if (value) this.$nextTick(this.measure);
    },
  },
  beforeDestroy() {
    this.unobserve();
  },
  methods: {
    observe() {
      let body = this.$refs.body;
      if (!body) return;
      this.measure();
      if (typeof ResizeObserver === "undefined" || this.observer) return;
      this.observer = new ResizeObserver(() => this.measure());
      this.observer.observe(body);
    },
    unobserve() {
      if (this.observer) this.observer.disconnect();
      this.observer = null;
    },
    measure() {
      let body = this.$refs.body;
      if (!body) return;
      this.size = { width: body.clientWidth, height: body.clientHeight };
    },
  },
};
</script>

<style scoped>
.mx-body {
  height: 88vh;
  background: #fff;
  overflow: hidden;
}
</style>
