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
              <v-list-item-title class="title">{{setsMetadataMap[item].name}}</v-list-item-title>
               <v-textarea height = "7vh" style="margin-bottom:-15px" multiple solo full-width dense 
               :value="setsMetadataMap[item].comment" label="add notes here" 
               :append-outer-icon="setsMetadataMap[item].comment?'mdi-send':''"
               @input="changeComment($event, item)"
              
               />


         
            </v-list-item-content>
          </v-list-item>

          
        </v-card>
      </template>
    </v-list>
  </v-container>
</template>

<style scoped>
.v-list-item {
  height: 100px;
}
.v-btn {
  height: 25px;
  width: 25px;
}

</style>
<script>

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
    ...mapState({ setsIDs: state => state.setsIDs, setsMetadataMap: state => state.setsMetadataMap }),

  },
  mounted() {},
  watch: {
    width: function(newValue, oldValue) {

    },
    height: function(newValue, oldValue) {

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
    changeComment(comment, itemID)
    {
        this.$store.commit('setSetMetadata',{setID: itemID, comment:comment})
        console.log(this.setsMetadataMap)

    },
    restoreSet(ID, event) {
      this.$store.dispatch("restoreSet", {
        setID: ID,
        operation: getOperationFromEvent(event)
      });
    }
  }
};
</script>