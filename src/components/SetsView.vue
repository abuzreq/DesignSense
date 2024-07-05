<template>
  <v-container fluid :style="{ overflow: 'auto', height: `calc(${height}px)` }">
    <div
      style="display: flex; flex-direction: row; justify-content: space-around; align-items: center;"
    >
      <v-tooltip :max-width="300" bottom>
        <template v-slot:activator="{ on }">
          <v-btn
            size="x-small"
            v-on="on"
            icon
          
            style="align-items: flex-end;"
            ><v-icon
              style="border: 1px solid currentColor; border-radius:50%;"
              >{{ "mdi-exclamation" }}</v-icon
            ></v-btn
          >
        </template>
        <span
          >When you click on a set, the current boolean operation will
          apply.</span
        >
      </v-tooltip>
      
      <v-card-title >Sets</v-card-title>

      <v-btn
      
        min-width="100"
        color="primary"
        @click="createSet.clickAction"
      >
        New Set
      </v-btn>
    </div>
    <!-- <v-icon> {{ createSet.icon }}</v-icon>-->
    <v-divider></v-divider>

    <v-list two-line>
      <v-card
        style="margin-bottom: 5px;"
        ripple
        outlined
        class="blue-lighten-3"
        hover
        v-for="(item, index) in setsIDs"
        :key="index"
        @click="restoreSet(item, $event)"
     
      >
        <v-list-item avatar>
          <v-list-item-action style="margin-right: 8px">
            <!--
            <v-tooltip left>
              <template v-slot:activator="{ on }">
                <v-btn
                  v-on="on"
                  icon
                  ripple
                  color="blue"
                  @click="restoreSet(item, $event)"
                >
                  <v-icon>mdi-backup-restore</v-icon>
                </v-btn>
              </template>
              <span>Select Set</span>
            </v-tooltip>
            -->
            <v-tooltip right>
              <template v-slot:activator="{ on }">
                <v-btn
                  v-on="on"
                  icon
                  ripple
                  color="blue"
                  @click="addToSet(item, $event)"
                >
                  <v-icon>mdi-plus</v-icon>
                </v-btn>
              </template>
              <span>Add the currently selected to this set</span>
            </v-tooltip>
            <v-tooltip right>
              <template v-slot:activator="{ on }">
                <v-btn
                  v-on="on"
                  icon
                  ripple
                  color="blue"
                  @click="removeFromSet(item, $event)"
                >
                  <v-icon>mdi-minus</v-icon>
                </v-btn>
              </template>
              <span>Remove the currently selected from this set</span>
            </v-tooltip>
            <v-tooltip right>
              <template v-slot:activator="{ on }">
                <v-btn v-on="on" icon ripple color="red" @click="remove(item)">
                  <v-icon>mdi-close</v-icon>
                </v-btn>
              </template>
              <span>Delete set</span>
            </v-tooltip>
          </v-list-item-action>

          <v-list-item-content>
            <v-list-item-title class="title" style="display: flex; justify-content: space-between;"
              >{{ setsMetadataMap[item].name }} &nbsp;&nbsp;&nbsp;

              <v-tooltip right>
                <template v-slot:activator="{ on }">
                  <v-chip
                  style="padding: 8px;"
                    small
                    v-on="on" 
                    color="blue darken-3"
                    text-color="white"
                  >
                   {{
                      setsMap[item].length
                    }}
                  </v-chip>
                </template>
                <span>Number of items in the set</span>
              </v-tooltip>
              </v-list-item-title
            >
            <v-textarea
              class="comment-text-area"
              height="70px"
              style="margin-bottom: -15px"
              multiple
              solo
              full-width
              outlined
              dense
              :value="setsMetadataMap[item].comment"
              label="add notes here"
              @input="changeComment($event, item)"
              @click="(e) => {e.stopPropagation(); e.preventDefault()}"
              @mousedown="(e) => {e.stopPropagation(); }"
                 @keydown="onCardKeydown($event)"
            />
          </v-list-item-content>
        </v-list-item>
      </v-card>
    </v-list>
  </v-container>
</template>

<style scoped>
.comment-text-area {
  font-size: 0.8em;
}

.v-list-item {
  height: 120px;
  margin-right: 8px;
  margin-left: -4px;
}
.v-btn {
  height: 25px;
  width: 25px;
}
</style>
<script>
//Source: https://codepen.io/sharon-the-encoder/pen/NzOLGy
import * as d3 from "d3";
import { mapState } from "vuex";
import { operations } from "./operations";

export default {
  name: "SetsView",
  props: ["width", "height", "x", "y", "type"],
  data: function() {
    return {
      setNote: "Interesting",
      createSet: {
        clickAction: () => this.$store.dispatch("createSet"),
        icon: "mdi-plus",
        tooltip: () => "Create Set",
        type: "selection",
      },
    };
  },
  computed: {
    ...mapState({
      currentSelectionOperation: (state) => state.currentSelectionOperation,
      setsIDs: (state) => state.setsIDs,
      setsMetadataMap: (state) => state.setsMetadataMap,
      setsMap: (state) => state.setsMap,
    }),
  },
  mounted() {},
  watch: {
    width: function(newValue, oldValue) {},
    height: function(newValue, oldValue) {},
    chartData: {
      handler: function(newValue, oldValue) {},
    },
  },
  created() {},
  methods: {
    onCardKeydown(e){
      console.log('keydown', e); 
      if(e.key == ' ')
      {
        e.stopPropagation();
      }
    
    },
    remove(ID) {
      this.$store.commit("removeSet", { setID: ID });
    },
    changeComment(comment, itemID, e) {
      console.log(comment, itemID, this, e)
      this.$store.commit("setSetMetadata", { setID: itemID, comment: comment });
    },
    changeName(name, itemID) {
      this.$store.commit("setSetMetadata", { setID: itemID, name: name });
    },
    restoreSet(ID, event) {
      console.log("Restore set");
      this.$store.dispatch("restoreSet", {
        setID: ID,
        operation: this.$store.state.currentSelectionOperation,
      });
    },
    addToSet(ID, e) {
      e.stopPropagation();
      console.log(e);
      this.$store.dispatch("updateSet", {
        setID: ID,
        operation: operations.ADD,
      });
      this.$forceUpdate();
    },
    removeFromSet(ID, e) {
      e.stopPropagation();
      this.$store.dispatch("updateSet", {
        setID: ID,
        operation: operations.SUBTRACT,
      });
      this.$forceUpdate();
    },
    updateSet(ID, event) {
      this.$store.dispatch("updateSet", {
        setID: ID,
        operation: this.$store.state.currentSelectionOperation,
      });
      this.$forceUpdate();
    },
  },
};
</script>
