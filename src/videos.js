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

/**
 * A video's player, to embed: on YouTube's privacy-enhanced domain, which
 * sets no cookies until the video plays, and playing as soon as it is in,
 * since it is only ever put in after a click. Only the welcome embeds one.
 */
export function videoEmbed(name) {
  return (
    "https://www.youtube-nocookie.com/embed/" +
    VIDEOS[name] +
    "?autoplay=1&rel=0&modestbranding=1"
  );
}
