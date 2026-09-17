/**
 * Does the generative rung get faster on a GPU, and by how much?
 *
 *   node eval/bench-device.mjs [model]
 *
 * onnxruntime-node here ships DirectML, so "dml" is a real execution provider
 * on Windows. In a browser the equivalent knob is device: "webgpu".
 *
 * Speed is the only thing this measures. A5's problem was that 192 of 221
 * completions were invalid, which no execution provider changes.
 */

import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;

const MODEL = process.argv[2] || "onnx-community/Qwen2.5-0.5B-Instruct";
const PROMPT = [
  { role: "system", content: 'Reply with one JSON object. Columns: "price", "year", "odometer".' },
  { role: "user", content: "price under 10000 and year at least 2015" },
];

async function run(device, dtype) {
  let label = device + "/" + dtype;
  try {
    let t0 = Date.now();
    let generate = await pipeline("text-generation", MODEL, { device: device, dtype: dtype });
    let load = Date.now() - t0;

    // One untimed pass: the first call pays for shader or kernel compilation.
    await generate(PROMPT, { max_new_tokens: 8, do_sample: false });

    let runs = [];
    for (let i = 0; i < 3; i++) {
      let t1 = Date.now();
      let out = await generate(PROMPT, { max_new_tokens: 64, do_sample: false });
      runs.push(Date.now() - t1);
      if (i === 0) {
        let text = out[0].generated_text;
        if (typeof text !== "string") text = text[text.length - 1].content;
        console.log("    " + JSON.stringify(String(text).replace(/\s+/g, " ").slice(0, 120)));
      }
    }
    runs.sort((a, b) => a - b);
    let median = runs[1];
    console.log(
      "  " + label.padEnd(14) +
      " load " + (load / 1000).toFixed(1) + "s" +
      "   64 tokens " + median + "ms" +
      "   ~" + (64000 / median).toFixed(1) + " tok/s"
    );
  } catch (e) {
    console.log("  " + label.padEnd(14) + " FAILED: " + e.message.split("\n")[0].slice(0, 110));
  }
}

console.log(MODEL);
await run("cpu", "q4");
await run("dml", "q4");
await run("dml", "fp16");
