<template>
  <v-dialog :value="value" max-width="560" @input="onInput">
    <v-card class="fb-card">
      <v-card-title class="fb-title">
        {{ sent ? "Thank you" : "Send feedback" }}
        <v-spacer />
        <v-btn icon aria-label="Close" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text v-if="sent" class="fb-body">
        <p class="fb-lead">
          Your feedback was sent. It helps decide what DesignSense does next.
        </p>
      </v-card-text>

      <v-card-text v-else class="fb-body">
        <p v-if="fromError" class="fb-lead fb-lead--error">
          Something went wrong just now. Saying what you were doing helps
          find it; the error's details are included below.
        </p>
        <p v-else class="fb-lead">
          An idea, something that got in the way, a question: all welcome.
        </p>

        <v-chip-group v-model="kind" mandatory active-class="fb-kind--on" class="fb-kinds">
          <v-chip v-for="k in kinds" :key="k" :value="k" small outlined>{{ k }}</v-chip>
        </v-chip-group>

        <v-textarea
          ref="message"
          v-model="message"
          :label="messageLabel"
          outlined
          auto-grow
          rows="4"
          counter="4000"
          maxlength="4000"
          hide-details="auto"
        />
        <v-text-field
          v-model="email"
          label="Your email, if you'd like a reply (optional)"
          type="email"
          outlined
          dense
          hide-details
          class="mt-3"
        />

        <div class="fb-attach">
          <v-checkbox
            v-model="includeShot"
            dense
            hide-details
            :disabled="shotState === 'failed'"
          >
            <template v-slot:label>
              <span>
                A picture of the screen
                <span class="fb-note">{{ shotNote }}</span>
              </span>
            </template>
          </v-checkbox>
          <img v-if="shotUrl && includeShot" :src="shotUrl" alt="" class="fb-shot" />
          <v-checkbox
            v-if="hasErrors"
            v-model="includeErrors"
            dense
            hide-details
            :label="'The errors seen this visit (' + errorCount + ')'"
          />
        </div>

        <p class="fb-privacy">
          <v-icon x-small class="fb-privacy-icon">mdi-shield-check-outline</v-icon>
          No sensitive data is shared: not your dataset, its values, or
          where it is kept. Only a picture of the screen, if you include one,
          shows what you're looking at. The rest of what is sent is listed
          below.
        </p>
        <details class="fb-details">
          <summary>What else is sent</summary>
          <p class="fb-note">
            These facts about the app, to make sense of the report. The
            dataset's contents are never sent.
          </p>
          <pre>{{ context }}</pre>
          <pre v-if="hasErrors && includeErrors">{{ errors }}</pre>
        </details>

        <v-alert v-if="failed" type="warning" dense text class="mt-3 mb-0">
          It couldn't be sent from here. Email it instead: the message and
          details are filled in{{
            shot && includeShot ? ", and the picture can be downloaded and attached" : ""
          }}.
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-btn
          v-if="!sent && shot && includeShot && (failed || !canPost)"
          text
          @click="downloadShot"
          >Download picture</v-btn
        >
        <v-spacer />
        <template v-if="sent">
          <v-btn color="primary" text @click="close">Close</v-btn>
        </template>
        <template v-else>
          <v-btn text @click="close">Cancel</v-btn>
          <v-btn
            v-if="canPost && !failed"
            color="primary"
            depressed
            :loading="sending"
            :disabled="!message.trim()"
            @click="send"
            >Send</v-btn
          >
          <v-btn
            v-else
            color="primary"
            depressed
            :disabled="!message.trim()"
            :href="mailto"
            @click="afterMail"
            >Open in email</v-btn
          >
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { errorState, errorsAsText } from "@/errors.js";
import {
  canPostForm,
  captureScreen,
  feedbackContext,
  feedbackMailto,
  postFeedback,
} from "@/feedback.js";
import { downloadBlob } from "@/story/image.js";

const KINDS = ["Idea", "Problem", "Question", "Praise"];

/**
 * Feedback from inside the app (see feedback.js for where it goes). Opened
 * from the help menu, or from the notice offered after an error, which picks
 * "Problem" and includes the errors.
 */
export default {
  name: "FeedbackDialog",
  props: {
    value: { type: Boolean, default: false },
    // Opened to report an error that just happened.
    fromError: { type: Boolean, default: false },
  },
  data() {
    return {
      kinds: KINDS,
      kind: KINDS[0],
      message: "",
      email: "",
      includeShot: true,
      includeErrors: true,
      shot: null,
      shotUrl: null,
      // "drawing", "ready" or "failed".
      shotState: "drawing",
      context: "",
      sending: false,
      sent: false,
      failed: false,
      canPost: canPostForm(),
    };
  },
  computed: {
    hasErrors() {
      return errorState.recent.length > 0;
    },
    errorCount() {
      return errorState.recent.reduce((n, e) => n + e.count, 0);
    },
    errors() {
      // Read so this follows new errors.
      void errorState.recent;
      return errorsAsText();
    },
    messageLabel() {
      return {
        Idea: "What would make it better?",
        Problem: "What happened, and what were you trying to do?",
        Question: "What would you like to know?",
        Praise: "What worked well?",
      }[this.kind];
    },
    shotNote() {
      if (this.shotState === "drawing") return "(drawing…)";
      if (this.shotState === "failed") return "(couldn't be drawn)";
      return "";
    },
    report() {
      return {
        kind: this.kind,
        message: this.message.trim(),
        email: this.email.trim(),
        context: this.context,
        errors: this.hasErrors && this.includeErrors ? this.errors : "",
        screenshot: this.includeShot ? this.shot : null,
      };
    },
    mailto() {
      return feedbackMailto(this.report);
    },
  },
  watch: {
    value: {
      immediate: true,
      handler(open) {
        if (open) this.start();
      },
    },
  },
  beforeDestroy() {
    this.dropShot();
  },
  methods: {
    start() {
      this.kind = this.fromError ? "Problem" : KINDS[0];
      this.message = "";
      this.includeShot = true;
      this.includeErrors = true;
      this.sending = false;
      this.sent = false;
      this.failed = false;
      this.canPost = canPostForm();
      this.context = feedbackContext(this.$store);
      this.dropShot();
      this.shotState = "drawing";
      let token = (this.shotToken = {});
      // Drawn while the user types: what is on screen behind the dialog.
      captureScreen().then((blob) => {
        if (this.shotToken !== token) return;
        this.shot = blob;
        this.shotState = blob ? "ready" : "failed";
        if (!blob) this.includeShot = false;
        else this.shotUrl = URL.createObjectURL(blob);
      });
      this.$nextTick(() => {
        let field = this.$refs.message;
        if (field && field.focus) setTimeout(() => field.focus(), 200);
      });
    },
    dropShot() {
      if (this.shotUrl) URL.revokeObjectURL(this.shotUrl);
      this.shotUrl = null;
      this.shot = null;
      this.shotToken = null;
    },
    async send() {
      this.sending = true;
      try {
        await postFeedback(this.report);
        this.sent = true;
        // Reported, so the notice about it has done its job.
        errorState.latest = null;
      } catch (e) {
        this.failed = true;
      }
      this.sending = false;
    },
    afterMail() {
      errorState.latest = null;
    },
    downloadShot() {
      if (this.shot) downloadBlob(this.shot, "designsense-screen.jpg");
    },
    onInput(open) {
      if (!open) this.close();
    },
    close() {
      // Seen, reported or not: the notice about it doesn't come back.
      if (this.fromError) errorState.latest = null;
      this.$emit("input", false);
      this.dropShot();
    },
  },
};
</script>

<style scoped>
.fb-title {
  padding-bottom: 4px !important;
}
.fb-body {
  padding-bottom: 4px !important;
}
.fb-lead {
  margin-bottom: 8px;
  font-size: 14px;
  color: #37474f;
}
.fb-lead--error {
  color: #bf360c;
}
.fb-kinds {
  margin-bottom: 6px;
}
.fb-kind--on {
  color: #1565c0 !important;
  border-color: #1565c0 !important;
}
.fb-attach {
  margin-top: 8px;
}
.fb-shot {
  display: block;
  max-width: 220px;
  max-height: 124px;
  margin: 4px 0 4px 32px;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
}
.fb-note {
  font-size: 12px;
  color: #78909c;
}
.fb-privacy {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: #2e7d32;
}
.fb-privacy-icon {
  margin-top: 2px;
  color: #2e7d32 !important;
}
.fb-details {
  margin-top: 4px;
  font-size: 13px;
  color: #546e7a;
}
.fb-details summary {
  cursor: pointer;
}
.fb-details pre {
  max-height: 160px;
  overflow: auto;
  margin-top: 4px;
  padding: 6px 8px;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
  background: #f5f7f8;
  border-radius: 4px;
}
</style>
