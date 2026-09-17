<template>
  <div class="assistant-bar" :class="{ 'assistant-bar--open': open }">
    <div class="assistant-field">
      <v-icon small class="assistant-icon">mdi-console-line</v-icon>
      <input
        ref="input"
        v-model="text"
        class="assistant-input"
        :placeholder="placeholder"
        spellcheck="false"
        autocomplete="off"
        @input="onInput"
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="onBlur"
      />
      <!-- The encoder's state, so a weaker ranking on first load is explained. -->
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <span v-on="on" class="assistant-dot" :class="'assistant-dot--' + encoder"></span>
        </template>
        <span>{{ encoderText }}</span>
      </v-tooltip>

      <!-- Everything else floats under the input, so the toolbar stays one row:
           what was understood or answered, then the nearest instructions. -->
      <div v-if="open && (items.length || reply || !text)" class="assistant-suggest" @mousedown.prevent>
        <div v-if="reply" class="assistant-reply" :class="'assistant-reply--' + reply.kind">
          <template v-if="reply.kind === 'clarify'">
            <span class="assistant-reply-text">{{ reply.message }}</span>
            <v-chip
              v-for="candidate in reply.candidates"
              :key="candidate"
              x-small
              class="assistant-candidate"
              color="amber darken-3"
              text-color="white"
              @click="choose(candidate)"
            >
              {{ short(candidate) }}
            </v-chip>
          </template>
          <template v-else>
            <v-chip v-if="reply.understood" x-small class="assistant-understood" color="blue-grey darken-2" text-color="white">
              {{ reply.understood }}
            </v-chip>
            <span v-if="reply.message" class="assistant-reply-text">{{ reply.message }}</span>
            <span v-else-if="reply.kind === 'done'" class="assistant-reply-note">done · Ctrl+Z undoes it</span>
          </template>
        </div>

        <div v-if="slot" class="assistant-slot-caption">
          <span
            v-for="(name, i) in slot.names"
            :key="i"
            class="assistant-slot-name"
            :class="{ 'assistant-slot-name--now': i === slot.index, 'assistant-slot-name--done': i < slot.index }"
          >{{ slotWord(name) }}</span>
        </div>
        <div v-if="!items.length && !text && !reply" class="assistant-hint">{{ hint }}</div>
        <div
          v-for="(item, i) in items"
          :key="item.insert + i"
          class="assistant-item"
          :class="{ 'assistant-item--on': i === highlighted }"
          @mouseenter="highlighted = i"
          @click="pick(item)"
        >
          <span class="assistant-item-label">{{ item.label }}</span>
          <span class="assistant-item-hint">{{ i === highlighted ? item.hint : "" }}</span>
          <span class="assistant-item-why" :title="whyTitle(item.why)">{{ whyMark(item.why) }}</span>
        </div>
      </div>
    </div>

    <v-menu v-model="helpOpen" offset-y open-on-hover close-delay="250" max-height="70vh" :close-on-content-click="false">
      <template v-slot:activator="{ on }">
        <v-btn v-on="on" icon small class="assistant-help">
          <v-icon small>mdi-help-circle-outline</v-icon>
        </v-btn>
      </template>
      <v-card class="assistant-card">
        <v-card-text>
          <div class="assistant-card-title">Supported instructions</div>
          <div class="assistant-card-lead">
            Click one: it goes into the bar, asks for any column or number it needs, and runs.
          </div>
          <div v-for="(entries, group) in instructionGroups" :key="group" class="assistant-group">
            <div class="assistant-group-name">{{ group }}</div>
            <div
              v-for="entry in entries"
              :key="entry.insert"
              class="assistant-group-item"
              :title="entry.title"
              @click="start(entry)"
            >
              <span class="assistant-group-item-text">{{ entry.label }}</span>
              <span class="assistant-group-item-hint">{{ entry.hint }}</span>
            </div>
          </div>
          <div class="assistant-card-note">
            Or type in your own words: Tab fills in the next part, Enter or a click runs it.
            Join steps with "and". Everything done shows as a chip and undoes with Ctrl+Z.
          </div>
        </v-card-text>
      </v-card>
    </v-menu>
  </div>
</template>

<script>
import {
  ask,
  instructions,
  suggest,
  acceptSuggestion,
  warmSemantic,
  prepareSemantic,
  semanticStatus,
  requestVector,
  wantsVector,
} from "@/assistant";

/* Shown one at a time while the box is empty and focused, so the vocabulary is
 * discoverable without a manual. */
const HINTS = [
  'try "price under 10000"',
  'try "select the cheapest"',
  'try "how many have year over 2015"',
  'try "what is the std of price"',
  'try "sort by year and colour by fuel"',
  'try "what do these have in common"',
  'try "pareto front of price vs year"',
  'try "cluster into 4 groups"',
  'try "compare Set #1 with the rest"',
  'try "zoom out"',
];

const ENCODER_TEXT = {
  idle: "Suggestions are ranked by wording.",
  loading: "Loading the meaning model (23 MB, once). Suggestions are ranked by wording until it arrives.",
  ready: "Suggestions are ranked by meaning and wording.",
  failed: "The meaning model could not load; suggestions are ranked by wording.",
};

const SLOT_WORDS = {
  dim: "column", op: "comparison", value: "number", values: "value", k: "how many",
  n: "how many", percent: "percent", order: "order", stat: "statistic", panel: "view",
  set: "set", mode: "mode", name: "name", ordinal: "which",
};

export default {
  name: "AssistantBar",
  data() {
    return {
      text: "",
      reply: null,
      focused: false,
      history: [],
      historyAt: -1,
      hintAt: 0,
      // The utterance a pending clarify belongs to, so choosing a candidate
      // re-reads the same sentence instead of making the user retype it.
      pending: "",
      // The guided path.
      items: [],
      slot: null,
      active: null,
      highlighted: -1,
      open: false,
      helpOpen: false,
      encoder: semanticStatus(),
    };
  },
  computed: {
    instructionGroups() {
      return instructions();
    },
    placeholder() {
      return "Ask or command…  [/]";
    },
    hint() {
      return HINTS[this.hintAt % HINTS.length];
    },
    encoderText() {
      return ENCODER_TEXT[this.encoder] || "";
    },
  },
  mounted() {
    this.hintTimer = setInterval(() => {
      this.hintAt += 1;
    }, 4000);
    // "/" and Ctrl+K reach the bar from anywhere, as long as the keystroke is
    // not already going into some other field.
    this.onGlobalKeydown = (e) => {
      let target = e.target || {};
      let tag = (target.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      let key = (e.key || "").toLowerCase();
      if (key === "/" || (e.ctrlKey && key === "k")) {
        e.preventDefault();
        this.focus();
      }
    };
    document.addEventListener("keydown", this.onGlobalKeydown);
    // The encoder loads in the background; the bar works before it arrives,
    // and the table's index is built while the page is idle so the first
    // click does not wait for it.
    warmSemantic((status) => {
      this.encoder = status;
      if (status === "ready") prepareSemantic(this.$store);
      if (this.open) this.refresh();
    });
  },
  beforeDestroy() {
    clearInterval(this.hintTimer);
    clearTimeout(this.vectorTimer);
    clearTimeout(this.blurTimer);
    document.removeEventListener("keydown", this.onGlobalKeydown);
  },
  methods: {
    short(column) {
      return String(column).replace(/^(in|out)\s*:\s*/i, "");
    },
    slotWord(name) {
      return SLOT_WORDS[name] || name;
    },
    whyMark(why) {
      return { parser: "↵", semantic: "≈", both: "≈" }[why] || "";
    },
    whyTitle(why) {
      return {
        parser: "Read from your sentence as it stands",
        semantic: "Matched by meaning",
        both: "Matched by meaning and wording",
        range: "From the values in this column",
      }[why] || "";
    },

    /* ------------------------------------------------------- suggestions -- */

    onFocus() {
      clearTimeout(this.blurTimer);
      this.focused = true;
      this.open = true;
      this.refresh();
    },
    onBlur() {
      this.focused = false;
      // Let a click on an item land before the list goes away.
      this.blurTimer = setTimeout(() => { this.open = false; }, 150);
    },
    onInput() {
      this.open = true;
      this.reply = this.reply && this.reply.kind === "clarify" ? this.reply : null;
      // Typing restarts the choice: the first item is the best reading of
      // what is in the box now, whatever was highlighted before.
      this.highlighted = 0;
      this.refresh();
    },
    /** Re-ranks for the current text, and asks for any vectors it lacked. */
    refresh() {
      let out;
      try {
        out = suggest(this.$store, this.text, this.active);
      } catch (error) {
        this.items = [];
        this.slot = null;
        return;
      }
      this.items = out.items;
      this.slot = out.slot;
      this.active = out.active;
      if (this.highlighted >= this.items.length) this.highlighted = this.items.length ? 0 : -1;
      if (this.items.length && this.highlighted < 0 && this.text) this.highlighted = 0;

      let wanted = wantsVector(this.text, this.active);
      if (wanted.length) {
        clearTimeout(this.vectorTimer);
        let text = this.text;
        this.vectorTimer = setTimeout(() => {
          Promise.all(wanted.map(requestVector)).then((got) => {
            // Only re-rank if the box still holds what was encoded.
            if (got.some(Boolean) && this.text === text && this.open) this.refresh();
          });
        }, 120);
      }
    },
    /**
     * An instruction chosen from the list: into the bar, and either its
     * first slot opens with candidates or, with nothing to fill, it runs.
     */
    start(entry) {
      this.helpOpen = false;
      this.reply = null;
      this.pick(entry);
    },
    /**
     * Puts the item's text in the box and moves on to its next slot; a
     * finished instruction runs at once, the same as Enter on it.
     */
    pick(item) {
      this.text = item.insert;
      if (item.complete) {
        this.submit();
        return;
      }
      this.active = acceptSuggestion(item);
      this.highlighted = 0;
      this.open = true;
      this.$nextTick(() => {
        this.focus();
        this.refresh();
      });
    },
    onKeydown(e) {
      let key = e.key;
      let listOpen = this.open && this.items.length > 0;

      if (key === "Escape") {
        e.preventDefault();
        this.dismiss();
        return;
      }
      if (key === "ArrowDown" || key === "ArrowUp") {
        e.preventDefault();
        if (listOpen) {
          let n = this.items.length;
          this.highlighted = key === "ArrowDown"
            ? (this.highlighted + 1) % n
            : (this.highlighted - 1 + n) % n;
        } else if (!this.text) {
          this.recall(key === "ArrowUp" ? -1 : 1);
        }
        return;
      }
      if (key === "Tab" || (key === "ArrowRight" && listOpen && this.caretAtEnd())) {
        if (!listOpen) return;
        e.preventDefault();
        this.pick(this.items[Math.max(0, this.highlighted)]);
        return;
      }
      if (key === "Enter") {
        e.preventDefault();
        let item = listOpen && this.highlighted >= 0 ? this.items[this.highlighted] : null;
        if (item && !item.complete && item.why !== "parser") {
          // Enter on an unfinished instruction fills it in, like Tab.
          this.pick(item);
          return;
        }
        if (item && item.complete) this.text = item.insert;
        this.submit();
      }
    },
    caretAtEnd() {
      let el = this.$refs.input;
      return el && el.selectionStart === el.value.length;
    },

    /* --------------------------------------------------------- running -- */

    submit() {
      let text = this.text.trim();
      if (text === "") return;
      this.run(text, null);
      this.history.unshift(text);
      this.historyAt = -1;
    },
    /** Answering the clarify: same sentence, one ambiguity settled. */
    choose(column) {
      this.run(this.pending || this.text, column);
    },
    run(text, prefer) {
      let reply = ask(this.$store, text, { prefer: prefer });
      if (reply.kind === "help") {
        this.reply = { kind: "answer", message: "The list is under the ? on the right." };
      } else {
        this.reply = reply;
      }
      this.pending = reply.kind === "clarify" ? text : "";
      // A question stays on screen with the text still there to edit; anything
      // else has already happened, so the box clears for the next request and
      // the reply stays readable under it until the next keystroke.
      if (reply.kind !== "clarify") this.text = "";
      this.active = null;
      this.items = [];
      this.slot = null;
      this.highlighted = -1;
      this.open = true;
      this.focus();
    },
    dismiss() {
      if (this.open && (this.items.length || this.reply)) {
        this.open = false;
        this.active = null;
        this.reply = null;
        this.pending = "";
      } else {
        this.text = "";
        this.active = null;
        this.reply = null;
        this.$refs.input.blur();
      }
    },
    recall(step) {
      if (this.history.length === 0) return;
      this.historyAt = Math.min(
        this.history.length - 1,
        Math.max(-1, this.historyAt + (step < 0 ? 1 : -1))
      );
      this.text = this.historyAt < 0 ? "" : this.history[this.historyAt];
    },
    focus() {
      this.$refs.input.focus();
    },
  },
};
</script>

<style scoped>
/* One compact control in the toolbar; the list and replies float below it. */
.assistant-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1 1 200px;
  min-width: 120px;
  max-width: 380px;
  padding: 0 2px;
}
/* Takes what the toolbar leaves, shrinks first when it is tight, and grows
   while in use so a sentence stays readable. */
.assistant-field {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
}
.assistant-bar--open,
.assistant-bar:focus-within {
  flex-basis: 380px;
}
.assistant-icon {
  position: absolute;
  left: 8px;
  opacity: 0.55;
  pointer-events: none;
}
.assistant-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 4px;
  color: #fff;
  font-size: 13px;
  padding: 4px 22px 4px 28px;
  outline: none;
}
.assistant-input:focus {
  border-color: rgba(0, 191, 255, 0.7);
  background: rgba(255, 255, 255, 0.12);
}
.assistant-input::placeholder {
  color: rgba(255, 255, 255, 0.45);
}
.assistant-dot {
  position: absolute;
  right: 8px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
}
.assistant-dot--loading {
  background: #ffd54f;
  animation: assistant-pulse 1.2s ease-in-out infinite;
}
.assistant-dot--ready {
  background: #69f0ae;
}
.assistant-dot--failed {
  background: #ff8a65;
}
@keyframes assistant-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
.assistant-suggest {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 520px;
  max-width: calc(100vw - 32px);
  z-index: 30;
  background: #263238;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 4px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
  padding: 4px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
}
.assistant-reply {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 10px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 2px;
}
.assistant-reply-text {
  font-size: 12.5px;
  line-height: 1.35;
  opacity: 0.92;
}
.assistant-reply-note {
  font-size: 11px;
  opacity: 0.55;
}
.assistant-reply--unknown .assistant-reply-text,
.assistant-reply--refused .assistant-reply-text {
  color: #ffab91;
}
.assistant-reply--clarify .assistant-reply-text {
  color: #ffd54f;
}
.assistant-understood,
.assistant-candidate {
  flex: 0 0 auto;
}
.assistant-candidate {
  cursor: pointer;
}
.assistant-hint {
  padding: 6px 10px;
  font-size: 12px;
  font-style: italic;
  opacity: 0.55;
}
.assistant-slot-caption {
  display: flex;
  gap: 10px;
  padding: 2px 10px 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.8;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 2px;
}
.assistant-slot-name {
  opacity: 0.45;
}
.assistant-slot-name--done {
  opacity: 0.7;
  text-decoration: line-through;
}
.assistant-slot-name--now {
  opacity: 1;
  color: #80deea;
}
.assistant-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 10px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
}
.assistant-item--on {
  background: rgba(0, 191, 255, 0.18);
}
.assistant-item-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
.assistant-item-hint {
  margin-left: auto;
  font-size: 11px;
  opacity: 0.55;
  flex: 0 0 auto;
}
.assistant-item-why {
  width: 12px;
  text-align: right;
  font-size: 11px;
  opacity: 0.5;
  flex: 0 0 auto;
}
.assistant-help {
  flex: 0 0 auto;
}
.assistant-card {
  width: 360px;
  max-width: 360px;
}
.assistant-card-title {
  font-weight: 600;
  margin-bottom: 2px;
}
.assistant-card-lead {
  font-size: 11px;
  opacity: 0.7;
  margin-bottom: 10px;
}
.assistant-group {
  margin-bottom: 8px;
}
.assistant-group-name {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
  margin-bottom: 2px;
}
.assistant-group-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  padding: 2px 6px 2px 8px;
  border-radius: 3px;
  cursor: pointer;
}
.assistant-group-item:hover {
  background: rgba(0, 191, 255, 0.14);
}
.assistant-group-item-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.assistant-group-item-hint {
  margin-left: auto;
  flex: 0 0 auto;
  font-size: 10px;
  opacity: 0.5;
}
.assistant-card-note {
  font-size: 11px;
  opacity: 0.7;
  margin-top: 10px;
}
</style>
