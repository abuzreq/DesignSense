const views = {
        SCATTERPLOT: "SCATTERPLOT",
        SPLOM: "SPLOM",
        PCOORDS: "PCOORDS",
        GRID: "GRID",
        SIMILARITY: "SIMILARITY"
  };
  export default views;

/**
 * Shown in place of a picture an option doesn't have, or that failed to
 * load: a picture-off icon and "No picture", drawn here as SVG so it is
 * sharp at any size and costs nothing to fetch. (It used to say
 * "loading...", which a card with no picture then said for ever.)
 */
const FALLBACK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">' +
  '<rect width="600" height="400" fill="#eef1f4"/>' +
  '<g transform="translate(276 150) scale(2)" fill="#b0bec5">' +
  '<path d="M22 20.7L3.3 2L2 3.3L3 4.3V19C3 20.1 3.9 21 5 21H19.7L20.7 22L22 20.7M5 19V6.3L12.6 13.9L11.1 15.8L9 13.1L6 17H15.7L17.7 19H5M8.8 5L6.8 3H19C20.1 3 21 3.9 21 5V17.2L19 15.2V5H8.8"/>' +
  "</g>" +
  '<text x="300" y="250" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="22" fill="#90a4ae">No picture</text>' +
  "</svg>";
export const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(FALLBACK_SVG);
