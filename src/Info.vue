<template>
  <!-- The page scrolls itself: the app keeps the body from scrolling. -->
  <div class="ab-page">
    <header class="ab-bar">
      <router-link to="/" class="ab-brand"
        >DesignSense<sup class="ab-stage">beta</sup></router-link
      >
      <v-spacer />
      <v-btn color="primary" depressed to="/">Open DesignSense</v-btn>
    </header>

    <main class="ab-main">
      <section class="ab-hero">
        <h1 class="ab-title">Explore a design space, and decide with others</h1>
        <p class="ab-lead">
          DesignSense turns a table of generated design options (their
          parameters, their performance, their pictures and 3D models) into
          linked views for narrowing them down to the few worth taking forward,
          seeing the trade-offs between them, and sharing why.
        </p>
      </section>

      <figure class="ab-figure">
        <router-link to="/">
          <img :src="screenshot" alt="DesignSense exploring 648 window designs" />
        </router-link>
        <figcaption>
          648 window designs from the Windows study of Design Explorer. Two
          filters in the bar narrow them to 224; arrows mark which way is better
          for each output; the inspected option carries a rating and a note.
        </figcaption>
      </figure>

      <section class="ab-flow-section">
        <h2 class="ab-heading">A typical session</h2>
        <p class="ab-flow-lead">
          Say an architect has 648 window designs, each simulated for cooling,
          heating, lighting and daylight, and needs to bring a few to the
          client. With DesignSense it goes like this; any step can send them
          back to an earlier one.
        </p>
        <ol class="ab-flow">
          <li v-for="(step, i) in flow" :key="step.title" class="ab-step">
            <div class="ab-step-head">
              <span class="ab-step-num">{{ i + 1 }}</span>
              <v-icon color="primary" class="ab-step-icon">{{ step.icon }}</v-icon>
            </div>
            <div class="ab-step-title">{{ step.title }}</div>
            <div class="ab-step-text">{{ step.text }}</div>
            <div class="ab-step-example">{{ step.example }}</div>
          </li>
        </ol>
      </section>

      <section>
        <h2 class="ab-heading">What it does</h2>
        <div class="ab-features">
          <div v-for="feature in features" :key="feature.title" class="ab-feature">
            <v-icon class="ab-feature-icon" color="primary">{{ feature.icon }}</v-icon>
            <div>
              <div class="ab-feature-title">{{ feature.title }}</div>
              <div class="ab-feature-text">{{ feature.text }}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="ab-paper">
        <h2 class="ab-heading">The research</h2>
        <div class="ab-paper-title">
          <a :href="paperUrl" target="_blank" rel="noopener"
            >Designing with sense: A critical review and proposal for enhanced
            design space exploration in generative design</a
          >
        </div>
        <div class="ab-authors">
          <a href="https://abuzreq.com/" target="_blank" rel="noopener">Ahmed M. Abuzuraiq</a>
          and
          <a href="https://www.sfu.ca/~herhan/" target="_blank" rel="noopener">Halil Erhan</a>
          · International Journal of Architectural Computing, 2024
        </div>
        <details class="ab-abstract">
          <summary>Abstract</summary>
          <p>
            Designers in the built-environment disciplines increasingly solve
            problems using generative design methods, which promise novel and
            performant solutions to design problems but produce large design
            spaces that are challenging to explore. Design Space Exploration
            (DSE) interfaces have been used to understand, refine and narrow
            design spaces. Still, a critical analysis of current DSE interfaces
            shows a gap between their features and how designers explore and
            make decisions. We conducted a design study with domain experts to
            develop a DSE interface (DesignSense) that tightly integrates and
            adds to several features found separately in current DSE systems.
            We present a formative focus group evaluation, which suggested more
            areas for improvement and highlighted the need to distinguish
            designers from scientists as two user groups of DSE systems with
            varying needs, amongst other findings.
          </p>
        </details>
        <div class="ab-links">
          <v-btn small outlined color="primary" :href="paperUrl" target="_blank" rel="noopener">
            <v-icon small left>mdi-file-document-outline</v-icon>Read the paper
          </v-btn>
          <v-btn small outlined color="primary" to="/">
            <v-icon small left>mdi-presentation-play</v-icon>Try it
          </v-btn>
        </div>
      </section>

      <footer class="ab-foot">
        DesignSense v{{ version }} is a research project and still changing.
        Feedback is welcome, from <b>Help → Send feedback</b> in the app.
      </footer>
    </main>
  </div>
</template>

<script>
import screenshot from "@/assets/designsense_windows.jpg";
import { APP_VERSION } from "@/feedback.js";

const FEATURES = [
  {
    icon: "mdi-view-dashboard-outline",
    title: "Linked views",
    text:
      "A gallery of pictures and 3D models, parallel coordinates, a scatterplot and a scatterplot matrix. Narrow the options in one and every view follows.",
  },
  {
    icon: "mdi-filter-outline",
    title: "Narrow by brushing",
    text:
      "Drag over any chart to filter. Each filter becomes a chip you can remove, with undo. Expert mode adds selection operations: add, subtract, intersect.",
  },
  {
    icon: "mdi-scale-balance",
    title: "Goals and best trade-offs",
    text:
      "Say which way is better for each output, then find the options no other beats on every goal, and the outliers.",
  },
  {
    icon: "mdi-star-outline",
    title: "Judge options your way",
    text:
      "Rate options with stars, write notes on them, and add custom and weighted dimensions to weigh criteria of your own.",
  },
  {
    icon: "mdi-bookmark-multiple-outline",
    title: "Shortlist and compare",
    text:
      "Keep candidates aside while you keep looking, compare them side by side, and save any result as a set with the filters that made it.",
  },
  {
    icon: "mdi-chart-box-outline",
    title: "Analysis",
    text:
      "Each dimension's spread and distribution, and which inputs move which outputs.",
  },
  {
    icon: "mdi-console-line",
    title: "Ask or command",
    text:
      "Type what you want in plain words, such as the cheapest options with high daylight, and the assistant does it. It runs in your browser.",
  },
  {
    icon: "mdi-presentation-play",
    title: "Tell the story",
    text:
      "Capture views as you go, present them in a meeting, or turn them into a PDF report or a one-image summary for stakeholders.",
  },
  {
    icon: "mdi-shield-check-outline",
    title: "Your data stays with you",
    text:
      "Open a CSV from your computer, a link or a shared folder. It is read in the browser and never uploaded; your work is kept in this browser.",
  },
];

// A session from first look to the result, as the page's steps.
const FLOW = [
  {
    icon: "mdi-chart-scatter-plot",
    title: "Find patterns, filter",
    text: "Read the charts for trends and trade-offs, then brush them to keep only the options that meet your targets.",
    example: "Daylight in the top half, cooling below 1,850 kWh: 224 left.",
  },
  {
    icon: "mdi-image-multiple-outline",
    title: "Pick in the gallery",
    text: "Scan the pictures of the options still in play, and pick out the promising ones.",
    example: "The deep-set windows on the south face look right.",
  },
  {
    icon: "mdi-eye-outline",
    title: "Inspect",
    text: "Open one option at a time to see it up close, with its values and where it stands among the rest.",
    example: "Low cooling, good daylight, but more heating.",
  },
  {
    icon: "mdi-star-outline",
    title: "Shortlist or rate",
    text: "Keep candidates on the shortlist, give them stars, and note why.",
    example: "Four stars: “check glare on the south face.”",
  },
  {
    icon: "mdi-content-save-outline",
    title: "Save or compare",
    text: "Save a result as a set with the filters that made it, or compare the shortlist side by side.",
    example: "The three shortlisted, side by side.",
  },
  {
    icon: "mdi-presentation-play",
    title: "Share the result",
    text: "Present the views captured along the way, or export a PDF report, a one-image summary, or the options as a table.",
    example: "A one-page summary for the client meeting.",
  },
];

export default {
  name: "Info",
  data() {
    return {
      screenshot: screenshot,
      flow: FLOW,
      features: FEATURES,
      version: APP_VERSION,
      paperUrl: "https://journals.sagepub.com/doi/10.1177/14780771241260854",
    };
  },
};
</script>

<style scoped>
.ab-page {
  height: 100vh;
  overflow-y: auto;
  background: #fafbfc;
  color: #263238;
}
.ab-bar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  padding: 10px 24px;
  background: #272727;
}
.ab-brand {
  font-size: 20px;
  font-weight: 500;
  color: #fff !important;
  text-decoration: none;
}
.ab-stage {
  margin-left: 2px;
  font-size: 10px;
  color: deepskyblue;
}
.ab-main {
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 24px 48px;
}
.ab-hero {
  max-width: 760px;
}
.ab-title {
  margin: 0 0 10px;
  font-size: 32px;
  line-height: 1.2;
  font-weight: 600;
}
.ab-lead {
  font-size: 17px;
  line-height: 1.55;
  color: #455a64;
}
.ab-figure {
  margin: 24px 0 36px;
}
.ab-figure img {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid #dfe5e8;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(38, 50, 56, 0.12);
}
.ab-figure figcaption {
  margin-top: 10px;
  font-size: 13px;
  color: #607d8b;
}
.ab-heading {
  margin: 0 0 16px;
  font-size: 22px;
  font-weight: 600;
}
.ab-flow-section {
  margin-bottom: 40px;
}
.ab-flow-lead {
  max-width: 760px;
  font-size: 15px;
  line-height: 1.55;
  color: #455a64;
}
/* Six steps in a row with arrows between them; two rows of three, then one
   column, as the page narrows. */
.ab-flow {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 22px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ab-step {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 14px 14px 12px;
  background: #fff;
  border: 1px solid #e3e8eb;
  border-top: 3px solid #1976d2;
  border-radius: 8px;
}
.ab-step:not(:last-child)::after {
  content: "";
  position: absolute;
  top: 26px;
  right: -17px;
  border: 7px solid transparent;
  border-left: 9px solid #90a4ae;
}
.ab-step-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.ab-step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: #1976d2;
  border-radius: 50%;
}
.ab-step-title {
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
}
.ab-step-text {
  flex: 1 1 auto;
  font-size: 13px;
  line-height: 1.45;
  color: #546e7a;
}
.ab-step-example {
  margin-top: 10px;
  padding-top: 8px;
  font-size: 12px;
  font-style: italic;
  line-height: 1.4;
  color: #78909c;
  border-top: 1px dashed #e3e8eb;
}
@media (max-width: 1000px) {
  .ab-flow {
    grid-template-columns: repeat(3, 1fr);
  }
  .ab-step:nth-child(3)::after {
    display: none;
  }
}
@media (max-width: 600px) {
  .ab-flow {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .ab-step:nth-child(3)::after,
  .ab-step:not(:last-child)::after {
    display: block;
    top: auto;
    right: auto;
    bottom: -17px;
    left: 24px;
    border: 7px solid transparent;
    border-top: 9px solid #90a4ae;
  }
}
.ab-features {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 14px;
}
.ab-feature {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #e3e8eb;
  border-radius: 8px;
}
.ab-feature-icon {
  flex: 0 0 auto;
  align-self: flex-start;
  margin-top: 1px;
}
.ab-feature-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 3px;
}
.ab-feature-text {
  font-size: 14px;
  line-height: 1.45;
  color: #546e7a;
}
.ab-paper {
  margin-top: 40px;
  padding: 20px 22px;
  background: #fff;
  border: 1px solid #e3e8eb;
  border-radius: 8px;
}
.ab-paper-title {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.4;
}
.ab-paper-title a,
.ab-authors a {
  text-decoration: none;
}
.ab-authors {
  margin-top: 4px;
  font-size: 14px;
  color: #607d8b;
}
.ab-abstract {
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.55;
  color: #455a64;
}
.ab-abstract summary {
  cursor: pointer;
  font-weight: 500;
  color: #37474f;
}
.ab-abstract p {
  margin: 8px 0 0;
}
.ab-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.ab-links .v-btn {
  text-transform: none;
  letter-spacing: 0;
}
.ab-foot {
  margin-top: 32px;
  font-size: 13px;
  color: #78909c;
}
@media (max-width: 600px) {
  .ab-title {
    font-size: 24px;
  }
  .ab-main {
    padding: 20px 16px 32px;
  }
  .ab-bar {
    padding: 8px 16px;
  }
}
</style>
