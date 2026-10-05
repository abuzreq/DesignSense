<template>
  <v-container :id="viewID" justify-start align-start>
    <v-container class="pa-0 ma-0">
      <PanelHeader
        icon="mdi-image-multiple-outline"
        title="Gallery"
        :compact="compactHeader"
        class="gallery-header"
      >
        <template v-slot:default>
          <span class="ph-label">Sort</span>
          <DimensionPicker
            v-model="sortByVar"
            :items="sortItems"
            dense
            outlined
            hide-details
            class="ph-select"
            @change="updateAuxiliaries()"
          />
          <TipButton
            small
            small-icon
            btn-class="ph-btn"
            :icon="isSortDesc ? 'mdi-sort-descending' : 'mdi-sort-ascending'"
            :tooltip="
              isSortDesc
                ? 'Descending. Click for ascending order.'
                : 'Ascending. Click for descending order.'
            "
            @click="toggleSortOrder"
          />
          <span class="ph-divider" />
          <v-tooltip bottom max-width="320">
            <template v-slot:activator="{ on }">
              <span v-on="on" class="ph-meta"
                ><strong>{{ headerCount }}</strong> {{ headerLabel }}</span
              >
            </template>
            <span>{{ headerTooltip }}</span>
          </v-tooltip>
          <v-btn
            v-if="hasGallerySelection"
            small
            text
            color="primary"
            class="ph-text-btn"
            @click="$store.dispatch('selectAllInGallery')"
            >Select all</v-btn
          >
        </template>

        <template v-slot:actions>
          <TipButton
            small
            small-icon
            :btn-class="enableContext ? 'ph-btn' : 'ph-btn ph-btn--on'"
            :icon="enableContext ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
            :tooltip="contextToggleTip"
            @click="toggleContext"
          />
          <span class="ph-divider" />
          <TipButton
            v-for="(size, index) in thumbnailSizes"
            :key="size.icon"
            small
            small-icon
            :btn-class="colSpan === index ? 'ph-btn ph-btn--on' : 'ph-btn'"
            :icon="size.icon"
            :tooltip="size.label"
            @click="setThumbnailSize(index)"
          />
        </template>
      </PanelHeader>

      <!-- The inspected option and the thumbnails share the panel, and
           which way they are laid out follows its shape: stacked while the
           panel is tall or narrow, and side by side once it is wide, the
           option on the left as Design Explorer has it. -->
      <div class="gallery-body" :class="'gallery-body--' + inspectorSide">
      <transition name="inspector">
      <v-card
        v-if="inspectedItem || isInspectionViewPinned"
        cols="12"
        class="inspector_card"
        :style="inspectorStyle"
      >
        <div class="inspected_item_top_bar">
          <div style="display: flex; align-items: center;">
            <TipButton
              small
              icon="mdi-list-box"
              :icon-color="isParamsPanelOpen ? 'primary' : 'secondary'"
              :tooltip="isParamsPanelOpen ? 'Hide details' : 'Show details'"
              @click="toggleParamsPanel"
            />
            <!-- Only when there is something to switch between. -->
            <ImageSwitcher
              v-if="hasSeveralImages && !showing3D"
              :images="inspectedImages"
              :index="inspectedImageIndex"
              @change="setImageIndex(inspectedItem._id, $event)"
            />
            <template v-if="hasModels">
              <TipButton
                small
                :icon="showing3D ? 'mdi-image-outline' : 'mdi-video-3d'"
                :icon-color="showing3D ? 'primary' : 'secondary'"
                :tooltip="showing3D ? 'Show the images' : 'Show the 3D model'"
                @click="showing3D = !showing3D"
              />
              <ImageSwitcher
                v-if="showing3D && inspectedModels.length > 1"
                :images="inspectedModels"
                :index="inspectedModelIndex"
                @change="setModelIndex(inspectedItem._id, $event)"
              />
            </template>
          </div>
          <!-- Which option this is: a picture alone doesn't say, and the ID is
               what the rest of the study refers to it by. -->
          <span
            v-if="inspectedItem"
            class="inspected-name"
            :title="inspectedName"
            >{{ inspectedName }}</span
          >
          <div style="display: flex;">
            <StarRating
              v-if="inspectedItem"
              :item="inspectedItem"
              @onRatingChanged="onRatingChanged"
            />
            <!-- Beside the rating: the stars say how much, the note says why. -->
            <OptionNote v-if="inspectedItem" :item="inspectedItem" />
            <CustomDimensionControl
              v-if="inspectedItem"
              :item="inspectedItem"
            />
            <TipButton
              v-if="inspectedItem"
              small
              :icon="
                inspectedInCart ? 'mdi-bookmark-check' : 'mdi-bookmark-plus-outline'
              "
              :color="inspectedInCart ? 'orange darken-2' : undefined"
              :tooltip="
                inspectedInCart
                  ? 'On the shortlist'
                  : 'Keep aside on the shortlist for comparing'
              "
              @click="toggleInCart(inspectedItem)"
            />
            <!-- Inspecting on hover without holding Space: Expert's, tucked
                 here rather than in the toolbar, and in the right-click menu. -->
            <TipButton
              v-if="can('inspectionControls')"
              small
              icon="mdi-selection-ellipse-arrow-inside"
              :color="isInspectionMode ? 'primary' : undefined"
              :tooltip="
                isInspectionMode
                  ? 'Inspecting on hover: click to stop'
                  : 'Inspect on hover, without holding Space'
              "
              @click="$store.dispatch('toggleInspectionMode')"
            />
            <!-- Pinning belongs to what it pins, so it sits here rather than
                 in the toolbar; P does the same. -->
            <TipButton
              v-if="inspectedItem && can('inspectionControls')"
              small
              :icon="isInspectionPinned ? 'mdi-pin' : 'mdi-pin-outline'"
              :color="isInspectionPinned ? 'primary' : undefined"
              :tooltip="
                isInspectionPinned
                  ? 'Pinned: stays inspected when the pointer moves on. Unpinning closes it [P]'
                  : 'Pin the inspected option [P]'
              "
              @click="$store.dispatch('togglePinInspection')"
            />
            <TipButton
              small
              icon="mdi-close"
              tooltip="Close inspection"
              @click="closeInspection"
            />
          </div>
        </div>

        <!-- The note itself, where it is read with the option; it opens for editing. -->
        <div v-if="inspectedItem && inspectedNote" class="inspected-note">
          <OptionNote :item="inspectedItem" show-text />
        </div>

        <div class="params_panel_parent">
          <!-- Built only while open: it re-renders with every inspection. -->
          <div v-if="isParamsPanelOpen" class="params_panel">
            <v-list plain>
              <v-list-item
                plain
                style="min-height: 28px; padding: 0 8px;"
                v-for="(param, j) in filteredKeys"
                :key="j"
              >
                <v-list-item-content
                  plain
                  style="font-weight: bold; padding: 4px 0;"
                  ><DimensionName :name="param"
                /></v-list-item-content>
                <v-list-item-content
                  plain
                  style="padding: 4px 0;"
                  class="justify-center"
                >
                  {{ formatParam(inspectedItem, param) }}
                </v-list-item-content>
              </v-list-item>
            </v-list>
          </div>
        </div>
        <div
          class="inspector_image_area"
          :style="{
            'justify-content': isParamsPanelOpen ? 'end' : 'center',
          }"
        >
          <ModelViewer
            v-if="inspectedItem && showing3D && inspectedModel"
            :model="inspectedModel"
            :height="inspectorImageHeight"
            @loaded="modelLoaded = true"
          />
          <imageZoom
            v-else-if="inspectedItem && inspectedImage"
            style="display: flex; justify-content: center;"
            :regular="inspectedImage"
            :zoom-amount="2"
            :click-zoom="true"
            img-class="inspected_image"
            :alt="inspectedAlt"
            :show-message="false"
          />
          <div v-else class="inspector_no_image">No picture for this option.</div>
        </div>
      </v-card>
      </transition>

      <!-- A plain list rather than Vuetify's v-data-iterator: that kept its own
           copy of every option in reactive data, which made Vue track every
           value of every row, and re-sorted all of them on each selection. -->
      <div class="gallery-list">
      <div v-if="galleryItems.length === 0" class="gallery-empty">
        {{ emptyMessage }}
      </div>
      <template v-else>
          <drag-select-container
            selectorClass="thumbnail_card"
            :scrollAccessor="dragScrollAccessor"
            :disabled="
              !galleryFiltering && (!enableContext || !can('gallerySelection'))
            "
            @onmouseup="onSelectionDragMouseUp($event)"
            @onmousemove="onSelectionDragMouseMove($event)"
          >
            <v-layout
              id="scroll-flex-container"
              grid-list-sm
              column
              :style="{
                'max-height': `calc(${height}px - ${
                  hasInspectedItem && !isInspectorBeside ? inspectorHeight : 0
                }px -  100px)`,
              }"
            >
              <!-- min-height 0 lets the list shrink into the space left and
                   scroll; thumbnails wrap, so it never scrolls sideways. -->
              <v-flex
                md6
                class="scroll-container gallery-scroller"
                style="overflow-y: scroll; overflow-x: hidden; min-height: 0;"
              >
                <v-card
                  color="primary"
                  class="showing-selection-note"
                  v-show="!enableContext && !isLite"
                >
                  Note: showing only the selected options. Unselect with the x
                  button.
                </v-card>

                <div
                  style="display: flex; flex-direction: row; height: 100%; margin-left: 10px;"
                >
                  <div id="gallery_axis"></div>
                  <v-row dense class="images-container" id="images-container">
                    <v-col
                      v-if="leadingSpacerHeight(galleryItems.length) > 0"
                      cols="12"
                      class="virtual-spacer"
                      :style="{
                        height: leadingSpacerHeight(galleryItems.length) + 'px',
                      }"
                    />
                    <v-col
                      v-for="card in windowedCards(galleryItems)"
                      :key="card.key"
                      :cols="possibleColSpans[colSpan]"
                      :class="[
                        'thumbnail_container',
                        possibleColSpans[colSpan] > 3 ? 'top-thumbnails' : '',
                      ]"
                    >
                      <GalleryCard
                        :item="card.item"
                        :card-id="cardSelector + card.item._id"
                        :control="cardControl"
                        :show-details="possibleColSpans[colSpan] > 3"
                        :detail-keys="detailKeys"
                        v-bind="cardState(card.item)"
                        @hover="onCardHover"
                        @inspect="inspect"
                        @load="imageLoaded"
                        @toggle-gallery="toggleInGallery"
                        @toggle="toggle"
                        @toggle-cart="toggleInCart"
                      />
                    </v-col>
                    <v-col
                      v-if="trailingSpacerHeight(galleryItems.length) > 0"
                      cols="12"
                      class="virtual-spacer"
                      :style="{
                        height: trailingSpacerHeight(galleryItems.length) + 'px',
                      }"
                    />
                  </v-row>
                  <div class="scrollbar-container">
                    <div
                      v-show="enableContext"
                      class="custom-scrollbar"
                      id="custom-scrollbar"
                    ></div>
                    <div class="scroll-tooltip" id="scroll-tooltip"></div>
                    <div
                      class="scroll-value-label"
                      id="scroll-value-label"
                    ></div>
                  </div>
                </div>
              </v-flex>
            </v-layout>
          </drag-select-container>
      </template>
      </div>
      </div>
    </v-container>
  </v-container>
</template>

<style scoped>
/* Stacked or side by side, from `inspectorSide`. The inspector comes first
   in the markup, so "right" is a reversed row. */
.gallery-body {
  display: flex;
  min-width: 0;
  min-height: 0;
}
.gallery-body--top {
  flex-direction: column;
}
.gallery-body--left {
  flex-direction: row;
}
.gallery-body--right {
  flex-direction: row-reverse;
}
.gallery-body--left .inspector_card,
.gallery-body--right .inspector_card {
  flex: 0 0 auto;
}
/* Opening an option pushes the thumbnails aside rather than replacing them
   between frames, so it is clear where it came from and what moved. The
   inline width and height are what collapse, hence !important. */
.inspector_card {
  transition: width 200ms ease, max-height 200ms ease, opacity 140ms ease;
}
.gallery-body--top .inspector-enter,
.gallery-body--top .inspector-leave-to {
  max-height: 0 !important;
  opacity: 0;
}
.gallery-body--left .inspector-enter,
.gallery-body--left .inspector-leave-to,
.gallery-body--right .inspector-enter,
.gallery-body--right .inspector-leave-to {
  width: 0 !important;
  opacity: 0;
}
/* Stacked, the list gives up its room over the same moment. */
#scroll-flex-container {
  transition: max-height 200ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .inspector_card,
  #scroll-flex-container {
    transition: none;
  }
}
.gallery-list {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}
.gallery-body--left .gallery-list {
  margin-left: 10px;
}
.gallery-body--right .gallery-list {
  margin-right: 10px;
}
.gallery-empty {
  padding: 32px 16px;
  text-align: center;
  opacity: 0.7;
}
/* Reserves the scroll height of the rows that windowing leaves unrendered. */
.virtual-spacer {
  padding: 0 !important;
  margin: 0 !important;
  pointer-events: none;
  flex: 0 0 100%;
  max-width: 100%;
}
::v-deep .params_panel_parent {
  position: relative;
  top: 0px;
  border: 1px solid rgb(0, 0, 0, 0.1);
  border-radius: 4px;
}
/* Sized from the panel's height (see `inspectorHeight`), not the window's, so
   the thumbnail list keeps its share however tall the panel is. */
.inspected-note {
  flex: 0 0 auto;
  height: 42px;
  padding: 2px 8px 4px;
  overflow: hidden;
}
.inspected-note ::v-deep .on-text-body {
  -webkit-line-clamp: 2;
}
.inspector_card {
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.inspector_image_area {
  display: flex;
  flex-direction: row;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
::v-deep .params_panel {
  margin-left: 0px;
  position: absolute;
  left: 0px;
  z-index: 100;
  overflow-y: scroll;
  min-width: 240px;
  height: var(--inspector-image-height, 38vh);
  width: auto;
  font-size: small;
  opacity: 0.8;
}
::v-deep .inspected_image {
  height: var(--inspector-image-height, 40vh);
  max-height: 100%;
  width: 100%;
  object-fit: contain;
}

::v-deep .vh--message-bottom {
  transition: opacity 0.2s linear;

  left: 20px;
}
::v-deep .vh--message-bottom:hover {
  opacity: 0;
}

::v-deep .scroll-value-label {
  position: absolute;
  background-color: black;
  opacity: 0.7;
  color: white;
  padding: 5px;
  border-radius: 3px;
  z-index: 1000; /* Ensure it is above other elements */
  left: -10px;
}

::v-deep #gallery_axis {
  display: block;
  position: relative;
  /* Stretches to the list's height in its flex row. */
  flex: 0 0 40px;
  left: -5px;
  top: 0px;
  width: 40px;
}
::v-deep .axis-label {
  position: absolute;
  background-color: #0075ff;
  color: white;
  text-align: center;
  min-width: 20px;
}

/* Takes what the axis and scrollbar leave, rather than 100% on top of them,
   which pushed the row wider than the list. */
.images-container {
  margin-top: 5px;
  flex: 1 1 0;
  min-width: 0;
}

::v-deep .scroll-tooltip {
  position: absolute;
  width: auto;
  padding: 5px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 3px;
  transform: translateX(-100%);
  white-space: nowrap;
  display: none; /* Initially hidden */
}

::v-deep .scrollbar-container {
  width: 10px;
  height: 100%;
  /* background-color: #f1f1f1;
      margin-left: 10px;*/
}

::v-deep .custom-scrollbar {
  position: absolute;
  top: 4%;
  right: 0.5%;
  width: 10px;
  height: 100%;
  /* background-color: #888; */
}

::v-deep .scrollbar-marker {
  position: absolute;
  width: 10px;
  height: 3px;
  background-color: #1565c052;
}

.inspected_item_top_bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  position: relative;
  justify-content: space-between;
  width: 100%;
}
.inspected-name {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: #37474f;
}
.showing-selection-note {
  position: relative;
  transform: translateX(-50%);
  left: 50%;
  text-align: center;
  margin-left: 0px;
  margin-right: 32px;
  margin-top: 4px;
  margin-bottom: 4px;
  color: white;
}

::v-deep .v-expansion-panel--active > .v-expansion-panel-header {
  min-height: 24px;
}

::v-deep .v-expansion-panel-header {
  padding: 0px;
  min-height: 24px;
}
::v-deep div.v-expansion-panel-content__wrap {
  padding-left: 0px;
  padding-right: 0px;
}

.thumbnail_container {
  display: flex;
  justify-content: center;
  align-items: center;
}
.thumbnail_container.top-thumbnails {
  align-items: start;
}


::v-deep .v-slider--horizontal {
  min-width: 5vw;
}


#enableContextBtn {
  margin-bottom: -10px;
}
#sortOrderBtn {
  margin-bottom: -10px;
}
</style>

<script>
//    "vue-drag-select": "git+https://github.com/JochenLutz/vue-drag-select.git",

//https://hujiulong.github.io/vue-3d-model/#/demo-gltf
import Vue from "vue";

import imageZoom from "@/components/ImageZoom.js";

import { operations } from "@/components/operations.js";
import { mapState, mapGetters } from "vuex";
import * as d3 from "d3";
import DragSelect from "@/plugins/DragSelect.vue";
import StarRating from "@/components/StarRating.vue";
import OptionNote from "@/components/OptionNote.vue";
import CustomDimensionControl from "@/components/CustomDimensionControl.vue";
import GalleryCard from "@/components/GalleryCard.vue";
import ImageSwitcher from "@/components/ImageSwitcher.vue";
import { DETAIL_BLACKLIST } from "@/store/compare.js";
import { isAssetColumn } from "@/data/assets.js";
import TipButton from "@/components/TipButton.vue";
import DimensionName from "@/components/DimensionName.vue";
import DimensionPicker from "@/components/DimensionPicker.vue";
import { formatValue } from "@/store/filters.js";
import { asRows } from "@/store/rows.js";
import { dimensionItems, optionName } from "@/columns.js";

import PanelHeader from "@/components/PanelHeader.vue";

// The largest share of the gallery panel the inspector may take, of its
// height when stacked and of its width when beside the thumbnails.
const INSPECTOR_SHARE = 0.45;
// Below this the inspector goes back on top: a column this narrow is worse
// for a picture than a band across a short panel.
const INSPECTOR_MIN_WIDTH = 300;
// What the panel's header and padding take, the same figure the thumbnail
// list already subtracts.
const GALLERY_CHROME = 100;
// A panel at least this wide, and this much wider than it is tall, has the
// room to put the inspected option beside the thumbnails instead of over
// them.
const SIDE_BY_SIDE_WIDTH = 720;
const SIDE_BY_SIDE_RATIO = 1.3;
// The inspector's top bar (buttons, stars) and its details strip, in px.
const INSPECTOR_BAR_HEIGHT = 42;
// The note's strip under the bar, two lines at most, when there is a note.
const INSPECTOR_NOTE_HEIGHT = 42;

function isMissingValue(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (typeof value === "number" && isNaN(value))
  );
}

/**
 * Orders two values of one dimension: numbers by value, anything else as text
 * with numbers inside it compared by value. A missing value goes last in both
 * directions, so options not given a custom value yet don't lead a descending
 * sort.
 */
const textOrder = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

// Room left between the inspected row and the edge it was scrolled past.
const SCROLL_MARGIN = 12;

function compareForSort(a, b, desc) {
  let aMissing = isMissingValue(a);
  let bMissing = isMissingValue(b);
  if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
  let order =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : textOrder.compare(String(a), String(b));
  return desc ? -order : order;
}

/*
 * The 3D viewer brings three.js with it, a quarter of the app's code, for a
 * view most sessions never open. It is fetched the first time a model is
 * shown, and the viewer's own "Load 3D model" step covers the wait.
 */
const ModelViewer = () =>
  import(/* webpackChunkName: "model-viewer" */ "@/components/ModelViewer.vue");

export default {
  name: "AugmentedGridCards",
  components: {
    PanelHeader,
    StarRating,
    OptionNote,
    CustomDimensionControl,
    GalleryCard,
    ImageSwitcher,
    ModelViewer,
    TipButton,
    DimensionName,
    DimensionPicker,
    "drag-select-container": DragSelect,
    imageZoom,
  },
  props: ["defaultEnableContext", "width", "height", "x", "y", "type"],
  data: function() {
    return {
      isParamsPanelOpen: false,
      chartData: [],
      cards: [],
      // Markings change in place, out of Vue's sight; bumped on every change
      // so the cards' selection state is read again.
      markingVersion: 0,
      viewID: null,
      colSpan: 1,
      possibleColSpans: [1, 2, 3, 4],
      // One per entry of possibleColSpans, smallest thumbnails first.
      thumbnailSizes: [
        { icon: "mdi-view-comfy-outline", label: "Small thumbnails" },
        { icon: "mdi-view-grid-outline", label: "Medium thumbnails" },
        { icon: "mdi-square-rounded-outline", label: "Large thumbnails" },
        {
          icon: "mdi-card-text-outline",
          label: "Details, to compare options side by side",
        },
      ],
      labels: ["S", "M", "L", "XL"],
      icons: ["mdi-snowflake", "mdi-leaf", "mdi-fire", "mdi-water"],
      sortFallback: "",
      enableContext: this.defaultEnableContext,
      inspectedItem: null,
      // Whether an item is inspected, for the list's height: unlike
      // `inspectedItem`, it doesn't change as inspection moves between items,
      // so the list doesn't re-render with it.
      hasInspectedItem: false,
      // Whether the 3D model is showing instead of the pictures.
      showing3D: false,
      // Whether a model is on screen, so hovering doesn't tear it down.
      modelLoaded: false,
      // Which view each option is showing, by option id. Component state, never
      // the row: `image` is what the gallery, the clusters and the exports
      // read, and it must not move under them.
      imageIndexById: {},
      modelIndexById: {},
      isInspectionViewPinned: false,
      isSelectionDragOn: false,
      dragSelection: {},
      numLoadedImages: 0,
      scrollLabel: null,
      // --- Windowing. Only large collections are virtualized so that the
      // small datasets this tool ships with behave exactly as before. ---
      virtualizeAbove: 150,
      overscanRows: 4,
      scrollTop: 0,
      viewportHeight: 0,
      measuredRowHeight: 0,
      // While a rubber-band drag is in flight, cards must not unmount or the
      // drag would lose items it has already swept over.
      pinnedWindowStart: null,
      pinnedWindowEnd: null,
    };
  },
  computed: {
    /*
     * Sort lives in the store so that anything outside this component can set
     * it. The local fallback is only the first-numeric-column default, used
     * until someone chooses.
     */
    sortByVar: {
      get() {
        return this.$store.state.viewSettings.sortBy || this.sortFallback;
      },
      set(value) {
        this.$store.commit("setViewSetting", { key: "sortBy", value: value });
      },
    },
    isSortDesc: {
      get() {
        return this.$store.state.viewSettings.sortDesc;
      },
      set(value) {
        this.$store.commit("setViewSetting", { key: "sortDesc", value: value });
      },
    },
    chartDataLength() {
      return this.chartData.length;
    },
    /**
     * The gallery in the order it is shown; options with no value go last in
     * either direction. Rows are not reactive (see store/rows.js), so a rating
     * or custom value set while sorted by it re-sorts through the version.
     */
    galleryItems() {
      void this.$store.state.dimensionValuesVersion;
      let list = this.chartData.slice();
      if (!this.sortByVar) return list;
      let dim = this.sortByVar;
      let desc = this.isSortDesc;
      return list.sort((a, b) => compareForSort(a[dim], b[dim], desc));
    },
    ...mapState({
      currentSelectionOperation: (state) => state.currentSelectionOperation,
      rawChartData: (state) => state.data,
      keys: (state) => state.allDimensions.concat(["selected"]),
      numericDimensions: (state) => state.numericDimensions,
      nonNumericDimensions: (state) => state.nonNumericDimensions,
      hovered: (state) => state.hovered,
      inspectionClears: (state) => state.inspectionClears,
      isInspectionPinned: (state) => state.isInspectionPinned,
      isInspectionMode: (state) => state.isInspectionMode,

      colorColumn: (state) => state.colorColumn,
      uiMode: (state) => state.uiMode,
    }),
    ...mapGetters([
      "colorScale",
      "colorize",
      "isHoveringEnabled",
      "can",
      "isLite",
      "isFilterActive",
      "selectionCount",
      "galleryPool",
      "hasGallerySelection",
      "isSelectedInGallery",
      "gallerySelectedCount",
      "isInCart",
    ]),
    /** Whether the inspected option is on the shortlist. */
    inspectedInCart() {
      return !!this.inspectedItem && this.isInCart(this.inspectedItem._id);
    },
    galleryFiltering() {
      return this.can("galleryFiltering");
    },
    /** The selection control each card offers (see GalleryCard). */
    cardControl() {
      if (this.galleryFiltering) return "gallery";
      if (!this.can("gallerySelection")) return null;
      return this.enableContext ? "checkbox" : "xbutton";
    },
    compactHeader() {
      return this.width < 620;
    },
    headerLabel() {
      if (!this.galleryFiltering || this.compactHeader) return "selected";
      return "selected · " + this.chartDataLength + " shown";
    },
    headerTooltip() {
      if (!this.galleryFiltering) return "Number of selected options";
      return "Selected options, out of those shown. Drag a box over images to select just those, or use the -/+ button on a card.";
    },
    emptyMessage() {
      if (!this.isLite) return "No options are selected.";
      return this.enableContext
        ? "No options pass the chart filters."
        : "No options are selected. Turn off Show selected only to see the rest.";
    },
    numSelected() {
      return this.selectionCount;
    },
    // Active Lite filters that match nothing still dim every thumbnail.
    hasSelection() {
      return this.numSelected > 0 || this.isFilterActive;
    },
    headerCount() {
      if (this.galleryFiltering) return this.gallerySelectedCount;
      return this.numSelected;
    },
    cardSelector() {
      return "card_" + this.viewID + "_";
    },
    contextToggleTip() {
      if (this.isLite) {
        return this.enableContext
          ? "Show selected only"
          : "Also show unselected options, dimmed";
      }
      return this.enableContext
        ? "Show only the selected options"
        : "Show all options while highlighting the selected options";
    },
    /**
     * Where the inspected option sits: "top" over the thumbnails while the
     * panel is tall or narrow, else "left" of them, which is where Design
     * Explorer puts it and so where a reader coming from it will look.
     */
    inspectorSide() {
      let w = Number(this.width);
      let h = Number(this.height);
      if (!(w > 0) || !(h > 0)) return "top";
      if (w < SIDE_BY_SIDE_WIDTH || w / h < SIDE_BY_SIDE_RATIO) return "top";
      if (w - this.inspectorWidth < INSPECTOR_MIN_WIDTH) return "top";
      return "left";
    },
    isInspectorBeside() {
      return this.inspectorSide !== "top";
    },
    /** The inspector's width in px when it is beside the thumbnails. */
    inspectorWidth() {
      let w = Number(this.width);
      if (!(w > 0)) return INSPECTOR_MIN_WIDTH;
      return Math.max(INSPECTOR_MIN_WIDTH, Math.round(w * INSPECTOR_SHARE));
    },
    /** The inspector's height in px: beside the thumbnails it takes all of it. */
    inspectorHeight() {
      let panel = Number(this.height);
      if (!(panel > 0)) return 400;
      if (this.isInspectorBeside) {
        return Math.max(160, panel - GALLERY_CHROME);
      }
      return Math.round(panel * INSPECTOR_SHARE);
    },
    inspectorStyle() {
      let style = {
        "max-height": this.inspectorHeight + "px",
        "--inspector-image-height": this.inspectorImageHeight + "px",
      };
      if (this.isInspectorBeside) {
        style.width = this.inspectorWidth + "px";
        style.height = this.inspectorHeight + "px";
      }
      return style;
    },
    /** The inspected image's height: the inspector less its top bar and note. */
    inspectorImageHeight() {
      let taken = INSPECTOR_BAR_HEIGHT + (this.inspectedNote ? INSPECTOR_NOTE_HEIGHT : 0);
      return Math.max(60, this.inspectorHeight - taken);
    },
    /** The note on the inspected option, or "". */
    inspectedNote() {
      if (!this.inspectedItem) return "";
      return this.$store.state.optionNotes[String(this.inspectedItem._id)] || "";
    },
    /** The inspected option's views, and the one on screen. */
    inspectedImages() {
      let item = this.inspectedItem;
      return (item && item.images) || [];
    },
    inspectedImageIndex() {
      let item = this.inspectedItem;
      if (!item) return 0;
      let index = this.imageIndexById[item._id] || 0;
      // A remembered index outlives a reload that changed the view count.
      return Math.min(index, Math.max(0, this.inspectedImages.length - 1));
    },
    inspectedImage() {
      return this.inspectedImages[this.inspectedImageIndex];
    },
    inspectedName() {
      return optionName(this.inspectedItem);
    },
    inspectedAlt() {
      let item = this.inspectedItem;
      if (!item) return "";
      let view = this.inspectedImages.length > 1
        ? " view " + (this.inspectedImageIndex + 1)
        : "";
      return optionName(item) + view;
    },
    inspectedModels() {
      let item = this.inspectedItem;
      return (item && item._models) || [];
    },
    hasModels() {
      return this.inspectedModels.length > 0;
    },
    inspectedModelIndex() {
      let item = this.inspectedItem;
      if (!item) return 0;
      let index = this.modelIndexById[item._id] || 0;
      return Math.min(index, Math.max(0, this.inspectedModels.length - 1));
    },
    inspectedModel() {
      return this.inspectedModels[this.inspectedModelIndex];
    },
    hasSeveralImages() {
      let item = this.inspectedItem;
      return !!item && !!item.images && item.images.length > 1;
    },
    sortItems() {
      // Sorting by a picture's address means nothing, so those columns stay out.
      return dimensionItems(
        this.keys.filter((key) => !isAssetColumn(key) && key !== "Tags")
      );
    },
    filteredKeys() {
      // The compare view hides the same columns, and the asset predicate covers
      // the names a list never could ("img_2", "model3d_3").
      return [...this.numericDimensions, ...this.nonNumericDimensions].filter(
        (x) => DETAIL_BLACKLIST.indexOf(x) === -1 && !isAssetColumn(x)
      );
    },
    /**
     * What a card lists when it is large enough to show its values, with
     * whatever the colours follow at the top. The mat says which options are
     * high or low; the first row says by how much.
     */
    detailKeys() {
      let keys = this.filteredKeys;
      let coloured = this.colorColumn;
      if (!coloured || keys.indexOf(coloured) === -1) return keys;
      return [coloured].concat(keys.filter((key) => key !== coloured));
    },
    columnsPerRow() {
      return Math.max(
        1,
        Math.floor(12 / this.possibleColSpans[this.colSpan])
      );
    },
    isVirtualized() {
      return this.chartData.length > this.virtualizeAbove;
    },
    rowHeight() {
      if (this.measuredRowHeight > 0) return this.measuredRowHeight;
      // Pre-measurement fallback, scaled by tile size.
      return [120, 190, 250, 380][this.colSpan] || 190;
    },
  },
  mounted() {
    Vue.nextTick(() => {
      this.attachGalleryScrollListener();
      this.measureRowHeight();
      this.updateAuxiliaries();
    });
  },

  updated() {
    // The iterator mounts its scroller after this component, so binding here
    // too covers the case where it was absent at mount. Idempotent. Row
    // height is not measured here: reading card heights forces a layout, and
    // renders happen on every filter change and hover.
    this.attachGalleryScrollListener();
    // Scrolling hands a mounted card a different option, so its colour has
    // to be put on again. Only a style is written, nothing is read back, so
    // this costs no layout.
    this.paintCardEdges();
  },
  created() {
    this.viewID = "id" + this._uid;
    // Which card shows which item (see windowedCards); outside data(), since
    // rendering writes it.
    this.cardKeys = null;
    this.nextCardKey = 0;
    // Set by the two places this component inspects from, and read once by
    // scrollInspectedIntoView: the gallery does not scroll itself about.
    this.inspectedFromHere = false;
    // The store's marking for this view, read as the selection changes. Kept
    // off data() as well: made reactive, all of its entries -- one per option
    // -- would be observed, though the store mutates it in place and the cards
    // follow markingVersion instead.
    this.selectionMap = {};

    // Kept, so beforeDestroy can unsubscribe.
    this.unsubscribeStore = this.$store.subscribe((mutation, state) => {
      if (
        mutation.type === "update" ||
        mutation.type === "reverseUpdate" ||
        mutation.type === "redoUpdate" ||
        mutation.type === "resetMarking"
      ) {
        this.updateContext();
        this.selectionMap = this.$store.getters.getMarking(this.viewID);

        this.chartData.forEach((d) => {
          d.selected = this.selectionMap[d._id];
        });
        this.markingVersion += 1;
        if (mutation.type == "resetMarking" && !this.isLite) {
          this.enableContext = true;
        }
        // The marking is mutated in place, so Vue cannot tell which
        // thumbnails changed state.
        this.$forceUpdate();
        Vue.nextTick(() => {
          this.updateAuxiliaries();
        });
      }
    });

    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this,
    });
    // Both modes open on every option; the eye narrows to the selection.
    this.enableContext = true;
    this.updateContext();

    this.sortFallback =
      this.keys.find((k) => !isNaN(this.chartData[0][k])) || this.keys[0];

    // Space would scroll the page, and the arrows step the inspected option's
    // views -- but only with focus on the page itself, so typing keeps them.
    this.onWindowKeydown = (e) => {
      if (e.target !== document.body) return;
      if (e.key === " ") {
        e.preventDefault();
        return;
      }
      let by = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      if (by !== 0 && this.stepImage(by)) e.preventDefault();
    };
    window.addEventListener("keydown", this.onWindowKeydown);
  },
  methods: {
    toggleSortOrder() {
      this.isSortDesc = !this.isSortDesc;
    },
    toggleContext() {
      this.enableContext = !this.enableContext;
    },
    toggleParamsPanel() {
      this.isParamsPanelOpen = !this.isParamsPanelOpen;
    },
    // Same as Esc: the store stops inspection and every view follows.
    closeInspection() {
      this.$store.dispatch("clearInspection");
    },
    /** Where the drag-select container finds the element that scrolls. */
    dragScrollAccessor(el) {
      return el.firstChild.firstChild;
    },
    galleryScrollEl() {
      // Not ".scroll-container": DragSelect removes that class when disabled.
      return this.$el ? this.$el.querySelector(".gallery-scroller") : null;
    },
    /**
     * A card's selection state, as the plain props its card compares: a card
     * re-renders only when one of these changes for it.
     */
    cardState(item) {
      void this.markingVersion;
      let id = item._id;
      if (this.galleryFiltering) {
        return {
          inGallery: this.isSelectedInGallery(id),
          underDrag:
            this.isSelectionDragOn && this.dragSelection[String(id)] === true,
        };
      }
      let selected = !!this.selectionMap[id];
      return {
        outlined: this.hasSelection && selected,
        transparent: this.enableContext && this.hasSelection && !selected,
        checked: selected,
      };
    },
    /**
     * Brings the inspected option's card into view.
     *
     * Clicking a line in the parallel coordinates or a point in the
     * scatterplot inspects an option whose card is usually elsewhere in a
     * long grid, so whatever marks it cannot be seen. The card does not have
     * to be mounted to be found: the rows are uniform, so its place is
     * arithmetic from the order the gallery is in.
     *
     * Three things it does not do. It stays put when the row is already
     * fully in view, so a card on screen is never shuffled. It stays put
     * when the option is not in the gallery at all, which happens when a
     * filter has taken it out and a chart inspects it anyway. And it stays
     * put when the gallery itself did the inspecting -- hovering with Space
     * held would otherwise pull the card out from under the pointer, and
     * whichever card landed there would do it again.
     */
    scrollInspectedIntoView() {
      let fromHere = this.inspectedFromHere;
      this.inspectedFromHere = false;
      if (fromHere) return;
      let item = this.hovered;
      let el = this.galleryScrollEl();
      if (!item || !el) return;
      let index = this.galleryItems.findIndex((row) => row._id === item._id);
      if (index < 0) return;
      let top = Math.floor(index / this.columnsPerRow) * this.rowHeight;
      let bottom = top + this.rowHeight;
      let viewTop = el.scrollTop;
      let viewBottom = viewTop + el.clientHeight;
      if (top >= viewTop && bottom <= viewBottom) return;
      // Clear of the edge it was past, rather than flush against it.
      let target =
        top < viewTop
          ? top - SCROLL_MARGIN
          : bottom - el.clientHeight + SCROLL_MARGIN;
      // Put there, not animated there. A smooth scroll is thrown away
      // whenever the document is hidden -- the browser stops animating and
      // the card is simply never reached -- and over the twenty rows this
      // usually travels an animation is a blur rather than a thread to
      // follow. The inspector panel changes in the same breath, so the
      // gallery arriving at once reads as one event.
      el.scrollTop = Math.max(0, target);
    },
    onCardHover(item) {
      this.inspectedFromHere = true;
      if (this.isHoveringEnabled) this.hover(item);
    },
    toggleInGallery(item) {
      this.$store.dispatch("toggleGallerySelection", { id: item._id });
    },
    toggleInCart(item) {
      this.$store.dispatch("toggleInCart", { id: item._id });
    },
    sameItems(a, b) {
      if (!a || !b || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    },
    attachGalleryScrollListener() {
      let el = this.galleryScrollEl();
      if (!el || el._dsScrollBound) return;
      el._dsScrollBound = true;
      this.viewportHeight = el.clientHeight;
      el.addEventListener(
        "scroll",
        () => {
          if (this._scrollRaf) return;
          this._scrollRaf = requestAnimationFrame(() => {
            this._scrollRaf = null;
            let node = this.galleryScrollEl();
            if (!node) return;
            this.scrollTop = node.scrollTop;
            this.viewportHeight = node.clientHeight;
            this.updateScrollValueLabel();
          });
        },
        { passive: true }
      );
    },
    /**
     * Rows are assumed uniform in height. That holds for the render-style
     * imagery these galleries show. Heights change only when images load, the
     * tile size changes or the panel resizes, so it is re-measured then (see
     * `scheduleRowMeasure`), not after every render.
     */
    measureRowHeight() {
      let nodes = this.$el
        ? this.$el.querySelectorAll(".images-container > .thumbnail_container")
        : [];
      // A card whose image has not arrived yet holds a 4:3 placeholder, not
      // its real height; a wrong estimate windows too few or too many cards
      // onto the page. So only cards with a loaded image count, the tallest
      // of a sample, and with none loaded yet the current estimate stands.
      let h = 0;
      let seen = 0;
      for (let i = 0; i < nodes.length && seen < 24; i++) {
        if (nodes[i].querySelector(".thumbnail_card--loading")) continue;
        seen += 1;
        h = Math.max(h, nodes[i].offsetHeight);
      }
      if (h > 0 && Math.abs(h - this.measuredRowHeight) > 2) {
        this.measuredRowHeight = h;
      }
      let scroller = this.galleryScrollEl();
      if (scroller) this.viewportHeight = scroller.clientHeight;
    },
    /** Images arrive after render, so re-measure as they land. */
    scheduleRowMeasure() {
      if (this._measureTimer) return;
      this._measureTimer = setTimeout(() => {
        this._measureTimer = null;
        this.measureRowHeight();
      }, 120);
    },
    /** Index range of items to actually render, in sorted order. */
    visibleWindow(total) {
      if (!this.isVirtualized) return { start: 0, end: total };

      let perRow = this.columnsPerRow;
      let rows = Math.ceil(total / perRow);
      let viewport = this.viewportHeight || 600;

      // The row height is an estimate, so the scroll position can imply a row
      // past the end. Clamp to keep at least one row of content mounted --
      // otherwise scrolling to the bottom renders nothing at all.
      let firstRow = Math.floor(this.scrollTop / this.rowHeight);
      firstRow = Math.min(Math.max(0, rows - 1), Math.max(0, firstRow));
      firstRow = Math.max(0, firstRow - this.overscanRows);

      let lastRow = Math.ceil((this.scrollTop + viewport) / this.rowHeight);
      lastRow = Math.min(rows, lastRow + this.overscanRows);
      lastRow = Math.max(lastRow, firstRow + 1);

      let start = Math.min(firstRow * perRow, Math.max(0, total - perRow));
      let end = Math.min(total, Math.max(lastRow * perRow, start + perRow));

      // Never unmount cards a live drag has already swept over.
      if (this.pinnedWindowStart !== null) {
        start = Math.min(start, this.pinnedWindowStart);
        end = Math.max(end, this.pinnedWindowEnd);
      }
      return { start: Math.max(0, start), end: Math.max(start, end) };
    },
    /**
     * The window's items as `{ item, key }`, where a key names a card. An
     * item still in view keeps its card, which only moves, so its image
     * stays. The cards of items that left go to the items that arrived, and
     * are updated rather than destroyed and rebuilt: scrolling hands the cards
     * leaving one end to the items entering the other.
     */
    windowedCards(list) {
      if (!list) return [];
      let w = this.isVirtualized
        ? this.visibleWindow(list.length)
        : { start: 0, end: list.length };
      let items = list.slice(w.start, w.end);
      // Item ID -> card key, from the previous render. Not reactive: it only
      // remembers what the last render did.
      let previous = this.cardKeys || new Map();
      let next = new Map();
      let taken = new Set();
      items.forEach((item) => {
        let key = previous.get(item._id);
        if (key !== undefined) {
          next.set(item._id, key);
          taken.add(key);
        }
      });
      let free = [];
      previous.forEach((key) => {
        if (!taken.has(key)) free.push(key);
      });
      let cards = items.map((item) => {
        let key = next.get(item._id);
        if (key === undefined) {
          key = free.length > 0 ? free.pop() : this.nextCardKey++;
          next.set(item._id, key);
        }
        return { item: item, key: key };
      });
      this.cardKeys = next;
      return cards;
    },
    leadingSpacerHeight(total) {
      if (!this.isVirtualized) return 0;
      let w = this.visibleWindow(total);
      return Math.ceil(w.start / this.columnsPerRow) * this.rowHeight;
    },
    trailingSpacerHeight(total) {
      if (!this.isVirtualized) return 0;
      let w = this.visibleWindow(total);
      let remainingRows = Math.ceil((total - w.end) / this.columnsPerRow);
      return Math.max(0, remainingRows) * this.rowHeight;
    },
    imageLoaded() {
      this.numLoadedImages += 1;
      this.scheduleRowMeasure();
    },
    /**
     * Shows the sort dimension's value for whichever card is at the top of the
     * viewport. Previously wired up inside `imageLoaded` against a
     * `.scroll-container` selector that matched nothing, so it never ran.
     */
    updateScrollValueLabel() {
      let container = this.galleryScrollEl();
      this.scrollLabel = this.$el
        ? this.$el.querySelector("#scroll-value-label")
        : null;
      if (!container || !this.scrollLabel) return;

      if (!this.numericDimensions.includes(this.sortByVar)) {
        this.scrollLabel.style.display = "none";
        return;
      }
      this.scrollLabel.style.display = "block";

      let denom = container.scrollHeight - container.clientHeight;
      let c = denom > 0 ? container.scrollTop / denom : 0;
      this.scrollLabel.style.top =
        (c < 0.5 ? c + 0.05 : c - 0.1) * container.clientHeight + "px";

      // Derive the top-most item from the sorted order rather than from the
      // DOM, so it stays correct when off-screen cards are not rendered.
      let sorted = this.sortedItems();
      if (sorted.length === 0) return;
      let rowIndex = Math.floor(container.scrollTop / this.rowHeight);
      let idx = Math.min(
        sorted.length - 1,
        Math.max(0, rowIndex * this.columnsPerRow)
      );
      let datum = sorted[idx];
      let value = datum ? datum[this.sortByVar] : undefined;
      if (typeof value === "number" && isFinite(value)) {
        // Weighted dimensions run from 0 to 1, so rounding them would say nothing.
        this.scrollLabel.textContent = this.$store.getters.fixedBoundsOf(
          this.sortByVar
        )
          ? this.formatParam(datum, this.sortByVar)
          : Math.round(value);
      }
    },
    /** The gallery's items in the order they are shown. */
    sortedItems() {
      return this.galleryItems;
    },
    /** A value as the details list shows it; custom and weighted values are rounded. */
    formatParam(item, param) {
      // Rows are not reactive; this is what redraws the list after an edit.
      void this.$store.state.dimensionValuesVersion;
      let value = item ? item[param] : undefined;
      let bounds = this.$store.getters.fixedBoundsOf(param);
      if (bounds) {
        return typeof value === "number" && isFinite(value)
          ? formatValue(value, bounds[1] - bounds[0])
          : "\u2014";
      }
      return value;
    },
    showTooltip(event) {
      console.log("moving");
      const scrollbar = document.getElementById("custom-scrollbar");
      const tooltip = document.getElementById("scroll-tooltip");

      tooltip.textContent = event.clientY;
      tooltip.style.top = `${event.clientY -
        scrollbar.getBoundingClientRect().top}px`;
      tooltip.style.display = "block";
    },
    hideTooltip() {
      console.log("leaving");
      const tooltip = document.getElementById("scroll-tooltip");

      tooltip.style.display = "none";
    },
    onRatingChanged(newRating) {
      this.$store.dispatch("rateAlt", {
        rating: newRating,
        item: this.inspectedItem,
      });
    },
    setImageIndex(id, index) {
      this.$set(this.imageIndexById, id, index);
    },
    setModelIndex(id, index) {
      this.$set(this.modelIndexById, id, index);
      this.modelLoaded = false;
    },
    /** Arrow keys step the inspected option's views. */
    stepImage(by) {
      let count = this.inspectedImages.length;
      if (!this.inspectedItem || count < 2 || this.showing3D) return false;
      this.setImageIndex(
        this.inspectedItem._id,
        (this.inspectedImageIndex + by + count) % count
      );
      return true;
    },
    getAllCards() {
      let cardNodes = d3.select("#" + this.viewID).selectAll(".thumbnail_card")
        ._groups[0]; //.select('.vue-drag-select')

      if (!cardNodes) return null;

      let cards = Array.prototype.slice
        .call(cardNodes)
        .filter((d) => d.id != "");

      return cards;
    },
    getAllCardsSelection() {
      let cardsSelection = d3
        .select("#" + this.viewID)
        .selectAll(".thumbnail_card");

      return cardsSelection;
    },
    getItemsIDs(selectedItems) {
      return selectedItems.map((s) => {
        let start = s.id.indexOf("_");
        let secondPart = s.id.substring(start + 1);
        let secondStart = secondPart.indexOf("_"); //finding the 2nd occurance of _ , accounting for ids that start with _
        return secondPart.substring(secondStart + 1);
      });
    },

    onSelectionDragMouseUp(selectedItems) {
      this.isSelectionDragOn = false;
      this.dragSelection = {};
      this.pinnedWindowStart = null;
      this.pinnedWindowEnd = null;
      let selectedIDs = this.getItemsIDs(selectedItems);

      if (this.galleryFiltering) {
        // Lite: the box selects exactly the options it touches.
        if (selectedIDs.length > 0) {
          this.$store.dispatch("selectOnlyInGallery", { ids: selectedIDs });
        }
        return;
      }

      // A drag that touches nothing clears the selection, but only under
      // Replace -- see the matching guard in ScatterplotView.
      if (
        selectedIDs.length === 0 &&
        this.currentSelectionOperation !== operations.REPLACE
      ) {
        return;
      }
      this.$store.dispatch("update", {
        view: this.viewID,
        selection: selectedIDs,
        operation: this.currentSelectionOperation,
        step: { kind: "set", label: "Gallery box", ids: selectedIDs },
      });
    },
    onSelectionDragMouseMove(selectedItems) {
      this.isSelectionDragOn = true;

      // Grow the pinned window to cover everything the drag has scrolled
      // through, so no swept-over card is unmounted mid-drag.
      if (this.isVirtualized) {
        let w = this.visibleWindow(this.chartData.length);
        if (this.pinnedWindowStart === null) {
          this.pinnedWindowStart = w.start;
          this.pinnedWindowEnd = w.end;
        } else {
          this.pinnedWindowStart = Math.min(this.pinnedWindowStart, w.start);
          this.pinnedWindowEnd = Math.max(this.pinnedWindowEnd, w.end);
        }
      }

      if (this.galleryFiltering) {
        // Preview the options the box will select.
        let preview = {};
        this.getItemsIDs(selectedItems).forEach((id) => {
          preview[id] = true;
        });
        this.dragSelection = preview;
        return;
      }

      if (!this.enableContext && selectedItems.length > 0) {
        // console.log("move",selectedItems,  d3.select(selectedItems) )
        // d3.selectAll(selectedItems).classed("outlined", true)

        let selectedIDs = selectedItems.map((s) => {
          let start = s.id.indexOf("_");
          let secondPart = s.id.substring(start + 1);
          let secondStart = secondPart.indexOf("_"); //finding the 2nd occurance of _ , accounting for ids that start with _
          return secondPart.substring(secondStart + 1);
        });

        this.dragSelection = {};

        selectedIDs.forEach((d) => {
          this.dragSelection[d] = null;
        });
      }
    },
    hover(item) {
      this.$store.commit("hover", { hovered: item });
    },
    // A click inspects; clicking the inspected option again stops inspecting.
    inspect(item) {
      this.inspectedFromHere = true;
      // With a model on screen the panel stays on its option while the pointer
      // wanders, so the store already counts the wandered-over option as the
      // hovered one: clicking it would read as "clicked the inspected option
      // again" and stop inspecting. A click here means "show me this one".
      let pinned = this.showing3D && this.modelLoaded && this.inspectedItem;
      if (pinned && item._id !== this.inspectedItem._id) {
        this.modelLoaded = false;
        this.inspectedItem = item;
        this.$store.commit("hover", { hovered: item });
        return;
      }
      this.$store.dispatch("inspectByClick", { item: item });
    },
    unhover(item) {
      this.$store.commit("hover", { hovered: null });
    },
    toggle(item, event) {
      event.stopPropagation();
      if (!this.isSelectionDragOn) {
        this.$store.dispatch("update", {
          view: this.viewID,
          selection: [item._id],
          operation: operations.TOGGLE,
          step: { kind: "pick", id: item._id },
        });
      }
    },

    highlight(selection) {
      let count = 0;
      for (var s in selection) {
        d3.select("#" + this.viewID)
          .select("#" + this.cardSelector + s)
          .classed("transparent", false)
          .classed("outlined", true);
      }
    },

    updateAxis() {
      console.log("updateAxis");
      const container = document.querySelector("#images-container");
      const containerRect = container.getBoundingClientRect();

      let axisDiv = document.querySelector("#gallery_axis");
      axisDiv.innerHTML = "";

      axisDiv.style.height = containerRect.height;

      const images = this.getAllCards();
      const displayedValues = new Set();
      const valuePositions = {};

      let IDs = this.getItemsIDs(images);
      let altsData = this.chartData.filter((alt) => IDs.includes(alt._id));
      // Sort images by their data values
      const sortedData = Array.from(altsData).sort((a, b) =>
        compareForSort(a[this.sortByVar], b[this.sortByVar], this.isSortDesc)
      );

      var i = 0;
      //Assumes images are already sorted
      images.forEach((image) => {
        const imageRect = image.getBoundingClientRect();
        const value = sortedData[i][this.sortByVar];
        const top = imageRect.top - containerRect.top + container.scrollTop;

        if (
          imageRect.top >= containerRect.top &&
          imageRect.bottom <= containerRect.bottom
        ) {
          if (!valuePositions[value] || top < valuePositions[value]) {
            valuePositions[value] = top;
          }
        }
        i++;
      });

      // Create labels for the values
      for (const value in valuePositions) {
        const label = document.createElement("div");
        label.classList.add("axis-label");
        label.style.top = `${valuePositions[value]}px`;
        label.textContent = value;
        axisDiv.appendChild(label);
        displayedValues.add(value);
      }
    },
    setThumbnailSize(index) {
      this.colSpan = index;
      this.updateAuxiliaries();
    },
    updateAuxiliaries() {
      this.updateScrollbar();
      this.paintCardEdges();
      //this.updateAxis();
    },
    /**
     * The colour the charts give an option, on the edge of its card, so a
     * card can be read against the chart it came from. Design Explorer does
     * the same thing, putting the scale on its thumbnails' own border.
     *
     * At full strength, not faded: a third of a colour over white lands
     * every value in the top of the range and flattens the ramp just where
     * the chart's own alpha already does. The edge is thin enough to take
     * the real colour, where the card's whole surround was not -- see the
     * .thumbnail_card rule in GalleryCard.vue for why that came off.
     *
     * Clearing it leaves the transparent edge the card reserves, so nothing
     * resizes. Painted here rather than bound in the template: the cards are
     * built by hand for speed, and windowing mounts only the ones on screen.
     */
    paintCardEdges() {
      let cards = this.getAllCards();
      if (!cards) return;
      let on = this.colorColumn !== "";
      cards.forEach((node) => {
        let id = node.id.substring(this.cardSelector.length);
        let datum = this.$store.getters.dataMap[id];
        d3.select(node).style(
          "border-color",
          on && datum ? this.colorize(datum) : null
        );
      });
    },
    /**
     * Marker positions come from each item's index in the sorted order rather
     * than from measured DOM positions, because virtualized galleries only
     * have the visible cards mounted -- a DOM scan would mark just those.
     */
    updateScrollbar() {
      const scrollbar = this.$el
        ? this.$el.querySelector("#custom-scrollbar")
        : null;
      if (!scrollbar) return;

      scrollbar.innerHTML = "";
      let isMarked = this.galleryFiltering
        ? this.isSelectedInGallery
        : (id) => !!this.selectionMap[id];
      if (this.galleryFiltering ? !this.hasGallerySelection : this.numSelected === 0) {
        return;
      }

      const sorted = this.sortedItems();
      const totalRows = Math.max(
        1,
        Math.ceil(sorted.length / this.columnsPerRow)
      );

      // One marker per row containing a selected item, so dense selections do
      // not pile thousands of overlapping divs onto the track.
      const markedRows = new Set();
      sorted.forEach((item, i) => {
        if (isMarked(item._id)) {
          markedRows.add(Math.floor(i / this.columnsPerRow));
        }
      });

      const frag = document.createDocumentFragment();
      markedRows.forEach((row) => {
        const marker = document.createElement("div");
        marker.classList.add("scrollbar-marker");
        marker.style.top = `${(row / totalRows) * 100}%`;
        frag.appendChild(marker);
      });
      scrollbar.appendChild(frag);
    },
    unhighlight(selection) {
      for (var s in selection) {
        d3.select("#" + this.cardSelector + s)
          .classed("outlined", false)
          .classed("transparent", true);
      }
    },
    unhighlightAll() {
      d3.select("#" + this.viewID)
        .selectAll(".thumbnail_card")
        .classed("outlined", false)
        .classed("transparent", true);
    },

    addSelection(id) {
      if (!this.selected.includes(id)) this.selected.push(id);
      else this.selected.splice(this.selected.indexOf(id), 1);
    },
    getCompareData() {
      let res = [];
      this.selected.forEach((e) => {
        res.push(this.chartData[e]);
      });
      return res;
    },
    destroyChart: function() {
      let node = d3.select("#" + this.viewID)._groups[0][0]; //this.$refs["parcoords"];
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    },
    updateContext() {
      let next;
      if (this.galleryFiltering) {
        // The pool ignores the gallery's own selection, so unselected options
        // stay (dimmed); "Show selected only" narrows it to the full result.
        if (this.enableContext) next = this.galleryPool;
        else if (!this.isFilterActive) next = this.rawChartData;
        else next = this.$store.getters.selectedDataInView(this.viewID);
      } else if (this.enableContext) {
        next = this.rawChartData;
      } else {
        next = this.$store.getters.selectedDataInView(this.viewID);
      }
      // Toggling one option rebuilds the pool with the same items; keep the
      // array so cards do not re-render.
      if (!this.sameItems(next, this.chartData)) this.chartData = asRows(next);
    },
    countSelected(selectionMap) {
      let count = 0;
      for (var alt in selectionMap) {
        if (selectionMap[alt] == 1) {
          count += 1;
        }
      }
      return count;
    },
  },
  beforeDestroy() {
    if (this._measureTimer) clearTimeout(this._measureTimer);
    if (this._scrollRaf) cancelAnimationFrame(this._scrollRaf);
    window.removeEventListener("keydown", this.onWindowKeydown);
    if (this.unsubscribeStore) this.unsubscribeStore();
    this.$store.commit("removeView", { view: this.viewID });
  },

  watch: {
    showing3D: function(value) {
      if (!value) this.modelLoaded = false;
    },
    colSpan: function() {
      // Tile size changed, so the cached row height no longer applies.
      this.measuredRowHeight = 0;
      Vue.nextTick(() => this.measureRowHeight());
    },
    height: function() {
      Vue.nextTick(() => this.measureRowHeight());
    },
    // Wider columns make taller images.
    width: function() {
      this.scheduleRowMeasure();
    },
    // The first cards of a collection, or of a filter that matched nothing.
    chartDataLength: function(length, previous) {
      if (length > 0 && !previous) this.scheduleRowMeasure();
    },
    isSortDesc: {
      handler: function() {
        Vue.nextTick(() => {
          this.updateAuxiliaries();
        });
      },
    },
    enableContext: {
      handler: function(enableContextNewValue, oldValue) {
        this.updateContext();
      },
      //deep: true
    },
    uiMode: function() {
      this.enableContext = true;
      this.updateContext();
    },
    rawChartData: {
      handler: function(newValue, oldValue) {
        this.imageIndexById = {};
        this.modelIndexById = {};
        this.updateContext();
      },
      //deep: true
    },
    hovered: function(newValue, oldValue) {
      // The hovered card outlines itself (see GalleryCard).
      // A loaded model stays put: swapping it out on every option the pointer
      // crosses would throw away a scene the user waited for. Clicking still
      // moves inspection.
      if (newValue && !(this.showing3D && this.modelLoaded)) {
        this.inspectedItem = newValue;
      }
      // A hover that just leaves an option (e.g. while Space-hovering) keeps
      // showing the option that was inspected. Stopping inspection on purpose
      // closes the panel instead: see `inspectionClears`.
      this.scrollInspectedIntoView();
    },
    // Bumped by the store's clearInspection (Esc, cancel, the panel's X,
    // clicking the inspected option again).
    inspectionClears: function() {
      this.inspectedItem = null;
    },
    inspectedItem: function(newItem) {
      this.hasInspectedItem = !!newItem;
      this.modelLoaded = false;
      // An option without a model has nothing to show on the 3D tab.
      if (this.showing3D && (!newItem || !newItem._models || newItem._models.length === 0)) {
        this.showing3D = false;
      }
    },
    colorColumn: function() {
      this.paintCardEdges();
    },
    // The ramp restretches when a zoom narrows the collection.
    colorScale: function() {
      this.paintCardEdges();
    },
  },
};
</script>

<style scoped>
/* Flush with the panel edges, across the container's padding. */
.gallery-header {
  margin: -12px -12px 8px;
}
</style>
