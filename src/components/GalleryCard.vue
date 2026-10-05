<template>
  <!-- Plain elements, not v-card, v-img and v-icon: a screen of cards is a
       hundred of each, and a filter that changes which options are shown
       builds or patches all of them. The classes keep the v-card look. -->
  <div
    class="thumbnail_card"
    :class="{
      hovered: isHovered,
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
      <!-- Until it loads, a grey 4:3 box fills the column; then the card is
           as wide as the picture, up to the column, and as tall as its
           proportions make it. -->
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

    <!-- Only the details layout shows a card's values, and only once opened. -->
    <v-expansion-panels v-if="showDetails" v-model="openPanel">
      <v-expansion-panel>
        <v-expansion-panel-header>
          <template v-slot:default="{ open }">
            <span v-if="!open" class="details-hint">Expand for Details</span>
          </template>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
          <v-list v-if="openPanel === 0">
            <v-list-item
              v-for="param in detailKeys"
              :key="param"
              style="min-height: 28px;"
            >
              <v-list-item-content style="font-weight: bold; padding: 6px 0;"
                ><DimensionName :name="param"
              /></v-list-item-content>
              <v-list-item-content
                style="padding: 6px 0;"
                class="justify-center"
              >
                {{ formatParam(param) }}
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script>
import {
  mdiBookmarkCheck,
  mdiBookmarkPlusOutline,
  mdiImageMultiple,
  mdiMinus,
  mdiPlus,
} from "@mdi/js";
import { formatValue } from "@/store/filters.js";
import { optionName } from "@/columns.js";
import { FALLBACK_IMAGE } from "@/components/constants.js";
import DimensionName from "@/components/DimensionName.vue";

const ICONS = Object.freeze({
  plus: mdiPlus,
  minus: mdiMinus,
  views: mdiImageMultiple,
  inCart: mdiBookmarkCheck,
  addToCart: mdiBookmarkPlusOutline,
});

/**
 * One gallery thumbnail. A card of its own so that it re-renders only when
 * its own state changes: filtering, selecting, hovering or sorting the gallery
 * then patches the cards whose state changed rather than every card on screen.
 * Everything it shows about the collection arrives as plain props.
 */
export default {
  name: "GalleryCard",
  components: { DimensionName },
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
  },
  data() {
    return {
      failed: false,
      // The source the image last finished loading. A card handed another
      // option keeps it, so a picture the two share counts as loaded at once.
      loadedSrc: null,
      // The details panel's open index; undefined while closed.
      openPanel: undefined,
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
      return this.failed || !this.item.image ? FALLBACK_IMAGE : this.item.image;
    },
    isLoaded() {
      return this.loadedSrc !== null && this.loadedSrc === this.shownSrc;
    },
    viewCount() {
      return this.item.images ? this.item.images.length : 0;
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
      this.openPanel = undefined;
    },
  },
  methods: {
    onLoad() {
      this.loadedSrc = this.shownSrc;
      this.$emit("load");
    },
    // The fallback is inline, so it can't fail in turn.
    onError() {
      this.failed = true;
    },
    /** Custom and weighted values are rounded; "—" when missing. */
    formatParam(param) {
      // Rows are not reactive (see store/rows.js): the version redraws edits.
      void this.$store.state.dimensionValuesVersion;
      let value = this.item[param];
      let bounds = this.$store.getters.fixedBoundsOf(param);
      if (!bounds) return value;
      return typeof value === "number" && isFinite(value)
        ? formatValue(value, bounds[1] - bounds[0])
        : "—";
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
  max-width: 100%;
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
  border: 3px solid transparent;
  /* Three for the edge outside the picture's own four. */
  border-radius: 7px;
  background-color: #fff;
  color: rgba(0, 0, 0, 0.87);
  box-shadow: 0 3px 1px -2px rgba(0, 0, 0, 0.2), 0 2px 2px 0 rgba(0, 0, 0, 0.14),
    0 1px 5px 0 rgba(0, 0, 0, 0.12);
}

.card-image {
  position: relative;
  overflow: hidden;
  /* Not inherit: that is now the outer radius, with the edge outside it. */
  border-radius: 4px;
  cursor: pointer;
}

/* The details panel below it takes the bottom corners. */
.card-image:not(:last-child) {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.card-image__img {
  display: block;
  max-width: 100%;
  height: auto;
}

/* The column is a flex box, so the card's width follows the picture; with no
   picture yet that is nothing, and a box of no size is never loaded lazily. */
.thumbnail_card--loading {
  width: 100%;
}

.thumbnail_card--loading .card-image__img {
  width: 100%;
  aspect-ratio: 4 / 3;
  background-color: #eceff1;
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

.details-hint {
  text-align: center;
  font-size: smaller;
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

.thumbnail_card .card-image.transparent {
  opacity: 0.35;
}

/* Lite: unselected options stay in the pool, dimmed. Only the picture fades,
   so the card's select button stays readable. */
.card-image.gallery-dimmed > .card-image__img {
  opacity: 0.3;
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
  font-size: 11px;
  line-height: 18px;
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
  line-height: 18px;
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
