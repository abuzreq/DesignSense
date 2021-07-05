<template>
  <v-container fluid>
    <v-card-title>Design Sets</v-card-title>
    <v-divider></v-divider>
    <v-list two-line>
      <template v-for="(item, index) in setsIDs">
        <v-card outlined :key="index">
          <v-list-item avatar>
            <v-list-item-action style="margin-right: 8px">
              <v-tooltip left>
                <template v-slot:activator="{ on }">
                  <v-btn
                    v-on="on"
                    icon
                    ripple
                    color="red"
                    @click="remove(item)"
                  >
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
                >{{ setsMetadataMap[item].name }} &nbsp;&nbsp;&nbsp; (#{{
                  setsMap[item].length
                }})</v-list-item-title
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
      </template>
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
  data: function () {
    return {
      setNote: "Interesting",
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
    width: function (newValue, oldValue) {},
    height: function (newValue, oldValue) {},
    chartData: {
      handler: function (newValue, oldValue) {},
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
        operation: this.$store.currentSelectionOperation,
      });
    },
    updateSet(ID, event) {
      this.$store.dispatch("updateSet", {
        setID: ID,
        operation: this.$store.currentSelectionOperation,
      });
      this.$forceUpdate();
    },
  },
};
</script>