<template>
  <!-- The rail: a strip down the workspace's left edge that is always there,
       so the saved sets never go out of sight entirely. Resting the pointer
       on it opens the drawer; its handle opens it to stay. The drawer is a
       child of the rail, positioned against the work area around both, so one
       pair of enter and leave events covers the rail and the drawer. -->
  <div class="sets-rail" @mouseenter="onEnter" @mouseleave="onLeave">
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
      width="280"
      class="sets-drawer"
      style="position: absolute"
    >
      <SetsView @close="close" />
    </v-navigation-drawer>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import SetsView from "@/components/SetsView.vue";

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
 */
export default {
  name: "SetsDrawer",
  components: { SetsView },
  computed: {
    ...mapState({
      drawer: (state) => state.setsDrawer,
      setsMap: (state) => state.setsMap,
      cartCount: (state) => state.cart.length,
    }),
    ...mapGetters(["isLite"]),
    open() {
      return this.drawer.open;
    },
    setCount() {
      return Object.keys(this.setsMap || {}).length;
    },
    title() {
      return this.isLite ? "Saved sets" : "Sets";
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
  },
  beforeDestroy() {
    this.clearTimers();
    this.unlisten();
  },
  methods: {
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
      if (this.open || this.isTourRunning()) return;
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
  flex: 0 0 16px;
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
  width: 15px;
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
  font-size: 11px;
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
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
  text-align: center;
}
/* Over the panels (25 is a panel being dragged), under the tour's highlight,
   with a shadow that says it lies on top of them. */
.sets-drawer.v-navigation-drawer--absolute {
  z-index: 26;
  box-shadow: 2px 0 10px rgba(38, 50, 56, 0.18);
}
</style>
