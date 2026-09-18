/*
 * Names for icon-only buttons, taken from their tooltips.
 *
 * An icon button has no text of its own, so without a name a screen reader
 * announces it as just "button". The tooltip already says what it does; these
 * turn it into the button's name. A tooltip may end in its shortcut, "Undo
 * [Ctrl+Z]": that is left out of the name, where it would be read out as
 * "left bracket control plus Z", and given as aria-keyshortcuts instead.
 */

const TRAILING_SHORTCUT = /\s*\[([^\]]+)\]\s*$/;

/** "Undo the last change [Ctrl+Z]" -> "Undo the last change". */
export function accessibleName(tooltip) {
  if (!tooltip) return undefined;
  return String(tooltip).replace(TRAILING_SHORTCUT, "").trim() || undefined;
}

/** "Redo [Ctrl+Y or Ctrl+Shift+Z]" -> "Control+Y Control+Shift+Z". */
export function keyShortcut(tooltip) {
  let match = tooltip ? TRAILING_SHORTCUT.exec(String(tooltip)) : null;
  if (!match) return undefined;
  return match[1]
    .split(/\s+or\s+|\s*,\s*/)
    .map((keys) =>
      keys
        .trim()
        .replace(/\bCtrl\b/g, "Control")
        .replace(/\bEsc\b/g, "Escape")
    )
    .filter(Boolean)
    .join(" ");
}
