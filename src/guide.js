/*
 * The guide's sections that the app links to. The guide is docs/guide.md,
 * shown over the workspace by guide/GuideDialog.vue and as a page of its own
 * at wiki/ (guide/GuidePage.vue); a section's id is its heading the way
 * GitHub writes it, so one id works in all three places. The build warns
 * when the guide links to a heading it doesn't have, and while developing
 * the guide says so in the console when asked for one, as it would be if one
 * of these stopped being a heading.
 */
export const GUIDE_SECTIONS = {
  process: "the-process-at-a-glance",
  generate: "generate",
  models: "3d-models",
  format: "prepare",
  load: "load",
  link: "from-a-link",
  workspace: "look-around",
  // The four tasks of exploring a design space, as the paper names them.
  understand: "understand",
  narrow: "narrow",
  decide: "decide",
  share: "share",
};

// The guide as a page of its own, beside the app's.
export const GUIDE_PAGE = "wiki/";

/**
 * The address of the guide's page, or of one of its sections there: for a
 * link that opens beside the app. Inside the app, the store's `openGuide`
 * shows the same section over the workspace.
 */
export function guideHref(section) {
  return GUIDE_PAGE + (section ? "#" + section : "");
}
