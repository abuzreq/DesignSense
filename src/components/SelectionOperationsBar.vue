<template>
  <v-container class="selectionOperationsContainer">
    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <div v-on="on" class="selection-count">
          <strong>{{ selectionCount.toLocaleString() }}</strong> /
          {{ totalCount.toLocaleString() }}
        </div>
      </template>
      <span>Selected options, out of those shown</span>
    </v-tooltip>
    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <div
          :class="{ 'operation-container': true, 
            selected:
              operationsList &&
              currentSelectionOperation == operationsList.REPLACE,
          }"
        >
        <v-btn icon v-on="on" @click="onReplace" > <v-icon class="operation-icon">mdi-vector-arrange-above</v-icon></v-btn>
        <!-- <ReplaceIcon v-on="on" @click="onReplace" class="operation-icon" />-->
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
        <v-btn icon v-on="on" @click="onAdd" > <v-icon class="operation-icon">mdi-vector-union</v-icon></v-btn>
        <!-- <AddIcon
          v-on="on"
          @click="onAdd"
          class="operation-icon"
        />-->
          <div v-show="currentSelectionOperation == operationsList.ADD">
            Add
          </div>
        </div>
      </template>
      <span>Add&emsp;[hold Shift or press Num 2]</span>
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
        <!-- <SubtractIcon
          v-on="on"
          @click="onSubtract"
          class="operation-icon"
        />-->
        <v-btn icon v-on="on" @click="onSubtract" > <v-icon class="operation-icon">mdi-vector-difference-ba</v-icon></v-btn>
          <div v-show="currentSelectionOperation == operationsList.SUBTRACT">
            Subtract
          </div>
        </div>
      </template>
      <span>Subtract&emsp;[hold Ctrl or press Num 3]</span>
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
        <v-btn icon v-on="on" @click="onToggle" > <v-icon  class="operation-icon">mdi-select-compare</v-icon></v-btn>
        

        <!--<ToggleIcon
          v-on="on"
          @click="onToggle"
          class="operation-icon"
        />-->
          <div v-show="currentSelectionOperation == operationsList.TOGGLE">
            Toggle
          </div>
        </div>
      </template>
      <span>Toggle&emsp;[Num 4]</span>
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
        <v-btn icon v-on="on" @click="onIntersect" > <v-icon class="operation-icon">mdi-vector-intersection</v-icon></v-btn>
        <!-- <IntersectIcon
          v-on="on"
          @click="onIntersect"
          class="operation-icon"
        />-->
          <div v-show="currentSelectionOperation == operationsList.INTERSECT">
            Intersect
          </div>
        </div>
      </template>
      <span>Intersect&emsp;[hold Shift & Ctrl or press Num 5]</span>
    </v-tooltip>
    <div v-if="isModifierHeld" class="held-hint">while held</div>
  </v-container>
</template>

<style scoped>
.selectionOperationsContainer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: auto;
  max-width: none;
  margin: 0;
  padding: 0 4px;
}
.selection-count {
  font-size: 13px;
  white-space: nowrap;
  margin-right: 8px;
}
.held-hint {
  font-size: 11px;
  opacity: 0.8;
  white-space: nowrap;
}
.operation-icon {
  color: grey !important;
}
.operation-icon:focus{
    outline: none;
}

.selected .operation-icon{
  color: white !important;
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

/* Narrow screens: the outlined icon alone marks the current operation. */
@media (max-width: 1500px) {
  .operation-container > div,
  .held-hint {
    display: none;
  }
  .operation-container {
    padding-right: 0;
  }
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
      stickySelectionOperation: (state) => state.stickySelectionOperation,
      data: (state) => state.data,
    }),
    ...mapGetters(["selectionCount"]),
    totalCount() {
      return this.data ? this.data.length : 0;
    },
    // Shift/Ctrl override the chosen operation only while held.
    isModifierHeld() {
      return this.currentSelectionOperation !== this.stickySelectionOperation;
    },
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
