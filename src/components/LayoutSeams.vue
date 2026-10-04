<template>
  <div class="ds-seams">
    <div
      v-for="seam in seams"
      :key="seam.id"
      class="ds-seam"
      :class="'ds-seam--' + seam.axis"
      :style="styleOf(seam)"
      role="separator"
      tabindex="0"
      :aria-label="labelOf(seam)"
      :aria-orientation="seam.axis === 'v' ? 'vertical' : 'horizontal'"
      :aria-valuenow="seam.at"
      :aria-valuemin="seam.min"
      :aria-valuemax="seam.max"
      @pointerdown="onDown(seam, $event)"
      @keydown="onKey(seam, $event)"
    >
      <span class="ds-seam-grip" />
    </div>
  </div>
</template>

<script>
import { PANEL_LABELS, layoutSeams, moveSeam } from "@/layout.js";

// Half the pointer target's thickness, in px. The line itself is thinner;
// this is how close the pointer has to come.
const GRAB = 5;

/**
 * The draggable edges between panels, as an overlay above them.
 *
 * It never touches a panel component. A drag only works out a new
 * arrangement with layout.js and hands it up, and the panels follow the same
 * way they follow a resized window -- through Card's layout props. That is
 * also why this works in Lite, where the panels' own handles are off.
 */
export default {
  name: "LayoutSeams",
  props: {
    layouts: { type: Array, required: true },
    unitW: { type: Number, required: true },
    unitH: { type: Number, required: true },
  },
  data() {
    return { dragging: null };
  },
  beforeDestroy() {
    this.stopListening();
  },
  computed: {
    seams() {
      return layoutSeams(this.layouts);
    },
  },
  methods: {
    unitFor(seam) {
      return seam.axis === "v" ? this.unitW : this.unitH;
    },
    styleOf(seam) {
      let along = seam.axis === "v" ? this.unitH : this.unitW;
      let at = seam.at * this.unitFor(seam);
      let from = seam.from * along;
      let length = (seam.to - seam.from) * along;
      if (seam.axis === "v") {
        return {
          left: at - GRAB + "px",
          top: from + "px",
          width: GRAB * 2 + "px",
          height: length + "px",
        };
      }
      return {
        top: at - GRAB + "px",
        left: from + "px",
        height: GRAB * 2 + "px",
        width: length + "px",
      };
    },
    labelOf(seam) {
      let name = (type) => PANEL_LABELS[type] || type;
      return (
        "Resize " +
        seam.before.map(name).join(" and ") +
        " against " +
        seam.after.map(name).join(" and ")
      );
    },
    onDown(seam, event) {
      if (event.button !== 0) return;
      event.preventDefault();
      this.dragging = {
        seam: seam,
        pointer: event.pointerId,
        from: seam.axis === "v" ? event.clientX : event.clientY,
        at: seam.at,
      };
      window.addEventListener("pointermove", this.onMove);
      window.addEventListener("pointerup", this.onUp);
      window.addEventListener("pointercancel", this.onUp);
      // Otherwise the drag selects the labels it passes over.
      document.body.classList.add("ds-seam-dragging");
      document.body.classList.add("ds-seam-dragging--" + seam.axis);
    },
    onMove(event) {
      let drag = this.dragging;
      if (!drag) return;
      let seam = drag.seam;
      let now = seam.axis === "v" ? event.clientX : event.clientY;
      let at = drag.at + (now - drag.from) / this.unitFor(seam);
      let moved = moveSeam(this.layouts, seam, at);
      // moveSeam hands back the same array when the drag stayed in one cell.
      if (moved !== this.layouts) this.$emit("preview", moved);
    },
    onUp() {
      if (!this.dragging) return;
      this.stopListening();
      this.$emit("commit");
    },
    stopListening() {
      this.dragging = null;
      window.removeEventListener("pointermove", this.onMove);
      window.removeEventListener("pointerup", this.onUp);
      window.removeEventListener("pointercancel", this.onUp);
      document.body.classList.remove("ds-seam-dragging");
      document.body.classList.remove("ds-seam-dragging--v");
      document.body.classList.remove("ds-seam-dragging--h");
    },
    onKey(seam, event) {
      let back = seam.axis === "v" ? "ArrowLeft" : "ArrowUp";
      let on = seam.axis === "v" ? "ArrowRight" : "ArrowDown";
      let step = event.key === back ? -1 : event.key === on ? 1 : 0;
      if (step === 0) return;
      event.preventDefault();
      let moved = moveSeam(this.layouts, seam, seam.at + step);
      if (moved === this.layouts) return;
      this.$emit("preview", moved);
      this.$emit("commit");
    },
  },
};
</script>

<style scoped>
/* Over the panels, under the sets drawer. Only the handles take the pointer,
   so the panels below are reached everywhere else. */
.ds-seams {
  position: absolute;
  inset: 0;
  z-index: 25;
  pointer-events: none;
}
.ds-seam {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  touch-action: none;
}
.ds-seam--v {
  cursor: col-resize;
}
.ds-seam--h {
  cursor: row-resize;
}
/* Nothing to see until the pointer is on it: the seam is already drawn, by
   the two panel borders that meet there. */
.ds-seam-grip {
  background: transparent;
  border-radius: 2px;
  transition: background 100ms;
}
.ds-seam--v .ds-seam-grip {
  width: 3px;
  height: 100%;
}
.ds-seam--h .ds-seam-grip {
  height: 3px;
  width: 100%;
}
.ds-seam:hover .ds-seam-grip,
.ds-seam:focus-visible .ds-seam-grip {
  background: #1565c0;
}
.ds-seam:focus {
  outline: none;
}
</style>

<style>
body.ds-seam-dragging {
  user-select: none;
}
/* The resize cursor follows the pointer wherever the drag takes it. */
body.ds-seam-dragging--v,
body.ds-seam-dragging--v * {
  cursor: col-resize !important;
}
body.ds-seam-dragging--h,
body.ds-seam-dragging--h * {
  cursor: row-resize !important;
}
</style>
