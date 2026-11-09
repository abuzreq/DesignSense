<template>
  <div class="panel-header" :class="{ 'panel-header--compact': compact }">
    <div class="panel-header-title" :title="title">
      <v-icon small class="panel-header-icon">{{ icon }}</v-icon>
      <span v-if="!compact">{{ title }}</span>
    </div>
    <div class="panel-header-main"><slot /></div>
    <div v-if="$slots.actions" class="panel-header-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script>
/**
 * The header shared by the workspace panels: a title, the panel's controls,
 * and toggles on the right. Controls opt into its look with the ph-* classes.
 */
export default {
  name: "PanelHeader",
  props: {
    icon: { type: String, required: true },
    title: { type: String, required: true },
    // Narrow panels keep only the title's icon, and their text buttons only
    // their words.
    compact: { type: Boolean, default: false },
  },
};
</script>

<style scoped>
.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  /* Grows with the icon buttons in it (PANEL_HEADER_HEIGHT, in layout.js,
     is this at 100%). */
  height: calc(40px * var(--ds-control-scale));
  padding: 0 6px 0 10px;
  box-sizing: border-box;
  flex: 0 0 auto;
  background: #f7f9fb;
  border-bottom: 1px solid #e3e8ee;
  color: #37474f;
  font-size: var(--ds-fs-md);
}
.panel-header-title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  font-weight: 600;
  white-space: nowrap;
}
.panel-header-icon.v-icon {
  color: #546e7a;
}
/* Clipped rather than spilled over the toggles on the right, should larger
   text leave its controls more than the room there is; the ellipsising hint
   gives way first. */
.panel-header-main {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}
.panel-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}

/* Controls placed in the header. */
.panel-header ::v-deep .ph-label {
  color: #546e7a;
  font-size: var(--ds-fs-sm);
  font-weight: 500;
  white-space: nowrap;
}
.panel-header ::v-deep .ph-btn--gap {
  margin-left: 6px;
}
.panel-header ::v-deep .ph-label--gap {
  margin-left: 8px;
}
.panel-header ::v-deep .ph-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #546e7a;
  font-size: var(--ds-fs-sm);
}
.panel-header ::v-deep .ph-divider {
  flex: 0 0 auto;
  width: 1px;
  height: 20px;
  margin: 0 6px;
  background: #dde3ea;
}
.panel-header ::v-deep .ph-select {
  flex: 0 1 calc(160px * var(--ds-text-scale));
  min-width: calc(90px * var(--ds-text-scale));
  margin: 0 2px 0 4px;
  font-size: var(--ds-fs-md);
}
.panel-header ::v-deep .ph-select--narrow {
  flex: 0 0 calc(68px * var(--ds-text-scale));
  min-width: calc(68px * var(--ds-text-scale));
}
/* For one holding a dimension's name, which runs to three words. The floor
   keeps a crowded header from squeezing it back to an initial or two; the
   hint beside it ellipsises, and gives way first. Past 130% the floor stops
   growing: a full-width floor at 150% pushed the colour key out of the
   parallel coordinates' header, and a name cut a little short is the
   smaller loss. */
.panel-header ::v-deep .ph-select--wide {
  flex: 0 1 calc(180px * var(--ds-text-scale));
  min-width: calc(150px * min(var(--ds-text-scale), 1.3));
}
.panel-header
  ::v-deep
  .ph-select.v-input--dense
  > .v-input__control
  > .v-input__slot {
  min-height: calc(28px * var(--ds-text-scale)) !important;
  padding: 0 2px 0 8px !important;
  background: #fff;
}
.panel-header ::v-deep .ph-select .v-input__append-inner {
  margin-top: 2px !important;
}
.panel-header ::v-deep .ph-select .v-select__selections input {
  padding: 2px 0;
}
.panel-header ::v-deep .ph-select fieldset {
  border-color: #d5dce4;
}
.panel-header ::v-deep .ph-btn.v-btn--icon {
  width: calc(28px * var(--ds-control-scale));
  height: calc(28px * var(--ds-control-scale));
  border-radius: 6px;
  color: #546e7a;
}
.panel-header ::v-deep .ph-btn--on.v-btn--icon {
  color: #1565c0;
  background: rgba(21, 101, 192, 0.12);
}
/* A narrow header's text buttons keep their words and lose their icons:
   "Dimensions" says what the scales did not, and at the larger text sizes
   the room went to the colour key. */
.panel-header--compact ::v-deep .ph-text-btn .v-icon {
  display: none;
}
.panel-header ::v-deep .ph-text-btn.v-btn {
  height: calc(28px * var(--ds-text-scale));
  padding: 0 8px;
  text-transform: none;
  letter-spacing: normal;
  font-weight: 500;
  color: #455a64;
}
</style>
