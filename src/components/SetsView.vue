<template>
  <v-container fluid>
    <v-card-title>Design Sets</v-card-title>
    <v-divider></v-divider>
    <v-list two-line>
      <template v-for="(item, index) in setsIDs">
        <v-card outlined :key="index">
          <v-list-item avatar>
            <v-list-item-action>
              <v-tooltip left>
                <template v-slot:activator="{ on }">
                  <v-btn v-on="on" icon ripple color="red" @click="remove(item)">
                    <v-icon>mdi-close</v-icon>
                  </v-btn>
                </template>
                <span>Delete</span>
              </v-tooltip>

              <v-tooltip left>
                <template v-slot:activator="{ on }">
                  <v-btn v-on="on" icon ripple color="red" @click="restoreSet(item, $event)">
                    <v-icon>mdi-backup-restore</v-icon>
                  </v-btn>
                </template>
                <span>Restore</span>
              </v-tooltip>
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
.v-list-item {
  height: 50px;
}
.v-btn {
  height: 25px;
  width: 25px;
}
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