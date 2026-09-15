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
          <v-toolbar dense dark color="blue darken-3" class="mb-1">
            <v-select
              style="width: 150px"
              dense
              v-model="sortByVar"
              solo-inverted
              hide-details
              prepend-inner-icon="search"
              :items="keys"
              label="Sort by"
              @change="updateAuxiliaries()"
            ></v-select>
            <v-tooltip bottom>
              <template v-slot:activator="{ on, attrs }">
                <v-simple-checkbox
                  :ripple="false"
                  v-on="on"
                  v-bind="attrs"
                  dense
                  v-model="isSortDesc"
                  icon="large"
                  :off-icon="arrowUpIcon"
                  :on-icon="arrowDownIcon"
                />
              </template>
              <span v-if="isSortDesc">change to ascending order</span>
              <span v-else>change to descending order</span>
            </v-tooltip>

            <!--
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  x-small
                  icon
                  v-on="on"
                  @click="
                    () => (isInspectionViewPinned = !isInspectionViewPinned)
                  "
                >
                  <v-icon v-if="isInspectionViewPinned">mdi-pin-outline</v-icon>
                  <v-icon v-else>mdi-pin-off-outline</v-icon>
                </v-btn>
              </template>
              <span v-if="isInspectionViewPinned"
                >Show the inspection view only if we are currently inspecting an
                option</span
              >
              <span v-else
                >Pin the inspection view even if no options are currently
                inspected</span
              >
            </v-tooltip>
            -->
            <v-spacer></v-spacer>
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-chip
                  v-on="on"
                  class="ma-2"
                  color="blue darken-2"
                  text-color="white"
                >
                  <v-avatar left class="blue darken-3">{{
                    numSelected
                  }}</v-avatar
                  >Selected
                </v-chip>
              </template>
              <span>Number of selected options</span>
            </v-tooltip>

            <v-tooltip bottom>
              <template v-slot:activator="{ on, attrs }">
                <v-simple-checkbox
                  :ripple="false"
                  v-on="on"
                  v-bind="attrs"
                  align-center
                  v-model="enableContext"
                  :off-icon="offContextIcon"
                  :on-icon="onContextIcon"
                />
              </template>
              <span v-if="enableContext">Show only the selected options</span>
              <span v-else
                >Show all options while highlighting the selected options</span
              >
            </v-tooltip>
            <v-spacer></v-spacer>
            <div
              style="display: flex; flex-direction: column;     margin-top: 15px;"
            >
              <div
                style="display: flex; flex-direction: row; justify-content: space-between; position: relative; top: 12px"
              >
                <span><SmallGridIcon /></span> <span><MediumGridIcon /></span>
                <span><LargeGridIcon /></span> <span><DetailsGridIcon /></span>
              </div>
              <v-slider
                id="size-slider"
                min="0"
                max="3"
                step="1"
                style="width: 150px;"
                ticks="always"
                tick-size="4"
                v-model="colSpan"
                @change="updateAuxiliaries()"
              ></v-slider>
            </div>

            <!--
            <v-btn-toggle x-small dense v-model="isSortDesc" mandatory>
              <v-btn x-small depressed color="blue" :value="false">
                <v-icon>mdi-arrow-up</v-icon>
              </v-btn>
              <v-btn x-small depressed  :value="true">
                <v-icon>mdi-arrow-down</v-icon>
              </v-btn>
            </v-btn-toggle>
            -->
          </v-toolbar>

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

        <template v-slot:default="items">
          <drag-select-container
            selectorClass="thumbnail_card"
            :scrollAccessor="(el) => el.firstChild.firstChild"
            :disabled="!enableContext"
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
              <v-flex md6 style="overflow-y: scroll; overflow-x: visible">
                <v-card
                  color="primary"
                  class="showing-selection-note"
                  v-show="!enableContext"
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
                      v-for="item in items.items"
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
                          v-bind:class="{
                            outlined: numSelected > 0 && selectionMap[item._id],
                            transparent:
                              enableContext &&
                              numSelected > 0 &&
                              !selectionMap[item._id],
                          }"
                          v-if="item"
                          :src="item.image"
                          :lazy-src="lazyImageSrc"
                          :ref="'img_' + cardSelector + item._id"
                          alt="item.image"
                          @mouseover="isHoveringEnabled ? hover(item) : null"
                          @click="hover(item)"
                          @load="imageLoaded()"
                          @error="imageLoadingError(item)"
                        >
                          <!--   v-on:mouseup="enableContext? toggle(item):null"-->
                          <input
                            v-if="enableContext"
                            v-on:click="toggle(item, $event)"
                            class="image_checkbox"
                            type="checkbox"
                            :checked="selectionMap[item._id]"
                          />
                          <button
                            class="xbtn"
                            v-else
                            v-on:click="toggle(item, $event)"
                          />
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

import DetailsGridIcon from "-!vue-svg-loader!/src/assets/details_grid_icon.svg";
import LargeGridIcon from "-!vue-svg-loader!/src/assets/large_grid_icon.svg";
import MediumGridIcon from "-!vue-svg-loader!/src/assets/medium_grid_icon.svg";
import SmallGridIcon from "-!vue-svg-loader!/src/assets/small_grid_icon.svg";

export default {
  name: "AugmentedGridCards",
  components: {
    DetailsGridIcon,
    LargeGridIcon,
    MediumGridIcon,
    SmallGridIcon,
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
      offContextIcon: "mdi-eye-off",
      onContextIcon: "mdi-eye",
      arrowUpIcon: "mdi-arrow-up",
      arrowDownIcon: "mdi-arrow-down",
      viewID: null,
      colSpan: 1,
      possibleColSpans: [1, 2, 3, 4],
      labels: ["S", "M", "L", "XL"],
      icons: ["mdi-snowflake", "mdi-leaf", "mdi-fire", "mdi-water"],
      maxPerPage: 10000,
      sortByVar: "",
      isSortDesc: true,
      enableContext: this.defaultEnableContext,
      numSelected: 0,
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
    }),
    ...mapGetters(["colorScale", "colorize", "isHoveringEnabled"]),
    cardSelector() {
      return "card_" + this.viewID + "_";
    },
    filteredKeys() {
      return [...this.numericDimensions, ...this.nonNumericDimensions].filter(
        (x) => !this.keysBlackList.includes(x)
      );
    },
  },
  mounted() {
    Vue.nextTick(() => this.updateAuxiliaries());
  },

  updated() {
    //this.cards.splice(0, this.cards.length);
    //this.cards.push(...this.getAllCards());
  },
  created() {
    this.viewID = "id" + this._uid;

    this.$store.subscribe((mutation, state) => {
      if (
        mutation.type === "update" ||
        mutation.type === "reverseUpdate" ||
        mutation.type === "resetMarking"
      ) {
        this.updateContext();
        this.selectionMap = this.$store.getters.getMarking(this.viewID);

        this.chartData.forEach((d) => {
          d.selected = this.selectionMap[d._id];
        });
        this.numSelected = this.countSelected(this.selectionMap);
        if (mutation.type == "resetMarking") {
          this.enableContext = true;
        }
        Vue.nextTick(() => {
          this.updateAuxiliaries();
        });
      }
    });

    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this,
    });
    this.updateContext();
    //Inspection setup
    this.isModelGLTF = this.chartData[0].gltf ? true : false;
    this.inspectedItem = this.chartData[0];
    this.lazyImageSrc = this.chartData[0].image;

    this.sortByVar =
      this.keys.find((k) => !isNaN(this.chartData[0][k])) || this.keys[0];

    // To prevent the space key from scrolling down, which it does by default
    window.addEventListener("keydown", function(e) {
      if (e.key == " " && e.target == document.body) {
        e.preventDefault();
      }
    });
  },
  methods: {
    imageLoadingError(item) {
      this.$refs["img_" + this.cardSelector + item._id][0].src =
        "data:image/webp;base64,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";
    },
    imageLoaded() {
      this.numLoadedImages += 1;
      if (this.numLoadedImages >= this.rawChartData.length) {
        const container = document.querySelector(".scroll-container");
        const containerRect = container.getBoundingClientRect();

        container.addEventListener("scroll", (e) => {
          this.scrollLabel = document.querySelector("#scroll-value-label");
          if (!this.scrollLabel) return;
          if (!this.numericDimensions.includes(this.sortByVar)) {
            this.scrollLabel.style.display = "none";
            return;
          }
          this.scrollLabel.style.display = "block";

          var a = container.scrollTop;
          var b = container.scrollHeight - container.clientHeight;
          var c = a / b;

          this.scrollLabel.style.top =
            (c < 0.5 ? c + 0.05 : c - 0.1) * container.clientHeight + "px";

          const images = this.getAllCards();
          if (images) {
            let closestImage = null;
            let closestDistance = Infinity;

            images.forEach((img) => {
              var imageRect = img.getBoundingClientRect();

              const visibleHeight = container.clientHeight;
              const scrollY = container.scrollTop; // Get the vertical scroll position

              const imageTopRelative =
                imageRect.top - containerRect.top + scrollY;

              if (
                imageTopRelative >= scrollY &&
                imageTopRelative < scrollY + visibleHeight
              ) {
                const distance = Math.abs(imageTopRelative - scrollY);
                if (distance < closestDistance) {
                  closestDistance = distance;
                  closestImage = img;
                }
              }
            });

            if (closestImage) {
              const id = this.getItemsIDs([closestImage])[0];
              const datum = this.chartData.filter((alt) => alt._id === id)[0];
              this.scrollLabel.textContent = Math.round(datum[this.sortByVar]);
            }
          }
        });
        this.numLoadedImages = 0;
      }
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
      this.$store.commit("rateAlt", {
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
      let selectedIDs = this.getItemsIDs(selectedItems);

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
    updateAuxiliaries() {
      this.updateScrollbar();
      //this.updateAxis();
    },
    updateScrollbar() {
      const container = document.querySelector(".images-container");
      const scrollbar = document.getElementById("custom-scrollbar");

      // Clear existing markers
      scrollbar.innerHTML = "";

      const sel = d3
        .select("#" + this.viewID)
        .selectAll(".images-container > .thumbnail_container")
        .select(".thumbnail_card")
        .select(".v-image");
      const selectedImages = sel
        .nodes()
        .filter((x) => x.className.includes("outlined"));
      if (selectedImages.length == 0) return;

      const contentHeight = container.scrollHeight;
      selectedImages.forEach((image) => {
        const rect = image.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const markerPosition =
          ((rect.top - containerRect.top + container.scrollTop) /
            contentHeight) *
          100;

        const marker = document.createElement("div");
        marker.classList.add("scrollbar-marker");
        marker.style.top = `${markerPosition}%`;
        scrollbar.appendChild(marker);
      });
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
      //console.log("Updating Context");
      if (this.enableContext) {
        this.chartData = this.rawChartData;
      } else {
        this.chartData = this.$store.getters.selectedDataInView(this.viewID);
      }
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
    console.log("before destroy");
  },

  watch: {
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
