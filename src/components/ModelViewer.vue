<template>
  <div class="mv-root" :style="{ height: height + 'px' }">
    <!-- No model in this column for this option. -->
    <div v-if="!model" class="mv-panel">
      <div class="mv-note">No 3D model for this option.</div>
    </div>

    <!-- A format no loader here can read. Said plainly, with no loader
         involved: an unsupported file must never reach three.js. -->
    <div v-else-if="!isSupported" class="mv-panel">
      <div class="mv-name" :title="fileName">{{ fileName }}</div>
      <div class="mv-note">{{ unsupportedText }}</div>
    </div>

    <template v-else>
      <!-- Built only once the bytes are in hand, so nothing loads on hover. -->
      <div v-if="sourceUrl" class="mv-stage">
        <ModelJson
          v-if="isJson"
          ref="model"
          :key="model.url"
          :src="sourceUrl"
          :lights="lights"
          :rotation="rotation"
          :camera-position="cameraPosition"
          :controls-options="controlsOptions"
          :output-encoding="srgbEncoding"
          :background-color="backgroundColor"
          @on-load="onLoaded"
          @on-error="onLoaderError"
        >
          <div class="mv-webgl">{{ noWebglText }}</div>
        </ModelJson>
        <ModelGltf
          v-else-if="!isObj"
          ref="model"
          :key="model.url"
          :src="sourceUrl"
          :lights="lights"
          :rotation="rotation"
          :camera-position="cameraPosition"
          :controls-options="controlsOptions"
          :output-encoding="srgbEncoding"
          :background-color="backgroundColor"
          @on-load="onLoaded"
          @on-error="onLoaderError"
        >
          <div class="mv-webgl">{{ noWebglText }}</div>
        </ModelGltf>
        <ModelObj
          v-else
          ref="model"
          :key="model.url"
          :src="sourceUrl"
          :mtl="mtlUrl"
          :lights="lights"
          :rotation="rotation"
          :camera-position="cameraPosition"
          :controls-options="controlsOptions"
          :output-encoding="srgbEncoding"
          :background-color="backgroundColor"
          @on-load="onLoaded"
          @on-error="onLoaderError"
        >
          <div class="mv-webgl">{{ noWebglText }}</div>
        </ModelObj>
      </div>

      <div v-if="state === 'ready'" class="mv-tools">
        <TipButton
          small
          small-icon
          icon="mdi-axis-z-rotate-clockwise"
          :icon-color="zUp ? 'primary' : undefined"
          tooltip="Rhino models are Z-up; use this if the model lies on its side."
          @click="toggleZUp"
        />
      </div>

      <!-- One panel over the canvas for every state but `ready`, so the
           orbit controls are never covered once the model is up. -->
      <div v-if="state !== 'ready'" class="mv-panel">
        <template v-if="state === 'idle'">
          <div class="mv-name" :title="fileName">{{ fileName }}</div>
          <div class="mv-chip">.{{ format }}</div>
          <v-btn small depressed color="primary" @click="load(false)"
            >Load 3D model</v-btn
          >
          <div class="mv-note">Models load only when you ask for them.</div>
        </template>

        <template v-else-if="state === 'confirm'">
          <div class="mv-name" :title="fileName">{{ fileName }}</div>
          <div class="mv-note">{{ confirmText }}</div>
          <div class="mv-actions">
            <v-btn small depressed color="primary" @click="load(true)"
              >Load it anyway</v-btn
            >
            <v-btn small text @click="cancel">Cancel</v-btn>
          </div>
        </template>

        <template v-else-if="state === 'fetching' || state === 'parsing'">
          <div class="mv-name" :title="fileName">{{ fileName }}</div>
          <div class="mv-note">{{ progressText }}</div>
          <v-progress-linear
            class="mv-progress"
            height="4"
            color="primary"
            :value="percent < 0 ? 0 : percent"
            :indeterminate="percent < 0"
          />
          <v-btn small text @click="cancel">Cancel</v-btn>
        </template>

        <template v-else-if="state === 'error'">
          <v-icon small color="#c0392b">mdi-alert-circle-outline</v-icon>
          <div class="mv-note mv-error">{{ message }}</div>
          <v-btn small depressed @click="load(false)">Retry</v-btn>
        </template>
      </div>
    </template>
  </div>
</template>

<script>
/**
 * One option's 3D model, in the gallery inspector.
 *
 * Nothing loads until the reader asks: people hover-inspect dozens of options
 * a minute, and a model is thousands of times the weight of a thumbnail.
 *
 * The component fetches the bytes itself rather than handing the url straight
 * to a loader. That one move buys all four things a loader can't give: the
 * size guard, a real progress percentage, a Cancel button, and an error
 * message that can tell a blocked origin from an expired share link.
 */
import { ModelGltf, ModelJson, ModelObj } from "vue-3d-model";
import TipButton from "@/components/TipButton.vue";
import { assetExtension, folderFileUrl } from "@/data/assets.js";
import { convertLegacyScene, isLegacyScene } from "@/data/threeLegacy.js";

/*
 * Never `import ... from "three"` in here.
 *
 * three r118 is already in the bundle, inside vue-3d-model's own build; the
 * `three` package in node_modules (0.130) is not bundled at all. Importing
 * from "three" -- even one constant -- would ship a second, different copy of
 * the whole library. So the wrappers above do all the three.js work, and the
 * few values we need are written out by hand below.
 */

// three's sRGBEncoding. Spelled as its number for the reason just above: the
// constant is not worth a second copy of three.js.
const SRGB_ENCODING = 3001;

const SUPPORTED = ["glb", "gltf", "obj", "json"];

// Past this a model takes longer to download and decode than anyone waiting
// on a gallery will sit through, and a big one can exhaust a laptop's memory.
// It is a prompt rather than a refusal: the reader can still ask for it.
const MAX_BYTES = 40 * 1024 * 1024;

// The wrappers' own lights, minus ModelObj's reddish ground colour: a red
// underside makes grey study models look like they are lit by a fire.
const LIGHTS = [
  {
    type: "HemisphereLight",
    position: { x: 0, y: 1, z: 0 },
    skyColor: 0xffffff,
    groundColor: 0xdfe4e8,
    intensity: 0.55,
  },
  {
    type: "DirectionalLight",
    position: { x: 1, y: 1, z: 1 },
    color: 0xffffff,
    intensity: 0.8,
  },
  // A dim fill from behind, so a face turned away isn't pure black.
  {
    type: "DirectionalLight",
    position: { x: -1, y: 0.4, z: -1 },
    color: 0xffffff,
    intensity: 0.25,
  },
];

const NO_WEBGL_TEXT =
  "This browser can't show 3D models: WebGL is unavailable or turned off. The images still work.";

/** A url's file name, with any query or hash ignored. */
function fileNameOf(url) {
  let path = String(url)
    .split("?")[0]
    .split("#")[0];
  let slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

/** The url of a file sitting beside this one, or undefined. */
function siblingUrl(url, fileName) {
  let path = String(url)
    .split("?")[0]
    .split("#")[0];
  let slash = path.lastIndexOf("/");
  if (slash === -1) return undefined;
  return path.slice(0, slash + 1) + fileName;
}

function hostOf(url) {
  try {
    return new URL(String(url), window.location.href).hostname;
  } catch (err) {
    return "that server";
  }
}

function formatBytes(bytes) {
  let mb = bytes / (1024 * 1024);
  return (mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10) + " MB";
}

function networkMessage(url) {
  return (
    "The server holding this model doesn't allow other sites to read it, or " +
    hostOf(url) +
    " couldn't be reached."
  );
}

function statusMessage(status, url) {
  if (status === 401 || status === 403) {
    // OneDrive's download links are signed and expire after about an hour, so
    // a refusal here usually means the link aged out rather than the sharing.
    return (
      hostOf(url) +
      " refused this file, so it may no longer be shared -- try reloading the dataset. OneDrive download links also expire after about an hour."
    );
  }
  if (status === 404 || status === 410) {
    return "No file was found at that link. The model may have been moved or renamed since the dataset was loaded.";
  }
  return hostOf(url) + " responded with an error (" + status + ").";
}

/**
 * The model's bounds in world space, from its own geometries.
 *
 * Written out rather than done with three's Box3 so that nothing has to be
 * imported from "three" -- see the note at the top of this file.
 */
function worldBounds(object) {
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  object.traverse((child) => {
    let geometry = child.geometry;
    if (!geometry) return;
    if (!geometry.boundingBox && geometry.computeBoundingBox) {
      geometry.computeBoundingBox();
    }
    let box = geometry.boundingBox;
    if (!box) return;
    let e = child.matrixWorld.elements;
    // A rotated box is not a box, so only its eight corners, each put through
    // the child's world matrix, can give the union.
    for (let corner = 0; corner < 8; corner++) {
      let x = corner & 1 ? box.max.x : box.min.x;
      let y = corner & 2 ? box.max.y : box.min.y;
      let z = corner & 4 ? box.max.z : box.min.z;
      let point = [
        e[0] * x + e[4] * y + e[8] * z + e[12],
        e[1] * x + e[5] * y + e[9] * z + e[13],
        e[2] * x + e[6] * y + e[10] * z + e[14],
      ];
      for (let axis = 0; axis < 3; axis++) {
        if (point[axis] < min[axis]) min[axis] = point[axis];
        if (point[axis] > max[axis]) max[axis] = point[axis];
      }
    }
  });
  return min[0] === Infinity ? null : { min: min, max: max };
}

/**
 * Normals for the geometries that arrived without any. Rhino's OBJ exports
 * often carry none, which renders the model flat and unreadable. This is not
 * ModelObj's `smoothing`, which welds vertices by comparing every pair --
 * O(n^2), and it hangs the tab on anything real.
 */
function computeMissingNormals(object) {
  object.traverse((child) => {
    let geometry = child.geometry;
    if (!geometry || !geometry.attributes) return;
    if (geometry.attributes.normal) return;
    if (geometry.computeVertexNormals) geometry.computeVertexNormals();
  });
}

function disposeMaterial(material) {
  if (!material) return;
  // Every texture slot, found by scanning rather than by name: a material can
  // carry map, normalMap, roughnessMap, aoMap and a dozen others, and a
  // texture left behind holds its GPU memory for the life of the tab.
  Object.keys(material).forEach((key) => {
    let value = material[key];
    if (value && value.isTexture && value.dispose) value.dispose();
  });
  if (material.dispose) material.dispose();
}

function disposeNode(child) {
  if (child.geometry && child.geometry.dispose) child.geometry.dispose();
  let material = child.material;
  if (!material) return;
  if (Array.isArray(material)) material.forEach(disposeMaterial);
  else disposeMaterial(material);
}

export default {
  name: "ModelViewer",
  components: { ModelGltf, ModelJson, ModelObj, TipButton },
  props: {
    // { url, name, format } -- one model. Switching between several is the
    // gallery's job, not this component's.
    model: { type: Object, default: null },
    height: { type: Number, default: 320 },
  },
  data() {
    return {
      // idle -> confirm? -> fetching -> parsing -> ready, or error
      state: "idle",
      // -1 while the length is unknown, so the bar goes indeterminate.
      percent: 0,
      message: "",
      sizeBytes: 0,
      sourceUrl: null,
      blobUrl: null,
      mtlUrl: undefined,
      zUp: false,
      rotation: { x: 0, y: 0, z: 0 },
      cameraPosition: { x: 0, y: 0, z: 0 },
      controlsOptions: {
        enablePan: true,
        // Pan parallel to the screen, which is what people expect of a viewer.
        screenSpacePanning: true,
        // The wrapper's render loop never calls controls.update(), so damping
        // would leave the camera drifting to a stop that never arrives.
        enableDamping: false,
        zoomSpeed: 0.8,
        minDistance: 0.01,
        maxDistance: 10000,
      },
      lights: LIGHTS,
      srgbEncoding: SRGB_ENCODING,
      backgroundColor: 0xfafbfc,
      noWebglText: NO_WEBGL_TEXT,
    };
  },
  computed: {
    /** "glb", "gltf" or "obj"; empty when this is not a file we can show. */
    format() {
      if (!this.model) return "";
      let declared = this.model.format
        ? String(this.model.format).toLowerCase()
        : "";
      if (SUPPORTED.indexOf(declared) !== -1) return declared;
      // A dataset may not have said; the url's extension is the fallback.
      let extension = assetExtension(this.model.url);
      return SUPPORTED.indexOf(extension) !== -1 ? extension : "";
    },
    isSupported() {
      return this.format !== "";
    },
    isObj() {
      return this.format === "obj";
    },
    isJson() {
      return this.format === "json";
    },
    fileName() {
      if (!this.model) return "";
      return this.model.name || fileNameOf(this.model.url);
    },
    unsupportedText() {
      let extension =
        assetExtension(this.model.url) ||
        (this.model.format ? String(this.model.format).toLowerCase() : "");
      let opening = extension
        ? "3D file of type ." + extension + "."
        : "This file isn't a 3D model DesignSense can read.";
      return opening + " DesignSense shows .glb, .gltf, .obj and .json.";
    },
    confirmText() {
      let size = this.sizeBytes
        ? formatBytes(this.sizeBytes)
        : "over " + formatBytes(MAX_BYTES);
      return "This model is " + size + ". Load it anyway?";
    },
    progressText() {
      if (this.state === "parsing") return "Preparing the model...";
      if (this.percent < 0) return "Downloading...";
      return "Downloading " + this.percent + "%";
    },
  },
  watch: {
    "model.url": function() {
      // A new model means the old one's memory, context and download all go.
      this.teardown();
      this.state = "idle";
      this.message = "";
      this.sizeBytes = 0;
      this.zUp = false;
      this.rotation = { x: 0, y: 0, z: 0 };
      this.cameraPosition = { x: 0, y: 0, z: 0 };
    },
  },
  created() {
    // Kept off `data`: nothing renders from the fetch, and Vue has no business
    // walking a stream controller.
    this.controller = null;
  },
  beforeDestroy() {
    this.teardown();
  },
  methods: {
    load(allowOversize) {
      this.teardown();
      this.start(allowOversize);
    },
    cancel() {
      this.teardown();
      this.state = "idle";
      this.message = "";
    },

    async start(allowOversize) {
      if (!this.model || !this.isSupported) return;
      let url = this.model.url;
      let controller = new AbortController();
      this.controller = controller;
      this.state = "fetching";
      this.percent = 0;
      this.message = "";

      let mtl;
      if (this.isObj) {
        mtl = await this.findMtl(url, controller);
        if (this.controller !== controller) return;
      }

      let response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } catch (error) {
        // fetch rejects without a status for a blocked origin, a DNS failure
        // and an offline machine alike; none of them are the file's fault.
        if (this.controller !== controller) return;
        this.fail(networkMessage(url));
        return;
      }
      if (this.controller !== controller) return;
      if (!response.ok) {
        this.fail(statusMessage(response.status, url));
        return;
      }

      let declared = Number(response.headers.get("content-length")) || 0;
      if (declared > MAX_BYTES && !allowOversize) {
        this.askFirst(declared, controller);
        return;
      }

      let bytes;
      try {
        bytes = await this.readBody(response, controller, allowOversize);
      } catch (error) {
        if (this.controller !== controller) return;
        this.fail(networkMessage(url));
        return;
      }
      // null means cancelled, or stopped at the cap with the question asked.
      if (this.controller !== controller || bytes === null) return;

      this.percent = 100;
      this.state = "parsing";
      this.mtlUrl = mtl;
      if (this.isJson) {
        let scene = await this.readScene(bytes);
        if (this.controller !== controller || scene === null) return;
        this.blobUrl = URL.createObjectURL(scene);
        this.sourceUrl = this.blobUrl;
      } else if (this.format === "gltf") {
        // A .gltf is the text form: it names its .bin and its textures by
        // relative path. A blob: URL has an opaque origin, so those siblings
        // would resolve against nothing and the model would arrive empty --
        // the loader gets the ORIGINAL url and re-reads it from the browser's
        // cache. The download above still bought the size guard, the progress,
        // the Cancel button and the precise error messages.
        this.sourceUrl = url;
      } else {
        this.blobUrl = URL.createObjectURL(bytes);
        this.sourceUrl = this.blobUrl;
      }
    },

    /**
     * A three.js scene as a Blob the loader can read, or null after failing.
     *
     * Design Explorer's files are the format three.js wrote before r99, which
     * its loader now refuses (see data/threeLegacy.js); they are rewritten
     * here. A file already in the current format is passed straight through.
     */
    async readScene(bytes) {
      let json;
      try {
        json = JSON.parse(await bytes.text());
      } catch (error) {
        this.fail("This .json file isn't a 3D scene DesignSense can read.");
        return null;
      }
      if (!json || !json.metadata || json.metadata.type !== "Object") {
        this.fail(
          "This .json file holds no three.js scene. Design Explorer's 3D files do; " +
            "other .json files are data, not geometry."
        );
        return null;
      }
      let scene = json;
      if (isLegacyScene(json)) {
        try {
          scene = convertLegacyScene(json);
        } catch (error) {
          this.fail("This 3D scene is in a form DesignSense couldn't read.");
          return null;
        }
      }
      return new Blob([JSON.stringify(scene)], { type: "application/json" });
    },

    /** The body as a Blob, or null when it was cancelled or hit the cap. */
    async readBody(response, controller, allowOversize) {
      let total = Number(response.headers.get("content-length")) || 0;
      if (!response.body || !response.body.getReader) {
        // No streams here (older Safari): an indeterminate bar, and the cap
        // checked once on the finished blob.
        this.percent = -1;
        let whole = await response.blob();
        if (this.controller !== controller) return null;
        if (whole.size > MAX_BYTES && !allowOversize) {
          this.askFirst(whole.size, controller);
          return null;
        }
        return whole;
      }

      let reader = response.body.getReader();
      let chunks = [];
      let received = 0;
      this.percent = total ? 0 : -1;
      for (;;) {
        let step = await reader.read();
        if (this.controller !== controller) return null;
        if (step.done) break;
        chunks.push(step.value);
        received += step.value.length;
        // A server that declares no length can still send a huge file, so the
        // cap is enforced again as the bytes arrive.
        if (received > MAX_BYTES && !allowOversize) {
          this.askFirst(total || received, controller);
          return null;
        }
        if (total) {
          this.percent = Math.min(99, Math.round((received / total) * 100));
        }
      }
      return new Blob(chunks);
    },

    askFirst(size, controller) {
      // Stop the download while the question stands; confirming starts again.
      controller.abort();
      this.sizeBytes = size;
      this.state = "confirm";
    },

    /**
     * The .mtl beside an .obj, when there is one. An .obj with no materials
     * is normal and not an error, so a guess is probed before it is used:
     * ModelObj reports a missing .mtl as a load failure.
     */
    async findMtl(url, controller) {
      // By the file's name, not the url's: a folder's files are reached by
      // addresses (a download link, a blob: URL) that don't carry it.
      let stem = fileNameOf(this.fileName).replace(/\.obj$/i, "");
      // A folder listing (Drive, OneDrive) knows the sharing url of every file
      // beside the model, and returns undefined when the dataset came from a
      // plain link that has no listing.
      let listed = folderFileUrl(stem + ".mtl");
      if (listed) return listed;
      // Otherwise the sibling path is the only guess. It drops any query, so
      // it can't work for signed links -- which is why the listing comes first.
      let sibling = siblingUrl(url, stem + ".mtl");
      if (!sibling) return undefined;
      try {
        let response = await fetch(sibling, { signal: controller.signal });
        if (!response.ok) return undefined;
        // Drained so the connection closes; an .mtl is a few hundred bytes and
        // the loader's own read of it comes from cache.
        await response.text();
        return sibling;
      } catch (error) {
        return undefined;
      }
    },

    onLoaded() {
      let view = this.$refs.model;
      if (view && view.object) {
        computeMissingNormals(view.object);
        this.frame(view);
        this.takeOverRendering(view);
      }
      this.state = "ready";
      this.$emit("loaded", this.model);
    },

    /**
     * The wrapper redraws on every animation frame for as long as it is
     * mounted, which keeps a whole workspace of charts and thumbnails from
     * ever going idle. A still model needs no redrawing, so the loop stops
     * here and the picture is redrawn only when something moves it.
     */
    takeOverRendering(view) {
      if (view.reqId) {
        cancelAnimationFrame(view.reqId);
        view.reqId = null;
      }
      // A screen with more pixels than this gains nothing a viewer this size
      // can show, and costs them all every redraw.
      if (view.renderer && view.renderer.setPixelRatio) {
        view.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      }
      // The wrapper raycasts the whole model on every mouse move to emit hover
      // events this viewer doesn't use; on a real massing that is the single
      // most expensive thing it does.
      if (view.$el && view.onMouseMove) {
        view.$el.removeEventListener("mousemove", view.onMouseMove, false);
      }
      if (view.$el && view.onClick) {
        view.$el.removeEventListener("click", view.onClick, false);
      }
      this.draw = () => {
        // Coalesced: orbiting fires many changes per frame.
        if (this.drawPending) return;
        this.drawPending = true;
        this.drawId = requestAnimationFrame(() => {
          this.drawPending = false;
          let current = this.$refs.model;
          if (current && current.renderer && current.scene && current.camera) {
            current.render();
          }
        });
      };
      if (view.controls && view.controls.addEventListener) {
        view.controls.addEventListener("change", this.draw);
      }
      window.addEventListener("resize", this.draw);
      // The first picture is drawn straight away rather than waiting for a
      // frame, so a background tab still has something to show when it opens.
      view.render();
    },

    onLoaderError() {
      // The bytes arrived whole, so anything failing now is the file itself.
      this.teardown();
      this.fail(
        "This file isn't a valid ." +
          this.format +
          " -- it may be damaged, or saved in another format under that name."
      );
    },

    fail(message) {
      this.state = "error";
      this.message = message;
      this.$emit("error", { model: this.model, message: message });
    },

    toggleZUp() {
      this.zUp = !this.zUp;
      // Rhino and most CAD exports call Z up; glTF and three call Y up.
      this.rotation = this.zUp
        ? { x: -Math.PI / 2, y: 0, z: 0 }
        : { x: 0, y: 0, z: 0 };
      // The wrapper watches `rotation` and turns the object; re-framing has to
      // wait for that to have happened.
      this.$nextTick(() => {
        let view = this.$refs.model;
        if (view && view.object) this.frame(view);
      });
    },

    /** Points the camera at the model, using the model's own bounds. */
    frame(view) {
      view.scene.updateMatrixWorld(true);
      let bounds = worldBounds(view.object);
      if (!bounds) return;

      // Re-centre on what the geometry actually occupies. The wrapper centres
      // the model when it loads, before any Z-up rotation is applied, which
      // otherwise leaves a turned model orbiting off to one side.
      view.wrapper.position.x -= (bounds.min[0] + bounds.max[0]) / 2;
      view.wrapper.position.y -= (bounds.min[1] + bounds.max[1]) / 2;
      view.wrapper.position.z -= (bounds.min[2] + bounds.max[2]) / 2;

      let dx = bounds.max[0] - bounds.min[0];
      let dy = bounds.max[1] - bounds.min[1];
      let dz = bounds.max[2] - bounds.min[2];
      let radius = Math.sqrt(dx * dx + dy * dy + dz * dz) / 2;
      if (!(radius > 0)) radius = 1;

      // The wrapper's camera has a 45-degree vertical field of view, so this
      // is the distance at which a sphere that size just fills the frame, plus
      // a margin so the model isn't touching the edges.
      let distance = (radius / Math.sin((Math.PI / 180) * 22.5)) * 1.15;
      // Three-quarter view: a straight-on camera hides the depth of a massing.
      let length = Math.sqrt(0.8 * 0.8 + 0.55 * 0.55 + 1);
      this.cameraPosition = {
        x: (distance * 0.8) / length,
        y: (distance * 0.55) / length,
        z: distance / length,
      };
      // Close enough to read a detail, far enough to keep the whole thing in
      // view, and neither so far that it vanishes.
      this.controlsOptions.minDistance = radius * 0.05;
      this.controlsOptions.maxDistance = distance * 8;

      // The wrapper reads cameraPosition as a prop, so the new value has to
      // reach it before the camera is moved.
      this.$nextTick(() => {
        // The viewer may have been torn down in between, which drops `object`.
        if (view.object && view.updateCamera) view.updateCamera();
        if (this.draw) this.draw();
      });
    },

    teardown() {
      if (this.controller) {
        this.controller.abort();
        this.controller = null;
      }
      if (this.drawId) {
        cancelAnimationFrame(this.drawId);
        this.drawId = null;
      }
      this.drawPending = false;
      if (this.draw) {
        window.removeEventListener("resize", this.draw);
        let previous = this.$refs.model;
        if (previous && previous.controls && previous.controls.removeEventListener) {
          previous.controls.removeEventListener("change", this.draw);
        }
        this.draw = null;
      }
      // While the child is still here: once it is destroyed its renderer and
      // its scene are out of reach.
      this.disposeViewer();
      if (this.blobUrl) {
        URL.revokeObjectURL(this.blobUrl);
        this.blobUrl = null;
      }
      this.sourceUrl = null;
      this.mtlUrl = undefined;
      this.percent = 0;
    },

    /**
     * The wrapper disposes neither the model's buffers nor the GL context, and
     * a browser allows about 16 contexts at once -- without this, a session of
     * inspecting options ends with viewers that never draw again.
     */
    disposeViewer() {
      let view = this.$refs.model;
      if (!view) return;
      // Stop the render loop first: a render() on a lost context only logs.
      if (view.reqId) cancelAnimationFrame(view.reqId);
      if (view.object) {
        view.object.traverse(disposeNode);
        if (view.wrapper) view.wrapper.remove(view.object);
        view.object = null;
      }
      let renderer = view.renderer;
      if (renderer) {
        if (renderer.forceContextLoss) renderer.forceContextLoss();
        if (renderer.dispose) renderer.dispose();
      }
    },
  },
};
</script>

<style scoped>
.mv-root {
  position: relative;
  width: 100%;
  background: #fafbfc;
  border: 1px solid #eceff1;
  border-radius: 4px;
  overflow: hidden;
  font-size: 13px;
  color: #546e7a;
}

/* Absolute, so the wrapper's own `height: 100%` canvas has a definite box to
   fill however the inspector is resized. */
.mv-stage {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.mv-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  text-align: center;
  background: #fafbfc;
}

.mv-tools {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: 1;
  display: flex;
  background: rgba(250, 251, 252, 0.85);
  border-radius: 4px;
}

.mv-name {
  max-width: 100%;
  font-size: 13px;
  font-weight: 500;
  color: #37474f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mv-chip {
  padding: 1px 8px;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #546e7a;
  background: #eceff1;
  border-radius: 10px;
}

.mv-note {
  max-width: 320px;
  font-size: 12px;
  line-height: 1.4;
  color: #546e7a;
}
.mv-error {
  color: #78525a;
}

.mv-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mv-progress {
  width: 60%;
  min-width: 120px;
  max-width: 240px;
}

.mv-webgl {
  padding: 16px;
  font-size: 12px;
  line-height: 1.4;
  color: #546e7a;
}
</style>
