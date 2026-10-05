/*
 * Links into the app: an address that opens DesignSense and has it do one
 * thing, so the guide can say "try it" from anywhere it is read -- GitHub,
 * the wiki page, or the guide's own dialog over the workspace.
 *
 *   https://designsense.app/?sample=windows    open a sample (data/presets.js)
 *   https://designsense.app/?tour=decide       start the tour, at one of its tasks
 *   https://designsense.app/?open=load         open a dialog: load, dimensions
 *
 * Nothing here knows the app, so the wiki page can read the same links.
 */

const APP = /^https:\/\/designsense\.app\/?(\?[^#]*)?$/i;
const NAMES = ["sample", "tour", "open"];
// Where the tour can be entered, and the dialogs a link can open.
export const TOUR_TASKS = ["start", "understand", "narrow", "decide", "share"];
export const OPENABLE = ["load", "dimensions"];

function read(query) {
  let found = {};
  let any = false;
  String(query || "")
    .replace(/^\?/, "")
    .split("&")
    .forEach((part) => {
      let at = part.indexOf("=");
      if (at < 1) return;
      let name = part.slice(0, at);
      if (NAMES.indexOf(name) === -1) return;
      let value = part.slice(at + 1);
      try {
        value = decodeURIComponent(value);
      } catch (e) {
        /* taken as written */
      }
      found[name] = value.toLowerCase();
      any = true;
    });
  if (found.tour && TOUR_TASKS.indexOf(found.tour) === -1) found.tour = "start";
  if (found.open && OPENABLE.indexOf(found.open) === -1) delete found.open;
  return any ? found : null;
}

/**
 * What the page's address asked for when the app opened and the workspace
 * has yet to do: the tour to start, or the dialog to open. `asked` stays
 * true, so nothing else greets a visitor who came for one of these.
 */
export const pendingAppLink = { asked: false, tour: null, open: null };

/**
 * What a link in the guide asks of the app: null when it isn't a link to the
 * app, `{}` when it is the app and nothing more, else what its query names.
 * `query` is that query as written, to carry to the app's own address.
 */
export function parseAppLink(href) {
  let match = APP.exec(String(href || ""));
  if (!match) return null;
  return Object.assign({ query: match[1] || "" }, read(match[1]));
}

/** The same, read from the page's own address when the app opens. */
export function readAppLink(location) {
  return read(location.search);
}

/** The page's address without what readAppLink reads, so a reload doesn't repeat it. */
export function withoutAppLink(location) {
  let kept = location.search
    .replace(/^\?/, "")
    .split("&")
    .filter((part) => part !== "" && NAMES.indexOf(part.split("=")[0]) === -1);
  return (
    location.pathname +
    (kept.length > 0 ? "?" + kept.join("&") : "") +
    location.hash
  );
}
