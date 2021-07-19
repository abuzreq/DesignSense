<template>
  <v-container class="selectionOperationsContainer">
    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <ReplaceIcon
          :class="{
            selected:
              operationsList &&
              currentSelectionOperation == operationsList.REPLACE,
          }"
          v-on="on"
          @click="onReplace"
          class="operation-icon"
        />
      </template>
      <span>Replace&emsp;[Num 1]</span>
    </v-tooltip>
    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <AddIcon
          :class="{
            selected:
              operationsList && currentSelectionOperation == operationsList.ADD,
          }"
          v-on="on"
          @click="onAdd"
          class="operation-icon"
        />
      </template>
      <span>Add&emsp;[Num 2]</span>
    </v-tooltip>
    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <IntersectIcon
          :class="{
            selected:
              operationsList &&
              currentSelectionOperation == operationsList.INTERSECT,
          }"
          v-on="on"
          @click="onIntersect"
          class="operation-icon"
        />
      </template>
      <span>Intersect&emsp;[Num 5]</span>
    </v-tooltip>
    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <SubtractIcon
          :class="{
            selected:
              operationsList &&
              currentSelectionOperation == operationsList.SUBTRACT,
          }"
          v-on="on"
          @click="onSubtract"
          class="operation-icon"
        />
      </template>
      <span>Subtract&emsp;[Num 3]</span>
    </v-tooltip>
    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <ToggleIcon
          :class="{
            selected:
              operationsList &&
              currentSelectionOperation == operationsList.TOGGLE,
          }"
          v-on="on"
          @click="onToggle"
          class="operation-icon"
        />
      </template>
      <span>Toggle&emsp;[Num 4]</span>
    </v-tooltip>
  </v-container>
</template>


<style scoped>
.selectionOperationsContainer {
  width: 250px;
  display: flex;
  justify-content: center;
}
.operation-icon {
  width: 10mm;
  height: 10mm;
  filter: grayscale(85%);
}

.operation-icon.selected {
  border: solid white 1px;
  border-radius: 10px;
  filter: grayscale(0%);
}
</style>

<script>
import { operations } from "@/components/operations.js";
import { mapState, mapGetters } from "vuex";

import ReplaceIcon from "@/assets/replace_icon.svg";
import AddIcon from "@/assets/add_icon.svg";
import SubtractIcon from "@/assets/subtract_icon.svg";
import ToggleIcon from "@/assets/toggle_icon.svg";
import IntersectIcon from "@/assets/intersect_icon.svg";

export default {
  name: "SelectionOperationsBar",
  components: {
    ReplaceIcon,
    AddIcon,
    SubtractIcon,
    ToggleIcon,
    IntersectIcon,
  },
  data: function () {
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