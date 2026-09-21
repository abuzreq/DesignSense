<template>
  <div class="report-cover" :style="{ width: width + 'px', height: height + 'px' }">
    <div class="rc-top">
      <div class="rc-kicker">Design options report</div>
      <h1 class="rc-title">{{ title }}</h1>
      <div class="rc-subtitle">{{ subtitle }}</div>
      <div v-if="goals.length > 0" class="rc-goals">
        <span class="rc-label">What we're after</span>
        <span v-for="goal in goals" :key="goal.dim" class="rc-chip">
          <b>{{ goal.mark }}</b> {{ goal.name }}
        </span>
      </div>
    </div>

    <div class="rc-contents">
      <div class="rc-label">Contents</div>
      <ol class="rc-list" :class="{ 'rc-list--two': views.length > 5 }">
        <li v-for="(view, i) in views" :key="view.id">
          <span class="rc-number">{{ i + 1 }}</span>
          <div class="rc-entry">
            <div class="rc-entry-title">{{ view.title }}</div>
            <div v-if="view.note" class="rc-entry-note">{{ view.note }}</div>
          </div>
        </li>
      </ol>
    </div>

    <footer class="rc-foot">{{ footer }}</footer>
  </div>
</template>

<script>
/**
 * A report's first page: its title, the goals, and the views that follow,
 * each with its note. The same size as a SummaryCard, so every page of the
 * PDF matches.
 */
export default {
  name: "ReportCover",
  props: {
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    goals: { type: Array, default: () => [] },
    // [{ id, title, note }]
    views: { type: Array, default: () => [] },
    footer: { type: String, default: "Made with DesignSense" },
    width: { type: Number, default: 1600 },
    height: { type: Number, default: 900 },
  },
};
</script>

<style scoped>
.report-cover {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 64px 72px 28px;
  background: #fff;
  color: #263238;
  font-family: Roboto, "Segoe UI", Arial, sans-serif;
  overflow: hidden;
}
.rc-top {
  padding-bottom: 28px;
  border-bottom: 3px solid #263238;
}
.rc-kicker {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #78909c;
}
.rc-title {
  margin: 10px 0 0;
  font-size: 56px;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.rc-subtitle {
  margin-top: 12px;
  font-size: 20px;
  color: #607d8b;
}
.rc-goals {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 22px;
}
.rc-label {
  margin-right: 8px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #78909c;
}
.rc-chip {
  padding: 5px 14px;
  border-radius: 16px;
  background: #eceff1;
  font-size: 17px;
}
.rc-contents {
  flex: 1;
  min-height: 0;
  padding-top: 28px;
  overflow: hidden;
}
.rc-contents > .rc-label {
  display: block;
  margin-bottom: 14px;
}
.rc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 16px 48px;
}
.rc-list--two {
  grid-template-columns: 1fr 1fr;
}
.rc-list li {
  display: flex;
  gap: 14px;
  min-width: 0;
}
.rc-number {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #263238;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  line-height: 30px;
  text-align: center;
}
.rc-entry {
  min-width: 0;
}
.rc-entry-title {
  font-size: 20px;
  font-weight: 600;
}
.rc-entry-note {
  margin-top: 3px;
  font-size: 15px;
  line-height: 1.4;
  color: #546e7a;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.rc-foot {
  padding-top: 10px;
  font-size: 13px;
  color: #90a4ae;
  text-align: right;
}
</style>
