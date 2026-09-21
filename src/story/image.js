/*
 * Turning a card into a picture: copying the options' images in, drawing the
 * card as a PNG, or pages as a PDF, and handing it over as a download or on
 * the clipboard.
 */

import { toBlob, toJpeg } from "html-to-image";

// Pictures are twice the card's size, sharp on high-density screens and projectors.
export const PIXEL_RATIO = 2;
// Images are copied in at no more than this width; no card shows one wider.
const MAX_IMAGE_WIDTH = 900;

/** The image at `src` as a data URL, or null when its host doesn't allow reading it. */
export function imageAsDataUrl(src) {
  if (/^data:/.test(src)) return Promise.resolve(src);
  return new Promise((resolve) => {
    let image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        let ratio = Math.min(1, MAX_IMAGE_WIDTH / (image.naturalWidth || MAX_IMAGE_WIDTH));
        let canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch (e) {
        // Drawn, but the host didn't allow reading it back.
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/**
 * `{ images, failed }`: each item's image as a data URL by its `id` (null
 * when it couldn't be read), and how many couldn't. Items without an image
 * don't count as failed.
 */
export async function loadImages(items) {
  let images = {};
  let failed = 0;
  let seen = new Set();
  await Promise.all(
    items.map(async (item) => {
      if (!item.image || seen.has(item.id)) return;
      seen.add(item.id);
      let url = await imageAsDataUrl(item.image);
      images[item.id] = url;
      if (!url) failed += 1;
    })
  );
  return { images: images, failed: failed };
}

/** The element drawn as a PNG, at its own size times PIXEL_RATIO. */
export async function renderPng(node) {
  let options = {
    pixelRatio: PIXEL_RATIO,
    width: node.offsetWidth,
    height: node.offsetHeight,
    backgroundColor: "#ffffff",
  };
  try {
    return await toBlob(node, options);
  } catch (e) {
    // Web fonts from another host can refuse to be embedded; the system's
    // fonts will do.
    return await toBlob(node, Object.assign({ skipFonts: true }, options));
  }
}

/** The element drawn as a JPEG data URL, for a page of a PDF. */
export async function renderJpeg(node) {
  let options = {
    pixelRatio: PIXEL_RATIO,
    width: node.offsetWidth,
    height: node.offsetHeight,
    backgroundColor: "#ffffff",
    quality: 0.92,
  };
  try {
    return await toJpeg(node, options);
  } catch (e) {
    return await toJpeg(node, Object.assign({ skipFonts: true }, options));
  }
}

// A page the shape of a slide, 16:9, in points.
const PAGE_WIDTH = 960;
const PAGE_HEIGHT = 540;

/**
 * A PDF with a page per element, each drawn as it looks on screen. The PDF
 * library is loaded only now, the first time a report is made. `onPage(i)`
 * hears which page is being drawn.
 */
export async function pdfOf(nodes, title, onPage) {
  const { jsPDF } = await import(/* webpackChunkName: "jspdf" */ "jspdf");
  let doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [PAGE_WIDTH, PAGE_HEIGHT],
    compress: true,
  });
  doc.setProperties({ title: title || "Report", creator: "DesignSense" });
  for (let i = 0; i < nodes.length; i++) {
    if (onPage) onPage(i);
    let image = await renderJpeg(nodes[i]);
    if (i > 0) doc.addPage([PAGE_WIDTH, PAGE_HEIGHT], "landscape");
    doc.addImage(image, "JPEG", 0, 0, PAGE_WIDTH, PAGE_HEIGHT, undefined, "FAST");
  }
  return doc.output("blob");
}

/** "designsense-4-options-worth-a-closer-look.png" from a title. */
export function fileNameFor(title, extension) {
  let base = (title || "summary")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return "designsense-" + (base || "summary") + "." + (extension || "png");
}

export function downloadBlob(blob, name) {
  let url = URL.createObjectURL(blob);
  let link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Whether this browser can put an image on the clipboard. */
export function canCopyImages() {
  return !!(navigator.clipboard && navigator.clipboard.write && typeof window.ClipboardItem !== "undefined");
}

/**
 * Puts the PNG `blob` promises on the clipboard. Handing the clipboard a
 * promise keeps the click's permission while the image is made (Safari needs
 * this).
 */
export function copyPng(blobPromise) {
  return navigator.clipboard.write([new window.ClipboardItem({ "image/png": blobPromise })]);
}
