<template>
  <!-- Docked: a column beside the panels, which give it its width (the
       workspace's ResizeObserver rescales them), with a draggable right edge.
       No rail and no hover: it is there until it is undocked. -->
  <aside
    v-if="docked"
    id="sets-drawer"
    class="sets-dock"
    :style="{ flexBasis: width + 'px', width: width + 'px' }"
  >
    <SetsView docked @toggle-dock="undock" @close="undock" />
    <div
      class="sets-dock-edge"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      :aria-label="'Resize the ' + title.toLowerCase()"
      :aria-valuenow="width"
      :aria-valuemin="minWidth"
      :aria-valuemax="maxWidth"
      title="Drag to resize; double-click for the usual width"
      @pointerdown="onEdgeDown"
      @keydown="onEdgeKey"
      @dblclick="resetWidth"
    >
      <span class="sets-dock-grip" />
    </div>
  </aside>
  <!-- The rail: a strip down the workspace's left edge that is always there,
       so the saved sets never go out of sight entirely. Resting the pointer
       on it opens the drawer; its handle opens it to stay. The drawer is a
       child of the rail, positioned against the work area around both, so one
       pair of enter and leave events covers the rail and the drawer. -->
  <div v-else class="sets-rail" @mouseenter="onEnter" @mouseleave="onLeave">
    <button
      type="button"
      class="sets-handle"
      :aria-label="'Show the ' + title.toLowerCase()"
      :aria-expanded="String(open)"
      aria-controls="sets-drawer"
      @click="onHandleClick"
    >
      <v-icon x-small class="sets-handle-icon">mdi-chevron-right</v-icon>
      <span class="sets-handle-label">{{ title }}</span>
      <span v-if="setCount > 0" class="sets-handle-count">{{ setCount }}</span>
    </button>

    <!-- Over the workspace rather than beside it: the panels keep their size,
         and stay usable while it is open. The inline position keeps the tour
         from making it relative when it highlights it. -->
    <v-navigation-drawer
      id="sets-drawer"
      ref="drawer"
      :value="open"
      absolute
      stateless
      hide-overlay
      :mobile-breakpoint="0"
      width="240"
      class="sets-drawer"
      style="position: absolute"
    >
      <SetsView @close="close" @toggle-dock="dock" />
    </v-navigation-drawer>
  </div>
</template>

<script>
import { mapState } from "vuex";
import SetsView from "@/components/SetsView.vue";
import {
  DOCK_DEFAULT_WIDTH,
  DOCK_MAX_WIDTH,
  DOCK_MIN_WIDTH,
  clampDockWidth,
} from "@/setsDock.js";

// How long the pointer rests on the rail before the drawer opens: long
// enough that sweeping past the window's edge doesn't open it.
const OPEN_DELAY_MS = 150;
// How long after the pointer leaves before the drawer closes, so a slip over
// its edge doesn't close it.
const CLOSE_DELAY_MS = 300;
// How long the drawer comes out for when a set is saved or an option is
// shortlisted, to show where it went.
const PEEK_MS = 2500;
const FOCUSABLE = "button, input, textarea, [tabindex]:not([tabindex='-1'])";

/**
 * The saved sets and the shortlist, in a drawer at the workspace's left
 * edge. The store holds whether it is open and whether it is pinned (see
 * `setSetsDrawer`); the timing of opening on hover and peeking lives here.
 *
 * Open three ways, each with its own way out:
 * - hover: the pointer rests on the rail; closes once it leaves, unless focus
 *   is inside (a set's name being typed) or one of its menus is open, which
 *   hold it until focus or a click goes elsewhere;
 * - pinned: the handle, the assistant or the tour; closes with its Hide
 *   control or "close the sets";
 * - peek: a set saved or an option shortlisted while it is closed; closes by
 *   itself, unless the pointer goes into it, which makes it a hover.
 *
 * Or docked (the pin in its header): no longer a drawer but a column beside
 * the panels, as wide as its edge is dragged, kept across visits (see
 * setsDock.js). Opening and closing the drawer then change nothing on
 * screen, so the tour and the assistant need not know which it is.
 */
export default {
  name: "SetsDrawer",
  components: { SetsView },
  data() {
    // The width while the edge is being dragged; stored when it is let go.
    return { dragWidth: null };
  },
  computed: {
    ...mapState({
      drawer: (state) => state.setsDrawer,
      setsDock: (state) => state.setsDock,
      setsMap: (state) => state.setsMap,
      cartCount: (state) => state.cart.length,
    }),
    open() {
      return this.drawer.open;
    },
    docked() {
      return this.setsDock.docked;
    },
    width() {
      return this.dragWidth !== null ? this.dragWidth : this.setsDock.width;
    },
    minWidth() {
      return DOCK_MIN_WIDTH;
    },
    maxWidth() {
      return DOCK_MAX_WIDTH;
    },
    setCount() {
      return Object.keys(this.setsMap || {}).length;
    },
    title() {
      return "Saved sets";
    },
  },
  watch: {
    // Sets restored from the session are in the store from the start, so
    // only a set saved now counts.
    setCount(next, previous) {
      if (next > previous) this.peek();
    },
    cartCount(next, previous) {
      if (next > previous) this.peek();
    },
    open(value) {
      if (!value) {
        this.clearTimers();
        this.unlisten();
      }
    },
  },
  created() {
    // Not reactive: nothing renders from them.
    this.pointerInside = false;
    this.listening = false;
    this.edgeDrag = null;
  },
  beforeDestroy() {
    this.clearTimers();
    this.unlisten();
    this.stopEdgeDrag();
  },
  methods: {
    /** From the drawer: becomes the column, and the drawer's own state is let go. */
    dock() {
      this.clearTimers();
      this.unlisten();
      this.$store.commit("setSetsDrawer", { open: false });
      this.$store.commit("setSetsDock", { docked: true });
    },
    /** Back to the drawer, closed: the panels take the room back. */
    undock() {
      this.stopEdgeDrag();
      this.$store.commit("setSetsDrawer", { open: false });
      this.$store.commit("setSetsDock", { docked: false });
    },
    onEdgeDown(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      this.edgeDrag = { from: event.clientX, width: this.width };
      window.addEventListener("pointermove", this.onEdgeMove);
      window.addEventListener("pointerup", this.onEdgeUp);
      window.addEventListener("pointercancel", this.onEdgeUp);
      // The same body classes as the seams between panels: no text selected
      // on the way, and the resize cursor wherever the pointer goes.
      document.body.classList.add("ds-seam-dragging", "ds-seam-dragging--v");
    },
    onEdgeMove(event) {
      if (!this.edgeDrag) return;
      this.dragWidth = clampDockWidth(
        this.edgeDrag.width + event.clientX - this.edgeDrag.from
      );
    },
    onEdgeUp() {
      if (!this.edgeDrag) return;
      let width = this.dragWidth;
      this.stopEdgeDrag();
      if (width !== null) this.$store.commit("setSetsDock", { width: width });
    },
    stopEdgeDrag() {
      this.edgeDrag = null;
      this.dragWidth = null;
      window.removeEventListener("pointermove", this.onEdgeMove);
      window.removeEventListener("pointerup", this.onEdgeUp);
      window.removeEventListener("pointercancel", this.onEdgeUp);
      document.body.classList.remove("ds-seam-dragging", "ds-seam-dragging--v");
    },
    onEdgeKey(event) {
      let step = { ArrowLeft: -16, ArrowRight: 16 }[event.key];
      if (!step) return;
      event.preventDefault();
      this.$store.commit("setSetsDock", { width: this.width + step });
    },
    resetWidth() {
      this.$store.commit("setSetsDock", { width: DOCK_DEFAULT_WIDTH });
    },
    show(pinned) {
      this.$store.commit("setSetsDrawer", { open: true, pinned: pinned });
    },
    close() {
      this.clearTimers();
      this.unlisten();
      this.$store.commit("setSetsDrawer", { open: false });
    },
    clearTimers() {
      clearTimeout(this.openTimer);
      clearTimeout(this.closeTimer);
      clearTimeout(this.peekTimer);
    },
    onEnter() {
      this.pointerInside = true;
      clearTimeout(this.closeTimer);
      // A peek the pointer goes into stays until the pointer leaves.
      clearTimeout(this.peekTimer);
      if (this.open) return;
      clearTimeout(this.openTimer);
      this.openTimer = setTimeout(() => {
        if (this.pointerInside && !this.open) this.show(false);
      }, OPEN_DELAY_MS);
    },
    onLeave() {
      this.pointerInside = false;
      clearTimeout(this.openTimer);
      if (!this.open || this.drawer.pinned) return;
      clearTimeout(this.closeTimer);
      this.closeTimer = setTimeout(this.closeUnlessHeld, CLOSE_DELAY_MS);
    },
    closeUnlessHeld() {
      if (!this.open || this.drawer.pinned || this.pointerInside) return;
      if (this.isHeld()) {
        this.listen();
        return;
      }
      this.close();
    },
    /** Focus inside, or a menu it opened (menus render outside it). */
    isHeld() {
      let drawer = this.$refs.drawer && this.$refs.drawer.$el;
      if (drawer && drawer.contains(document.activeElement)) return true;
      return !!document.querySelector(".v-menu__content.menuable__content__active");
    },
    isOwn(target) {
      return (
        !!target &&
        (this.$el.contains(target) ||
          (target.closest && !!target.closest(".v-menu__content")))
      );
    },
    // While held, a click or focus anywhere else lets it go.
    listen() {
      if (this.listening) return;
      this.listening = true;
      document.addEventListener("pointerdown", this.onElsewhere, true);
      document.addEventListener("focusin", this.onElsewhere, true);
    },
    unlisten() {
      if (!this.listening) return;
      this.listening = false;
      document.removeEventListener("pointerdown", this.onElsewhere, true);
      document.removeEventListener("focusin", this.onElsewhere, true);
    },
    onElsewhere(event) {
      if (this.isOwn(event.target)) return;
      this.unlisten();
      if (!this.drawer.pinned && !this.pointerInside) this.close();
    },
    peek() {
      // The tour saves a set and fills the shortlist for its own steps, and
      // opens the drawer itself where it wants it.
      // Docked, the sets are already in sight.
      if (this.docked || this.open || this.isTourRunning()) return;
      this.show(false);
      clearTimeout(this.peekTimer);
      this.peekTimer = setTimeout(() => {
        if (!this.pointerInside) this.closeUnlessHeld();
      }, PEEK_MS);
    },
    isTourRunning() {
      let tours = this.$tours || {};
      return Object.keys(tours).some((name) => tours[name] && tours[name].isRunning);
    },
    onHandleClick(event) {
      clearTimeout(this.openTimer);
      clearTimeout(this.peekTimer);
      this.show(true);
      // From the keyboard (a click with no pointer behind it), take focus in.
      if (event.detail === 0) {
        this.$nextTick(() => {
          let drawer = this.$refs.drawer && this.$refs.drawer.$el;
          let first = drawer && drawer.querySelector(FOCUSABLE);
          if (first) first.focus();
        });
      }
    },
  },
};
</script>

<style scoped>
/* Not positioned itself, so the drawer inside is placed against the work area. */
.sets-rail {
  box-sizing: border-box;
  /* As wide as its sideways label needs, at any text size. */
  flex: 0 0 calc(16px * var(--ds-text-scale));
  display: flex;
  align-items: center;
  background: #eceff1;
  border-right: 1px solid #d5dce2;
  transition: background-color 0.12s;
}
.sets-rail:hover {
  background: #dfe5e9;
}
/* A tab in the top bar's colour, so the closed drawer still says it's there. */
.sets-handle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: calc(15px * var(--ds-text-scale));
  padding: 10px 0;
  border: none;
  border-radius: 0 6px 6px 0;
  background: #455a64;
  color: #fff;
  cursor: pointer;
  transition: background-color 0.12s;
}
.sets-handle:hover,
.sets-handle:focus-visible,
.sets-rail:hover .sets-handle {
  background: #263238;
}
.sets-handle-icon.v-icon {
  color: inherit;
}
/* Read from the bottom up, as a spine at the left edge is. */
.sets-handle-label {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: var(--ds-fs-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.sets-handle-count {
  min-width: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background: #fff;
  color: #263238;
  font-size: var(--ds-fs-2xs);
  font-weight: 600;
  line-height: calc(14px * var(--ds-text-scale));
  text-align: center;
}
/* Beside the panels rather than over them, so no shadow: a border, like
   the one between two panels. Above the workspace only so that the edge's
   grab area, which reaches a few pixels over the first panel, takes the
   pointer there. */
.sets-dock {
  position: relative;
  z-index: 26;
  box-sizing: border-box;
  flex: 0 0 auto;
  height: 100%;
  min-width: 0;
  background: #fff;
  border-right: 1px solid #d5dce2;
}
.sets-dock-edge {
  position: absolute;
  top: 0;
  right: -5px;
  width: 10px;
  height: 100%;
  display: flex;
  justify-content: center;
  cursor: col-resize;
  touch-action: none;
}
.sets-dock-grip {
  width: 3px;
  height: 100%;
  border-radius: 2px;
  background: transparent;
  transition: background 100ms;
}
.sets-dock-edge:hover .sets-dock-grip,
.sets-dock-edge:focus-visible .sets-dock-grip {
  background: #1565c0;
}
.sets-dock-edge:focus {
  outline: none;
}
/* Over the panels (25 is a panel being dragged), under the tour's highlight,
   with a shadow that says it lies on top of them. */
.sets-drawer.v-navigation-drawer--absolute {
  z-index: 26;
  box-shadow: 2px 0 10px rgba(38, 50, 56, 0.18);
}
</style>
