<template>
  <v-container style="width: auto; padding: 0 4px;">
    <div class="text-center">
      <v-dialog v-model="dialog" width="500" overlay-opacity="0.5">
        <template v-slot:activator="{ on: dialogOn, attrs }">
          <v-tooltip bottom>
            <template v-slot:activator="{ on: tooltipOn }">
              <v-btn
                text
                small
                class="color-by-button"
                v-bind="attrs"
                v-on="Object.assign({}, tooltipOn, dialogOn)"
              >
                <v-icon left small>mdi-palette</v-icon>
                <span class="color-by-label">{{ colorColumn || "Color" }}</span>
              </v-btn>
            </template>
            <span>{{
              colorColumn
                ? "Options are colored by " + colorColumn + ". Click to change."
                : "Color the options by a category"
            }}</span>
          </v-tooltip>
        </template>

        <v-card height="350" style="overflow: hidden">
          <v-card-title class="headline grey lighten-2" style="display: flex; align-items: center;">
            Color Settings
            <v-spacer />
            <v-btn
              icon
              color="red"
              @click="dialog = false"
            >
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-card-title>
          <v-row class="row-margins">
            <!-------------- Color Column ---------->
            <v-col style="height: 100%" :cols="12">
              <div style="padding: 10px; padding-top: 0px">
                Choose the column to color based on (only categorical dimensions
                are supported)
              </div>
              <SingleDimensionSelect
                :initialValue="colorColumn"
                v-on:update="onColorColumnChange($event)"
                :width="this.selectorWidth"
                :prefixWidth="this.prefixWidth"
                :dimensionsType="1"
              >
                <template v-slot:prefix>
                  <div
                    :style="{
                      float: 'left',
                      height: '100%',
                      width: `${prefixWidth}px`,
                    }"
                  >
                    Color Column:
                  </div>
                </template>
              </SingleDimensionSelect>
            </v-col>
            <!-------------- Color Range ---------->
            <!--
            <v-col :cols="4">
              <SingleDimensionSelect
                :initialValue="this.$store.state.colorRange"
                v-on:update="onColorRangeChange($event)"
                :width="this.selectorWidth"
                :prefixWidth="this.prefixWidth"
                :dimensionsType="1"
              >
                <template v-slot:prefix>
                  <div
                    :style="{
                      float: 'left',
                      height: '100%',
                      width: `${prefixWidth}px`,
                    }"
                  >
                    Color Column:
                  </div>
                </template>
              </SingleDimensionSelect>
            </v-col>
            -->
            <!-------------- Color Scale ---------->
            <!--
        <v-col :cols="4">
         <SingleDimensionSelect
            :initialValue="this.$store.state.colorScale"
            v-on:update="onColorScaleChange($event)"
            :width="this.selectorWidth"
            :prefixWidth="this.prefixWidth"
            :dimensionsType= "1"
          >
            <template v-slot:prefix>
              <div
                :style="{
                  float: 'left',
                  height: '100%',
                  width: `${prefixWidth}px`,
                }"
              >
                Color Column:
              </div>
            </template>
          </SingleDimensionSelect>
            </v-col>
            -->
          </v-row>
          <v-card-actions class="buttons-parent">
            <v-btn
              class="change-button"
              color="primary"
              text
              @click="OnColorColumnChangeSubmit"
            >
              Change Color
            </v-btn>

            <v-btn
              class="reset-button"
              color="secondary"
              text
              @click="OnColorReset"
            >
              Reset Color
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </v-container>
</template>

<style scoped>
.color-by-button {
  text-transform: none;
  letter-spacing: normal;
}
.color-by-label {
  display: inline-block;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.buttons-parent {
  justify-content: flex-end;
  position: relative;
}
.change-button,
.reset-button {
  position: relative;
}
</style>
<script>
//[todo] don't allow changing settings if now dataset was loaded
//[todo] add icon of color wheel instead of modal button title
//[todo]

import * as d3 from "d3";
import SingleDimensionSelect from "@/components/SingleDimensionSelect.vue";
import { mapState } from "vuex";

export default {
  name: "ColorSelectionModal",
  components: { SingleDimensionSelect },

  data() {
    return {
      dialog: false,
      currentColorColumn: "",
      prefixWidth: 100,
      selectorWidth: 400,
    };
  },
  computed: {
    ...mapState({
      colorColumn: (state) => state.colorColumn,
    }),
  },
  methods: {
    OnColorReset: function () {
      this.$store.commit("changeColorColumn", "");
    },
    onColorColumnChange: function (newColorColumn) {
      this.currentColorColumn = newColorColumn;
    },
    OnColorColumnChangeSubmit() {
      this.dialog = false;
      this.$store.commit("changeColorColumn", this.currentColorColumn);
    },
    onColorRangeChange: function (newColorRange) {
      this.$store.commit("changeColorRange", newColorRange);
    },
    onColorScaleChange: function (newColorScale) {},
  },
  watch: {
    colorColumn: {
      immediate: true,
      handler(val) {
        this.currentColorColumn = val || "";
      },
    },
  },
};
</script>

<style scoped>
.row-margins {
  margin: 10px;
  height: "100%";
}
</style>