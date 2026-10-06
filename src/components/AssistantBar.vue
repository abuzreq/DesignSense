<template>
  <div class="assistant-bar" :class="barClasses">
    <!-- On a narrow screen the bar is only this button; the field opens over
         the toolbar instead of taking width from its neighbours. -->
    <v-tooltip v-if="compact" bottom>
      <template v-slot:activator="{ on }">
        <v-btn v-on="on" icon small class="assistant-toggle" aria-label="Ask or command" @click="expand">
          <v-icon small>mdi-console-line</v-icon>
        </v-btn>
      </template>
      <span>Ask or command&nbsp;&nbsp;[/]</span>
    </v-tooltip>
    <div v-show="!compact || floating" class="assistant-field">
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
        <!-- The download begins on the first focus, which is this moment, so
             this is where to say so. The bar is working meanwhile, by wording;
             the only thing waiting is the better ranking. -->
        <div v-if="encoder === 'loading'" class="assistant-loading">
          <v-progress-circular
            indeterminate
            size="12"
            width="2"
            color="amber lighten-2"
          />
          <span
            >Loading the meaning model, 23&nbsp;MB, once. Matching by wording
            until it arrives.</span
          >
        </div>
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
          <span class="assistant-item-label" :aria-label="item.label"
            ><span
              v-for="(part, k) in labelParts(item)"
              :key="k"
              :class="{ 'assistant-blank': part.open }"
              >{{ part.text }}</span
            ></span
          >
          <span class="assistant-item-hint">{{ i === highlighted ? item.hint : "" }}</span>
          <span class="assistant-item-why" :title="whyTitle(item.why)">{{ whyMark(item.why) }}</span>
        </div>

        <!-- The instruction list lives in the popup, so the bar has no second
             "?" next to the app's own help. -->
        <template v-if="!text && !slot">
          <div
            class="assistant-help-toggle"
            :class="{ 'assistant-help-toggle--open': helpOpen }"
            @click="toggleHelp"
          >
            <v-icon x-small class="assistant-help-icon">mdi-help-circle-outline</v-icon>
            <span>What can I ask?</span>
            <span class="assistant-item-hint">{{ helpOpen ? "Esc hides" : "type ?" }}</span>
          </div>
          <div v-if="helpOpen" ref="helpList" class="assistant-help-list">
            <div class="assistant-card-lead">
              Click one or use the arrow keys and Enter: it goes into the bar, asks for any
              column or number it needs, and runs.
            </div>
            <div v-for="section in helpSections" :key="section.group" class="assistant-group">
              <div class="assistant-group-name">{{ section.group }}</div>
              <div
                v-for="row in section.rows"
                :key="row.index"
                class="assistant-group-item"
                :class="{ 'assistant-group-item--on': row.index === helpAt }"
                :title="row.entry.title"
                @mouseenter="helpAt = row.index"
                @click="start(row.entry)"
              >
                <span class="assistant-group-item-text" :aria-label="row.entry.label"
                  ><span
                    v-for="(part, k) in labelParts(row.entry)"
                    :key="k"
                    :class="{ 'assistant-blank': part.open }"
                    >{{ part.text }}</span
                  ></span
                >
                <span class="assistant-group-item-hint">{{ row.entry.hint }}</span>
              </div>
            </div>
            <div class="assistant-card-note">
              Or type in your own words: Tab fills in the next part, Enter or a click runs it.
              Join steps with "and". Everything done shows as a chip and undoes with Ctrl+Z.
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import {
  ask,
  instructions,
  suggest,
  acceptSuggestion,
  warmSemantic,
  watchSemantic,
  unwatchSemantic,
  prepareSemantic,
  semanticStatus,
  requestVector,
  wantsVector,
} from "@/assistant";
import { SLOT_WORDS, previewParts } from "@/assistant/templates.js";

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
  idle: "Suggestions are ranked by wording; the meaning model loads when you use the bar.",
  loading: "Loading the meaning model (23 MB, once). Suggestions are ranked by wording until it arrives.",
  ready: "Suggestions are ranked by meaning and wording.",
  failed: "The meaning model could not load; suggestions are ranked by wording.",
};

/** Width of the field while it floats over the toolbar, and of its popup. */
const FIELD_WIDTH = 380;
const POPUP_WIDTH = 520;

export default {
  name: "AssistantBar",
  props: {
    // Only a button until it is used, when the toolbar is short of room. The
    // toolbar decides, weighing everything else in the row.
    compact: { type: Boolean, default: false },
  },
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
      // The highlighted row of the instruction list, for arrow keys.
      helpAt: -1,
      encoder: semanticStatus(),
      // Compact: whether the button has been opened into the field.
      expanded: false,
      // Which way the floating field and its popup open, so both stay on screen.
      alignRight: false,
      popupRight: false,
    };
  },
  computed: {
    instructionGroups() {
      return instructions();
    },
    /** The groups with a running index, so the keyboard can walk them. */
    helpSections() {
      let index = 0;
      let groups = this.instructionGroups;
      return Object.keys(groups).map((group) => ({
        group: group,
        rows: groups[group].map((entry) => ({ entry: entry, index: index++ })),
      }));
    },
    helpEntries() {
      let out = [];
      this.helpSections.forEach((section) => {
        section.rows.forEach((row) => out.push(row.entry));
      });
      return out;
    },
    /**
     * Whether the field floats over the toolbar. It never takes width from its
     * neighbours: narrow, it floats whenever it is open; wide, it sits in its
     * own slot and floats out to full width only while in use.
     */
    floating() {
      return this.compact ? this.expanded : this.focused || this.open;
    },
    barClasses() {
      return {
        "assistant-bar--compact": this.compact,
        "assistant-bar--floating": this.floating,
        "assistant-bar--right": this.alignRight,
        "assistant-bar--popup-right": this.popupRight,
      };
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
    // The encoder is not started here. It is twenty-three megabytes of model
    // and runtime pulled from two other hosts, and on a published site that is
    // a cost every first visit pays whether or not anyone ever types in this
    // bar -- so it waits for a focus (see onFocus). Subscribing costs nothing
    // and is done now, so that this bar follows an encoder that some other bar
    // may already have started. The table's index is still built while the
    // page is idle, once the encoder is there.
    // Kept, so beforeDestroy can take the same function off again: the
    // encoder's listeners outlive this bar, and one left behind would keep
    // this whole app alive after the next dataset replaces it.
    this.onEncoderStatus = (status) => {
      this.encoder = status;
      if (status === "ready") prepareSemantic(this.$store);
      if (this.open) this.refresh();
    };
    watchSemantic(this.onEncoderStatus);
  },
  beforeDestroy() {
    unwatchSemantic(this.onEncoderStatus);
    clearInterval(this.hintTimer);
    clearTimeout(this.vectorTimer);
    clearTimeout(this.blurTimer);
    document.removeEventListener("keydown", this.onGlobalKeydown);
  },
  watch: {
    // Crossing the toolbar's threshold swaps the inline field for the button and back.
    compact() {
      if (!this.focused && !this.text) this.expanded = false;
      if (this.floating) this.$nextTick(() => this.place());
    },
  },
  methods: {
    short(column) {
      return String(column).replace(/^(in|out|min|max|custom|weighted)\s*:\s*/i, "");
    },
    slotWord(name) {
      return SLOT_WORDS[name] || name;
    },
    /** A suggestion's text in parts, its open slots marked to show as blanks. */
    labelParts(item) {
      if (!item.template) return [{ text: item.label }];
      return previewParts(item.template, item.filled || []);
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
      // The reader has asked for the bar, so now the encoder is worth its
      // download. Idempotent: every focus after the first returns at once.
      warmSemantic(this.onEncoderStatus);
      clearTimeout(this.blurTimer);
      if (!this.floating) this.place();
      this.focused = true;
      if (this.compact) this.expanded = true;
      this.open = true;
      this.refresh();
    },
    onBlur() {
      this.focused = false;
      // Let a click on an item land before the list goes away.
      this.blurTimer = setTimeout(() => {
        this.open = false;
        this.helpOpen = false;
        // Narrow: back to the button, unless there is text still to finish.
        if (this.compact && !this.text) this.expanded = false;
      }, 150);
    },
    /** Opens the narrow bar over the toolbar and puts the caret in it. */
    expand() {
      if (!this.expanded) this.place();
      this.expanded = true;
      this.$nextTick(() => {
        if (this.$refs.input) this.$refs.input.focus();
      });
    },
    /**
     * Picks the side the floating field and its popup open towards: from the
     * bar's left edge, unless that would run off the right of the window.
     */
    place() {
      if (!this.$el || !this.$el.getBoundingClientRect) return;
      let rect = this.$el.getBoundingClientRect();
      let room = window.innerWidth - 8;
      this.alignRight = rect.left + FIELD_WIDTH > room;
      let popupLeft = this.alignRight ? rect.right - FIELD_WIDTH : rect.left;
      this.popupRight = popupLeft + POPUP_WIDTH > room;
    },
    toggleHelp() {
      this.helpOpen = !this.helpOpen;
      this.helpAt = -1;
    },
    /** Arrow keys and Enter inside the instruction list. */
    helpKeydown(e) {
      let n = this.helpEntries.length;
      if (!n) return false;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (this.helpAt < 0) this.helpAt = e.key === "ArrowDown" ? 0 : n - 1;
        else this.helpAt = e.key === "ArrowDown" ? (this.helpAt + 1) % n : (this.helpAt - 1 + n) % n;
        this.$nextTick(() => {
          let list = this.$refs.helpList;
          let row = list && list.querySelector(".assistant-group-item--on");
          if (row && row.scrollIntoView) row.scrollIntoView({ block: "nearest" });
        });
        return true;
      }
      if (e.key === "Enter" && this.helpAt >= 0) {
        e.preventDefault();
        this.start(this.helpEntries[this.helpAt]);
        return true;
      }
      return false;
    },
    onInput() {
      if (this.text) this.helpOpen = false;
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
        if (this.helpOpen) {
          this.helpOpen = false;
          return;
        }
        this.dismiss();
        return;
      }
      // "?" in an empty box shows the instruction list, which then takes the
      // arrow keys and Enter until something is typed.
      if (key === "?" && !this.text) {
        e.preventDefault();
        this.open = true;
        this.toggleHelp();
        return;
      }
      if (this.helpOpen && !this.text && this.open && this.helpKeydown(e)) return;
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
        // Asking for help opens the list in place.
        this.reply = null;
        this.helpOpen = true;
        this.helpAt = -1;
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
      if (this.compact && !this.expanded) {
        this.expand();
        return;
      }
      this.$refs.input.focus();
    },
  },
};
</script>

<style scoped>
/* One compact control in the toolbar; the list and replies float below it.
   Its slot in the row never changes size while it is used: the field floats
   over the neighbours instead, so filter chips and operations stay put. */
.assistant-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Its own width, not a share of the spare room: that goes to the filters
     or the selection beside it, which have more to show. */
  flex: 0 1 260px;
  min-width: 180px;
  max-width: 320px;
  height: 30px;
  padding: 0 2px;
}
/* Narrow toolbar: only a button, until "/", Ctrl+K or a click opens it. */
.assistant-bar--compact {
  flex: 0 0 36px;
  min-width: 36px;
  max-width: 36px;
  padding: 0;
}
.assistant-toggle {
  flex: 0 0 auto;
}
.assistant-field {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
}
.assistant-bar--floating .assistant-field {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  width: 380px;
  max-width: calc(100vw - 16px);
  z-index: 40;
  background: #263238;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
}
.assistant-bar--floating.assistant-bar--right .assistant-field {
  left: auto;
  right: 0;
}
.assistant-bar--popup-right .assistant-suggest {
  left: auto;
  right: 0;
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
/* Said in the panel and not only on the dot, because the download now starts
   under the reader's eyes rather than long before they looked. */
.assistant-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 7px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
  font-size: 13px;
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
/* An open slot: a blank to fill in, named by what goes there. */
.assistant-blank {
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(144, 202, 249, 0.16);
  color: #90caf9;
  font-style: italic;
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
.assistant-help-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 2px;
  opacity: 0.85;
}
.assistant-help-toggle:hover,
.assistant-help-toggle--open {
  background: rgba(0, 191, 255, 0.1);
  opacity: 1;
}
.assistant-help-icon.v-icon {
  color: inherit;
  opacity: 0.8;
}
.assistant-help-list {
  max-height: 55vh;
  overflow-y: auto;
  padding: 6px 10px 8px;
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
.assistant-group-item--on {
  background: rgba(0, 191, 255, 0.18);
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
