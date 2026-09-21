/*
 * The sample datasets offered in the load dialog. Also how feedback tells a
 * sample, whose link is public, from a user's own data, whose link is never
 * reported (see feedback.js).
 */

export const PRESETS = [
  {
    name: "Craigslist - Used Cars",
    url:
      "https://raw.githubusercontent.com/abuzreq/ds_datasets/refs/heads/main/used_cars/data.csv",
    info: "Used cars with their price, year and mileage",
  },
  {
    name: "Simple Box",
    url:
      "https://raw.githubusercontent.com/tt-acm/DesignExplorer/gh-pages/design_explorer_data/LittleRedBox.csv",
    info: "A simple red box (from https://tt-acm.github.io/DesignExplorer/)",
  },
  {
    name: "Façade Design",
    url:
      "https://raw.githubusercontent.com/abuzreq/ds_datasets/refs/heads/main/facade/data.csv",
    info: "Façade panel variations",
  },
  {
    name: "AIA Building",
    url:
      "https://raw.githubusercontent.com/tt-acm/DesignExplorer/gh-pages/design_explorer_data/AIA%20building.csv",
    info:
      "The AIA building dataset (from https://tt-acm.github.io/DesignExplorer/)",
  },
  {
    name: "Windows Exploration",
    url:
      "https://raw.githubusercontent.com/tt-acm/DesignExplorer/gh-pages/design_explorer_data/default_onload.csv",
    info:
      "Exploring impact of windows on lighting/heating (from https://tt-acm.github.io/DesignExplorer/)",
  },
  {
    name: "Massing Study",
    url:
      "https://raw.githubusercontent.com/Zohrehhasanpur/GalleryDesignDataset/main/data.csv",
    info:
      "A generative design dataset exploring different massing for an arts gallery project.",
  },
  {
    name: "Rezoning Project",
    url:
      "https://raw.githubusercontent.com/abuzreq/ds_datasets/refs/heads/main/rezoning/data.csv",
    info: "Form exploration for a rezoning project",
  },
  {
    name: "Solar",
    url:
      "https://raw.githubusercontent.com/abuzreq/ds_datasets/refs/heads/main/solar/data.csv",
    info: "Solar analysis for a tower placement",
  },
  {
    name: "Malaeeb",
    url: "https://raw.githubusercontent.com/abuzreq/ds_datasets/refs/heads/main/malaeeb/data.csv",
    info: "Procedurally generated game puzzles",
  },
  {
    name: "Molecules",
    url:
      "https://raw.githubusercontent.com/abuzreq/ds_datasets/refs/heads/main/molecules/data.csv",
    info: "Molecular designs from the Postera.ai crowdsourcing project",
  },
];

/** The sample dataset at `link`, or null when it isn't one of them. */
export function presetFor(link) {
  if (!link) return null;
  return PRESETS.find((preset) => preset.url === link) || null;
}
