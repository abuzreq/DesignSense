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

    <!-- Narrow screens: the five operations fold into the current one, which
         opens the rest. The bar shares its row with the filters, the assistant
         and the toolbar groups, and this is what gives way first. -->
    <v-menu v-if="compact" bottom offset-y>
      <template v-slot:activator="{ on: menu }">
        <v-tooltip bottom>
          <template v-slot:activator="{ on: tooltip }">
            <v-btn
              small
              text
              class="operation-compact"
              v-on="Object.assign({}, menu, tooltip)"
            >
              <v-icon small left class="operation-icon operation-icon--current">{{
                operationIcon(currentSelectionOperation)
              }}</v-icon>
              {{ currentSelectionOperation }}
              <v-icon x-small right>mdi-menu-down</v-icon>
            </v-btn>
          </template>
          <span
            >{{ currentSelectionOperation }}: how a new selection combines with
            the current one. Click to change, or press 1 to 5.</span
          >
        </v-tooltip>
      </template>
      <v-list dense>
        <v-list-item
          v-for="item in operationItems"
          :key="item.operation"
          :input-value="item.operation === stickySelectionOperation"
          @click="choose(item.operation)"
        >
          <v-list-item-icon class="mr-2"
            ><v-icon small>{{ item.icon }}</v-icon></v-list-item-icon
          >
          <v-list-item-title>{{ item.operation }}</v-list-item-title>
          <v-list-item-action-text class="ml-4">{{
            item.hint
          }}</v-list-item-action-text>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-tooltip v-if="!compact" bottom>
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
    <v-tooltip v-if="!compact" bottom>
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
    <v-tooltip v-if="!compact" bottom>
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
    <v-tooltip v-if="!compact" bottom>
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
    <v-tooltip v-if="!compact" bottom>
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
    <div v-if="isModifierHeld && !compact" class="held-hint">while held</div>
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

.operation-compact {
  text-transform: none;
  letter-spacing: 0;
  white-space: nowrap;
}
.operation-icon--current {
  color: white !important;
}




</style>

<script>
import { operations } from "@/components/operations.js";
import { operationIcon } from "@/components/operationIcons.js";
import { mapState, mapGetters } from "vuex";

// Up to this width the five operations fold into a pulldown. Spread out they
// take some 235px more, and below about 2000px that comes out of the
// assistant's field: at 1920px it was squeezed to half its width.
const COMPACT_WIDTH = 2000;

const OPERATION_ITEMS = [
  { operation: operations.REPLACE, hint: "1" },
  { operation: operations.ADD, hint: "Shift · 2" },
  { operation: operations.SUBTRACT, hint: "Ctrl · 3" },
  { operation: operations.TOGGLE, hint: "4" },
  { operation: operations.INTERSECT, hint: "Shift+Ctrl · 5" },
].map(function(item) {
  return {
    operation: item.operation,
    hint: item.hint,
    icon: operationIcon(item.operation),
  };
});

export default {
  name: "SelectionOperationsBar",
  data: function() {
    return {
      operationsList: operations,
      operationItems: OPERATION_ITEMS,
      windowWidth: typeof window !== "undefined" ? window.innerWidth : 1920,
    };
  },
  created() {
    this.onResize = () => {
      this.windowWidth = window.innerWidth;
    };
    window.addEventListener("resize", this.onResize);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.onResize);
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
    compact() {
      return this.windowWidth <= COMPACT_WIDTH;
    },
    // Shift/Ctrl override the chosen operation only while held.
    isModifierHeld() {
      return this.currentSelectionOperation !== this.stickySelectionOperation;
    },
  },
  methods: {
    operationIcon: operationIcon,
    choose(operation) {
      this.$store.commit("changeSelectionOperation", operation);
    },
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
