<template>
  <v-container style="width: 200px">
    <div class="text-center">
      <v-dialog v-model="dialog" width="800"  overlay-opacity="0.5">
        <template v-slot:activator="{ on, attrs }">
          <v-btn color="blue lighten-2" dark v-bind="attrs" v-on="on">
            Color
          </v-btn>
        </template>

        <v-card height="350">
          <v-card-title class="headline grey lighten-2">
            Data Loading
          </v-card-title>
          <v-row  class="row-margins">
            <!-------------- Color Column ---------->
            <v-col style=" height: 100%;" :cols="4">
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
            <!-------------- Color Scale ---------->
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
          </v-row>

        </v-card>
      </v-dialog>
    </div>
  </v-container>
</template>


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
      prefixWidth: 100,
      selectorWidth: 200,
    };
  },
  computed: {},
  methods: {
    onColorColumnChange: function (newColorColumn) {
      this.$store.commit("changeColorColumn", newColorColumn );
      //[todo] add store mutation to change color column
    },
    onColorRangeChange: function (newColorRange) {
        this.$store.commit("changeColorRange", newColorColumn );
      //[todo] add store mutation to change color column
    },
    onColorScaleChange: function (newColorScale) {
      //[todo] add store mutation to change color column
    },
  },
};
</script>

<style scoped>
.row-margins
{
  margin: 10px;
  height: '100%';
}
</style>