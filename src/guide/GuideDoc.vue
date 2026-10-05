<template>
  <div class="gd" :class="['gd--' + layout, { 'gd--ready': ready }]">
    <nav class="gd-nav" aria-label="In this guide">
      <div class="gd-search">
        <input
          ref="search"
          v-model="query"
          type="text"
          placeholder="Search the guide"
          aria-label="Search the guide"
          autocomplete="off"
          spellcheck="false"
          @keydown.esc="onSearchEsc"
          @keydown.enter.prevent="openFirstResult"
        />
        <button
          v-if="query"
          type="button"
          class="gd-search-clear"
          aria-label="Clear the search"
          @click="clearSearch"
        >
          ×
        </button>
      </div>
      <div v-if="searching" class="gd-results">
        <a
          v-for="result in results"
          :key="result.key"
          class="gd-result"
          :href="hrefFor(result.id)"
          @click.prevent="openResult(result)"
        >
          <span class="gd-result-title">{{ result.title }}</span>
          <span class="gd-result-text">
            <template v-for="(part, i) in result.snippet">
              <mark v-if="part.hit" :key="i">{{ part.text }}</mark>
              <span v-else :key="i">{{ part.text }}</span>
            </template>
          </span>
        </a>
        <div v-if="results.length === 0" class="gd-none">
          Nothing in the guide matches.
        </div>
      </div>
      <div v-else class="gd-list">
        <template v-for="(group, g) in groups">
          <div v-if="group.title" :key="'group-' + g" class="gd-group">
            {{ group.title }}
          </div>
          <a
            v-for="item in group.items"
            :key="'item-' + item.id"
            class="gd-link"
            :class="{ 'gd-link--on': item.id === current }"
            :href="hrefFor(item.id)"
            :aria-current="item.id === current ? 'true' : null"
            @click.prevent="go(item.id)"
            >{{ item.title }}</a
          >
        </template>
        <button
          v-if="layout === 'folds'"
          type="button"
          class="gd-all"
          @click="setAllOpen(!allOpen)"
        >
          {{ allOpen ? "Collapse all" : "Expand all" }}
        </button>
      </div>
    </nav>

    <main class="gd-main">
      <!-- docs/guide.md as the build renders it, handed in by the host: the
           file GitHub shows is the guide shown here. It is the project's own
           file, so its HTML is trusted. "toggle" doesn't bubble, hence the
           capture. -->
      <article
        ref="doc"
        class="gd-doc"
        v-html="html"
        @click="onDocClick"
        @toggle.capture="onToggle"
      />
      <div v-if="layout === 'single'" class="gd-pager">
        <button v-if="previous" type="button" @click="go(previous.id)">
          <small>Previous</small>{{ previous.title }}
        </button>
        <button
          v-if="next"
          type="button"
          class="gd-pager-next"
          @click="go(next.id)"
        >
          <small>Next</small>{{ next.title }}
        </button>
      </div>
      <slot name="foot" />
    </main>

    <div
      v-if="zoomed"
      class="gd-zoom"
      role="dialog"
      aria-label="The picture at full size"
      @click="zoomed = null"
    >
      <img :src="zoomed.src" :alt="zoomed.alt" />
    </div>
  </div>
</template>

<script>
/*
 * The guide, wherever it is shown: docs/guide.md with its contents by part,
 * a search over it, and the tabs and live examples the Markdown asks for
 * (see build/markdown-loader.js). Two hosts put it on screen: GuideDialog
 * over the workspace, one section at a time, and GuidePage as the wiki page,
 * with every section folded under its heading.
 *
 * Nothing here uses the store, the router or Vuetify, so the wiki page's
 * bundle is this and little else.
 */
import Vue from "vue";
import "./guide.css";
import live from "./live";
import { parseAppLink } from "@/appLinks.js";

const MAX_RESULTS = 12;
const MAX_MARKS = 60;

/** The element that scrolls `el`: the dialog's body, or the page. */
function scrollerOf(el) {
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    let overflow = window.getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") return node;
  }
  return document.scrollingElement || document.documentElement;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default {
  name: "GuideDoc",
  props: {
    // The guide, as HTML (see build/markdown-loader.js).
    html: { type: String, required: true },
    // "folds": every section on one page, folded under its heading.
    // "single": one section at a time, with the next and the last below it.
    layout: { type: String, default: "folds" },
    // The heading to show, by its id; "" is the guide's opening.
    section: { type: String, default: "" },
    // What a contents link's address starts with, for opening it elsewhere.
    base: { type: String, default: "#" },
    // How far below the top of the window a heading counts as the one
    // being read, where the sections share a page.
    readingLine: { type: Number, default: 140 },
  },
  data() {
    return {
      ready: false,
      // The guide's opening and its second-level sections, in order, and
      // the same under the parts the guide's own contents list names.
      pages: [],
      groups: [],
      // The section being read, and the heading last gone to.
      current: "",
      at: "",
      allOpen: false,
      query: "",
      // Counts the index being built, for the results to follow.
      indexed: 0,
      zoomed: null,
      scrollQueued: false,
    };
  },
  computed: {
    words() {
      return this.query
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 0);
    },
    searching() {
      return this.words.length > 0;
    },
    results() {
      if (!this.indexed || !this.searching) return [];
      let words = this.words;
      let found = [];
      this.searchIndex.forEach((entry, order) => {
        let inTitle = words.every((word) => entry.titleLower.indexOf(word) !== -1);
        let anywhere = words.every(
          (word) =>
            entry.titleLower.indexOf(word) !== -1 ||
            entry.lower.indexOf(word) !== -1
        );
        if (anywhere) found.push({ entry: entry, rank: inTitle ? 0 : 1, order: order });
      });
      found.sort((a, b) => a.rank - b.rank || a.order - b.order);
      return found.slice(0, MAX_RESULTS).map((hit) => ({
        key: hit.order,
        id: hit.entry.id,
        title: hit.entry.title,
        entry: hit.entry,
        snippet: this.snippet(hit.entry, words),
      }));
    },
    place() {
      return this.pages.findIndex((page) => page.id === this.current);
    },
    previous() {
      return this.place > 0 ? this.pages[this.place - 1] : null;
    },
    next() {
      return this.place >= 0 && this.place < this.pages.length - 1
        ? this.pages[this.place + 1]
        : null;
    },
  },
  watch: {
    section(id) {
      if ((id || "") !== this.at) this.show(id, { smooth: true });
    },
    query(value) {
      if (!value) this.clearMarks();
    },
    // Across the top of a narrow page the contents are one scrolling row;
    // the section being read is kept in sight there.
    current() {
      this.$nextTick(() => {
        let link = this.$el.querySelector(".gd-link--on");
        let row = link && link.parentElement;
        if (!row || row.scrollWidth <= row.clientWidth) return;
        row.scrollTo({
          left: link.offsetLeft - (row.clientWidth - link.offsetWidth) / 2,
          behavior: "smooth",
        });
      });
    },
  },
  created() {
    // Outside data: elements and the search's text are not Vue's to watch.
    this.pageEls = {};
    this.searchIndex = [];
    this.liveVms = [];
  },
  mounted() {
    this.readPages();
    this.buildIndex();
    this.setUpTabs();
    this.mountLive();
    this.ready = true;
    this.countOpen();
    // A heading the guide no longer has leaves it at its opening.
    if (this.section && !this.show(this.section, { smooth: false })) {
      this.show("", { smooth: false });
    } else if (!this.section && this.layout === "single") {
      this.show("", { smooth: false });
    }
    window.addEventListener("scroll", this.onScroll, true);
    window.addEventListener("keydown", this.onKey, true);
  },
  beforeDestroy() {
    window.removeEventListener("scroll", this.onScroll, true);
    window.removeEventListener("keydown", this.onKey, true);
    this.liveVms.forEach((vm) => vm.$destroy());
  },
  methods: {
    hrefFor(id) {
      return this.base + (id || "");
    },
    /** The opening and the sections, and the parts the guide sorts them into. */
    readPages() {
      let doc = this.$refs.doc;
      let pages = [{ id: "", title: "Overview" }];
      this.pageEls[""] = doc.querySelector(".md-intro");
      Array.prototype.forEach.call(
        doc.querySelectorAll("details.md-section"),
        (section) => {
          let heading = section.querySelector("summary h2[id]");
          if (!heading) return;
          pages.push({ id: heading.id, title: heading.textContent });
          this.pageEls[heading.id] = section;
        }
      );
      let byId = {};
      pages.forEach((page) => (byId[page.id] = page));
      let groups = [{ title: null, items: [pages[0]] }];
      let placed = { "": true };
      let contents = doc.querySelector("ul.md-contents");
      Array.prototype.forEach.call(contents ? contents.children : [], (part) => {
        let title = Array.prototype.filter
          .call(part.childNodes, (node) => node.nodeName !== "UL")
          .map((node) => node.textContent)
          .join("")
          .trim();
        let items = [];
        Array.prototype.forEach.call(part.querySelectorAll('a[href^="#"]'), (link) => {
          let page = byId[decodeURIComponent(link.getAttribute("href").slice(1))];
          if (page && !placed[page.id]) {
            placed[page.id] = true;
            items.push(page);
          }
        });
        if (items.length > 0) groups.push({ title: title, items: items });
      });
      // A section the contents list forgot is still a section.
      let rest = pages.filter((page) => !placed[page.id]);
      if (rest.length > 0) groups.push({ title: null, items: rest });
      this.pages = pages;
      this.groups = groups;
    },
    /**
     * Shows a heading: its section unfolded (or put on screen, where one
     * shows at a time), its tab chosen, and the page moved to it. False
     * when the guide has no such heading.
     */
    show(id, options) {
      let doc = this.$refs.doc;
      if (!doc) return false;
      id = id || "";
      let target = id ? document.getElementById(id) : null;
      if (id && (!target || !doc.contains(target))) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("The guide has no heading to show for: " + id);
        }
        return false;
      }
      let holder = target
        ? target.closest(".md-section, .md-intro")
        : this.pageEls[""];
      let page = this.pages.find((p) => this.pageEls[p.id] === holder);
      if (!page) return false;
      this.at = id;
      this.current = page.id;
      if (this.layout === "single") {
        this.pages.forEach((p) => {
          let el = this.pageEls[p.id];
          if (el) el.hidden = p.id !== page.id;
        });
      }
      if (holder.tagName === "DETAILS") holder.open = true;
      let tab = target ? target.closest(".md-tab") : null;
      if (tab) this.selectTab(tab);
      let smooth = !options || options.smooth !== false;
      let heading = holder.querySelector("summary h2");
      let toTop = !target || (this.layout === "single" && target === heading);
      // A tab's own heading is its title in the row of tabs; the row is
      // what there is to go to.
      let landing =
        tab && target.parentElement === tab && target.tagName === "H3"
          ? tab.parentElement
          : target;
      let move = () => {
        if (toTop) {
          scrollerOf(this.$el).scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
        } else {
          landing.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
        }
      };
      this.$nextTick(move);
      if (!toTop) this.settleOnPictures(id, move);
      return true;
    },
    /**
     * The pictures above a heading arrive after it and push it down, so the
     * page is put on the heading once more when they are in. Those out of
     * sight take up no room and are not waited for.
     */
    settleOnPictures(id, move) {
      let images = Array.prototype.filter.call(
        this.$refs.doc.querySelectorAll("img"),
        (image) => !image.complete && image.offsetParent !== null
      );
      let waiting = images.length;
      let settle = () => {
        waiting -= 1;
        if (waiting === 0 && this.at === id) move();
      };
      images.forEach((image) => {
        image.addEventListener("load", settle, { once: true });
        image.addEventListener("error", settle, { once: true });
      });
    },
    /** Shows a heading because the reader asked, and says so to the host. */
    go(id) {
      if (this.show(id, { smooth: true })) this.$emit("navigate", id || "");
    },
    folds() {
      let doc = this.$refs.doc;
      return doc ? doc.querySelectorAll("details.md-section") : [];
    },
    countOpen() {
      let folds = this.folds();
      this.allOpen =
        folds.length > 0 &&
        Array.prototype.every.call(folds, (fold) => fold.open);
    },
    setAllOpen(open) {
      Array.prototype.forEach.call(this.folds(), (fold) => {
        fold.open = open;
      });
      this.allOpen = open;
    },
    onToggle(event) {
      let fold = event.target;
      // Shown one at a time, a section is the page: it doesn't fold.
      if (
        this.layout === "single" &&
        fold.classList &&
        fold.classList.contains("md-section") &&
        !fold.open
      ) {
        fold.open = true;
        return;
      }
      this.countOpen();
    },

    /* ---- Tabs ---- */

    /** A row of titles over each run of sections the guide marks as tabs. */
    setUpTabs() {
      Array.prototype.forEach.call(
        this.$refs.doc.querySelectorAll(".md-tabs"),
        (box) => {
          let tabs = this.tabsOf(box);
          if (tabs.length < 2) return;
          let bar = document.createElement("div");
          bar.className = "md-tabbar";
          bar.setAttribute("role", "tablist");
          tabs.forEach((tab, i) => {
            let heading = tab.querySelector("h3");
            let button = document.createElement("button");
            button.type = "button";
            button.className = "md-tabbtn";
            button.setAttribute("role", "tab");
            button.textContent = heading ? heading.textContent : "Part " + (i + 1);
            button.addEventListener("click", () => this.selectTab(tab, true));
            bar.appendChild(button);
            tab.setAttribute("role", "tabpanel");
          });
          box.insertBefore(bar, box.firstChild);
          box.classList.add("md-tabs--on");
          this.selectTab(tabs[0]);
        }
      );
    },
    tabsOf(box) {
      return Array.prototype.filter.call(box.children, (el) =>
        el.classList.contains("md-tab")
      );
    },
    selectTab(tab, byReader) {
      let box = tab.parentElement;
      let bar = box.querySelector(".md-tabbar");
      if (!bar) return;
      this.tabsOf(box).forEach((el, i) => {
        let on = el === tab;
        el.classList.toggle("md-tab--on", on);
        bar.children[i].classList.toggle("md-tabbtn--on", on);
        bar.children[i].setAttribute("aria-selected", String(on));
      });
      if (!byReader) return;
      // A tab has an address of its own: its heading's.
      let heading = tab.querySelector("h3[id]");
      if (heading) {
        this.at = heading.id;
        this.$emit("navigate", heading.id);
      }
    },

    /* ---- Live examples ---- */

    /** Each picture the guide marks as live gets its example in its place. */
    mountLive() {
      Array.prototype.forEach.call(
        this.$refs.doc.querySelectorAll("figure.md-live[data-live]"),
        (figure) => {
          let name = figure.getAttribute("data-live");
          let load = live[name];
          if (!load) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("The guide asks for a live example there is none of: " + name);
            }
            return;
          }
          load()
            .then((module) => {
              if (this._isDestroyed) return;
              let holder = document.createElement("div");
              figure.appendChild(holder);
              let Example = module.default || module;
              this.liveVms.push(
                new Vue({ render: (h) => h(Example) }).$mount(holder)
              );
              figure.classList.add("md-live--on");
            })
            .catch(() => {
              /* the picture stays */
            });
        }
      );
    },

    /* ---- Search ---- */

    /**
     * One entry for each stretch of the guide under a heading: a section's
     * opening, then each of its smaller headings.
     */
    buildIndex() {
      let entries = [];
      this.pages.forEach((page) => {
        let el = this.pageEls[page.id];
        if (!el) return;
        let body = page.id ? el.querySelector(".md-section-body") : el;
        let entry = { id: page.id, title: page.title, nodes: [] };
        let keep = () => {
          let text = entry.nodes
            .map((node) => node.textContent)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          if (text || entry.id !== page.id) {
            entry.text = text;
            entry.lower = text.toLowerCase();
            entry.titleLower = entry.title.toLowerCase();
            entries.push(entry);
          }
        };
        let walk = (parent) => {
          Array.prototype.forEach.call(parent.children, (child) => {
            if (child.classList.contains("md-tabs")) {
              this.tabsOf(child).forEach(walk);
            } else if (child.tagName === "H3" && child.id) {
              keep();
              entry = {
                id: child.id,
                title: page.title + " › " + child.textContent,
                nodes: [],
              };
            } else if (
              child.tagName !== "H1" &&
              !child.classList.contains("md-contents") &&
              !child.classList.contains("md-tabbar")
            ) {
              entry.nodes.push(child);
            }
          });
        };
        if (body) walk(body);
        keep();
      });
      this.searchIndex = entries;
      this.indexed += 1;
    },
    /** The words around the first hit, cut into what matched and what didn't. */
    snippet(entry, words) {
      let first = -1;
      words.forEach((word) => {
        let at = entry.lower.indexOf(word);
        if (at !== -1 && (first === -1 || at < first)) first = at;
      });
      let start = Math.max(0, first - 40);
      if (start > 0) {
        let space = entry.text.indexOf(" ", start);
        if (space !== -1 && space < first) start = space + 1;
      }
      let text = entry.text.slice(start, start + 130);
      if (start > 0) text = "… " + text;
      if (start + 130 < entry.text.length) text += " …";
      let pattern = new RegExp("(" + words.map(escapeRegExp).join("|") + ")", "i");
      return text
        .split(pattern)
        .filter((part) => part !== "")
        .map((part) => ({ text: part, hit: pattern.test(part) }));
    },
    openResult(result) {
      if (!this.show(result.id, { smooth: false })) return;
      this.$emit("navigate", result.id);
      this.$nextTick(() => this.markHits(result.entry, this.words));
    },
    openFirstResult() {
      if (this.results.length > 0) this.openResult(this.results[0]);
    },
    clearSearch() {
      this.query = "";
      if (this.$refs.search) this.$refs.search.focus();
    },
    /** Esc empties the box first; with it empty, Esc is the host's. */
    onSearchEsc(event) {
      if (!this.query) return;
      event.stopPropagation();
      this.query = "";
    },
    focusSearch() {
      if (this.$refs.search) this.$refs.search.focus();
    },
    clearMarks() {
      let doc = this.$refs.doc;
      if (!doc) return;
      Array.prototype.forEach.call(doc.querySelectorAll("mark.gd-hit"), (mark) => {
        let parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
      });
    },
    /** Marks what the search matched where it was found, and goes to the first. */
    markHits(entry, words) {
      this.clearMarks();
      if (words.length === 0) return;
      let pattern = new RegExp(words.map(escapeRegExp).join("|"), "i");
      let marks = [];
      entry.nodes.forEach((root) => {
        let walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let texts = [];
        while (walker.nextNode()) texts.push(walker.currentNode);
        texts.forEach((node) => {
          while (node && marks.length < MAX_MARKS) {
            let match = pattern.exec(node.nodeValue);
            if (!match) break;
            let hit = node.splitText(match.index);
            let rest = hit.splitText(match[0].length);
            let mark = document.createElement("mark");
            mark.className = "gd-hit";
            hit.parentNode.replaceChild(mark, hit);
            mark.appendChild(hit);
            marks.push(mark);
            node = rest;
          }
        });
      });
      let first = marks.find((mark) => mark.offsetParent !== null);
      if (first) first.scrollIntoView({ block: "center" });
    },

    /* ---- The guide's own links and pictures ---- */

    onDocClick(event) {
      let el = event.target;
      let link = el.closest ? el.closest("a[href]") : null;
      if (link) {
        let href = link.getAttribute("href");
        if (href.charAt(0) === "#") {
          // An address of this page alone; where the page has a router in
          // hash mode, following it would leave for a route of that name.
          event.preventDefault();
          this.go(decodeURIComponent(href.slice(1)));
          return;
        }
        let app = parseAppLink(href);
        if (app && this.$listeners["app-link"]) {
          event.preventDefault();
          this.$emit("app-link", app);
        }
        return;
      }
      // A picture drawn smaller than it is opens at its own size.
      if (
        el.tagName === "IMG" &&
        el.naturalWidth > el.clientWidth * 1.15 &&
        !/\.svg(\?|$)|^data:image\/svg/i.test(el.currentSrc || el.src)
      ) {
        this.zoomed = { src: el.currentSrc || el.src, alt: el.alt };
      }
    },
    onKey(event) {
      if (this.zoomed && event.key === "Escape") {
        event.stopPropagation();
        this.zoomed = null;
      }
    },
    onScroll() {
      if (this.layout !== "folds" || this.scrollQueued) return;
      this.scrollQueued = true;
      window.requestAnimationFrame(() => {
        this.scrollQueued = false;
        this.markCurrent();
      });
    },
    /** The last section whose heading has passed the reading line. */
    markCurrent() {
      if (!this.$refs.doc) return;
      // Where the contents run across the top, the line is under them.
      let line = this.readingLine;
      let nav = this.$el.querySelector(".gd-nav");
      if (nav && nav.offsetWidth > this.$el.offsetWidth * 0.8) {
        line = Math.max(line, nav.getBoundingClientRect().bottom + 24);
      }
      let current = "";
      this.pages.forEach((page) => {
        if (!page.id) return;
        let heading = document.getElementById(page.id);
        if (heading && heading.getBoundingClientRect().top <= line) {
          current = page.id;
        }
      });
      this.current = current;
    },
  },
};
</script>
