<template>
  <div class="panel-header">
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
    // Narrow panels keep only the icon.
    compact: { type: Boolean, default: false },
  },
};
</script>

<style scoped>
.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 6px 0 10px;
  box-sizing: border-box;
  flex: 0 0 auto;
  background: #f7f9fb;
  border-bottom: 1px solid #e3e8ee;
  color: #37474f;
  font-size: 13px;
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
  color: #607d8b;
}
.panel-header-main {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1 1 auto;
  min-width: 0;
}
.panel-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}

/* Controls placed in the header. */
.panel-header ::v-deep .ph-label {
  color: #78909c;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.panel-header ::v-deep .ph-label--gap {
  margin-left: 8px;
}
.panel-header ::v-deep .ph-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #607d8b;
  font-size: 12px;
}
.panel-header ::v-deep .ph-divider {
  flex: 0 0 auto;
  width: 1px;
  height: 20px;
  margin: 0 6px;
  background: #dde3ea;
}
.panel-header ::v-deep .ph-select {
  flex: 0 1 160px;
  min-width: 90px;
  margin: 0 2px 0 4px;
  font-size: 13px;
}
.panel-header ::v-deep .ph-select--narrow {
  flex: 0 0 68px;
  min-width: 68px;
}
.panel-header
  ::v-deep
  .ph-select.v-input--dense
  > .v-input__control
  > .v-input__slot {
  min-height: 28px !important;
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
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: #607d8b;
}
.panel-header ::v-deep .ph-btn--on.v-btn--icon {
  color: #1565c0;
  background: rgba(21, 101, 192, 0.12);
}
.panel-header ::v-deep .ph-text-btn.v-btn {
  height: 28px;
  padding: 0 8px;
  text-transform: none;
  letter-spacing: normal;
  font-weight: 500;
  color: #455a64;
}
</style>
