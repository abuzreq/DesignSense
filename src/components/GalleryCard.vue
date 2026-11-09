<template>
  <!-- Plain elements, not v-card, v-img and v-icon: a screen of cards is a
       hundred of each, and a filter that changes which options are shown
       builds or patches all of them. The classes keep the v-card look. -->
  <div
    class="thumbnail_card"
    :class="{
      hovered: isHovered,
      'thumbnail_card--dimmed': isDimmed,
      'thumbnail_card--shortlisted': inCart,
      'thumbnail_card--loading': !isLoaded,
    }"
    :id="cardId"
  >
    <!-- A button to the keyboard as well as the mouse: Tab reaches it, and
         Enter or Space inspects, as a click does. Space is stopped here so it
         doesn't also start the hold-Space inspection the workspace listens for. -->
    <div
      class="card-image"
      :class="imageClasses"
      tabindex="0"
      role="button"
      :aria-label="'Inspect ' + altText"
      @mouseover="$emit('hover', item)"
      @click="$emit('inspect', item)"
      @keydown.enter.prevent="$emit('inspect', item)"
      @keydown.space.prevent.stop="$emit('inspect', item)"
    >
      <!-- The frame is the gallery's shape (--thumb-aspect) and fills the
           column; the picture fits inside it, centred, whatever its own
           shape, so every card in a row is the same size, grey until its
           picture loads. -->
      <img
        class="card-image__img"
        :src="shownSrc"
        :alt="altText"
        loading="lazy"
        @load="onLoad"
        @error="onError"
      />
      <button
        v-if="control === 'gallery'"
        class="gallery-toggle"
        :title="inGallery ? 'Unselect' : 'Select'"
        @mousedown.stop
        @click.stop="$emit('toggle-gallery', item)"
      >
        <svg class="card-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path :d="inGallery ? icons.minus : icons.plus" />
        </svg>
      </button>
      <input
        v-else-if="control === 'checkbox'"
        class="image_checkbox"
        type="checkbox"
        :checked="checked"
        title="Select this option"
        aria-label="Select this option"
        @click="$emit('toggle', item, $event)"
      />
      <button
        v-else-if="control === 'xbutton'"
        class="xbtn"
        title="Remove from selection"
        aria-label="Remove from selection"
        @click="$emit('toggle', item, $event)"
      />
      <!-- Cards always show the first view, so scrolling and the clusters
           stay put; the badge says there is more to see in the inspector. -->
      <span v-if="viewCount > 1" class="view-badge" :title="viewCount + ' views'">
        <svg class="card-icon card-icon--x-small" viewBox="0 0 24 24" aria-hidden="true">
          <path :d="icons.views" />
        </svg>
        {{ viewCount }}
      </span>
      <!-- The shortlist is not the selection: it keeps an option aside while
           the filters and the selection keep changing. Its own corner, so it
           is never mistaken for Lite's select button above it. -->
      <button
        class="cart-toggle"
        :class="{ 'cart-toggle--on': inCart }"
        :title="
          inCart
            ? 'On the shortlist'
            : 'Keep aside on the shortlist for comparing'
        "
        :aria-label="inCart ? 'Remove from the shortlist' : 'Add to the shortlist'"
        @mousedown.stop
        @click.stop="$emit('toggle-cart', item)"
      >
        <svg class="card-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path :d="inCart ? icons.inCart : icons.addToCart" />
        </svg>
      </button>
    </div>

    <!-- The values, when the gallery asks for them, and only once opened:
         the same dimensions in the same order on every card, so a row reads
         across the cards, and their scrolling moves together (see the
         gallery's syncValuesScroll). -->
    <div v-if="showDetails" class="card-details">
      <button
        type="button"
        class="card-details-toggle"
        :aria-expanded="String(valuesOpen)"
        @click="$emit('toggle-values', item)"
      >
        <span>Values</span>
        <svg class="card-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path :d="valuesOpen ? icons.up : icons.down" />
        </svg>
      </button>
      <div v-if="valuesOpen" ref="values" class="card-values">
        <div v-for="param in detailKeys" :key="param" class="card-value-row">
          <span class="card-value-name" :title="nameTitle(param)">
            <i
              v-if="param === colorColumn"
              class="card-value-swatch"
              :style="{ background: swatch }"
            />
            <span class="card-value-label">{{ label(param) }}</span>
            <span v-if="goalMark(param)" class="card-value-goal">{{
              goalMark(param)
            }}</span>
          </span>
          <span
            class="card-value"
            :class="{ 'card-value--missing': isMissing(param) }"
            :title="valueTitle(param)"
            >{{ formatParam(param) }}</span
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  mdiBookmarkCheck,
  mdiBookmarkPlusOutline,
  mdiChevronDown,
  mdiChevronUp,
  mdiImageMultiple,
  mdiMinus,
  mdiPlus,
} from "@mdi/js";
import { formatValue } from "@/store/filters.js";
import { GOAL_MARKS, displayName, optionName } from "@/columns.js";
import { FALLBACK_IMAGE } from "@/components/constants.js";
import { IMAGE_WIDTH, imageAtWidth } from "@/data/assets.js";

const ICONS = Object.freeze({
  plus: mdiPlus,
  minus: mdiMinus,
  views: mdiImageMultiple,
  inCart: mdiBookmarkCheck,
  addToCart: mdiBookmarkPlusOutline,
  up: mdiChevronUp,
  down: mdiChevronDown,
});

/**
 * One gallery thumbnail. A card of its own so that it re-renders only when
 * its own state changes: filtering, selecting, hovering or sorting the gallery
 * then patches the cards whose state changed rather than every card on screen.
 * Everything it shows about the collection arrives as plain props.
 */
export default {
  name: "GalleryCard",
  props: {
    item: { type: Object, required: true },
    cardId: { type: String, required: true },
    // Which selection control the card offers: "gallery" (Lite's -/+),
    // "checkbox", "xbutton" or none.
    control: { type: String, default: null },
    // Lite: whether the option is selected in the gallery.
    inGallery: { type: Boolean, default: true },
    // Lite: whether a drag-selection box is over the card.
    underDrag: { type: Boolean, default: false },
    // Expert: selected, and dimmed for not being selected.
    outlined: { type: Boolean, default: false },
    transparent: { type: Boolean, default: false },
    checked: { type: Boolean, default: false },
    showDetails: { type: Boolean, default: false },
    detailKeys: { type: Array, default: () => [] },
    // Per dimension listed, how its values are written: { span, magnitude }
    // over the whole collection, so a column reads the same on every card.
    detailScales: { type: Object, default: () => ({}) },
    // Per dimension with a goal, "max" or "min".
    detailGoals: { type: Object, default: () => ({}) },
    // The dimension the colours follow; its row shows the card's colour.
    colorColumn: { type: String, default: "" },
    // Whether the values show: the gallery's choice, made for a whole row
    // of cards at once (see its openRows).
    valuesOpen: { type: Boolean, default: false },
  },
  data() {
    return {
      failed: false,
      // The source the image last finished loading. A card handed another
      // option keeps it, so a picture the two share counts as loaded at once.
      loadedSrc: null,
      isHovered: false,
      inCart: false,
    };
  },
  created() {
    this.icons = ICONS;
    // Every card checks the hovered option, but only the two whose answer
    // changes re-render; a prop would re-render the whole gallery instead.
    this.$watch(
      () => {
        let hovered = this.$store.state.hovered;
        return !!hovered && hovered._id === this.item._id;
      },
      (value) => {
        this.isHovered = value;
      },
      { immediate: true }
    );
    // Same reason: one Set lookup per card, and only the card whose answer
    // flipped re-renders when the shortlist changes.
    this.$watch(
      () => this.$store.getters.isInCart(this.item._id),
      (value) => {
        this.inCart = value;
      },
      { immediate: true }
    );
  },
  computed: {
    altText() {
      return optionName(this.item);
    },
    // An option with no picture shows the fallback, as one whose picture
    // failed does.
    shownSrc() {
      if (this.failed || !this.item.image) return FALLBACK_IMAGE;
      // A card is 170 pixels wide at the usual size and 340 at the largest.
      // Where the host lets us say so, it is sent that rather than the
      // inspector's copy (see data/assets.js).
      return imageAtWidth(this.item.image, IMAGE_WIDTH.card);
    },
    // The colour the card's edge is painted (see the gallery's paintCardEdges).
    swatch() {
      if (!this.colorColumn) return null;
      return this.$store.getters.colorize(this.item);
    },
    isLoaded() {
      return this.loadedSrc !== null && this.loadedSrc === this.shownSrc;
    },
    viewCount() {
      return this.item.images ? this.item.images.length : 0;
    },
    /** Unselected (Expert) or left out (Lite): the picture and edge fade. */
    isDimmed() {
      return this.control === "gallery" ? !this.inGallery : this.transparent;
    },
    imageClasses() {
      if (this.control === "gallery") {
        return {
          "gallery-dimmed": !this.inGallery,
          under_drag_selection: this.underDrag,
        };
      }
      return { outlined: this.outlined, transparent: this.transparent };
    },
  },
  watch: {
    // Cards are reused for other items as the gallery scrolls and filters.
    "item._id": function() {
      this.failed = false;
    },
    // The gallery scrolls a newly opened list to where the others are.
    valuesOpen: function(open) {
      if (open) this.$nextTick(() => this.$emit("values-open", this.$refs.values));
    },
  },
  methods: {
    onLoad(event) {
      this.loadedSrc = this.shownSrc;
      this.$emit("load", event);
    },
    // The fallback is inline, so it can't fail in turn.
    onError() {
      this.failed = true;
    },
    label: displayName,
    goalMark(param) {
      let goal = GOAL_MARKS[this.detailGoals[param]];
      return goal ? goal.mark : "";
    },
    nameTitle(param) {
      let goal = GOAL_MARKS[this.detailGoals[param]];
      return displayName(param) + (goal ? " (" + goal.title.toLowerCase() + ")" : "");
    },
    isMissing(param) {
      // Rows are not reactive (see store/rows.js): the version redraws edits.
      void this.$store.state.dimensionValuesVersion;
      let value = this.item[param];
      return value === undefined || value === null || value === "" ||
        (typeof value === "number" && !isFinite(value));
    },
    /**
     * Numbers to the precision their spread calls for, large ones compacted
     * (12.4k), every card's the same way; text as it is; "—" when missing.
     */
    formatParam(param) {
      void this.$store.state.dimensionValuesVersion;
      if (this.isMissing(param)) return "—";
      let value = this.item[param];
      if (typeof value !== "number") return String(value);
      let scale = this.detailScales[param] || {};
      return formatValue(value, scale.span || 0, scale.magnitude);
    },
    // The value as it is in the data, where rounding or cutting short hid some.
    valueTitle(param) {
      if (this.isMissing(param)) return "No value";
      return String(this.item[param]);
    },
  },
};
</script>

<style scoped>
/* What v-card and v-img gave the card: a raised white sheet whose picture
   fills its width, corners rounded, with the controls laid over it. */
.thumbnail_card {
  position: relative;
  display: block;
  /* The whole column, so pictures grow with it rather than stopping at
     their own size. */
  width: 100%;
  box-sizing: border-box;
  /*
   * The edge the chart's colour is painted on (see paintCardEdges). Reserved
   * whether or not there is a colour for it, the way SensitivityDialog's
   * .ax-orow reserves its marker: a card is sized by its picture, so an edge
   * that came and went would resize every picture in the gallery the moment
   * a colour dimension was chosen or cleared.
   *
   * The colour goes here and not in the four pixels of column padding around
   * the card, where it started: each card's four pixels meet its neighbour's,
   * so every gutter became an eight-pixel band and the grid read as a
   * coloured lattice rather than as cards. Design Explorer rings its own
   * thumbnails and scales the cells to nine tenths for the same reason --
   * white has to separate one from the next.
   */
  border: 3px solid var(--card-edge, transparent);
  /* Three for the edge outside the picture's own four. */
  border-radius: 7px;
  background-color: #fff;
  color: rgba(0, 0, 0, 0.87);
  box-shadow: 0 3px 1px -2px rgba(0, 0, 0, 0.2), 0 2px 2px 0 rgba(0, 0, 0, 0.14),
    0 1px 5px 0 rgba(0, 0, 0, 0.12);
}

.card-image {
  position: relative;
  box-sizing: border-box;
  aspect-ratio: var(--thumb-aspect, 4 / 3);
  overflow: hidden;
  background-color: #eef1f4;
  /* Not inherit: that is now the outer radius, with the edge outside it. */
  border-radius: 4px;
  cursor: pointer;
}

/* The details panel below it takes the bottom corners. */
.card-image:not(:last-child) {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

/* Fitted, not cropped: a picture of another shape than the frame keeps all
   of itself, with the frame's grey either side. */
.card-image__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Until its picture arrives, the frame shimmers: a soft light passing
   across it says something is on its way, where a still grey box looked
   empty. Still, for anyone who asks for less motion. */
.thumbnail_card--loading .card-image {
  background-image: linear-gradient(
    100deg,
    rgba(255, 255, 255, 0) 30%,
    rgba(255, 255, 255, 0.7) 50%,
    rgba(255, 255, 255, 0) 70%
  );
  background-size: 250% 100%;
  animation: card-shimmer 1.4s ease-in-out infinite;
}
.thumbnail_card--loading .card-image__img {
  opacity: 0;
}
@keyframes card-shimmer {
  from {
    background-position: 125% 0;
  }
  to {
    background-position: -25% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .thumbnail_card--loading .card-image {
    animation: none;
  }
}

.card-icon {
  width: 16px;
  height: 16px;
  fill: #fff;
}

.card-icon--x-small {
  width: 12px;
  height: 12px;
}

/* The values: a slim toggle, then name and value in two columns, the
   same rows in the same order on every card. Plain elements, as the rest
   of the card is (see the top), and sized to the card's caption text. */
.card-details {
  border-top: 1px solid #eceff1;
}
.card-details-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  height: calc(20px * var(--ds-text-scale));
  padding: 0 6px;
  border: 0;
  border-radius: 0 0 4px 4px;
  background: transparent;
  font: inherit;
  font-size: var(--ds-fs-xs);
  color: #546e7a;
  cursor: pointer;
}
.card-details-toggle:hover {
  background: #f5f7f8;
  color: #263238;
}
.card-details-toggle:focus-visible {
  outline: 2px solid var(--ds-focus);
  outline-offset: -2px;
}
.card-chevron {
  width: 14px;
  height: 14px;
  fill: currentColor;
}
/* Eight rows, then it scrolls; the gallery keeps every open card's list at
   the same place, so a row stays a row across the cards. */
/* The size is the gallery's choice (--values-font, --values-row), the same
   on every card so their rows stay level. */
.card-values {
  max-height: calc(8 * var(--values-row, 20px));
  overflow-y: auto;
  padding: 0 0 4px;
  border-top: 1px solid #eceff1;
  font-size: var(--values-font, 12.5px);
  line-height: var(--values-row, 20px);
}
.card-value-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  height: var(--values-row, 20px);
  padding: 0 6px;
}
.card-value-row:nth-child(even) {
  background: #f7f9fa;
}
.card-value-name {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: 1 1 auto;
  min-width: 0;
  color: #546e7a;
}
.card-value-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-value-goal {
  flex: 0 0 auto;
  color: #78909c;
}
.card-value-swatch {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
/* Never shrunk to make room for the name: a number cut to "2…" says
   nothing, a name cut to "Cooling[k…" still says which. Only a long text
   value, past 60% of the row, is cut. */
.card-value {
  flex: 0 0 auto;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: #263238;
}
.card-value--missing {
  font-weight: 400;
  color: #b0bec5;
}

.thumbnail_card:not(.hovered) .card-image.under_drag_selection {
  border: 2px dashed var(--ds-selected);
}

.card-image.outlined {
  border: 3px solid var(--ds-selected);
  background-color: lightgray;
}

.card-image.outlined > .card-image__img {
  scale: 0.9;
}

.thumbnail_card .card-image:not(.transparent) {
  opacity: 1;
}

/* Dimmed, but still easy to tell apart: the options not selected stay
   readable at a glance, a step behind the ones that are. */
.thumbnail_card .card-image.transparent {
  opacity: 0.5;
}

/* Lite: unselected options stay in the pool, dimmed. Only the picture fades,
   so the card's select button stays readable. */
.card-image.gallery-dimmed > .card-image__img {
  opacity: 0.5;
}

/* Under the pointer, a dimmed picture shows in full, to be looked at. */
.thumbnail_card .card-image.transparent:hover,
.card-image.gallery-dimmed:hover > .card-image__img {
  opacity: 1;
}

/* Its coloured edge softened too, further than the picture, so a row of
   dimmed cards doesn't read as a row of outlines. */
.thumbnail_card--dimmed {
  border-color: color-mix(in srgb, var(--card-edge, transparent) 25%, transparent);
}

/*
 * The option the inspector is showing -- which is the hovered one, since
 * hovering is what inspects.
 *
 * An outline rather than a border. The card is sized by its picture, so a
 * border is pixels the layout has not reserved: it grew the card by six and
 * the row under it by six, and every card to the right of it moved. An
 * outline is drawn over the card rather than in it, so nothing shifts.
 *
 * Solid and near-black, not dashed and blue. Dashed says provisional, which
 * this is not -- it is the option the whole inspector is given over to --
 * and on a card dashed already means "the drag box is about to take this
 * one in". The blue was worse: it is the selection's colour, and inspected
 * was told from selected by the dash alone. Near-black is nobody else's,
 * and it is what the matrix has always marked its hovered point with.
 *
 * Held two pixels off the card so a band of white separates it from the
 * colour on the card's own edge; against it they read as one striped band.
 * The pulse below closes that gap at its peak and opens it again at its
 * trough, which is most of what makes the pulse legible.
 *
 * Three pixels, matching that colour rather than being outweighed by it:
 * the edge is a fact about the option and the ring is which option is being
 * read, and the second should not be the fainter of the two.
 */
.thumbnail_card.hovered {
  outline: 3px solid var(--ds-inspected);
  outline-offset: 2px;
  /* Over its neighbours rather than under them. Cards are position:
     relative, so they and their pseudo-elements paint in tree order, and
     the glow below would be cut off square by the next card's white
     background while spilling freely over the previous one. One step up
     and it is symmetrical. */
  z-index: 1;
}

/*
 * The band that pulses. Its timing, its curve and the reduced-motion rule
 * are in App.vue, which the clusters and the shortlist strip share; here is
 * only where this one sits and how far it goes.
 *
 * The element is the card's own border box -- inset minus three, since an
 * absolutely positioned box is measured from the padding box and the colour
 * border is three pixels wide -- and it draws nothing itself. Only the
 * shadow outside it: five pixels of spread take it from the card's edge out
 * past the resting ring, and two of blur leave it an edge rather than a
 * wash. About six pixels of the eight-pixel gutter, so the neighbour's own
 * edge is never reached.
 */
.thumbnail_card.hovered::after {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: 7px;
  pointer-events: none;
  color: var(--ds-inspected);
  box-shadow: 0 0 2px 5px currentColor;
  opacity: 1;
  animation: ds-inspected-pulse var(--ds-pulse);
}

/*
 * The global focus ring (App.vue) is offset outward, which here would draw
 * it along the card's coloured edge in a blue a hair off the selection's.
 * Inside the picture instead, as CompareDialog and SensitivityDialog
 * already tighten it locally. The selector has to out-specify
 * `.v-application [tabindex]:not([tabindex="-1"]):focus-visible`, which is
 * four class-level parts; a bare `.card-image:focus-visible` is three and
 * would quietly lose.
 */
.thumbnail_card .card-image[tabindex]:focus-visible {
  outline-offset: -2px;
}

.view-badge {
  position: absolute;
  bottom: 4px;
  left: 4px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 5px;
  border-radius: 9px;
  background: rgba(38, 50, 56, 0.75);
  color: #fff;
  font-size: var(--ds-fs-xs);
  line-height: calc(18px * var(--ds-text-scale));
}

/* Its own corner, so it is never mistaken for Lite's select button above
   it. Shortlisted cards keep it visible, so membership reads while
   scrolling. */
.cart-toggle {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(69, 90, 100, 0.9);
  opacity: 0;
  transition: opacity 0.12s;
  cursor: pointer;
}
.thumbnail_card:hover .cart-toggle,
.cart-toggle:focus-visible,
.cart-toggle--on {
  opacity: 1;
}
.cart-toggle--on {
  background-color: var(--ds-shortlist);
}
/* Added to the card's elevation, not instead of it: box-shadow is one
   property, so the bare `inset` here was throwing the three layers above
   away and leaving every shortlisted card flat on the page. */
.thumbnail_card--shortlisted {
  box-shadow: inset 3px 0 0 var(--ds-shortlist), 0 3px 1px -2px rgba(0, 0, 0, 0.2),
    0 2px 2px 0 rgba(0, 0, 0, 0.14), 0 1px 5px 0 rgba(0, 0, 0, 0.12);
}

.gallery-toggle {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(21, 101, 192, 0.9);
  opacity: 0;
  transition: opacity 0.12s;
  cursor: pointer;
}

.thumbnail_card:hover .gallery-toggle,
.gallery-toggle:focus-visible {
  opacity: 1;
}

/* Inside the selected card's outline, not on it: the same place checked or
   not, clear of the corner. */
.image_checkbox {
  width: 18px;
  height: 18px;
  display: inline;
  position: absolute;
  top: 7px;
  left: 7px;
  margin: 0;
}

/* Where the checkbox it stands in for sits, so turning "show only the
   selected options" on and off does not move the control between corners.
   It was placed in percentages of the card -- top: -6%, left: -4% -- which
   put it outside .card-image, whose overflow is hidden: at a 173px card
   seven of its eighteen pixels were cut off against the top-left corner,
   with the rest sitting on the card's coloured edge, and the overhang grew
   with the thumbnails. */
.xbtn {
  position: absolute;
  top: 7px;
  left: 7px;
  height: 18px;
  line-height: calc(18px * var(--ds-text-scale));
  width: 18px;
  font-size: 0.85em;
  font-weight: bold;
  border-radius: 50%;
  background-color: #ef0000;
  color: white;
  text-align: center;
  cursor: pointer;
}
.xbtn::before {
  content: "x";
}
</style>
