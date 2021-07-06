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
              <span>Number of selected items</span>
            </v-tooltip>

            <v-spacer></v-spacer>
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
              <span v-if="enableContext">Show only selection</span>
              <span v-else>Show selection in context</span>
            </v-tooltip>
            <v-spacer></v-spacer>

            <v-slider
              min="0"
              max="3"
              step="1"
              :tick-labels="labels"
              ticks="always"
              tick-size="4"
              v-model="colSpan"
            ></v-slider>
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
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  x-small
                  icon
                  v-on="on"
                  @click="() => (inspectedItem = null)"
                >
                  <v-icon>mdi-close</v-icon>
                </v-btn>
              </template>
              <span>Close inspection</span>
            </v-tooltip>

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
              <span
                >Pin the inspection view even if no items are currently
                inspected</span
              >
            </v-tooltip>

            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <!--
                          <v-checkbox
                          v-on="on"
                          dense
                          align-center
                          v-model="inspecting3DView"
                          icon="large"
                          :off-icon="inspected3DIcon"
                          :on-icon="inspected2DIcon"
                        />
                -->
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

            <v-btn icon @click="() => previousView(inspectedItem)">
              <v-icon small>mdi-arrow-left</v-icon>
            </v-btn>
            <v-btn icon @click="() => nextView(inspectedItem)">
              <v-icon small>mdi-arrow-right</v-icon>
            </v-btn>

            <v-img
              contain
              width="100%"
              height="400px"
              v-if="inspectedItem && !inspecting3DView"
              :src="inspectedItem.image"
            />

            <model-gltf
              ref="gltf"
              v-else-if="inspectedItem && inspecting3DView && isModelGLTF"
              :src="inspectedItem.gltf"
              :on-load="onGLTFLoaded(this)"
              :rotation="modelRotation"
              :position="modelPosition"
              :lights="modelLights"
            />
            <v-card
              v-else
              width="100%"
              height="400px"
              id="inspector"
              name="inspector"
            ></v-card>
          </v-card>
        </template>

        <template v-slot:default="items">
          <drag-select-container
            selectorClass="thumbnail_card"
            :scrollAccessor="(el) => el.firstChild.firstChild"
            @onmouseup="onSelectionDragMouseUp($event)"
            @onmousemove="onSelectionDragMouseMove($event)"
          >
            <v-layout
              grid-list-sm
              column
              :style="{
                'max-height': `calc(${height}px - ${
                  inspectedItem ? 400 : 0
                }px -  100px)`,
              }"
            >
              <v-flex md6 style="overflow-y: auto; overflow-x: hidden">
                <v-row dense>
                  <v-col
                    v-for="item in items.items"
                    v-bind:key="cardSelector + item._id"
                    :cols="possibleColSpans[colSpan]"
                    class="thumbnail_container"
                  >
                    <!--<v-card :id="item._id" v-if="enableContext || selected.includes(index)"  v-on:click="addSelection(index)">-->
                    <v-card
                      class="thumbnail_card"
                      v-bind:id="cardSelector + item._id"
                    >
                      <v-img
                        v-bind:class="{
                          under_drag_selection:
                            !enableContext &&
                            isSelectionDragOn &&
                            item._id in dragSelection,
                          outlined:
                            enableContext &&
                            numSelected > 0 &&
                            selectionMap[item._id],
                          transparent:
                            enableContext &&
                            numSelected > 0 &&
                            !selectionMap[item._id],
                        }"
                        v-if="item"
                        :src="item.image"
                        v-on:mouseup="toggle(item)"
                        v-on:mouseover="hover(item)"
                      />
                      <!--  -->
                      <!--:id='"card_"+item._id' -->
                      <!--<router-link :to="{ name: 'AltView', params: { item } }">-->
                      <!--
                      <model-three
                        v-else
                        :src="item.json" 

                      />-->

                      <!--:id='"card_"+item._id'
                  <model-gltf 
                    v-else
                    :src="item.gltf" 
                  />
                      -->

                      <!-- -->
                      <v-expansion-panels
                        v-show="possibleColSpans[colSpan] > 3"
                      >
                        <v-expansion-panel>
                          <v-expansion-panel-header
                            >{{ "ID:" }} &nbsp;&nbsp;&nbsp;&nbsp;
                            {{ item["_id"] }}</v-expansion-panel-header
                          >

                          <v-expansion-panel-content>
                            <v-list>
                              <v-list-item v-for="(param, j) in keys" :key="j">
                                <v-list-item-content>{{
                                  param
                                }}</v-list-item-content>
                                <v-list-item-content class="justify-center">
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
              </v-flex>
            </v-layout>
          </drag-select-container>
        </template>
      </v-data-iterator>
    </v-container>
  </v-container>
</template>

<style scoped>
/** To show a crosshair when the curson is on the grid */
.vue-drag-select {
  cursor: crosshair;
}

::v-deep div.v-expansion-panel-content__wrap {
  padding-left: 0px;
  padding-right: 0px;
}

.thumbnail_container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.col > .thumbnail_card:not(.hovered) .v-image.under_drag_selection {
  border: 2px dashed rgb(33, 119, 180);
}

.col > .thumbnail_card:not(.hovered) .v-image.outlined {
  border: 3px solid rgb(33, 119, 180);
}

.col > .thumbnail_card.hovered .v-image.outlined {
  margin: 2px;
  border: 3px solid rgb(33, 119, 180);
}

.col > .thumbnail_card .v-image:not(.transparent) {
  opacity: 1;
}

.col > .thumbnail_card .v-image.transparent {
  opacity: 0.4;
}

::v-deep .v-slider--horizontal {
  min-width: 5vw;
}

.col > .thumbnail_card.hovered {
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
import { ModelGltf, ModelThree } from "vue-3d-model";
import { operations } from "@/components/operations.js";
import { mapState, mapGetters } from "vuex";
import * as d3 from "d3";
import DragSelect from "@/plugins/DragSelect.vue";
import SPECTACLES from "@/plugins/SPECTACLES.js";
import $ from "jquery";

export default {
  name: "AugmentedGridCards",
  components: {
    ModelGltf,
    ModelThree,
    "drag-select-container": DragSelect,
  },
  props: ["defaultEnableContext", "width", "height", "x", "y"],
  data: function () {
    return {
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
      isInspectionViewPinned: true,
      isSelectionDragOn: false,
      dragSelection: {},
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
      hovered: (state) => state.hovered,
      colorColumn: (state) => state.colorColumn,
    }),
    ...mapGetters(["colorScale", "colorize", "isHoveringEnabled"]),
    cardSelector() {
      return "card_" + this.viewID + "_";
    },
  },
  mounted() {
    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this,
    });
    this.updateContext();
    //Inspection setup
    this.isModelGLTF = this.chartData[0].gltf ? true : false;
    this.inspectedItem = this.chartData[0];

    this.sortByVar = this.keys.find((k) => !isNaN(this.chartData[0][k])) || this.keys[0];

    // console.log(this.chartData.filter((x) => x == null || !x.image));
  },

  updated() {
    //this.cards.splice(0, this.cards.length);
    //this.cards.push(...this.getAllCards());
  },
  created() {
    this.viewID = "id" + this._uid;

    this.$store.subscribe((mutation, state) => {
      if (mutation.type === "update" || mutation.type === "resetMarking") {
        this.updateContext();
        this.selectionMap = this.$store.getters.getMarking(this.viewID);
        this.chartData.forEach((d) => {
          d.selected = this.selectionMap[d._id];
        });
        this.numSelected = this.countSelected(this.selectionMap);
        if (mutation.type == "resetMarking") {
          this.enableContext = true;
        }
      }
    });
  },
  methods: {
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
    onSelectionDragMouseUp(selectedItems) {
      this.isSelectionDragOn = false;
      this.dragSelection = {};
      let selectedIDs = selectedItems.map((s) => {
        let start = s.id.indexOf("_");
        let secondPart = s.id.substring(start + 1);
        let secondStart = secondPart.indexOf("_"); //finding the 2nd occurance of _ , accounting for ids that start with _
        return secondPart.substring(secondStart + 1);
      });

      if (selectedIDs.length > 0) {
        this.$store.commit("update", {
          view: this.viewID,
          selection: selectedIDs,
          operation: this.currentSelectionOperation,
        });
      }
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
    hover(item, forced) {
      if (forced || this.isHoveringEnabled) {
        this.$store.commit("hover", { hovered: item });
      }
    },
    unhover(item) {
      this.$store.commit("hover", { hovered: null });
    },
    toggle(item) {
      if (!this.isSelectionDragOn) {
        this.$store.commit("update", {
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
    destroyChart: function () {
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
      console.log("loading");
      if (this.inspecting3DView && !this.isModelGLTF) {
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
      }
    },
  },
  beforeDestroy() {
    console.log("before destroy");
  },

  watch: {
    enableContext: {
      handler: function (enableContextNewValue, oldValue) {
        this.updateContext();
      },
      //deep: true
    },
    rawChartData: {
      handler: function (newValue, oldValue) {
        this.updateContext();
      },
      //deep: true
    },
    hovered: function (newValue, oldValue) {
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
        this.inspectedItem = null;
      }
    },
    inspecting3DView: function (newValue) {
      if (this.inspectedItem && newValue == true) {
        this.isLoading = true;
        this.load3DJSON(this.inspectedItem);
      } else {
        this.va3cViewer = null;
      }
    },
    inspectedItem: function (newItem) {
      this.inspectedItemViewIndex = 0;
      if (newItem && this.inspecting3DView) {
        this.isLoading = true;
        this.load3DJSON(newItem);
      }
    },
    colorColumn: function (newValue, oldValue) {
      let cardNodes = d3.select("#" + this.viewID).selectAll(".thumbnail_card");
      console.log(cardNodes);
      this.getAllCards().forEach((node, i) => {
        let id = node.id.substring(this.cardSelector.length);
        let datum = this.$store.getters.dataMap[id];
        d3.select(node.parentNode).style(
          "background-color",
          this.colorize(datum) + "55"
        );
      });
    },
    colorScale: function (newValue, oldValue) {
      this.refresh();
    },
  },
};
</script>