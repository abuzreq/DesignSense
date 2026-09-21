<template>
  <v-container class="selectionOperationsContainer">
    <!-- The count opens the whole description; the strip beside it shows
         what fits in the bar. -->
    <v-menu bottom offset-y :close-on-content-click="false" max-width="520">
      <template v-slot:activator="{ on: menu }">
        <v-tooltip bottom>
          <template v-slot:activator="{ on: tooltip }">
            <!-- A button to look at: outlined, with the menu's arrow. -->
            <div
              v-on="Object.assign({}, menu, tooltip)"
              class="selection-count"
              role="button"
              tabindex="0"
              aria-haspopup="true"
            >
              <span
                ><strong>{{ selectionCount.toLocaleString() }}</strong> /
                {{ totalCount.toLocaleString() }}</span
              >
              <v-icon x-small class="selection-count-arrow">mdi-menu-down</v-icon>
            </div>
          </template>
          <span
            >Selected options, out of those shown. Click to see what is
            selected: your selection steps turned into one logical statement
            and simplified, with the steps below it.</span
          >
        </v-tooltip>
      </template>
      <v-card class="selection-panel">
        <div class="selection-panel-head">
          <strong>{{ selectionCount.toLocaleString() }}</strong> of
          {{ totalCount.toLocaleString() }} options selected
        </div>
        <SelectionDescription panel />
      </v-card>
    </v-menu>
    <SelectionDescription class="selection-description-strip" />

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
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: auto;
  max-width: none;
  margin: 0;
  padding: 0 4px;
}
/* The description takes only the room the bar has spare, up to a limit;
   the count's menu always has all of it. */
.selection-description-strip {
  flex: 1 1 0;
  width: 0;
  /* Room for one short chip, or the "+N" of those that don't fit. */
  min-width: 90px;
  max-width: 460px;
}
.selection-count {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: 0 0 auto;
  margin-right: 4px;
  padding: 1px 3px 1px 8px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
}
.selection-count:hover,
.selection-count:focus-visible {
  background: rgba(255, 255, 255, 0.24);
  outline: none;
}
.selection-count-arrow.v-icon {
  color: inherit !important;
}
.selection-panel {
  padding: 10px 12px;
  font-size: 13px;
}
.selection-panel-head {
  margin-bottom: 8px;
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

/* The operations sit close together, small, as one control. */
.operation-container {
  display: flex;
  align-items: center;
  border-radius: 10px;
  font-size: 12px;
}
.operation-container.selected {
  padding-right: 6px;
}
/* Over Vuetify's 48px for a toolbar's icon buttons. */
.operation-container .v-btn.v-btn--icon {
  width: 26px !important;
  height: 26px !important;
}
.operation-container ::v-deep .v-icon__component,
.operation-container ::v-deep .v-icon__svg {
  width: 18px;
  height: 18px;
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
  font-size: 12px;
  padding: 0 4px !important;
  min-width: 0 !important;
}
.operation-icon--current {
  color: white !important;
}




</style>

<script>
import { operations } from "@/components/operations.js";
import { operationIcon } from "@/components/operationIcons.js";
import { mapState, mapGetters } from "vuex";
import SelectionDescription from "@/components/SelectionDescription.vue";

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
  components: { SelectionDescription },
  props: {
    // The five operations folded into a pulldown. Spread out they take some
    // 235px more; the toolbar decides, weighing the whole bar at once.
    compact: { type: Boolean, default: true },
  },
  data: function() {
    return {
      operationsList: operations,
      operationItems: OPERATION_ITEMS,
    };
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
