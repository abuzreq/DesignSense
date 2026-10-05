<template>
  <div class="sets-view">
    <div class="sets-header">
      <div class="sets-title">{{ isLite ? "Saved sets" : "Sets" }}</div>
      <v-tooltip bottom max-width="300">
        <template v-slot:activator="{ on }">
          <span v-on="on">
            <v-btn small depressed color="primary" :disabled="selectedShown.length === 0" @click="save">
              <v-icon left small>{{
                isLite ? "mdi-bookmark-plus-outline" : "mdi-plus"
              }}</v-icon>
              {{ isLite ? "Save" : "New set" }}
            </v-btn>
          </span>
        </template>
        <span>{{ saveTooltip }}</span>
      </v-tooltip>
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn
            v-on="on"
            icon
            small
            class="sets-hide"
            aria-label="Hide the saved sets"
            @click="$emit('close')"
          >
            <v-icon small>mdi-chevron-left</v-icon>
          </v-btn>
        </template>
        <span>Hide</span>
      </v-tooltip>
      <!-- Clearing the saved work is in the help menu, where the rest of what
           is kept for a dataset is looked after. -->
    </div>

    <!-- The shortlist sits above the sets because that is what it becomes. -->
    <div class="cart-section">
      <div class="cart-header">
        <span class="cart-title">Shortlist</span>
        <span v-if="cartCount > 0" class="cart-count">{{ cartCount }}</span>
        <v-spacer />
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <span v-on="on">
              <v-btn
                icon
                x-small
                :disabled="cartCount === 0"
                aria-label="Compare the shortlist"
                @click="compareCart"
              >
                <v-icon small>mdi-table-column</v-icon>
              </v-btn>
            </span>
          </template>
          <span>Compare the shortlisted options side by side</span>
        </v-tooltip>
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <span v-on="on">
              <v-btn
                icon
                x-small
                :disabled="selectedShown.length === 0"
                aria-label="Add the selected to the shortlist"
                @click="addResultToCart"
              >
                <v-icon small>mdi-playlist-plus</v-icon>
              </v-btn>
            </span>
          </template>
          <span>{{
            selectedShown.length === 0
              ? "Select options first: the selected options in view are added"
              : "Add the " + selectedShown.length + " selected options in view to the shortlist"
          }}</span>
        </v-tooltip>
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <span v-on="on">
              <v-btn
                icon
                x-small
                :disabled="cartCount === 0"
                aria-label="Clear the shortlist"
                @click="clearCart"
              >
                <v-icon small>mdi-bookmark-off-outline</v-icon>
              </v-btn>
            </span>
          </template>
          <span>Clear the shortlist</span>
        </v-tooltip>
      </div>

      <p v-if="cartCount === 0" class="cart-empty">
        Keep options aside here as you browse, then compare them or save them as
        a set.
      </p>
      <template v-else>
        <div class="cart-strip">
          <div
            v-for="item in cartItems"
            :key="'cart-' + item._id"
            class="cart-thumb"
            :class="{
              'cart-thumb--away': !isShown(item._id),
              'cart-thumb--inspected': isInspected(item._id),
            }"
            :title="
              isShown(item._id)
                ? 'Inspect this option'
                : 'Not in the current view'
            "
            @click="inspect(item)"
          >
            <v-img
              :src="item.image"
              :alt="'Shortlisted option ' + item._id"
              :aspect-ratio="4 / 3"
              contain
            />
            <button
              type="button"
              class="cart-thumb-remove"
              aria-label="Remove from the shortlist"
              @click.stop="removeFromCart(item)"
            >
              <v-icon x-small color="white">mdi-close</v-icon>
            </button>
          </div>
        </div>
        <div class="cart-save">
          <input
            v-model="cartName"
            class="cart-name"
            spellcheck="false"
            :placeholder="nextSetName"
            aria-label="Name for the saved set"
            @keydown.stop
            @keydown.enter="saveCart"
          />
          <v-btn small depressed color="primary" @click="saveCart">
            Save as set
          </v-btn>
        </div>
      </template>
    </div>

    <p v-if="setsIDs.length === 0" class="sets-empty">{{ emptyText }}</p>

    <div class="sets-list">
      <div
        v-for="id in setsIDs"
        :key="id"
        class="set-card"
        :class="{
          'set-card--active': matchingSetID === id,
          'set-card--pickable': !isLite,
        }"
        @click="onCardClick(id)"
      >
        <div class="set-card-head">
          <input
            class="set-name"
            :value="nameOf(id)"
            spellcheck="false"
            aria-label="Set name"
            @click.stop
            @mousedown.stop
            @keydown.stop="onNameKeydown"
            @change="changeName($event, id)"
          />
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <span v-on="on" class="set-count">{{ countOf(id) }}</span>
            </template>
            <span>{{ countOf(id) }} options saved</span>
          </v-tooltip>
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn v-on="on" x-small icon @click.stop="remove(id)">
                <v-icon small>mdi-delete-outline</v-icon>
              </v-btn>
            </template>
            <span>Delete this set</span>
          </v-tooltip>
        </div>

        <div class="set-criteria">
          <template v-if="setCriteriaChips(id)">
            <span v-if="setCriteriaChips(id).length === 0" class="set-chip"
              >All options</span
            >
            <span
              v-for="chip in setCriteriaChips(id)"
              :key="chip.key"
              class="set-chip"
              :class="'set-chip--' + chip.tone"
              :title="chip.title"
              >{{ chip.text }}</span
            >
          </template>
          <span
            v-else
            class="set-chip set-chip--picked"
            title="Saved from a selection rather than from filters"
            >Hand-picked</span
          >
        </div>

        <div class="set-actions">
          <v-tooltip v-if="isLite" bottom max-width="260">
            <template v-slot:activator="{ on }">
              <v-btn
                v-on="on"
                x-small
                depressed
                :outlined="matchingSetID === id"
                :color="matchingSetID === id ? 'green darken-1' : 'primary'"
                @click.stop="restore(id)"
              >
                <v-icon left x-small>{{
                  matchingSetID === id ? "mdi-check" : "mdi-restore"
                }}</v-icon>
                {{ matchingSetID === id ? "Showing" : "Restore" }}
              </v-btn>
            </template>
            <span>{{
              matchingSetID === id
                ? "The current filters are this set's filters"
                : "Replace the current filters with this set's filters. Undo brings yours back."
            }}</span>
          </v-tooltip>
          <template v-if="can('setEditing')">
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn v-on="on" x-small icon color="blue" @click.stop="addToSet(id)">
                  <v-icon small>mdi-plus</v-icon>
                </v-btn>
              </template>
              <span>Add the selected options to this set</span>
            </v-tooltip>
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  v-on="on"
                  x-small
                  icon
                  color="blue"
                  @click.stop="removeFromSet(id)"
                >
                  <v-icon small>mdi-minus</v-icon>
                </v-btn>
              </template>
              <span>Remove the selected options from this set</span>
            </v-tooltip>
          </template>
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn
                icon
                x-small
                v-on="on"
                aria-label="Compare this set"
                @click.stop="compareSet(id)"
              >
                <v-icon small>mdi-table-column</v-icon>
              </v-btn>
            </template>
            <span>Compare this set's options side by side</span>
          </v-tooltip>
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn
                icon
                x-small
                v-on="on"
                aria-label="Put this set on the shortlist"
                @click.stop="putOnCart(id)"
              >
                <v-icon small>mdi-bookmark-multiple-outline</v-icon>
              </v-btn>
            </template>
            <span>Put this set's options on the shortlist, beside what is there</span>
          </v-tooltip>
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn
                icon
                x-small
                v-on="on"
                aria-label="Summary image of this set"
                @click.stop="summarizeSet(id)"
              >
                <v-icon small>mdi-image-text</v-icon>
              </v-btn>
            </template>
            <span>Summary image of this set: its options pictured and ringed in the charts</span>
          </v-tooltip>
          <v-spacer />
          <button
            v-if="!hasNote(id) && !openNotes[id]"
            type="button"
            class="set-note-toggle"
            @click.stop="openNote(id)"
          >
            Add note
          </button>
        </div>

        <textarea
          v-if="hasNote(id) || openNotes[id]"
          :ref="'note-' + id"
          class="set-note"
          rows="2"
          placeholder="Add a note"
          :value="noteOf(id)"
          @click.stop
          @mousedown.stop
          @keydown.stop
          @input="changeComment($event.target.value, id)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import { operations } from "./operations";

export default {
  name: "SetsView",
  data: function() {
    return {
      // Sets whose empty note was opened with "Add note".
      openNotes: {},
      // The name to save the shortlist under; blank means the next "Set #N".
      cartName: "",
    };
  },
  computed: {
    ...mapState({
      setsIDs: (state) => state.setsIDs,
      setsMetadataMap: (state) => state.setsMetadataMap,
      setsMap: (state) => state.setsMap,
      dataLength: (state) => state.data.length,
      setsCounter: (state) => state.setsCounter,
      hovered: (state) => state.hovered,
    }),
    ...mapGetters([
      "can",
      "hasScope",
      "isFilterActive",
      "isLite",
      "matchingSetID",
      "selectionCount",
      "selectedShown",
      "setCriteriaChips",
      "cartCount",
      "cartItems",
      "dataMap",
    ]),
    /** What the shortlist would be named if it were saved unnamed. */
    nextSetName() {
      return "Set #" + (this.setsCounter + 1);
    },
    saveTooltip() {
      let count = this.selectedShown.length;
      if (count === 0) {
        return this.isLite
          ? "Filter the options first: a set saves the selected options in view."
          : "Select options first: a set saves the selected options in view.";
      }
      if (!this.isLite) {
        return "Save the " + count.toLocaleString() + " selected options as a set. Click a set later to bring its options back; the current selection operation applies.";
      }
      return (
        "Save the " +
        count.toLocaleString() +
        " selected options and the filters that found them. Restore the set later to bring those filters back."
      );
    },
    emptyText() {
      return this.isLite
        ? "Nothing saved yet. Filter the collection, then save the results here to come back to them later."
        : "No sets yet. Select options, then click New set.";
    },
  },
  watch: {
    /*
     * Which notes are open is keyed by set id, and clearing the saved work
     * starts the numbering over: "Set #1" left open here would open the note
     * of the next unrelated set to take that name.
     */
    setsIDs(ids) {
      if (ids.length === 0) this.openNotes = {};
    },
  },
  methods: {
    /** An option a zoom left out is still shortlisted, just not on screen. */
    isShown(id) {
      return !!this.dataMap[id];
    },
    inspect(item) {
      this.$store.dispatch("inspectByClick", { item: item });
    },
    /** Clicking here inspects, so the strip says which one it inspected. */
    isInspected(id) {
      return !!this.hovered && this.hovered._id === id;
    },
    removeFromCart(item) {
      this.$store.commit("removeFromCart", { ids: [item._id] });
    },
    addResultToCart() {
      this.$store.dispatch("addResultToCart");
    },
    clearCart() {
      this.$store.dispatch("clearCart");
    },
    saveCart() {
      if (this.cartCount === 0) return;
      this.$store.dispatch("saveCartAsSet", { name: this.cartName });
      this.cartName = "";
    },
    compareCart() {
      this.$store.dispatch("openCompare", { source: "cart" });
    },
    compareSet(id) {
      this.$store.dispatch("openCompare", { source: "set", setID: id });
    },
    putOnCart(id) {
      this.$store.dispatch("putSetOnCart", { setID: id });
    },
    summarizeSet(id) {
      this.$store.dispatch("openSummary", { focus: { kind: "set", setID: id } });
    },
    nameOf(id) {
      let metadata = this.setsMetadataMap[id];
      return metadata ? metadata.name : id;
    },
    noteOf(id) {
      let metadata = this.setsMetadataMap[id];
      return metadata && metadata.comment ? metadata.comment : "";
    },
    hasNote(id) {
      return this.noteOf(id) !== "";
    },
    countOf(id) {
      let members = this.setsMap[id];
      return members ? members.length : 0;
    },
    save() {
      this.$store.dispatch("createSet");
    },
    restore(id) {
      this.$store.dispatch("restoreSet", { setID: id, operation: operations.REPLACE });
    },
    onCardClick(id) {
      // Lite restores only from its button, so a stray click never replaces
      // the filters.
      if (this.isLite) return;
      this.$store.dispatch("restoreSet", {
        setID: id,
        operation: this.$store.state.currentSelectionOperation,
      });
    },
    remove(id) {
      this.$delete(this.openNotes, id);
      // The action offers to undo the deletion.
      this.$store.dispatch("removeSet", { setID: id });
    },
    openNote(id) {
      this.$set(this.openNotes, id, true);
      this.$nextTick(() => {
        let refs = this.$refs["note-" + id];
        if (refs && refs[0]) refs[0].focus();
      });
    },
    changeComment(comment, id) {
      this.$store.commit("setSetMetadata", { setID: id, comment: comment });
    },
    changeName(event, id) {
      let name = event.target.value.trim();
      if (name) {
        this.$store.commit("setSetMetadata", { setID: id, name: name });
      } else {
        event.target.value = this.nameOf(id);
      }
    },
    onNameKeydown(event) {
      if (event.key === "Enter" || event.key === "Escape") event.target.blur();
    },
    addToSet(id) {
      this.$store.dispatch("updateSet", {
        setID: id,
        operation: operations.ADD,
      });
    },
    removeFromSet(id) {
      this.$store.dispatch("updateSet", {
        setID: id,
        operation: operations.SUBTRACT,
      });
    },
  },
};
</script>

<style scoped>
/* Fills the drawer it lives in (SetsDrawer.vue); the list scrolls. */
.sets-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.sets-hide {
  margin-right: -4px;
}
.sets-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 10px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.cart-section {
  flex: 0 0 auto;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: #fafbfc;
}
.cart-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cart-title {
  font-size: 13px;
  font-weight: 600;
  color: #37474f;
}
.cart-count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--ds-shortlist);
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
.cart-empty {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.35;
  color: #546e7a;
}
/* A strip rather than a grid: the sets list below must keep its room. */
.cart-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 6px 0 2px;
}
.cart-thumb {
  position: relative;
  flex: 0 0 72px;
  border: 1px solid #cfd8dc;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  cursor: pointer;
}
.cart-thumb--away {
  opacity: 0.45;
}
/* Inward: the strip scrolls sideways, and a ring outside the thumbnail
   would be clipped at either end of it. */
.cart-thumb--inspected {
  outline: 2px solid var(--ds-inspected);
  outline-offset: -2px;
}
/* Pulsing inward for the same reason as the clusters, and because the strip
   scrolls sideways and clips anything outside a thumbnail. Smaller again:
   these are seventy-two pixels wide, and a band sized for a cluster card
   would close over the picture. The gesture is in App.vue; the strip is the
   view where it earns the most, since clicking a thumbnail here used to say
   nothing back at all. */
.cart-thumb--inspected::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 5px;
  pointer-events: none;
  color: var(--ds-inspected);
  box-shadow: inset 0 0 2px 3px currentColor;
  opacity: 1;
  animation: ds-inspected-pulse var(--ds-pulse);
}
.cart-thumb-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(69, 90, 100, 0.85);
  opacity: 0;
  transition: opacity 0.12s;
}
.cart-thumb:hover .cart-thumb-remove,
.cart-thumb-remove:focus-visible {
  opacity: 1;
}
.cart-save {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 6px;
}
.cart-name {
  flex: 1 1 auto;
  min-width: 0;
  padding: 3px 6px;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  font-size: 13px;
}
.sets-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sets-empty {
  margin: 12px 10px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
}
.sets-list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.set-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-left: 3px solid #90a4ae;
  border-radius: 6px;
  padding: 6px 8px 8px;
  background: #fff;
}
.set-card--pickable {
  cursor: pointer;
}
.set-card--pickable:hover {
  background: #f5f9ff;
}
.set-card--active {
  border-left-color: #43a047;
  background: #f1f8f1;
}
.set-card-head {
  display: flex;
  align-items: center;
  gap: 4px;
}
.set-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: inherit;
  border: 1px solid transparent;
  border-radius: 3px;
  padding: 1px 3px;
  background: transparent;
  outline: none;
  text-overflow: ellipsis;
}
.set-name:hover {
  border-color: rgba(0, 0, 0, 0.15);
}
.set-name:focus {
  border-color: var(--ds-focus);
  background: #fff;
}
.set-count {
  font-size: 12px;
  line-height: 18px;
  padding: 0 7px;
  border-radius: 9px;
  background: #e3eaf2;
  color: #1a3b5d;
}
.set-criteria {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 6px 0;
}
.set-chip {
  font-size: 11px;
  line-height: 18px;
  padding: 0 7px;
  border-radius: 9px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #eceff1;
  color: #37474f;
}
.set-chip--range {
  background: #e3f2fd;
  color: #0d47a1;
}
.set-chip--gallery {
  background: #e8f5e9;
  color: #1b5e20;
}
.set-chip--members {
  background: #fbe9e7;
  color: #bf360c;
}
.set-chip--picked {
  font-style: italic;
}
.set-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.set-note-toggle {
  font-size: 12px;
  color: #1976d2;
  background: none;
  border: 0;
  cursor: pointer;
  padding: 0 2px;
}
.set-note {
  display: block;
  width: 100%;
  margin-top: 6px;
  font-size: 12px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  padding: 4px 6px;
  resize: vertical;
  outline: none;
}
.set-note:focus {
  border-color: var(--ds-focus);
}
</style>
