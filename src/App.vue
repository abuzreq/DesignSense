<template>
  <v-app>
    <span
      id="designsense-center"
      style="display: none; position: relative; left: 50%; top: 50%"
    ></span>

    <v-main id="designsense-workspace" style="padding: 0">
      <router-view></router-view>
    </v-main>
  </v-app>
</template>

<script>
import Vue from "vue";

export default {
  name: "App",
  components: {},
  data: function() {
    return {
    };
  },
  created() {
    

  },
};
</script>
<style>
/*
 * The type scale.
 *
 *   10  the smallest thing drawn: a badge, the label inside a layout figure
 *   11  a label under an icon, a caption, an axis tick
 *   12  dense controls -- chips, menu notes, a table's cells
 *   13  the interface's ordinary text
 *   14  prose in a dialog
 *   15  a dialog's opening paragraph
 *   16  a subheading
 *   18  a dialog's title, the app's name
 *   20  and above: a report's headings, which are print rather than interface
 *
 * Sizes between those steps are worth nothing: half a pixel is invisible and
 * an unlearnable system costs more than it saves. The 9, 11.5, 12.5, 17px and
 * 1.1rem that had accumulated are gone, each rounded to the step above it.
 *
 * Two deliberate exceptions. The guide (src/guide/guide.css) keeps a scale of
 * its own: it is a document to read, not an interface to use, and its sizes
 * answer to line length rather than to this list. And a few sizes are relative
 * on purpose -- the goal arrow after a dimension's name is 0.85em, so it
 * follows whatever it is set beside rather than any step here.
 *
 * The steps are the tokens below, and every interface size is one of them:
 * a new rule picks a step, never a pixel size. All of them are multiplied by
 * --ds-text-scale, the reader's text size (src/textSize.js: 100% to 150%),
 * and so is the root size Vuetify's own rem-based text is measured in. The
 * guide multiplies its own sizes by the same scale. What becomes an image or
 * a PDF -- the summary card, the story report's pages -- keeps fixed sizes,
 * so it looks the same wherever it is sent.
 */
:root {
  --ds-text-scale: 1;
  --ds-fs-2xs: calc(10px * var(--ds-text-scale));
  --ds-fs-xs: calc(11px * var(--ds-text-scale));
  --ds-fs-sm: calc(12px * var(--ds-text-scale));
  --ds-fs-md: calc(13px * var(--ds-text-scale));
  --ds-fs-base: calc(14px * var(--ds-text-scale));
  --ds-fs-lg: calc(15px * var(--ds-text-scale));
  --ds-fs-xl: calc(16px * var(--ds-text-scale));
  --ds-fs-2xl: calc(18px * var(--ds-text-scale));
  --ds-fs-3xl: calc(20px * var(--ds-text-scale));
  --ds-fs-4xl: calc(24px * var(--ds-text-scale));
  /* Icons, at two rates (see src/textSize.js). An icon that goes with text
     grows with it; an icon-only control at half the rate, 125% at the
     largest size. --ds-icon-scale is the one an icon is drawn at: the
     text's, except inside an icon-only control, which sets it below. */
  --ds-control-scale: calc(1 + (var(--ds-text-scale) - 1) / 2);
  --ds-icon-scale: var(--ds-text-scale);
}
/* html:root, not html: Vuetify sets the root size itself, and this has to
   win whichever stylesheet comes last. */
html:root {
  font-size: calc(16px * var(--ds-text-scale));
}

/*
 * Vuetify's own text, onto the scale. It writes most of its sizes in rem,
 * which the root above scales, but these in pixels: chips, badges, form
 * fields and their labels, messages, tooltips. Each gets its step here, and
 * the box around it the same multiplier, so text never comes to fill its
 * box at the larger sizes. Icons have rules of their own, below.
 *
 * The same goes for any box sized to hold text: a dialog of a fixed width is
 * given it as `min(calc(Npx * var(--ds-text-scale)), 94vw)` (Vuetify passes
 * a width that isn't a number straight to the style), a header's picker
 * likewise, so their text wraps at the same words at every size.
 */
.v-application .v-chip.v-size--x-small {
  font-size: var(--ds-fs-2xs);
  height: calc(16px * var(--ds-text-scale));
}
.v-application .v-chip.v-size--small {
  font-size: var(--ds-fs-sm);
  height: calc(24px * var(--ds-text-scale));
  border-radius: calc(12px * var(--ds-text-scale));
}
.v-application .v-chip.v-size--default {
  font-size: var(--ds-fs-base);
  height: calc(32px * var(--ds-text-scale));
  border-radius: calc(16px * var(--ds-text-scale));
}
/* A badge sits on the corner of an icon button, so it grows as the button
   does: faster, and it would come to cover the icon. */
.v-application .v-badge__badge {
  font-size: calc(12px * var(--ds-control-scale));
  height: calc(20px * var(--ds-control-scale));
  min-width: calc(20px * var(--ds-control-scale));
  border-radius: calc(10px * var(--ds-control-scale));
  padding: calc(4px * var(--ds-control-scale)) calc(6px * var(--ds-control-scale));
}
.v-application .v-input,
.v-application .v-label {
  font-size: var(--ds-fs-xl);
}
.v-application .v-input .v-label {
  height: calc(20px * var(--ds-text-scale));
  line-height: calc(20px * var(--ds-text-scale));
}
.v-application .v-input input {
  max-height: calc(32px * var(--ds-text-scale));
}
.v-application .v-messages {
  font-size: var(--ds-fs-sm);
}
.v-application .v-messages__message {
  line-height: calc(12px * var(--ds-text-scale));
}
.v-tooltip__content {
  font-size: var(--ds-fs-base) !important;
  line-height: calc(22px * var(--ds-text-scale)) !important;
}
.v-application .v-btn:not(.v-btn--icon):not(.v-btn--fab):not(.v-btn--round).v-size--x-small {
  height: calc(20px * var(--ds-text-scale));
}
.v-application .v-btn:not(.v-btn--icon):not(.v-btn--fab):not(.v-btn--round).v-size--small {
  height: calc(28px * var(--ds-text-scale));
}
.v-application .v-btn:not(.v-btn--icon):not(.v-btn--fab):not(.v-btn--round).v-size--default {
  height: calc(36px * var(--ds-text-scale));
}

/*
 * Icons. Every v-icon is drawn 1em square (MdiIcon.vue), so its font size
 * is its size. A size given as a prop already comes out of Vuetify times
 * --ds-icon-scale (plugins/vuetify.js); these are the sizes Vuetify's own
 * stylesheet gives, at the same scale. Inside an icon-only control the
 * scale is the control's, and the control's box grows by it too, so an
 * icon keeps its margin in its button at every size. Anything else that
 * draws an icon -- a glyph over a card, the rating's stars -- writes its
 * size as calc(Npx * var(--ds-icon-scale)) and gets the same treatment.
 */
/* ds-icon-control: for an icon that acts as a control without being an
   icon button, such as an info icon beside a header's buttons. */
.v-application .v-btn--icon,
.v-application .v-btn--fab,
.ds-icon-control {
  --ds-icon-scale: var(--ds-control-scale);
}
.v-application .v-icon.v-icon {
  font-size: calc(24px * var(--ds-icon-scale));
}
.v-application .v-icon.v-icon.v-icon--dense {
  font-size: calc(20px * var(--ds-icon-scale));
}
.v-application .v-btn__content .v-icon.v-icon--left,
.v-application .v-btn__content .v-icon.v-icon--right {
  font-size: calc(18px * var(--ds-icon-scale));
  height: calc(18px * var(--ds-icon-scale));
  width: calc(18px * var(--ds-icon-scale));
}
.v-application .v-btn--icon.v-size--x-small .v-icon {
  font-size: calc(18px * var(--ds-icon-scale));
  height: calc(18px * var(--ds-icon-scale));
  width: calc(18px * var(--ds-icon-scale));
}
.v-application .v-btn--icon.v-size--small .v-icon,
.v-application .v-btn--icon.v-size--default .v-icon {
  font-size: calc(24px * var(--ds-icon-scale));
  height: calc(24px * var(--ds-icon-scale));
  width: calc(24px * var(--ds-icon-scale));
}
.v-application .v-btn--icon.v-size--x-small {
  height: calc(20px * var(--ds-control-scale));
  width: calc(20px * var(--ds-control-scale));
}
.v-application .v-btn--icon.v-size--small {
  height: calc(28px * var(--ds-control-scale));
  width: calc(28px * var(--ds-control-scale));
}
.v-application .v-btn--icon.v-size--default {
  height: calc(36px * var(--ds-control-scale));
  width: calc(36px * var(--ds-control-scale));
}
.v-application .v-btn--icon.v-size--large {
  height: calc(44px * var(--ds-control-scale));
  width: calc(44px * var(--ds-control-scale));
}
.v-application .v-chip .v-icon {
  font-size: calc(24px * var(--ds-icon-scale));
}
.v-application .v-chip .v-chip__close.v-icon {
  font-size: calc(18px * var(--ds-icon-scale));
  max-height: calc(18px * var(--ds-icon-scale));
  max-width: calc(18px * var(--ds-icon-scale));
}
.v-application .v-alert__icon.v-icon {
  font-size: calc(24px * var(--ds-icon-scale));
}
/* A field's arrow and a checkbox's box are sized by the box around them. */
.v-application .v-input__icon {
  height: calc(24px * var(--ds-icon-scale));
  min-width: calc(24px * var(--ds-icon-scale));
  width: calc(24px * var(--ds-icon-scale));
}
.v-application .v-input--selection-controls__input {
  height: calc(24px * var(--ds-icon-scale));
  width: calc(24px * var(--ds-icon-scale));
}

/*
 * The wordmark's typeface, for the app's name in the bar and nothing else.
 * One variable file covering 300 to 700, the latin subset, 36 kB, served from
 * here rather than from Google: the name is worth a light weight beside a bold
 * one, and the font the bar had offers only regular and bold -- 300, 400 and
 * 500 all drew the same glyphs. `swap` so the name is readable in the fallback
 * while the file arrives. DM Sans, SIL Open Font License 1.1 (see
 * assets/DM-Sans-OFL.txt).
 */
@font-face {
  font-family: "DM Sans";
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url("~@/assets/dm-sans-latin.woff2") format("woff2");
}

/*
 * Where keyboard focus is. Vuetify only tints a focused button, by 12% on a
 * light panel and 24% on the dark bar, which is easy to lose among a row of
 * icons. :focus-visible leaves mouse clicks without a ring; the keyboard gets
 * one on everything it can reach.
 */
.v-application button:focus-visible,
.v-application a:focus-visible,
.v-application [role="button"]:focus-visible,
.v-application [tabindex]:not([tabindex="-1"]):focus-visible {
  outline: 2px solid var(--ds-focus);
  outline-offset: 2px;
}
.v-application .v-app-bar button:focus-visible,
.v-application .v-app-bar [role="button"]:focus-visible {
  outline-color: #fff;
}

/*
 * The inspected option's mark, pulsing.
 *
 * A near-solid band of the mark's own colour sits against the card and goes
 * from full strength to all but out on a sine, one and a third seconds
 * round. It is at full strength the instant the class lands: inspection is
 * usually ordered from somewhere else -- a line in the parallel
 * coordinates, a point in the scatterplot -- so the mark has to be loudest
 * first and settle afterwards rather than the other way round.
 *
 * Drawn as a shadow and not as a border, because a shadow is sized by its
 * spread and softened by its blur independently, and that is what made it
 * tunable. Five pixels of spread with two of blur fills the gutter to about
 * six and stops short of the neighbour's own edge at eight, with just
 * enough softness not to read as a second frame around the first. At its
 * peak it covers the resting ring, so the two read as one mark thickening;
 * at its trough the ring is what is left.
 *
 * Earlier attempts were a second ring, which had nowhere to go -- the gap
 * between two cards is eight pixels and the resting ring already stands in
 * two to five of them -- and then a wide, soft wash, which read as a smudge
 * rather than as a mark. This is the middle: a shadow's shape, used at a
 * ring's hardness.
 *
 * Outward in the gallery, inward in the clusters and the shortlist strip,
 * which clip their own children; an inset shadow is the same gesture turned
 * around, sized down for cards a third the size.
 *
 * The colour comes from `color` so that the shadows can say currentColor
 * and keep the state token; the strength is opacity, which is also the one
 * property here that composites, so nothing is laid out per frame.
 */
/* Duration and curve in one place, since all three use them and this has
   taken some tuning to settle. cubic-bezier(0.37, 0, 0.63, 1) is the usual
   stand-in for a sine ease, which CSS has no keyword for. */
:root {
  --ds-pulse: 1300ms cubic-bezier(0.37, 0, 0.63, 1) infinite;
}
@keyframes ds-inspected-pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.06;
  }
  100% {
    opacity: 1;
  }
}
/* Only the breathing goes, and each rule rests at full strength, so what is
   left without it is the mark at its loudest rather than nothing. */
@media (prefers-reduced-motion: reduce) {
  .thumbnail_card.hovered::after,
  .cluster-card.hovered::after,
  .cart-thumb--inspected::after {
    animation: none;
  }
}

a {
  color: #000;
  text-decoration: none;
}

a:hover {
  color: #8a5ed3;
}

img {
  border: none;
}

strong,
b {
  font-weight: 600;
}
</style>
