/*
 * The videos about DesignSense, on YouTube: a one-minute intro, and a
 * tutorial that follows the guided tour step by step. The app links to them
 * from the welcome screen, the Help menu and the tour; the guide
 * (docs/guide.md) and the README write the same links out, as markdown
 * cannot import this. A re-upload gets a new address, so it changes here and
 * there.
 */
export const VIDEOS = {
  intro: "4A_yEZ4cex4",
  tutorial: "KHVPWmzlfpQ",
};

/** A video's address on YouTube, which opens in a tab of its own. */
export function videoHref(name) {
  return "https://youtu.be/" + VIDEOS[name];
}
