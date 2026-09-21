/*
 * What a summary image shows: one set of choices for every summary image,
 * whether of the screen or of a captured view, and for every page of the
 * story report. Kept in localStorage for all datasets, as a preference.
 *
 *   goals, featured, chart (the scatterplot), parallel, findings: sections;
 *   context: the other options drawn in grey behind the result in the
 *   charts. Without them, the charts hold only the result and the shortlist
 *   or set pictured, and their axes fit those.
 *   highlight: that shortlist or set ringed in the charts. Without it, its
 *   options are drawn like any other in the result.
 *   pictures: "large", "medium" or "small": smaller pictures fit more
 *   options on the card (see SummaryCard's cardLayout).
 */

export const PICTURE_SIZES = ["large", "medium", "small"];

export const SUMMARY_SETTINGS_KEY = "designsense-summary-settings-v1";

export const DEFAULT_SUMMARY_SETTINGS = Object.freeze({
  goals: true,
  featured: true,
  chart: true,
  parallel: false,
  findings: true,
  context: true,
  highlight: true,
  pictures: "large",
});

/** The saved choices over the defaults; anything unreadable is left at its default. */
export function parseSummarySettings(text) {
  let settings = Object.assign({}, DEFAULT_SUMMARY_SETTINGS);
  let parsed = null;
  try {
    parsed = typeof text === "string" && text ? JSON.parse(text) : null;
  } catch (e) {
    parsed = null;
  }
  if (parsed && typeof parsed === "object") {
    Object.keys(DEFAULT_SUMMARY_SETTINGS).forEach((key) => {
      if (typeof parsed[key] === "boolean" && typeof settings[key] === "boolean") settings[key] = parsed[key];
    });
    if (PICTURE_SIZES.indexOf(parsed.pictures) !== -1) settings.pictures = parsed.pictures;
  }
  return settings;
}

export function loadSummarySettings() {
  try {
    return parseSummarySettings(localStorage.getItem(SUMMARY_SETTINGS_KEY));
  } catch (e) {
    return Object.assign({}, DEFAULT_SUMMARY_SETTINGS);
  }
}

export function saveSummarySettings(settings) {
  try {
    localStorage.setItem(SUMMARY_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    /* kept until the page is reloaded */
  }
}

/**
 * The sections a card shows for one summary: the choices, less a chart the
 * view had nothing for.
 */
export function shownFor(settings, summary) {
  return Object.assign({}, settings, {
    chart: !!(settings.chart && summary.chart),
    parallel: !!(settings.parallel && summary.parallel),
  });
}
