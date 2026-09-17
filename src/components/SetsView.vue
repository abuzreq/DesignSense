<template>
  <div class="sets-view" :style="{ height: height + 'px' }">
    <div class="sets-header">
      <div class="sets-title">{{ isLite ? "Saved sets" : "Sets" }}</div>
      <v-tooltip bottom max-width="300">
        <template v-slot:activator="{ on }">
          <span v-on="on">
            <v-btn small depressed color="primary" @click="save">
              <v-icon left small>{{
                isLite ? "mdi-bookmark-plus-outline" : "mdi-plus"
              }}</v-icon>
              {{ isLite ? "Save" : "New set" }}
            </v-btn>
          </span>
        </template>
        <span>{{ saveTooltip }}</span>
      </v-tooltip>
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
  props: ["width", "height", "x", "y", "type"],
  data: function() {
    return {
      // Sets whose empty note was opened with "Add note".
      openNotes: {},
    };
  },
  computed: {
    ...mapState({
      setsIDs: (state) => state.setsIDs,
      setsMetadataMap: (state) => state.setsMetadataMap,
      setsMap: (state) => state.setsMap,
      dataLength: (state) => state.data.length,
    }),
    ...mapGetters([
      "can",
      "hasScope",
      "isFilterActive",
      "isLite",
      "matchingSetID",
      "selectionCount",
      "setCriteriaChips",
    ]),
    saveTooltip() {
      if (!this.isLite) {
        return "Save the selected options as a set. Click a set later to bring its options back; the current selection operation applies.";
      }
      if (!this.isFilterActive && !this.hasScope) {
        return "Save all options as a set. Filter the collection first to save just part of it.";
      }
      let count = this.isFilterActive ? this.selectionCount : this.dataLength;
      return (
        "Save the " +
        count.toLocaleString() +
        " matching options and the filters that found them. Restore the set later to bring those filters back."
      );
    },
    emptyText() {
      return this.isLite
        ? "Nothing saved yet. Filter the collection, then save the results here to come back to them later."
        : "No sets yet. Select options, then click New set.";
    },
  },
  methods: {
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
      this.$store.dispatch("restoreSet", { setID: id });
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
      this.$store.commit("removeSet", { setID: id });
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
.sets-view {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sets-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 10px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.sets-title {
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
  border-color: #1976d2;
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
  border-color: #1976d2;
}
</style>
