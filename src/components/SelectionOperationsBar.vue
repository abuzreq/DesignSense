<template>
  <v-container class="selectionOperationsContainer">
    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <div
          :class="{ 'operation-container': true, 
            selected:
              operationsList &&
              currentSelectionOperation == operationsList.REPLACE,
          }"
        >
          <ReplaceIcon v-on="on" @click="onReplace" class="operation-icon" />
          <div v-show="currentSelectionOperation == operationsList.REPLACE">
            Replace
          </div>
        </div>
      </template>
      <span>Replace&emsp;[Num 1]</span>
    </v-tooltip>
    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <div
          :class="{'operation-container': true, 
            selected:
              operationsList &&
              currentSelectionOperation == operationsList.ADD,
          }"
        >
        <AddIcon
          v-on="on"
          @click="onAdd"
          class="operation-icon"
        />
          <div v-show="currentSelectionOperation == operationsList.ADD">
            Add
          </div>
        </div>
      </template>
      <span>Add&emsp;[Num 2]</span>
    </v-tooltip>
    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <div
          :class="{'operation-container': true, 
            selected:
              operationsList &&
              currentSelectionOperation == operationsList.INTERSECT,
          }"
        >
        <IntersectIcon
          v-on="on"
          @click="onIntersect"
          class="operation-icon"
        />
          <div v-show="currentSelectionOperation == operationsList.INTERSECT">
            Intersect
          </div>
        </div>
      </template>
      <span>Intersect&emsp;[Num 5]</span>
    </v-tooltip>
    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <div
          :class="{'operation-container': true, 
            selected:
              operationsList &&
              currentSelectionOperation == operationsList.SUBTRACT,
          }"
        >
        <SubtractIcon
          v-on="on"
          @click="onSubtract"
          class="operation-icon"
        />
          <div v-show="currentSelectionOperation == operationsList.SUBTRACT">
            Substract
          </div>
        </div>
      </template>
      <span>Subtract&emsp;[Num 3]</span>
    </v-tooltip>
    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <div
          :class="{'operation-container': true, 
            selected:
              operationsList &&
              currentSelectionOperation == operationsList.TOGGLE,
          }"
        >
        <ToggleIcon
          v-on="on"
          @click="onToggle"
          class="operation-icon"
        />
          <div v-show="currentSelectionOperation == operationsList.TOGGLE">
            Toggle
          </div>
        </div>
      </template>
      <span>Toggle&emsp;[Num 4]</span>
    </v-tooltip>
  </v-container>
</template>

<style scoped>
.selectionOperationsContainer {
  width: 350px;
  display: flex;
  justify-content: space-between;
}
.operation-icon {
  width: 10mm;
  height: 10mm;
  filter: grayscale(85%);
}
.operation-icon:focus{
    outline: none;
}

.selected .operation-icon{
  filter: grayscale(0%);
  pointer-events: none;

}

@keyframes selecting {
  from {border: solid white 1px;
  }
  to {border: solid white 0px;}
}

.operation-container {
  display: flex;
  align-items: center;
  padding-right: 5px;
  border-radius: 10px;
}
  .operation-container.selected {
    border: solid white 1px;
 /* animation-name: selecting;
  animation-duration: 4s; */
}




</style>

<script>
import { operations } from "@/components/operations.js";
import { mapState, mapGetters } from "vuex";

import ReplaceIcon from "-!vue-svg-loader!/src/assets/replace_icon.svg";
import AddIcon from "-!vue-svg-loader!/src/assets/add_icon.svg";
import SubtractIcon from "-!vue-svg-loader!/src/assets/subtract_icon.svg";
import ToggleIcon from "-!vue-svg-loader!/src/assets/toggle_icon.svg";
import IntersectIcon from "-!vue-svg-loader!/src/assets/intersect_icon.svg";

export default {
  name: "SelectionOperationsBar",
  components: {
    ReplaceIcon,
    AddIcon,
    SubtractIcon,
    ToggleIcon,
    IntersectIcon,
  },
  data: function() {
    return { operationsList: operations };
  },
  computed: {
    ...mapState({
      currentSelectionOperation: (state) => state.currentSelectionOperation,
    }),
  },
  methods: {
    onReplace() {
      this.$store.commit("changeSelectionOperation", operations.REPLACE);
    },
    onAdd() {
      this.$store.commit("changeSelectionOperation", operations.ADD);
    },
    onSubtract() {
      this.$store.commit("changeSelectionOperation", operations.SUBTRACT);
    },
    onToggle() {
      this.$store.commit("changeSelectionOperation", operations.TOGGLE);
    },
    onIntersect() {
      this.$store.commit("changeSelectionOperation", operations.INTERSECT);
    },
  },
};
</script>
