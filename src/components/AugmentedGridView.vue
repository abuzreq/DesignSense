<template>
  <v-container :id="viewID" justify-start align-start>
    <v-container class="pa-0 ma-0">
      <v-data-iterator
        :items="chartData"
        hide-default-footer
        :items-per-page="maxPerPage"
        :sort-by="sortByVar"
        :sort-desc="isSortDesc"
      >
        <template v-slot:header>
          <PanelHeader
            icon="mdi-image-multiple-outline"
            title="Gallery"
            :compact="compactHeader"
            class="gallery-header"
          >
            <span class="ph-label">Sort</span>
            <v-autocomplete
              v-model="sortByVar"
              :items="keys"
              dense
              outlined
              hide-details
              class="ph-select"
              @change="updateAuxiliaries()"
            />
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  v-on="on"
                  icon
                  small
                  class="ph-btn"
                  @click="isSortDesc = !isSortDesc"
                >
                  <v-icon small>{{
                    isSortDesc ? "mdi-sort-descending" : "mdi-sort-ascending"
                  }}</v-icon>
                </v-btn>
              </template>
              <span>{{
                isSortDesc
                  ? "Descending. Click for ascending order."
                  : "Ascending. Click for descending order."
              }}</span>
            </v-tooltip>
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

            <template v-slot:actions>
              <v-tooltip bottom>
                <template v-slot:activator="{ on }">
                  <v-btn
                    v-on="on"
                    icon
                    small
                    class="ph-btn"
                    :class="{ 'ph-btn--on': !enableContext }"
                    @click="enableContext = !enableContext"
                  >
                    <v-icon small>{{
                      enableContext ? "mdi-eye-outline" : "mdi-eye-off-outline"
                    }}</v-icon>
                  </v-btn>
                </template>
                <span v-if="isLite && enableContext">Show selected only</span>
                <span v-else-if="isLite"
                  >Also show unselected options, dimmed</span
                >
                <span v-else-if="enableContext"
                  >Show only the selected options</span
                >
                <span v-else
                  >Show all options while highlighting the selected
                  options</span
                >
              </v-tooltip>
              <span class="ph-divider" />
              <v-tooltip
                v-for="(size, index) in thumbnailSizes"
                :key="size.icon"
                bottom
              >
                <template v-slot:activator="{ on }">
                  <v-btn
                    v-on="on"
                    icon
                    small
                    class="ph-btn"
                    :class="{ 'ph-btn--on': colSpan === index }"
                    @click="setThumbnailSize(index)"
                  >
                    <v-icon small>{{ size.icon }}</v-icon>
                  </v-btn>
                </template>
                <span>{{ size.label }}</span>
              </v-tooltip>
            </template>
          </PanelHeader>

          <v-card
            v-if="inspectedItem || isInspectionViewPinned"
            cols="12"
            style="width: 100%"
          >
            <div class="inspected_item_top_bar">
              <div style="display: flex;">
                <!--
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  icon
                  v-on="on"
                  @click="() => (inspecting3DView = !inspecting3DView)"
                >
                  <v-icon v-if="inspecting3DView"
                    >mdi-file-image-outline</v-icon
                  >
                  <v-icon v-else>mdi-video-3d</v-icon>
                </v-btn>
              </template>
              <span>
                <span v-if="inspecting3DView">Show 2D image instead</span>
                <span v-else>Show 3D model instead</span>
              </span>
            </v-tooltip>

            <v-progress-circular
              v-show="isLoading"
              indeterminate
              :width="3"
              :size="25"
              color="primary"
            ></v-progress-circular>
-->
                <v-tooltip bottom>
                  <template v-slot:activator="{ on }">
                    <v-btn
                      v-on="on"
                      icon
                      small
                      @click="isParamsPanelOpen = !isParamsPanelOpen"
                    >
                      <v-icon
                        :color="isParamsPanelOpen ? 'primary' : 'secondary'"
                        >mdi-list-box</v-icon
                      >
                    </v-btn>
                  </template>
                  <span>
                    <span v-if="isParamsPanelOpen">Hide details</span>
                    <span v-else>Show details</span>
                  </span>
                </v-tooltip>
                <v-tooltip bottom>
                  <template v-slot:activator="{ on }">
                    <v-btn
                      v-on="on"
                      v-show="
                        inspectedItem &&
                          inspectedItem.images &&
                          inspectedItem.images.length > 1
                      "
                      icon
                      @click="() => previousView(inspectedItem)"
                    >
                      <v-icon small>mdi-arrow-left</v-icon>
                    </v-btn>
                  </template>
                  <span>Previous image</span>
                </v-tooltip>
                <v-tooltip bottom>
                  <template v-slot:activator="{ on }">
                    <v-btn
                      v-on="on"
                      v-show="
                        inspectedItem &&
                          inspectedItem.images &&
                          inspectedItem.images.length > 1
                      "
                      icon
                      @click="() => nextView(inspectedItem)"
                    >
                      <v-icon small>mdi-arrow-right</v-icon>
                    </v-btn>
                  </template>
                  <span>Next image</span>
                </v-tooltip>
              </div>
              <div style="display: flex;">
                <StarRating
                  v-if="inspectedItem"
                  :item="inspectedItem"
                  @onRatingChanged="onRatingChanged"
                />
                <v-tooltip bottom>
                  <template v-slot:activator="{ on }">
                    <v-btn
                      small
                      icon
                      v-on="on"
                      @click="
                        () => {
                          inspectedItem = null;
                          unhover();
                        }
                      "
                    >
                      <v-icon>mdi-close</v-icon>
                    </v-btn>
                  </template>
                  <span>Close inspection</span>
                </v-tooltip>
              </div>
            </div>

            <div class="params_panel_parent">
              <div
                class="params_panel"
                :style="{ display: isParamsPanelOpen ? 'block' : 'none' }"
              >
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
                      >{{ param }}</v-list-item-content
                    >
                    <v-list-item-content
                      plain
                      style="padding: 4px 0;"
                      class="justify-center"
                    >
                      {{ inspectedItem[param] }}
                    </v-list-item-content>
                  </v-list-item>
                </v-list>
              </div>
            </div>
            <div
              :style="{
                display: 'flex',
                'flex-direction': 'row',
                'justify-content': isParamsPanelOpen ? 'end' : 'center',
              }"
            >
              <imageZoom
                v-if="inspectedItem && !inspecting3DView"
                style="display: flex; justify-content: center;"
                :regular="inspectedItem.image"
                :zoom-amount="2"
                :click-zoom="true"
                img-class="inspected_image"
                :alt="inspectedItem.image"
                :show-message="false"
              />
              <!--
              <model-gltf
                ref="gltf"
                v-else-if="inspectedItem && inspecting3DView && isModelGLTF"
                :src="inspectedItem.gltf"
                :on-load="onGLTFLoaded(this)"
                :rotation="modelRotation"
                :position="modelPosition"
                :lights="modelLights"
              />-->
              <v-card
                v-else
                width="100%"
                height="400px"
                id="inspector"
                name="inspector"
              ></v-card>
            </div>
          </v-card>
        </template>

        <template v-slot:no-data>
          <div class="gallery-empty">{{ emptyMessage }}</div>
        </template>
        <template v-slot:default="items">
          <drag-select-container
            selectorClass="thumbnail_card"
            :scrollAccessor="(el) => el.firstChild.firstChild"
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
                  inspectedItem ? 400 : 0
                }px -  100px)`,
              }"
            >
              <v-flex
                md6
                class="scroll-container gallery-scroller"
                style="overflow-y: scroll; overflow-x: visible"
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
                      v-if="leadingSpacerHeight(items.items.length) > 0"
                      cols="12"
                      class="virtual-spacer"
                      :style="{
                        height: leadingSpacerHeight(items.items.length) + 'px',
                      }"
                    />
                    <v-col
                      v-for="item in windowedItems(items.items)"
                      v-bind:key="cardSelector + item._id"
                      :cols="possibleColSpans[colSpan]"
                      :class="[
                        'thumbnail_container',
                        possibleColSpans[colSpan] > 3 ? 'top-thumbnails' : '',
                      ]"
                    >
                      <!--<v-card :id="item._id" v-if="enableContext || selected.includes(index)"  v-on:click="addSelection(index)">-->
                      <v-card
                        class="thumbnail_card"
                        v-bind:id="cardSelector + item._id"
                      >
                        <v-img
                          v-bind:class="cardClasses(item)"
                          v-if="item"
                          :src="item.image"
                          :lazy-src="lazyImageSrc"
                          :ref="'img_' + cardSelector + item._id"
                          alt="item.image"
                          @mouseover="isHoveringEnabled ? hover(item) : null"
                          @click="inspect(item)"
                          @load="imageLoaded()"
                          @error="imageLoadingError(item)"
                        >
                          <button
                            v-if="galleryFiltering"
                            class="gallery-toggle"
                            :title="
                              isSelectedInGallery(item._id)
                                ? 'Unselect'
                                : 'Select'
                            "
                            @mousedown.stop
                            @click.stop="toggleInGallery(item)"
                          >
                            <v-icon small color="white">{{
                              isSelectedInGallery(item._id)
                                ? "mdi-minus"
                                : "mdi-plus"
                            }}</v-icon>
                          </button>
                          <template v-else>
                            <input
                              v-if="enableContext && can('gallerySelection')"
                              v-on:click="toggle(item, $event)"
                              class="image_checkbox"
                              type="checkbox"
                              :checked="selectionMap[item._id]"
                            />
                            <button
                              class="xbtn"
                              v-else-if="can('gallerySelection')"
                              v-on:click="toggle(item, $event)"
                            />
                          </template>
                        </v-img>

                        <v-expansion-panels
                          v-show="possibleColSpans[colSpan] > 3"
                        >
                          <v-expansion-panel>
                            <v-expansion-panel-header>
                              <template v-slot:default="{ open }">
                                <span
                                  v-if="!open"
                                  style="text-align: center;font-size: smaller;"
                                >
                                  Expand for Details
                                </span>
                              </template>
                            </v-expansion-panel-header>

                            <v-expansion-panel-content>
                              <v-list>
                                <v-list-item
                                  style="min-height: 28px;"
                                  v-for="(param, j) in filteredKeys"
                                  :key="j"
                                >
                                  <v-list-item-content
                                    style="font-weight: bold; padding: 6px 0;"
                                    >{{ param }}</v-list-item-content
                                  >
                                  <v-list-item-content
                                    style="padding: 6px 0;"
                                    class="justify-center"
                                  >
                                    {{ item[param] }}
                                  </v-list-item-content>
                                </v-list-item>
                              </v-list>
                            </v-expansion-panel-content>
                          </v-expansion-panel>
                        </v-expansion-panels>
                      </v-card>
                    </v-col>
                    <v-col
                      v-if="trailingSpacerHeight(items.items.length) > 0"
                      cols="12"
                      class="virtual-spacer"
                      :style="{
                        height: trailingSpacerHeight(items.items.length) + 'px',
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
      </v-data-iterator>
    </v-container>
  </v-container>
</template>

<style scoped>
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
::v-deep .params_panel {
  margin-left: 0px;
  position: absolute;
  left: 0px;
  z-index: 100;
  overflow-y: scroll;
  min-width: 240px;
  height: 38vh;
  width: auto;
  font-size: small;
  opacity: 0.8;
}
::v-deep .inspected_image {
  height: 40vh;
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
  height: 400px;
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
.images-container {
  margin-top: 5px;
  width: 100%;
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
  position: relative;
  justify-content: space-between;
  width: 100%;
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

.col > .thumbnail_card:not(.hovered) .v-image.under_drag_selection {
  border: 2px dashed rgb(33, 119, 180);
}

.col > .thumbnail_card:not(.hovered) .v-image.outlined {
  border: 3px solid rgb(33, 119, 180);
  background-color: lightgray;
}

::v-deep .col > .thumbnail_card:not(.hovered) .v-image.outlined > div {
  scale: 0.9;
}

.col > .thumbnail_card.hovered .v-image.outlined {
  margin: 2px;
  border: 3px solid rgb(33, 119, 180);
}

.col > .thumbnail_card .v-image:not(.transparent) {
  opacity: 1;
}

.col > .thumbnail_card .v-image.transparent {
  opacity: 0.35;
}

/* Lite: unselected options stay in the pool, dimmed. Only the picture fades,
   so the card's select button stays readable. */
::v-deep .v-image.gallery-dimmed .v-image__image,
::v-deep .v-image.gallery-dimmed .v-image__placeholder {
  opacity: 0.3;
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

::v-deep .v-slider--horizontal {
  min-width: 5vw;
}

.col > .thumbnail_card.hovered {
  /* border: 3px solid #ff0000;*/
  border: 3px dashed rgb(33, 119, 180); /*#82b1ff;*/
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

import imageZoom from "vue-image-zoomer";

import { ModelGltf, ModelThree } from "vue-3d-model";
import { operations } from "@/components/operations.js";
import { mapState, mapGetters } from "vuex";
import * as d3 from "d3";
import DragSelect from "@/plugins/DragSelect.vue";
import StarRating from "@/components/StarRating.vue";

import PanelHeader from "@/components/PanelHeader.vue";

export default {
  name: "AugmentedGridCards",
  components: {
    PanelHeader,
    StarRating,
    "drag-select-container": DragSelect,
    imageZoom,
  },
  props: ["defaultEnableContext", "width", "height", "x", "y", "type"],
  data: function() {
    return {
      isParamsPanelOpen: false,
      isLoading: false,
      va3cViewer: null,
      isModelGLTF: false,
      modelCameraPosition: { x: 1, y: 2, z: -3 },
      modelCameraRotation: { x: 3, y: 2, z: -1 },
      modelRotation: { x: -Math.PI / 3, y: 0, z: 0 },
      modelPosition: { x: 0, y: -30, z: -30 },
      modelLights: [
        {
          type: "AmbientLight",
          color: 0xaaaaaa,
        },
        {
          type: "hemispherelight",
          groundColor: 0xff0000,
          skyColor: 0xffffff,
          intensity: 0.8,
        },
      ],
      crossOrigin: "anonymous",
      chartData: [],
      cards: [],
      selectionMap: {},
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
      maxPerPage: 100000,
      sortFallback: "",
      enableContext: this.defaultEnableContext,
      inspectedItem: null,
      inspecting3DView: false,
      inspectedItemViewIndex: 0,
      inspected3DIcon: "mdi-video-3d",
      inspected2DIcon: "mdi-file-image-outline",
      isInspectionViewPinned: false,
      isSelectionDragOn: false,
      dragSelection: {},
      numLoadedImages: 0,
      scrollLabel: null,
      lazyImageSrc: undefined,
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
      keysBlackList: [
        "index",
        "selected",
        "gltf",
        "image",
        "ID",
        "id",
        "_id",
        "geometry",
        "json",
        "img",
        "threeD",
        "collection",
        "images",
        "description",
      ],
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
    ...mapState({
      currentSelectionOperation: (state) => state.currentSelectionOperation,
      rawChartData: (state) => state.data,
      keys: (state) => state.allDimensions.concat(["selected"]),
      numericDimensions: (state) => state.numericDimensions,
      nonNumericDimensions: (state) => state.nonNumericDimensions,
      hovered: (state) => state.hovered,
      lastHovered: (state) => state.lastHovered,

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
    ]),
    galleryFiltering() {
      return this.can("galleryFiltering");
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
    filteredKeys() {
      return [...this.numericDimensions, ...this.nonNumericDimensions].filter(
        (x) => !this.keysBlackList.includes(x)
      );
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
    // too covers the case where it was absent at mount. Both calls are
    // idempotent and converge after a pass or two.
    this.attachGalleryScrollListener();
    this.measureRowHeight();
  },
  created() {
    this.viewID = "id" + this._uid;

    this.$store.subscribe((mutation, state) => {
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
    //Inspection setup
    this.isModelGLTF = this.chartData[0].gltf ? true : false;
    this.inspectedItem = this.chartData[0];
    this.lazyImageSrc = this.chartData[0].image;

    this.sortFallback =
      this.keys.find((k) => !isNaN(this.chartData[0][k])) || this.keys[0];

    // To prevent the space key from scrolling down, which it does by default
    this.onWindowKeydown = function(e) {
      if (e.key == " " && e.target == document.body) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", this.onWindowKeydown);
  },
  methods: {
    galleryScrollEl() {
      // Not ".scroll-container": DragSelect removes that class when disabled.
      return this.$el ? this.$el.querySelector(".gallery-scroller") : null;
    },
    cardClasses(item) {
      if (this.galleryFiltering) {
        return {
          "gallery-dimmed": !this.isSelectedInGallery(item._id),
          under_drag_selection:
            this.isSelectionDragOn &&
            this.dragSelection[String(item._id)] === true,
        };
      }
      return {
        outlined: this.hasSelection && this.selectionMap[item._id],
        transparent:
          this.enableContext &&
          this.hasSelection &&
          !this.selectionMap[item._id],
      };
    },
    toggleInGallery(item) {
      this.$store.dispatch("toggleGallerySelection", { id: item._id });
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
     * imagery these galleries show, and `measureRowHeight` re-measures after
     * every render so any drift self-corrects on the next frame.
     */
    measureRowHeight() {
      let nodes = this.$el
        ? this.$el.querySelectorAll(".images-container > .thumbnail_container")
        : [];
      // Take the tallest of a sample rather than the first card: a card whose
      // image has not arrived yet collapses to a few pixels, and a single
      // collapsed card would otherwise poison the estimate for the whole grid.
      let h = 0;
      let sample = Math.min(nodes.length, 24);
      for (let i = 0; i < sample; i++) {
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
    windowedItems(list) {
      if (!list) return [];
      if (!this.isVirtualized) return list;
      let w = this.visibleWindow(list.length);
      return list.slice(w.start, w.end);
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
    imageLoadingError(item) {
      this.$refs["img_" + this.cardSelector + item._id][0].src =
        "data:image/webp;base64,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";
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
      if (datum && datum[this.sortByVar] !== undefined) {
        this.scrollLabel.textContent = Math.round(datum[this.sortByVar]);
      }
    },
    /** The gallery's items in the order the iterator renders them. */
    sortedItems() {
      let list = this.chartData.slice();
      if (!this.sortByVar) return list;
      let dim = this.sortByVar;
      let dir = this.isSortDesc ? -1 : 1;
      return list.sort((a, b) => {
        let av = a[dim];
        let bv = b[dim];
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * dir;
      });
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
    nextView(item) {
      this.inspectedItemViewIndex =
        (this.inspectedItemViewIndex + 1) % item.images.length;
      item.image = item.images[this.inspectedItemViewIndex];
    },
    previousView(item) {
      let index = this.inspectedItemViewIndex - 1;
      if (index < 0) {
        index = item.images.length - 1;
      }
      this.inspectedItemViewIndex = index;
      item.image = item.images[this.inspectedItemViewIndex];
    },
    onGLTFLoaded() {
      this.isLoading = false;
      //TODO fetch the loaded object and color it.. see https://github.com/abuzreq/abuzreq.github.io/blob/develop/js/geom.js
      /*
        if(this.$refs.gltf)
        {
          let object = this.$refs.gltf.scene;
          object.traverse(function(child) {

              if (child.type ==  'Mesh')
              {

                  var materialColor = new THREE.Color();
                  materialColor.setRGB( 0.4, 0.0, 0.0 );
                  let material = new THREE.MeshPhongMaterial( { color: materialColor, side: THREE.DoubleSide } );

                  child.material = material;//new THREE.Color(0xffb830);

                //console.log(child)
              }
          });
           //  this.$refs.gltf.update();
          //this.$refs.gltf.updateRenderer();//renderer.render(object, this.$refs.gltf.camera)
        }*/
    },
    onProgressLoading3DModel(d) {
      this.isLoading = true;
    },
    onDoneLoading3DModel(d) {
      this.isLoading = false;
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
      const sortedData = Array.from(altsData).sort((a, b) => {
        return (
          (a[this.sortByVar] - b[this.sortByVar]) * (this.isSortDesc ? -1 : 1)
        );
      });

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
      //this.updateAxis();
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
      if (!this.sameItems(next, this.chartData)) this.chartData = next;
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
    load3DJSON(item) {
      console.log("loading 3D TODO: not implemented");

      /*    if (this.inspecting3DView && !this.isModelGLTF) {
        d3.json(item.json).then((jsonModel) => {
          this.isLoading = false;

          if (!this.va3cViewer) {
            let inspector = d3.select("#" + this.viewID).select("#inspector");
            if (inspector) {
              this.va3cViewer = new SPECTACLES(inspector._groups[0][0]);
            }
          }

          if (this.va3cViewer) {
            this.va3cViewer.loadNewModel(jsonModel);
          }
        });
      } */
    },
  },
  beforeDestroy() {
    if (this._measureTimer) clearTimeout(this._measureTimer);
    if (this._scrollRaf) cancelAnimationFrame(this._scrollRaf);
    window.removeEventListener("keydown", this.onWindowKeydown);
  },

  watch: {
    colSpan: function() {
      // Tile size changed, so the cached row height no longer applies.
      this.measuredRowHeight = 0;
      Vue.nextTick(() => this.measureRowHeight());
    },
    height: function() {
      Vue.nextTick(() => this.measureRowHeight());
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
        this.updateContext();
      },
      //deep: true
    },
    hovered: function(newValue, oldValue) {
      if (oldValue) {
        d3.select("#" + this.viewID)
          .select("#" + this.cardSelector + oldValue._id)
          .classed("hovered", false);
      }
      if (newValue) {
        d3.select("#" + this.viewID)
          .select("#" + this.cardSelector + newValue._id)
          .classed("hovered", true);

        if (!this.inspecting3DView) {
          //Change inpsection only if showing 2D. Quickly changing 3D models would be too slow.
          this.inspectedItem = newValue;
        }
      } else {
        if (this.lastHovered) {
          this.inspectedItem = this.lastHovered;
        } else {
          this.inspectedItem = null;
        }
      }
    },
    inspecting3DView: function(newValue) {
      if (this.inspectedItem && newValue == true) {
        this.isLoading = true;
        this.load3DJSON(this.inspectedItem);
      } else {
        this.va3cViewer = null;
      }
    },
    inspectedItem: function(newItem) {
      this.inspectedItemViewIndex = 0;
      if (newItem && this.inspecting3DView) {
        this.isLoading = true;
        this.load3DJSON(newItem);
      }
    },
    colorColumn: function(newValue, oldValue) {
      let cardNodes = d3.select("#" + this.viewID).selectAll(".thumbnail_card");

      this.getAllCards().forEach((node, i) => {
        let id = node.id.substring(this.cardSelector.length);
        let datum = this.$store.getters.dataMap[id];
        d3.select(node.parentNode).style(
          "background-color",
          newValue !== "" ? this.colorize(datum) + "55" : "white"
        );
      });
    },
    colorScale: function(newValue, oldValue) {
      // this.refresh();
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
