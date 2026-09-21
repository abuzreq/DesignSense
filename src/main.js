import Vue from "vue";
import App from "./App";

import router from "./router";
import store from "./store";
import vuetify from "./plugins/vuetify";
import vdr from "./plugins/vdr";
import { loadLayouts } from "./layout.js";

import { operations, getOperationFromKey } from "@/components/operations.js";
import VueTour from "vue-tour";

import {
  DEFAULT_DATASET_URL,
  configureLoader,
  loadDataset,
  loadState,
} from "@/data/loader.js";
import { readShareParams } from "@/data/shareLink.js";
import { datasetKey } from "@/customDimensions.js";
import { installErrorCapture } from "@/errors.js";
import { setColumnRoles } from "@/columns.js";
import { loadColumnRoles } from "@/data/columnRoles.js";

window.Gkey = "AIzaSyCSrF08UMawxKIb0m4JsA1mYE5NMmP36bY";

require("vue-tour/dist/vue-tour.css");

Vue.use(VueTour);

Vue.config.productionTip = false;
// Errors nothing handled are kept, so feedback can carry them (see errors.js).
installErrorCapture();

let app = null;

/**
 * Shows `data` in a fresh app. Views read the collection when they are created,
 * so every dataset gets its own app; destroying the previous one first releases
 * its store, its views and their listeners.
 */
function mountApp(data, dataTypesMap, options) {
  let link = options && options.link;
  // What a share link would point at; a local file has nothing to share.
  window._folderInfo = link
    ? { inLink: link, url: link, DE_PW: "", type: "" }
    : null;
  if (app) app.$destroy();
  // What is saved per dataset is found again by this key. The placeholder
  // collection has no options, so nothing is saved for it.
  let key = options
    ? datasetKey({
        link: link,
        name: options.name,
        fields: Object.keys(dataTypesMap),
        ids: data.map((d) => d._id),
      })
    : null;
  // Roles the user gave this dataset's columns, before anything reads them.
  setColumnRoles(loadColumnRoles(key).roles);
  app = new Vue({
    vuetify,
    vdr,
    router,
    store: store(data, dataTypesMap, loadLayouts(), {}, { datasetKey: key }),
    el: "#app",
    render: (h) => h(App),
  });
  app.$store.dispatch("createMarkingEntry", {});
  app.$store.dispatch("processShareLink");
  return app;
}

configureLoader({ mount: mountApp });

// A placeholder collection, until the first dataset finishes loading.
mountApp([{ _id: "1" }, { _id: "2" }, { _id: "3" }, { _id: "4" }], {
  _id: "string",
});

function loadDefaultDataset() {
  return loadDataset(DEFAULT_DATASET_URL, { source: "startup" }).then(
    (dataset) => {
      // Null when a dataset the user chose meanwhile took over.
      if (!dataset) return null;
      sessionStorage.clear();
      return dataset;
    }
  );
}

// A shared link names its own dataset; otherwise the default one opens.
let sharedDataset = readShareParams(window.location);
if (sharedDataset === null) {
  loadDefaultDataset().catch(() => {
    /* loadState.error carries the message */
  });
} else {
  loadDataset(sharedDataset, { source: "startup" })
    .catch((error) => {
      let reason = error.userMessage || "it could not be loaded";
      return loadDefaultDataset().then(() => {
        loadState.error = "The shared link couldn't be opened: " + reason;
      });
    })
    .catch(() => {
      /* already reported */
    });
}

/**
 * Global shortcuts must not fire while the user is typing, otherwise a digit in
 * a comment or URL silently changes the selection operation.
 */
function isTypingTarget(e) {
  let el = e.target;
  if (!el || !el.tagName) return false;
  let tag = el.tagName.toUpperCase();
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true
  );
}

/**
 * While a dialog or menu is open its keys are its own: Esc closes the dialog
 * and must not also clear every filter behind it.
 */
function isOverlayOpen(e) {
  let el = e.target;
  if (el && el.closest && el.closest(".v-dialog, .menuable__content__active")) {
    return true;
  }
  return !!document.querySelector(
    ".v-dialog--active, .menuable__content__active"
  );
}

/** Space and Enter press a focused button, link or checkbox as usual. */
function isPressableTarget(e) {
  let el = e.target;
  return !!(
    el &&
    el.closest &&
    el.closest("button, a[href], [role=button], [role=checkbox], [role=menuitem], label")
  );
}

function modifierOperation(state) {
  if (state.isShiftKey && state.isCtrlKey) return operations.INTERSECT;
  if (state.isShiftKey) return operations.ADD;
  if (state.isCtrlKey) return operations.SUBTRACT;
  return null;
}

/**
 * Shift and Ctrl are quasimodes: they override the chosen operation only while
 * held, and releasing them returns to that operation rather than to Replace.
 */
function syncModifiers(e) {
  let store = app.$store;
  // For the modifier's own event, trust the event type: some sources still
  // report the modifier flag as set on its keyup.
  let shift = e.key === "Shift" ? e.type === "keydown" : e.shiftKey;
  let ctrl = e.key === "Control" ? e.type === "keydown" : e.ctrlKey;
  if (shift !== store.state.isShiftKey) {
    store.dispatch("updateShiftKey", { value: shift });
  }
  if (ctrl !== store.state.isCtrlKey) {
    store.dispatch("updateCtrlKey", { value: ctrl });
  }
  if (!store.getters.can("selectionOperations")) return;
  let held = modifierOperation(store.state);
  let effective = held || store.state.stickySelectionOperation;
  if (effective !== store.state.currentSelectionOperation) {
    store.commit("setModifierOperation", held);
  }
}

document.addEventListener("keydown", function(e) {
  // Modifiers are tracked even while typing, so a release is never missed.
  syncModifiers(e);
  if (isTypingTarget(e) || isOverlayOpen(e)) return;

  let store = app.$store;

  // Number keys pick the sticky selection operation.
  if (
    store.getters.can("selectionOperations") &&
    e.key >= 1 &&
    e.key <= Object.keys(operations).length
  ) {
    store.commit("changeSelectionOperation", getOperationFromKey(e.key - 1));
  }

  // Undo/redo step through selections in Expert and filters in Lite.
  let key = (e.key || "").toLowerCase();
  if (e.ctrlKey && (key === "y" || (key === "z" && e.shiftKey))) {
    e.preventDefault();
    store.dispatch("redo");
  } else if (e.ctrlKey && key === "z") {
    e.preventDefault();
    store.dispatch("undo");
  }

  if (e.key === "Escape") {
    if (store.state.hovered != null) {
      store.dispatch("clearInspection");
    } else {
      // Clears the selection in Expert and the filters in Lite.
      store.dispatch("resetAllMarkings");
    }
  }

  if (e.key === " " && !store.state.isAltKey && !isPressableTarget(e)) {
    e.preventDefault();
    e.stopPropagation();
    store.dispatch("updateAltKey", { value: true });
    store.commit("toggleInspectionMode", { value: true });
  }
});

document.addEventListener("keyup", function(e) {
  syncModifiers(e);
  if (isTypingTarget(e)) return;

  let store = app.$store;
  // Released even over a dialog, so inspection never sticks on.
  if (e.key === " " && store.state.isAltKey) {
    e.preventDefault();
    e.stopPropagation();
    store.dispatch("updateAltKey", { value: false });
    store.commit("toggleInspectionMode", { value: false });
    if (!store.state.isInspectionPinned) {
      store.dispatch("clearInspection", { keepShown: true });
    }
  } else if (isOverlayOpen(e) || e.key === " ") {
    return;
  } else if (
    (e.key === "p" || e.key === "P") &&
    store.getters.can("inspectionControls")
  ) {
    store.dispatch("togglePinInspection");
  } else if (e.key === "`") {
    store.dispatch("toggleEditingMode");
  }
});

// A modifier released while the window is unfocused never sends keyup, which
// would leave a quasimode such as Subtract stuck on.
window.addEventListener("blur", function() {
  syncModifiers({ shiftKey: false, ctrlKey: false });
});

// Mouse events carry the true modifier state, so a brush starts with the right
// operation even when a modifier's keyup was missed. Capture phase, so this
// runs before the brush itself sees the mousedown.
document.addEventListener("mousedown", syncModifiers, true);
