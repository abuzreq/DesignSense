/**
 * Two sentence encoders behind one interface, so an approach can swap which
 * one it uses without changing anything else.
 *
 *   potion — minishlab/potion-base-8M, 30 MB, 256 dims. A static embedding
 *            table with mean pooling: no transformer forward pass, so it is
 *            roughly a lookup. Driven through onnxruntime directly because it
 *            takes EmbeddingBag-style (input_ids, offsets) inputs that the
 *            generic feature-extraction pipeline does not supply.
 *   minilm — Xenova/all-MiniLM-L6-v2 int8, ~23 MB, 384 dims. Six transformer
 *            layers through the normal pipeline.
 *
 * Both are warmed up in a batch before scoring and then read from a cache, so
 * the harness can stay synchronous and so download time is not charged to
 * per-utterance latency. Encode cost is measured separately during warmup.
 */

import { mkdirSync, existsSync, writeFileSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, "..", ".cache");

const POTION_URL =
  "https://huggingface.co/minishlab/potion-base-8M/resolve/main/onnx/model.onnx";

function normalise(vector) {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) sum += vector[i] * vector[i];
  let length = Math.sqrt(sum) || 1;
  let out = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) out[i] = vector[i] / length;
  return out;
}

export function cosine(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/* ---------------------------------------------------------------- potion -- */

async function potionEncoder() {
  const ort = await import("onnxruntime-node");
  const { AutoTokenizer } = await import("@huggingface/transformers");

  mkdirSync(join(CACHE, "potion-base-8M"), { recursive: true });
  let file = join(CACHE, "potion-base-8M", "model.onnx");
  if (!existsSync(file)) {
    let response = await fetch(POTION_URL);
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  let bytes = statSync(file).size;

  let session = await ort.InferenceSession.create(file);
  let tokenizer = await AutoTokenizer.from_pretrained("minishlab/potion-base-8M");
  let output = session.outputNames[0];

  return {
    name: "potion-base-8M",
    bytes: bytes,
    async encode(texts) {
      // One EmbeddingBag call for the whole batch: `offsets` says where each
      // text starts in the concatenated id stream.
      let flat = [];
      let offsets = [];
      for (let text of texts) {
        offsets.push(flat.length);
        let ids = Array.from(tokenizer(text).input_ids.data, Number);
        // An empty sequence would make the bag read past the next offset.
        if (ids.length === 0) ids = [0];
        flat.push(...ids);
      }
      let result = await session.run({
        input_ids: new ort.Tensor("int64", BigInt64Array.from(flat, BigInt), [flat.length]),
        offsets: new ort.Tensor("int64", BigInt64Array.from(offsets, BigInt), [offsets.length]),
      });
      let tensor = result[output];
      let dims = tensor.dims[1];
      return texts.map((_, i) =>
        normalise(Float32Array.from(tensor.data.slice(i * dims, (i + 1) * dims)))
      );
    },
  };
}

/* ---------------------------------------------------------------- minilm -- */

async function minilmEncoder() {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  let pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });

  return {
    name: "all-MiniLM-L6-v2 (int8)",
    // Reported from the hub rather than measured: transformers.js keeps its
    // own cache layout and the number that matters is what a browser fetches.
    bytes: 23 * 1e6,
    async encode(texts) {
      let out = [];
      for (let start = 0; start < texts.length; start += 64) {
        let batch = texts.slice(start, start + 64);
        let tensor = await pipe(batch, { pooling: "mean", normalize: true });
        let dims = tensor.dims[tensor.dims.length - 1];
        batch.forEach((_, i) =>
          out.push(Float32Array.from(tensor.data.slice(i * dims, (i + 1) * dims)))
        );
      }
      return out;
    },
  };
}

const BUILDERS = { potion: potionEncoder, minilm: minilmEncoder };

/**
 * A cache in front of an encoder. `warmup` pays the whole cost up front and
 * records how long encoding took per text, so latency can be reported without
 * the model load in it.
 */
export async function makeEncoder(kind) {
  let encoder = await BUILDERS[kind]();
  let cache = new Map();
  let encodeMicros = [];

  return {
    name: encoder.name,
    bytes: encoder.bytes,
    async warmup(texts) {
      let missing = Array.from(new Set(texts)).filter((t) => !cache.has(t));
      if (missing.length === 0) return;
      let started = process.hrtime.bigint();
      let vectors = await encoder.encode(missing);
      let micros = Number(process.hrtime.bigint() - started) / 1000 / missing.length;
      encodeMicros.push(micros);
      missing.forEach((text, i) => cache.set(text, vectors[i]));
    },
    /** Null when the text was never warmed up, so a miss is visible rather than silent. */
    vec(text) {
      return cache.get(text) || null;
    },
    perTextMicros() {
      if (encodeMicros.length === 0) return 0;
      return encodeMicros.reduce((a, b) => a + b, 0) / encodeMicros.length;
    },
  };
}
