/*
 * Turns a Markdown file into HTML at build time, for html-loader to pick the
 * images out of. docs/guide.md is the one this is for: GitHub renders the file
 * as it is, and the guide in the app and on the wiki page shows what comes out
 * of here, so they can't drift apart and no Markdown library reaches the
 * browser.
 *
 * The file may ask for more than Markdown has, in ways GitHub either renders
 * itself or doesn't show at all, so it never reads as stray syntax there:
 *
 *   > [!TIP]  > [!NOTE]  > [!WARNING]     a callout (GitHub's own alerts)
 *   <img align="right" width="380" …>     a picture with the text beside it
 *   <!-- contents --> before a list       the guide's contents, by part
 *   <!-- cards --> before a list          the list's items as cards
 *   <!-- tabs --> … <!-- /tabs -->        the ### sections between, as tabs
 *   <!-- live: name --> before a picture  a live example in the picture's
 *                                         place (see src/guide/live)
 *
 * A link to https://designsense.app/?sample=…, ?tour=… or ?open=… is one into
 * the app (see src/appLinks.js) and is drawn as a button.
 */
const MarkdownIt = require('markdown-it');
const anchor = require('markdown-it-anchor');

// The id GitHub gives a heading, so a "#the-file-format" link written in the
// file lands on the same heading in both places.
function githubSlug(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

const md = new MarkdownIt({ html: true }).use(anchor, {
  slugify: githubSlug,
  tabIndex: false,
});

const APP_LINK = /^https:\/\/designsense\.app\/\?(sample|tour|open)=/i;

// A link out of the app opens beside it rather than in its place.
const renderLink =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet('href') || '';
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener');
  }
  if (APP_LINK.test(href)) tokens[idx].attrJoin('class', 'md-try');
  return renderLink(tokens, idx, options, env, self);
};

// A wide table scrolls inside its own box instead of widening the page.
md.renderer.rules.table_open = () => '<div class="md-table"><table>\n';
md.renderer.rules.table_close = () => '</table></div>\n';

// "<!-- contents -->" or "<!-- cards -->" names the list that follows it.
const LIST_MARKER = /^<!--\s*(contents|cards)\s*-->\s*$/;
md.core.ruler.push('list_markers', (state) => {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].type !== 'html_block') continue;
    const marker = tokens[i].content.match(LIST_MARKER);
    if (!marker || tokens[i + 1].type !== 'bullet_list_open') continue;
    tokens[i + 1].attrJoin('class', 'md-' + marker[1]);
    tokens[i].content = '';
  }
});

const CALLOUTS = {
  TIP: 'Tip',
  NOTE: 'Note',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
  CAUTION: 'Caution',
};

/** GitHub's alerts: a quote whose first line is "[!TIP]" and the like. */
function callouts(html) {
  return html.replace(
    /<blockquote>\s*<p>\[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION)\]\s*/g,
    (match, kind) =>
      '<blockquote class="md-callout md-callout--' + kind.toLowerCase() + '">' +
      '<p class="md-callout-title">' + CALLOUTS[kind] + '</p>\n<p>'
  );
}

/**
 * The ### sections between the two markers, each in an element of its own,
 * for the guide to show one at a time under a row of their titles. Until a
 * script does that they read one under another, as GitHub shows them.
 */
function tabs(html) {
  return html.replace(
    /<!--\s*tabs\s*-->([\s\S]*?)<!--\s*\/tabs\s*-->/g,
    (match, inner) => {
      const parts = inner.split(/(?=<h3 )/);
      const before = parts[0].indexOf('<h3 ') === 0 ? '' : parts.shift();
      return (
        before +
        '<div class="md-tabs">\n' +
        parts
          .map((part) => '<section class="md-tab">' + part + '</section>\n')
          .join('') +
        '</div>\n'
      );
    }
  );
}

/** A picture a live example may stand in for. */
function liveFigures(html) {
  return html.replace(
    /<!--\s*live:\s*([\w-]+)\s*-->\s*(<p>\s*<img[^>]*>\s*<\/p>|<img[^>]*>)/g,
    (match, name, picture) =>
      '<figure class="md-live" data-live="' + name + '">' + picture + '</figure>'
  );
}

/*
 * Each second-level section folds away: a <details> around it, with its
 * heading as the summary, so the page can be read as a list of its sections
 * and opened one at a time. Only here -- the file itself stays plain
 * Markdown, which is what GitHub shows. What comes before the first section
 * is the guide's opening, and the first section, the overview, starts open.
 */
function foldSections(html) {
  let folded = 0;
  return html
    .split(/(?=<h2 )/)
    .map((part) => {
      if (part.indexOf('<h2 ') !== 0) {
        return '<div class="md-intro">' + part + '</div>\n';
      }
      const end = part.indexOf('</h2>') + '</h2>'.length;
      folded += 1;
      return (
        '<details class="md-section"' + (folded === 1 ? ' open' : '') + '>' +
        '<summary>' + part.slice(0, end) + '</summary>\n' +
        '<div class="md-section-body">' + part.slice(end) + '</div>' +
        '</details>\n'
      );
    })
    .join('');
}

/** The "#section" links in the file that no heading answers to. */
function brokenAnchors(html) {
  const ids = new Set();
  html.replace(/\sid="([^"]+)"/g, (match, id) => ids.add(id));
  const broken = new Set();
  html.replace(/\shref="#([^"]+)"/g, (match, id) => {
    let name = id;
    try {
      name = decodeURIComponent(id);
    } catch (e) {
      /* taken as written */
    }
    if (!ids.has(name)) broken.add(name);
  });
  return Array.from(broken);
}

function render(source) {
  return foldSections(liveFigures(tabs(callouts(md.render(source)))));
}

module.exports = function(source) {
  const html = render(source);
  const broken = brokenAnchors(html);
  if (broken.length > 0 && this && this.emitWarning) {
    this.emitWarning(
      new Error('Links to sections the file does not have: #' + broken.join(', #'))
    );
  }
  return html;
};

module.exports.render = render;
module.exports.brokenAnchors = brokenAnchors;
module.exports.githubSlug = githubSlug;
