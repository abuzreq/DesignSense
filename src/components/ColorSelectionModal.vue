<template>
  <v-container style="width: 200px">
    <div class="text-center">
      <v-dialog v-model="dialog" width="500" overlay-opacity="0.5">
        <template v-slot:activator="{ on, attrs }">
          <v-btn color="blue lighten-2" dark v-bind="attrs" v-on="on">
            Color
          </v-btn>
        </template>

        <v-card height="350" style="overflow: hidden">
          <v-card-title class="headline grey lighten-2">
            Color Settings
          </v-card-title>
          <v-row class="row-margins">
            <!-------------- Color Column ---------->
            <v-col style="height: 100%" :cols="12">
              <div style="padding: 10px; padding-top: 0px">
                Choose the column to color based on (only categorical dimensions
                are supported)
              </div>
              <SingleDimensionSelect
                :initialValue="this.$store.getters.colorColumn"
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
            <v-btn
              class="close-button"
              color="red"
              text
              @click="dialog = false"
            >
              Close
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </v-container>
</template>

<style scoped>
.buttons-parent {
  justify-content: flex-end;
  position: relative;
}
.change-button {
  position: absolute;
  left: 25px;
  bottom: -100px;
}
.reset-button {
  position: absolute;
  left: 225px;
  bottom: -100px;
}
.close-button {
  position: absolute;
  bottom: -100px;
}
</style>
<script>
//[todo] don't allow changing settings if now dataset was loaded
//[todo] add icon of color wheel instead of modal button title
//[todo]

import * as d3 from "d3";
import SingleDimensionSelect from "@/components/SingleDimensionSelect.vue";

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
  computed: {},
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
      this.$store.commit("changeColorRange", newColorColumn);
    },
    onColorScaleChange: function (newColorScale) {},
  },
};
</script>

<style scoped>
.row-margins {
  margin: 10px;
  height: "100%";
}
</style>