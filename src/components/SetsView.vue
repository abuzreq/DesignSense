<template>
  <v-container fluid :style="{ overflow: 'auto', height: `calc(${height}px)` }">
    <div style="display: flex; flex-direction: row; justify-content: space-around; align-items: center;">
      <v-card-title>Sets Panel</v-card-title>
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon @click="createSet.clickAction">
            <v-icon>{{ createSet.icon }}</v-icon>
          </v-btn>
        </template>
        <span>{{ createSet.tooltip() }}</span>
      </v-tooltip>
    </div>

    <v-divider></v-divider>

    <v-list two-line>
      <v-card outlined v-for="(item, index) in setsIDs" :key="index">
        <v-list-item avatar>
          <v-list-item-action style="margin-right: 8px">
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
              <span>Restore</span>
            </v-tooltip>

            <v-tooltip left>
              <template v-slot:activator="{ on }">
                <v-btn
                  v-on="on"
                  icon
                  ripple
                  color="blue"
                  @click="updateSet(item, $event)"
                >
                  <v-icon>mdi-find-replace</v-icon>
                </v-btn>
              </template>
              <span>Update</span>
            </v-tooltip>
          </v-list-item-action>

          <v-list-item-content>
            <v-list-item-title class="title"
              >{{ setsMetadataMap[item].name }} &nbsp;&nbsp;&nbsp; (count
              {{ setsMap[item].length }})</v-list-item-title
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

export default {
  name: "SetsView",
  props: ["width", "height", "x", "y", "type"],
  data: function() {
    return {
      setNote: "Interesting",
      createSet: {
        clickAction: () => this.$store.dispatch("createSet"),
        icon: "mdi-contain",
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
    remove(ID) {
      this.$store.commit("removeSet", { setID: ID });
    },
    changeComment(comment, itemID) {
      this.$store.commit("setSetMetadata", { setID: itemID, comment: comment });
    },
    changeName(name, itemID) {
      this.$store.commit("setSetMetadata", { setID: itemID, name: name });
    },
    restoreSet(ID, event) {
      this.$store.dispatch("restoreSet", {
        setID: ID,
        operation: this.$store.state.currentSelectionOperation,
      });
    },
    updateSet(ID, event) {
      console.log(
        "updateSet",
        ID,
        event,
        this.$store.state.currentSelectionOperation
      );
      this.$store.dispatch("updateSet", {
        setID: ID,
        operation: this.$store.state.currentSelectionOperation,
      });
      this.$forceUpdate();
    },
  },
};
</script>
