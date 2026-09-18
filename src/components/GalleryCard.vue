<template>
  <v-card
    class="thumbnail_card"
    :class="{ hovered: isHovered, 'thumbnail_card--shortlisted': inCart }"
    :id="cardId"
  >
    <!-- A button to the keyboard as well as the mouse: Tab reaches it, and
         Enter or Space inspects, as a click does. Space is stopped here so it
         doesn't also start the hold-Space inspection the workspace listens for. -->
    <v-img
      :class="imageClasses"
      :src="failed ? fallbackImage : item.image"
      :lazy-src="lazySrc"
      :alt="altText"
      tabindex="0"
      role="button"
      :aria-label="'Inspect ' + altText"
      @mouseover="$emit('hover', item)"
      @click="$emit('inspect', item)"
      @keydown.native.enter.prevent="$emit('inspect', item)"
      @keydown.native.space.prevent.stop="$emit('inspect', item)"
      @load="$emit('load')"
      @error="failed = true"
    >
      <button
        v-if="control === 'gallery'"
        class="gallery-toggle"
        :title="inGallery ? 'Unselect' : 'Select'"
        @mousedown.stop
        @click.stop="$emit('toggle-gallery', item)"
      >
        <v-icon small color="white">{{
          inGallery ? "mdi-minus" : "mdi-plus"
        }}</v-icon>
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
        <v-icon x-small color="white">mdi-image-multiple</v-icon>
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
        <v-icon small color="white">{{
          inCart ? "mdi-bookmark-check" : "mdi-bookmark-plus-outline"
        }}</v-icon>
      </button>
    </v-img>

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
  </v-card>
</template>

<script>
import { formatValue } from "@/store/filters.js";
import { displayName, optionName } from "@/columns.js";
import { FALLBACK_IMAGE } from "@/components/constants.js";

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
    lazySrc: { type: String, default: undefined },
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
      // The details panel's open index; undefined while closed.
      openPanel: undefined,
      fallbackImage: FALLBACK_IMAGE,
      isHovered: false,
      inCart: false,
    };
  },
  created() {
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
.details-hint {
  text-align: center;
  font-size: smaller;
}

.thumbnail_card:not(.hovered) .v-image.under_drag_selection {
  border: 2px dashed rgb(33, 119, 180);
}

.thumbnail_card:not(.hovered) .v-image.outlined {
  border: 3px solid rgb(33, 119, 180);
  background-color: lightgray;
}

.thumbnail_card:not(.hovered) .v-image.outlined ::v-deep > div {
  scale: 0.9;
}

.thumbnail_card.hovered .v-image.outlined {
  margin: 2px;
  border: 3px solid rgb(33, 119, 180);
}

.thumbnail_card .v-image:not(.transparent) {
  opacity: 1;
}

.thumbnail_card .v-image.transparent {
  opacity: 0.35;
}

/* Lite: unselected options stay in the pool, dimmed. Only the picture fades,
   so the card's select button stays readable. */
.v-image.gallery-dimmed ::v-deep .v-image__image,
.v-image.gallery-dimmed ::v-deep .v-image__placeholder {
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
  position: relative;
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
