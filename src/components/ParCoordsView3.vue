<template>
  <v-container>
    <v-row no-gutters>
      <v-col
        style="position: relative; left: -12px; top: -12px"
        :cols="isCustomizingDimensions ? 2 : 1"
      >
        <span>
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn
                color="red"
                small
                icon
                v-on="on"
                @click="
                  () => (isCustomizingDimensions = !isCustomizingDimensions)
                "
              >
                <v-icon>mdi-wrench-outline</v-icon>
              </v-btn>
            </template>
            <span>Customize the Chart</span>
          </v-tooltip>
        </span>
        <MultiDimensionSelect
          v-show="isCustomizingDimensions"
          :initialValue="numericDimensions"
          :keys="allKeys"
          :width="(1 / 6.0) * width"
          v-on:update="onDimensionChange($event)"
        />
      </v-col>
      <v-col
        :style="[
          !isCustomizingDimensions
            ? { position: 'relative', left: '-60px' }
            : { position: 'relative', left: '0px' },
        ]"
        :cols="isCustomizingDimensions ? 10 : 11"
      >
        <div :id="viewID" ref="parcoords" class="parcoords"></div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import "parcoord-es/dist/parcoords.css";

import ParCoords from "parcoord-es";
import * as d3 from "d3";
import { mapGetters, mapState } from "vuex";
import TemplateView from "@/components/TemplateView.vue";
import MultiDimensionSelect from "@/components/MultiDimensionSelect.vue";
import { round } from "@/components/utils.js";
import { operations } from "@/components/operations.js";
import { isAssetColumn } from "@/data/assets.js";

export default {
  mixins: [TemplateView],
  components: { MultiDimensionSelect },
  name: "ParCoordsView",
  data() {
    return {
      excludedDimensions: [],
      isCustomizingDimensions: false,
      allKeys: [],
      keysBlackList: [],
      graphCentriodPoints: null,
    };
  },
  computed: {
    ...mapState({
      numericDimensions: (state) => state.numericDimensions,
      nonNumericDimensions: (state) => state.nonNumericDimensions,
    }),
  },
  mounted() {},
  created() {
    // Bookkeeping columns only: the picture and model ones are isAssetColumn's,
    // since a list can never cover "img_2" or "model3d_3".
    this.keysBlackList = ["index", "selected", "ID", "id", "_id", "collection"];
    // The axes on offer, so nothing holding a picture or a model can be picked.
    this.allKeys = Object.keys(this.chartData[0]).filter(
      (key) => !isAssetColumn(key)
    );

    this.excludedDimensions = this.nonNumericDimensions;
    this.excludedDimensions.push("selected");
  },
  watch: {
    isCustomizingDimensions: {
      handler: function(newValue) {
        this.refresh();
      },
      //deep: true
    },
  },
  methods: {
    formatDimensions(dimensions) {
      var result = {};
      dimensions.forEach((dim) => {
        result[dim] = {};
      });
      return result;
    },
    prepareDimensions(data, dimensions, chart) {
      let range = this.height; //- chart.margin().top - chart.margin().bottom;
      var result = {};
      dimensions.forEach((dim) => {
        let extents = d3.extent(data, (d) => d[dim]);
        let scale = d3
          .scaleLinear()
          .domain(extents)
          .range([range, 1]);
        result[dim] = {
          yscale: scale,
          title: dim,
          tickPadding: 0,
          innerTickSize: 8,
          type: "number",
          orient: "right",
          ticks: 10,
        };
      });

      return result;
    },
    onDimensionChange(newDimensions) {
      this.excludedDimensions = Object.keys(this.chartData[0]).filter(
        (d) => !newDimensions.includes(d)
      );

      this.refresh();
    },
    markingChangeHandler: function(reset) {
      console.log("resetting!!! PCP", reset);
      if (reset) {
        //this.chart.unhighlight(this.$store.getters.data);
        //this.chart.highlight(this.$store.getters.data);
        this.chart.brushReset();
      } else {
        this.chart.brushReset();

        this.chart.unhighlight(this.$store.getters.data);
        var result = this.$store.getters.selectedDataInView(this.viewID);
        this.chart.highlight(result);
      }
    },
    hoverHandler: function() {
      this.chart.unhighlight();

      let hovered = this.$store.getters.getHovered;
      if (hovered) {
        this.chart.highlight([hovered]);
      }

      this.updateStyleGivenHovered(hovered);
    },
    updateStyleGivenHovered(hovered) {

      let dict = {}
      d3.select("#" + this.viewID)
        .selectAll("canvas").nodes().map(canvas => dict[canvas.getAttribute("class")] = canvas)
          console.log(dict)

          let items = this.chart.brushed() || [];
          if(items.length > 0)
          {
            if(hovered)
            {
               dict["brushed"].style.opacity = 0.6;
            }
            else 
            {
              dict["brushed"].style.opacity = 0.6;
            }
          }
          else 
          {
            dict["foreground"].style.opacity = 1;
            dict["brushed"].style.opacity = 0.0;
          }
      /*
      d3.select("#" + this.viewID)
        .selectAll("canvas")
        .nodes()
        .forEach((d, i) => {
          let canvas = d3.select(d);
          if (canvas.attr("class").includes("foreground")) {
           // canvas.style("opacity", 0.35);
          } else if (canvas.attr("class").includes("highlight")) {
            if (hovered) {
          //    canvas.style("opacity", 0.5);
            } else {
           //   canvas.style("opacity", 1);
            }
          } else if (canvas.attr("class").includes("marked")) {
          }
        });*/
    },
    markLineOnHover(mousePosition) {
      let hoveredData = this.getHoveredLines(mousePosition);
      //console.log(hoveredData);
      if (hoveredData && hoveredData.length != 0) {
        //picking the first in the array for now (todo: consider picking the closes to mouse?)
        this.$store.commit("hover", { hovered: hoveredData[0] });
      }
    },
    

    Chart: function() {
      const chart = ParCoords({
        markedLineWidth: 3,
        highlightedLineWidth: 1.4,
        lineWidth: 1.4,
        markedShadowColor: "#ff0000",
        markedShadowBlur: 5,
        alpha: 0.4,
      })("#" + this.viewID)
        .data(this.chartData)
        .width(
          (this.isCustomizingDimensions ? (5 / 6.0) * this.width : this.width) -
            20
        )
        .height(this.height - 25)
        .hideAxis(this.excludedDimensions);

      chart
        .createAxes()

        .brushMode("1D-axes") //1D-axes-multi 2D-strums angular 1D-axes
        .reorderable()
        .mode("default")

        .render()
        .on("brushend", (brushed, args) => {
          if (d3.event.selection === null) return;

          if (chart.brushed().length == chart.data().length) {
            this.$store.dispatch("update", {
              view: this.viewID,
              selection: [],
              operation: operations.REPLACE,
            });
          } else {
            this.chart.brushReset();
            this.$store.dispatch("update", {
              view: this.viewID,
              selection: brushed.map((d) => d._id),
              operation: this.currentSelectionOperation,
            });
          }
        })
        .on("brush", (brushed, args) => {
         
        })
        .on("highlight", (e) => {

        })
        .on("render", (e) => {
          var selection = this.$store.getters.selectedDataInView(this.viewID);
          chart.highlight(selection);
          this.graphCentriodPoints = null;
        });

      return chart;
    },
  },
};
</script>

<style scoped>
.parcoords {
  /* cursor: crosshair;*/
}

::v-deep .parcoords rect.overlay {
  fill: transparent;
}

::v-deep .parcoords rect.overlay:hover {
  fill: rgba(120, 120, 120, 0.2);
}

#tooltip {
  font-family: sans-serif;
  font-size: 14px;
  font-weight: bold;
  color: black;
}

::v-deep .multiselect__tag {
  width: 50px;
  display: none;
}

::v-deep .multiselect {
  width: 200px;
  margin-top: 10px;
}

.parcoords /deep/ .label {
  transform: rotate(10deg) translate(0px, -10px);
}

.parcoords canvas.faded {
    opacity: 0.25 !important;
}

.parcoords canvas.dimmed {
  opacity: 0.85 !important;
}

</style>
