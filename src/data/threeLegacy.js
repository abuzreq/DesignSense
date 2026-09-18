/*
 * Design Explorer's 3D files, for a three.js that no longer reads them.
 *
 * Design Explorer shows geometry exported from Grasshopper by Spectacles and
 * its predecessor va3c: a three.js "Object" scene at format version 4, whose
 * geometries are the old face-and-vertex `Geometry` rather than
 * `BufferGeometry`. three.js dropped that geometry, and r118's ObjectLoader
 * answers "Loading \"Geometry\" is not supported anymore" and then throws on
 * the geometry it didn't build. So the file is rewritten here, before any
 * loader sees it: the same scene, the same uuids, every geometry rebuilt.
 *
 * Three things besides the geometry have to be translated:
 *
 *   - Colours are written as strings ("0xFFC700"). The material loader turns
 *     one into a number only by accident of how JavaScript reads "0x"; they
 *     are made numbers here instead.
 *   - A mesh coloured face by face carries a `MeshFaceMaterial`, which three
 *     removed in r72. Its materials become an array on the mesh, and the
 *     faces become the geometry groups that index into it.
 *   - Which material a face uses is not in the file's face records at all:
 *     Spectacles writes the indices as a comma-separated string in the mesh's
 *     userData, so the groups are built from there.
 *
 * The format itself is documented by the loader that used to read it,
 * three.js r108's examples/js/loaders/deprecated/LegacyJSONLoader.js; the
 * face bitmask and the winding of a quad follow it exactly.
 *
 * Kept free of imports -- of three.js above all. A second copy of the library
 * in the bundle is the thing the viewer takes pains to avoid.
 */

// What the rewritten file claims to be: the Object format as r118 reads it.
const OBJECT_VERSION = 4.5;

function isBitSet(value, position) {
  return !!(value & (1 << position));
}

function isNumber(value) {
  return typeof value === "number" && isFinite(value);
}

/**
 * A colour as a number. The exporters write "0xFFC700"; a hand-edited file
 * may hold "#FFC700" or a number already. Undefined when it is none of these,
 * which leaves the material's own default in place.
 */
export function colorNumber(value) {
  if (isNumber(value)) return value;
  if (typeof value !== "string") return undefined;
  let text = value.trim();
  if (text === "") return undefined;
  let digits = text.charAt(0) === "#" ? text.slice(1) : text;
  let parsed = /^0[xX]/.test(digits)
    ? Number(digits)
    : parseInt(digits, 16);
  return isNumber(parsed) ? parsed : undefined;
}

/** Whether `json` is a scene this module has to rewrite before a loader can read it. */
export function isLegacyScene(json) {
  if (!json || !json.metadata || json.metadata.type !== "Object") return false;
  let geometries = json.geometries || [];
  for (let i = 0; i < geometries.length; i++) {
    if (geometries[i] && geometries[i].type === "Geometry") return true;
  }
  let materials = json.materials || [];
  for (let i = 0; i < materials.length; i++) {
    if (materials[i] && materials[i].type === "MeshFaceMaterial") return true;
  }
  return false;
}

/**
 * The per-face material indices Spectacles leaves in a mesh's userData, as
 * numbers. The string ends in a comma, so blanks are dropped rather than read
 * as face zero.
 */
function faceColorIndexes(object) {
  let data = object && object.userData;
  let text = data && data.Spectacles_FaceColorIndexes;
  if (typeof text !== "string" || text === "") return null;
  let out = [];
  text.split(",").forEach(function(part) {
    let trimmed = part.trim();
    if (trimmed === "") return;
    let value = parseInt(trimmed, 10);
    out.push(isNumber(value) && value >= 0 ? value : 0);
  });
  return out.length > 0 ? out : null;
}

/**
 * Reads the old vertex-and-face arrays into triangles.
 *
 * `faceMaterials`, when given, says which material each *face* uses -- a quad
 * hands its index to both of the triangles it becomes.
 */
function readTriangles(data, faceMaterials) {
  let vertices = data.vertices || [];
  let faces = data.faces || [];
  let normals = data.normals || [];
  let colors = data.colors || [];
  let uvLayers = [];
  (data.uvs || []).forEach(function(layer) {
    // The format keeps empty layers; only filled ones count towards indices.
    if (layer && layer.length > 0) uvLayers.push(layer);
  });
  // The exporters write 1. Anything else scaled the vertices on the way out.
  let scale = isNumber(data.scale) && data.scale !== 0 ? data.scale : 1;

  let triangles = [];
  let offset = 0;
  let faceNumber = 0;
  while (offset < faces.length) {
    let type = faces[offset++];
    let isQuad = isBitSet(type, 0);
    let hasMaterial = isBitSet(type, 1);
    let hasFaceVertexUv = isBitSet(type, 3);
    let hasFaceNormal = isBitSet(type, 4);
    let hasFaceVertexNormal = isBitSet(type, 5);
    let hasFaceColor = isBitSet(type, 6);
    let hasFaceVertexColor = isBitSet(type, 7);
    let corners = isQuad ? 4 : 3;

    let indices = [];
    for (let i = 0; i < corners; i++) indices.push(faces[offset++]);
    // A quad is two triangles sharing the diagonal from its first corner to
    // its last: 0-1-3 and 1-2-3, as the loader that wrote this format cut it.
    let cuts = isQuad ? [[0, 1, 3], [1, 2, 3]] : [[0, 1, 2]];

    let material = 0;
    if (hasMaterial) material = faces[offset++];
    else if (faceMaterials && faceNumber < faceMaterials.length) {
      material = faceMaterials[faceNumber];
    }

    let uvsByCorner = null;
    if (hasFaceVertexUv) {
      uvsByCorner = [];
      for (let layer = 0; layer < uvLayers.length; layer++) {
        let uvs = [];
        for (let i = 0; i < corners; i++) {
          let index = faces[offset++] * 2;
          uvs.push([uvLayers[layer][index], uvLayers[layer][index + 1]]);
        }
        // Only the first layer reaches the "uv" attribute; three's own
        // conversion did the same, and nothing here reads a second one.
        if (layer === 0) uvsByCorner = uvs;
      }
    }

    let faceNormal = null;
    if (hasFaceNormal) {
      let index = faces[offset++] * 3;
      faceNormal = [normals[index], normals[index + 1], normals[index + 2]];
    }

    let normalsByCorner = null;
    if (hasFaceVertexNormal) {
      normalsByCorner = [];
      for (let i = 0; i < corners; i++) {
        let index = faces[offset++] * 3;
        normalsByCorner.push([
          normals[index],
          normals[index + 1],
          normals[index + 2],
        ]);
      }
    }

    let faceColor = null;
    if (hasFaceColor) faceColor = colors[faces[offset++]];

    let colorsByCorner = null;
    if (hasFaceVertexColor) {
      colorsByCorner = [];
      for (let i = 0; i < corners; i++) {
        colorsByCorner.push(colors[faces[offset++]]);
      }
    }

    cuts.forEach(function(cut) {
      triangles.push({
        vertices: cut.map(function(corner) {
          let index = indices[corner] * 3;
          return [
            vertices[index] * scale,
            vertices[index + 1] * scale,
            vertices[index + 2] * scale,
          ];
        }),
        normals: normalsByCorner
          ? cut.map(function(corner) {
              return normalsByCorner[corner];
            })
          : faceNormal
          ? [faceNormal, faceNormal, faceNormal]
          : null,
        uvs: uvsByCorner
          ? cut.map(function(corner) {
              return uvsByCorner[corner];
            })
          : null,
        colors: colorsByCorner
          ? cut.map(function(corner) {
              return colorsByCorner[corner];
            })
          : faceColor !== null
          ? [faceColor, faceColor, faceColor]
          : null,
        material: material,
      });
    });
    faceNumber += 1;
  }
  return triangles;
}

/** The unit normal of a triangle, or [0, 0, 1] for one with no area. */
function flatNormal(corners) {
  let ax = corners[1][0] - corners[0][0];
  let ay = corners[1][1] - corners[0][1];
  let az = corners[1][2] - corners[0][2];
  let bx = corners[2][0] - corners[0][0];
  let by = corners[2][1] - corners[0][1];
  let bz = corners[2][2] - corners[0][2];
  let x = ay * bz - az * by;
  let y = az * bx - ax * bz;
  let z = ax * by - ay * bx;
  let length = Math.sqrt(x * x + y * y + z * z);
  if (!(length > 0)) return [0, 0, 1];
  return [x / length, y / length, z / length];
}

function pushColor(into, hex) {
  let value = isNumber(hex) ? hex : 0xffffff;
  into.push(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255
  );
}

function attribute(array, itemSize) {
  return {
    itemSize: itemSize,
    type: "Float32Array",
    array: array,
    normalized: false,
  };
}

/**
 * One old geometry as a BufferGeometry, with a group per material used.
 *
 * The triangles are written out one by one rather than indexed: a face in
 * this format carries its own normals, uvs and colours, so two faces meeting
 * at a vertex do not necessarily agree about it. Triangles are ordered by
 * material so that each material is one group, and so one draw call, however
 * the faces were interleaved in the file.
 */
function convertGeometryData(data, faceMaterials) {
  let triangles = readTriangles(data, faceMaterials);

  // No faces: the file is a line, whose vertices are its path in order.
  if (triangles.length === 0) {
    let positions = [];
    let vertices = data.vertices || [];
    let scale = isNumber(data.scale) && data.scale !== 0 ? data.scale : 1;
    for (let i = 0; i + 2 < vertices.length; i += 3) {
      positions.push(
        vertices[i] * scale,
        vertices[i + 1] * scale,
        vertices[i + 2] * scale
      );
    }
    return { attributes: { position: attribute(positions, 3) }, groups: [] };
  }

  let order = triangles
    .map(function(triangle, index) {
      return { index: index, material: triangle.material };
    })
    .sort(function(a, b) {
      return a.material - b.material || a.index - b.index;
    });

  let positions = [];
  let normals = [];
  let uvs = [];
  let colors = [];
  let hasUvs = false;
  let hasColors = false;
  let groups = [];
  let group = null;

  order.forEach(function(entry, position) {
    let triangle = triangles[entry.index];
    if (!group || group.materialIndex !== triangle.material) {
      group = { start: position * 3, count: 0, materialIndex: triangle.material };
      groups.push(group);
    }
    group.count += 3;

    let computed = triangle.normals ? null : flatNormal(triangle.vertices);
    for (let corner = 0; corner < 3; corner++) {
      let vertex = triangle.vertices[corner];
      positions.push(vertex[0], vertex[1], vertex[2]);
      let normal = computed || triangle.normals[corner];
      normals.push(normal[0], normal[1], normal[2]);
      if (triangle.uvs) {
        hasUvs = true;
        uvs.push(triangle.uvs[corner][0], triangle.uvs[corner][1]);
      } else {
        uvs.push(0, 0);
      }
      if (triangle.colors) {
        hasColors = true;
        pushColor(colors, triangle.colors[corner]);
      } else {
        colors.push(1, 1, 1);
      }
    }
  });

  let attributes = {
    position: attribute(positions, 3),
    normal: attribute(normals, 3),
  };
  if (hasUvs) attributes.uv = attribute(uvs, 2);
  if (hasColors) attributes.color = attribute(colors, 3);
  return { attributes: attributes, groups: groups };
}

/** A material with its colours as numbers; unknown keys are left alone. */
function convertMaterial(material) {
  let out = {};
  Object.keys(material).forEach(function(key) {
    out[key] = material[key];
  });
  ["color", "emissive", "specular", "ambient"].forEach(function(key) {
    if (out[key] === undefined) return;
    let number = colorNumber(out[key]);
    if (number === undefined) delete out[key];
    else out[key] = number;
  });
  /*
   * The va3c exporter writes `"opacity": 0, "transparent": false`, which the
   * renderer of the day ignored -- opacity was for transparent materials. It
   * is not ignored now: it becomes the pixel's alpha, and against a canvas
   * with an alpha channel the whole model comes out invisible. A material
   * that is not transparent is opaque, which is what the file meant.
   */
  if (out.transparent !== true && out.opacity !== undefined) out.opacity = 1;
  return out;
}

/**
 * The materials as r118 wants them, and what each old uuid now stands for: a
 * `MeshFaceMaterial` becomes the list of materials it held, which a mesh then
 * names as an array.
 */
function convertMaterials(materials) {
  let out = [];
  let seen = {};
  let arrays = {};
  let add = function(material) {
    if (!material || !material.uuid || seen[material.uuid]) return;
    seen[material.uuid] = true;
    out.push(convertMaterial(material));
  };
  (materials || []).forEach(function(material) {
    if (!material) return;
    if (material.type === "MeshFaceMaterial" || material.type === "MultiMaterial") {
      let inner = material.materials || [];
      arrays[material.uuid] = inner.map(function(one) {
        return one.uuid;
      });
      inner.forEach(add);
      return;
    }
    add(material);
  });
  return { materials: out, arrays: arrays };
}

/**
 * A three.js scene in the old format, rewritten as one r118 can load.
 * Returns a new object; the file that was parsed is left as it was.
 */
export function convertLegacyScene(json) {
  let converted = convertMaterials(json.materials);
  let sources = {};
  (json.geometries || []).forEach(function(geometry) {
    if (geometry && geometry.uuid) sources[geometry.uuid] = geometry;
  });

  let geometries = [];
  // Which source uuids have been written out, and what each shape of a
  // geometry -- the geometry together with one mesh's face materials -- is
  // called in the result.
  let emitted = {};
  let shapes = {};
  let clones = 0;
  /*
   * Which material each face uses is a property of the *mesh* in this format,
   * so a geometry drawn by two meshes that colour their faces differently has
   * to become two geometries. Rare, and silently wrong if it isn't handled.
   */
  let geometryFor = function(uuid, faceMaterials) {
    let source = sources[uuid];
    if (!source) return uuid;
    // One already in the current format is passed through, once.
    if (source.type !== "Geometry") {
      if (!emitted[uuid]) {
        emitted[uuid] = true;
        geometries.push(source);
      }
      return uuid;
    }
    let key = uuid + "|" + (faceMaterials ? faceMaterials.join(",") : "");
    if (shapes[key]) return shapes[key];
    // The first shape keeps the file's uuid; another gets one of its own.
    let id = emitted[uuid] ? uuid + "-" + ++clones : uuid;
    emitted[uuid] = true;
    shapes[key] = id;
    let entry = { uuid: id, type: "BufferGeometry" };
    if (source.name !== undefined) entry.name = source.name;
    entry.data = convertGeometryData(source.data || {}, faceMaterials);
    geometries.push(entry);
    return id;
  };

  let convertObject = function(object) {
    let out = {};
    Object.keys(object).forEach(function(key) {
      if (key !== "children") out[key] = object[key];
    });
    if (object.geometry) {
      out.geometry = geometryFor(object.geometry, faceColorIndexes(object));
    }
    if (object.material && converted.arrays[object.material]) {
      out.material = converted.arrays[object.material].slice();
    }
    if (object.children) out.children = object.children.map(convertObject);
    return out;
  };

  let object = json.object ? convertObject(json.object) : json.object;

  // A geometry no object draws is converted too, so that nothing in the file
  // is quietly dropped on the way through.
  (json.geometries || []).forEach(function(geometry) {
    if (geometry && geometry.uuid && !emitted[geometry.uuid]) {
      geometryFor(geometry.uuid, null);
    }
  });

  return {
    metadata: {
      version: OBJECT_VERSION,
      type: "Object",
      generator: "DesignSense (from " + generatorOf(json) + ")",
    },
    geometries: geometries,
    materials: converted.materials,
    object: object,
  };
}

function generatorOf(json) {
  let generator = json.metadata && json.metadata.generator;
  return generator ? String(generator) : "an older three.js export";
}
