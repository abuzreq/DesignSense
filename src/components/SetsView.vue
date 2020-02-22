<template>
  <v-container fluid>
    <v-list two-line>
      <template v-for="(item, index) in setsIDs">
        <v-card :key="index">
          <v-list-item avatar>
            <v-list-item-action>
              <v-btn icon ripple color="red" @click="remove(item)">
                <v-icon>mdi-close</v-icon>
              </v-btn>

              <v-btn icon ripple color="red" @click="restoreSet(item, $event)">
                <v-icon>mdi-backup-restore</v-icon>
              </v-btn>
            </v-list-item-action>

            <v-list-item-content>
              <v-list-item-title class="title">{{item}}</v-list-item-title>
              <v-list-item-subtitle>Note: {{setNote}}</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
        </v-card>
      </template>
    </v-list>
  </v-container>
</template>

<style scoped>
</style>
<script>
//v-if="todo.done" @click="removeTodo(i)"

//Source: https://codepen.io/sharon-the-encoder/pen/NzOLGy
import * as d3 from "d3";
import { operations, getOperationFromEvent } from "@/components/operations.js";
import { mapState } from "vuex";

export default {
  name: "SetsView",
  data: function() {
    return {
      setNote: "Interesting"
    };
  },
  computed: {
    ...mapState({ setsIDs: state => state.setsIDs })
  },
  mounted() {},
  watch: {
    width: function(newValue, oldValue) {
      // this.createChart();
      /* this.chart.outerWidth(newValue)
      d3.select("#"+this.id)
        .datum(this.chartData)
        .call(this.chart);*/
    },
    height: function(newValue, oldValue) {
      //  this.createChart();
      /*
            this.chart.outerWidth(newValue)
      d3.select("#"+this.id)
        .datum(this.chartData)
        .call(this.chart);*/
    },
    chartData: {
      handler: function(newValue, oldValue) {}
    }
  },
  created() {},
  methods: {
    remove(ID) {
      this.$store.commit("removeSet", { setID: ID });
    },
    restoreSet(ID, event) {
      /*
    if (event) {
        event.preventDefault()
    }*/
      console.log("restoing", ID, event);
      this.$store.dispatch("restoreSet", {
        setID: ID,
        operation: getOperationFromEvent(event)
      });

      /*
           this.$store.commit("update", {
            view: this.viewID,
            selection: brushedIDs,
            operation: getOperationFromEvent(d3.event.sourceEvent)
          });*/
    }
  }
};
</script>