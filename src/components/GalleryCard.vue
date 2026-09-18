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
              <v-list-item-content style="font-weight: bold; padding: 6px 0;">{{
                label(param)
              }}</v-list-item-content>
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
import { displayName, optionName } from "@/columns.js";
import { FALLBACK_IMAGE } from "@/components/constants.js";

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
    label: displayName,
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
  border-radius: 4px;
  background-color: #fff;
  color: rgba(0, 0, 0, 0.87);
  box-shadow: 0 3px 1px -2px rgba(0, 0, 0, 0.2), 0 2px 2px 0 rgba(0, 0, 0, 0.14),
    0 1px 5px 0 rgba(0, 0, 0, 0.12);
}

.card-image {
  position: relative;
  overflow: hidden;
  border-radius: inherit;
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
  border: 2px dashed rgb(33, 119, 180);
}

.thumbnail_card:not(.hovered) .card-image.outlined {
  border: 3px solid rgb(33, 119, 180);
  background-color: lightgray;
}

.thumbnail_card:not(.hovered) .card-image.outlined > .card-image__img {
  scale: 0.9;
}

.thumbnail_card.hovered .card-image.outlined {
  margin: 2px;
  border: 3px solid rgb(33, 119, 180);
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

.thumbnail_card.hovered {
  border: 3px dashed rgb(33, 119, 180);
}

/* Bottom right: Expert's checkbox holds the top left, Lite's select button
   the top right. Shortlisted cards keep it visible, so membership reads while
   scrolling. */
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
  background-color: rgba(245, 124, 0, 0.95);
}
.thumbnail_card--shortlisted {
  box-shadow: inset 3px 0 0 #f57c00 !important;
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

.image_checkbox {
  width: 18px;
  height: 18px;
  display: inline;
  position: absolute;
  top: 3%;
  left: 3%;
}

.image_checkbox:checked {
  top: -3%;
  left: -3%;
}

.xbtn {
  position: absolute;
  top: -6%;
  left: -4%;
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
