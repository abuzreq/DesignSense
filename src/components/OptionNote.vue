<template>
  <v-menu
    v-model="open"
    :close-on-content-click="false"
    offset-y
    left
    max-width="360"
    min-width="300"
  >
    <template v-slot:activator="{ on: menu }">
      <v-tooltip bottom max-width="320" :disabled="open">
        <!-- One element stays the activator while what is in it changes:
             Vuetify loses an activator swapped for another element, which
             left a note typed in Compare showing nothing until reopened. -->
        <template v-slot:activator="{ on: tooltip }">
          <span
            class="on-activator"
            :class="{ 'on-activator--text': showText && note }"
            v-on="Object.assign({}, menu, tooltip)"
          >
            <button
              v-if="showText && note"
              type="button"
              class="on-text"
              :aria-label="'Note: ' + note + '. Click to edit.'"
            >
              <v-icon x-small class="on-text-icon">mdi-comment-text-outline</v-icon>
              <span class="on-text-body">{{ note }}</span>
            </button>
            <v-btn
              v-else
              icon
              small
              class="on-button"
              :class="{ 'on-button--has': !!note }"
              :aria-label="note ? 'Edit the note: ' + note : 'Add a note'"
            >
              <v-icon small :color="note ? 'amber darken-2' : undefined">{{
                note ? "mdi-comment-text" : "mdi-comment-plus-outline"
              }}</v-icon>
            </v-btn>
          </span>
        </template>
        <span>{{ note ? "Your note: " + note : "Add a note: why it's in or out, what to ask about it" }}</span>
      </v-tooltip>
    </template>

    <v-card class="on-card">
      <div class="on-head">
        Note on <b>{{ name }}</b>
      </div>
      <v-textarea
        ref="field"
        v-model="draft"
        outlined
        dense
        auto-grow
        rows="3"
        hide-details="auto"
        :counter="limit"
        :maxlength="limit"
        placeholder="Why it's in or out, what to ask about it…"
        @keydown.esc.stop="open = false"
        @keydown.ctrl.enter="open = false"
        @keydown.meta.enter="open = false"
      />
      <div class="on-foot">
        <span class="on-hint">Saved as you type · shown in Compare and the summary</span>
        <v-spacer />
        <v-btn v-if="note" small text color="red darken-1" @click="remove">Delete</v-btn>
        <v-btn small text color="primary" @click="open = false">Done</v-btn>
      </div>
    </v-card>
  </v-menu>
</template>

<script>
import { optionName } from "@/columns.js";
import { NOTE_LIMIT } from "@/optionNotes.js";

/**
 * An option's note (see optionNotes.js): a button that shows whether there is
 * one and opens it for editing. With `showText`, a note that exists is shown
 * as its text instead, which opens it the same way. Saved as it's typed.
 */
export default {
  name: "OptionNote",
  props: {
    item: { type: Object, required: true },
    showText: { type: Boolean, default: false },
  },
  data() {
    return { open: false, draft: "", limit: NOTE_LIMIT };
  },
  computed: {
    note() {
      return this.$store.state.optionNotes[String(this.item._id)] || "";
    },
    name() {
      return optionName(this.item);
    },
  },
  watch: {
    open(value) {
      if (value) {
        this.draft = this.note;
        // After the menu's transition, or the caret doesn't land.
        setTimeout(() => {
          let field = this.$refs.field;
          if (field && field.focus) field.focus();
        }, 120);
      }
    },
    draft(text) {
      if (!this.open || text === this.note) return;
      this.$store.commit("setOptionNote", { id: this.item._id, text: text });
    },
    // Another option inspected while the note is open: its own note shows.
    "item._id"() {
      this.open = false;
    },
  },
  methods: {
    /** Opens the note from outside, e.g. from its text on the inspector. */
    edit() {
      this.open = true;
    },
    remove() {
      this.$store.commit("setOptionNote", { id: this.item._id, text: "" });
      this.draft = "";
      this.open = false;
    },
  },
};
</script>

<style scoped>
.on-card {
  padding: 10px 12px 6px;
}
.on-head {
  margin-bottom: 8px;
  font-size: 13px;
  color: #455a64;
}
.on-foot {
  display: flex;
  align-items: center;
  margin-top: 4px;
}
.on-hint {
  font-size: 11px;
  color: #90a4ae;
}
.on-activator {
  display: inline-flex;
}
.on-activator--text {
  display: flex;
  width: 100%;
}
.on-text {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  padding: 2px 4px;
  text-align: left;
  font-size: 12px;
  line-height: 1.35;
  color: #5d4037;
  background: #fff8e1;
  border-radius: 4px;
  cursor: pointer;
}
.on-text:hover {
  background: #ffecb3;
}
.on-text-icon {
  margin-top: 2px;
  color: #ffa000 !important;
}
.on-text-body {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
