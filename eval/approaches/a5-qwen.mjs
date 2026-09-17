/**
 * A5 — a small instruction-tuned model emitting the command as JSON.
 *
 * Qwen2.5-0.5B-Instruct, q4, through transformers.js. No grammar, no alias
 * table, no shapes: the model is given the command list, the dataset's column
 * names and six examples, and asked for one JSON object. This is the rung that
 * tests whether a generative model can do the whole job, and in particular
 * whether it can do the one thing the grammar is worst at — composition.
 *
 * Generation happens in `warmup` for the whole set at once, so `parse` stays a
 * synchronous cache lookup. The cost is reported per item rather than hidden.
 *
 * There is no constrained decoding here. transformers.js has no grammar-based
 * sampler, so validity is enforced after the fact: anything that is not a JSON
 * object naming a known command with known argument names is discarded and
 * counted as a no-parse. That is the honest version of what shipping this
 * would look like without extra machinery.
 */

import { COMMANDS, DATASETS } from "../schema.mjs";

// Overridable so alternative small models can be compared on the same
// prompt, validator and metrics without a new approach file.
const MODEL = process.env.A5_MODEL || "onnx-community/Qwen2.5-0.5B-Instruct";
const DTYPE = process.env.A5_DTYPE || "q4";

/** The command list, compact enough not to dominate the prompt. */
function commandCatalogue() {
  return Object.keys(COMMANDS)
    .map((id) => {
      let spec = COMMANDS[id];
      let args = spec.required.concat(spec.optional.map((o) => o + "?"));
      return id + (args.length ? "(" + args.join(",") + ")" : "()");
    })
    .join("\n");
}

/**
 * Few-shot examples, built from two real columns of the dataset in play.
 *
 * The first version of this used "<measure>" placeholders and the model
 * dutifully copied the placeholder into every answer -- it was being taught to
 * emit a token, not to look a column up. Showing it real strings from the list
 * it has just been given is the difference between a demonstration and a
 * template.
 *
 * None of these utterances appears in the evaluation set.
 */
export function shots(columns) {
  let a = columns[0];
  let b = columns.length > 1 ? columns[1] : columns[0];
  let q = (x) => JSON.stringify(x);
  return [
    ["limit to entries with " + a + " greater than 12",
     '{"command":"filter.range","args":{"dim":' + q(a) + ',"op":"gte","value":12}}'],
    ["keep the 8 largest on " + b,
     '{"command":"filter.topk","args":{"dim":' + q(b) + ',"k":8,"direction":"max"}}'],
    ["order the gallery by " + a + ", high to low",
     '{"command":"view.sort","args":{"dim":' + q(a) + ',"desc":true}}'],
    [a + " over 5 and " + b + " under 3",
     '{"command":"sequence","args":{"steps":[' +
     '{"command":"filter.range","args":{"dim":' + q(a) + ',"op":"gte","value":5}},' +
     '{"command":"filter.range","args":{"dim":' + q(b) + ',"op":"lte","value":3}}]}}'],
    ["keep the big ones",
     '{"command":"clarify","args":{"slot":"value","candidates":["a number you name","the top 25%"]}}'],
    ["book me a flight",
     '{"command":"abstain","args":{"reason":"out_of_scope"}}'],
  ];
}

export function usableColumns(dataset) {
  return (DATASETS[dataset] || []).filter(
    (c) => !["img", "images", "image", "image_url", "threeD", "json", "url", "region_url", "lat", "long", "id"].includes(c)
  );
}

export function systemPrompt(dataset) {
  let columns = usableColumns(dataset);
  return [
    "You turn a request about a table of design options into ONE JSON command.",
    "",
    "Commands (? marks an optional argument):",
    commandCatalogue(),
    "",
    "Columns of this table:",
    columns.map((c) => JSON.stringify(c)).join(", "),
    "",
    "Rules:",
    '- op is one of "gte", "lte", "between", "eq". Use gte for above/at least, lte for below/at most.',
    '- "between" takes range:[lo,hi]. Other ops take value.',
    "- Several actions in one request become sequence, with steps in order.",
    '- If the column named could be several of the columns above, answer clarify with slot "dim" and the candidates.',
    '- If no threshold was given but one is needed, answer clarify with slot "value".',
    '- If the request is not about this table, answer abstain with reason "out_of_scope".',
    "- dim, x, y and dims must be copied character for character from the Columns list above.",
    "- Never invent a command name or an argument name that is not listed.",
    "- Reply with the JSON object and nothing else.",
  ].join("\n");
}

function buildMessages(utterance, dataset) {
  let messages = [{ role: "system", content: systemPrompt(dataset) }];
  shots(usableColumns(dataset)).forEach(([user, assistant]) => {
    messages.push({ role: "user", content: user });
    messages.push({ role: "assistant", content: assistant });
  });
  messages.push({ role: "user", content: utterance });
  return messages;
}

/** First balanced {...} in the completion, so trailing chatter is tolerated. */
function extractJson(text) {
  let start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    let ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch (e) {
          return null;
        }
      }
    }
  }
  return null;
}

/*
 * Why a completion was rejected, bucketed by what could have prevented it.
 *
 * The buckets are the point. A5 was scored with post-hoc validation because
 * transformers.js has no grammar sampler, so the headline "192 of 221
 * rejected" mixes together failures a constrained decoder would make
 * impossible with failures no decoder can help. Separating them bounds what
 * WebLLM's JSON mode could actually buy before anyone integrates it.
 */
export const REJECTION_BUCKETS = {
  // Any JSON grammar over the command schema prevents these outright.
  no_json: "structural",
  unknown_command: "structural",
  unknown_arg: "structural",
  missing_arg: "structural",
  bad_enum: "structural",
  bad_scalar: "structural",
  bad_steps: "structural",
  // Prevented only if the schema enumerates the columns of the loaded table,
  // which a json_schema can express and a plain JSON grammar cannot.
  unknown_column: "column-enum",
};

/** Validity is enforced here because nothing enforced it during decoding. */
function validate(node, dataset) {
  if (!node || typeof node !== "object") return { ok: false, why: "no_json" };
  let spec = COMMANDS[node.command];
  if (!spec) return { ok: false, why: "unknown_command" };
  let args = node.args && typeof node.args === "object" ? node.args : {};

  let allowed = spec.required.concat(spec.optional);
  for (let key of Object.keys(args)) {
    if (!allowed.includes(key)) return { ok: false, why: "unknown_arg" };
  }
  for (let key of spec.required) {
    if (!(key in args)) return { ok: false, why: "missing_arg" };
  }

  let columns = DATASETS[dataset] || [];
  for (let key of ["dim", "x", "y"]) {
    if (typeof args[key] === "string" && !columns.includes(args[key])) {
      return { ok: false, why: "unknown_column" };
    }
  }
  if (Array.isArray(args.dims) && args.dims.some((d) => !columns.includes(d))) {
    return { ok: false, why: "unknown_column" };
  }

  // Enum arguments, checked because nothing constrained the decoder. An
  // op of "ltf" reached the app once before this was here.
  let ENUMS = {
    op: ["gte", "lte", "between", "eq", "in", "not_in"],
    direction: ["max", "min", "top", "bottom"],
    stat: ["mean", "median", "min", "max", "range", "std", "count"],
    mode: ["lite", "expert"],
    operation: ["add", "subtract"],
    reason: ["out_of_scope", "unsupported", "no_such_dimension", "needs_data"],
  };
  for (let key of Object.keys(ENUMS)) {
    if (key in args && !ENUMS[key].includes(args[key])) {
      return { ok: false, why: "bad_enum" };
    }
  }
  if ("directions" in args) {
    if (!Array.isArray(args.directions)) return { ok: false, why: "bad_scalar" };
    if (args.directions.some((d) => !["max", "min"].includes(d))) {
      return { ok: false, why: "bad_enum" };
    }
  }
  for (let key of ["value", "k", "percent", "n"]) {
    if (key in args && typeof args[key] === "string") {
      return { ok: false, why: "bad_scalar" };
    }
  }

  if (node.command === "sequence") {
    if (!Array.isArray(args.steps) || args.steps.length === 0) {
      return { ok: false, why: "bad_steps" };
    }
    let steps = [];
    for (let step of args.steps) {
      let checked = validate(step, dataset);
      // A step's own reason is more informative than "bad_steps".
      if (!checked.ok) return checked;
      steps.push(checked.value);
    }
    return { ok: true, value: { command: "sequence", args: { steps: steps } } };
  }
  return { ok: true, value: { command: node.command, args: args } };
}

export function makeGenerativeApproach(config) {
  let generator = null;
  let cache = new Map();
  let millisPerItem = [];
  let invalid = 0;
  let rejections = {};

  function key(utterance, dataset) {
    return dataset + " " + utterance;
  }

  return {
    id: config.id,
    name: config.name,
    /** Exposed so A6 can reuse one loaded model rather than loading a second. */
    async generate(utterance, dataset) {
      let messages = buildMessages(utterance, dataset);
      let out = await generator(messages, {
        max_new_tokens: config.maxTokens || 128,
        do_sample: false,
        return_full_text: false,
      });
      let text = out[0].generated_text;
      if (typeof text !== "string") {
        let last = text[text.length - 1];
        text = last && last.content ? last.content : "";
      }
      let checked = validate(extractJson(text), dataset);
      let parsed = checked.ok ? checked.value : null;
      if (!checked.ok) {
        invalid++;
        rejections[checked.why] = (rejections[checked.why] || 0) + 1;
      }
      if (process.env.A5_DEBUG) {
        console.log("  IN  " + JSON.stringify(utterance));
        console.log("  RAW " + JSON.stringify(String(text).slice(0, 260)));
        console.log("  OUT " + JSON.stringify(parsed));
      }
      return parsed;
    },
    async warmup(items) {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      generator = await pipeline("text-generation", MODEL, { dtype: DTYPE, device: process.env.A5_DEVICE || "cpu" });

      // Skip anything already generated, so that A6 reusing this module in the
      // same run costs nothing rather than generating a second time.
      let todo = (config.only ? items.filter(config.only) : items).filter(
        (item) => !cache.has(key(item.utterance, item.dataset))
      );
      for (let i = 0; i < todo.length; i++) {
        let item = todo[i];
        let started = Date.now();
        let parsed = await this.generate(item.utterance, item.dataset);
        millisPerItem.push(Date.now() - started);
        cache.set(key(item.utterance, item.dataset), parsed);
        if ((i + 1) % 25 === 0) {
          process.stdout.write("[" + (i + 1) + "/" + todo.length + "] ");
        }
      }
    },
    parse(utterance, context) {
      let hit = cache.get(key(utterance, context.dataset));
      return hit === undefined ? null : hit;
    },
    notes() {
      let total = millisPerItem.reduce((a, b) => a + b, 0);
      let mean = millisPerItem.length ? total / millisPerItem.length : 0;
      let sorted = millisPerItem.slice().sort((a, b) => a - b);
      return {
        model: MODEL + " (" + DTYPE + ", " + (process.env.A5_DEVICE || "cpu") + ")",
        generate: mean.toFixed(0) + "ms mean, " +
          (sorted[Math.floor(sorted.length * 0.95)] || 0) + "ms p95",
        invalid: invalid + " completions rejected by validation",
        rejected: describeRejections(rejections, invalid),
      };
    },
  };
}

/**
 * The line that decides whether constrained decoding is worth pursuing: how
 * much of the rejection pile a grammar could have prevented, and how much of
 * it is the model naming a column that simply is not in the table.
 */
function describeRejections(rejections, total) {
  if (total === 0) return "none";
  let byBucket = {};
  Object.keys(rejections).forEach((why) => {
    let bucket = REJECTION_BUCKETS[why] || "other";
    byBucket[bucket] = (byBucket[bucket] || 0) + rejections[why];
  });
  let constrainable = (byBucket.structural || 0) + (byBucket["column-enum"] || 0);
  let detail = Object.keys(rejections)
    .sort((a, b) => rejections[b] - rejections[a])
    .map((why) => why + " " + rejections[why])
    .join(", ");
  return (
    detail +
    "\n                (" +
    Object.keys(byBucket)
      .map((b) => b + " " + byBucket[b])
      .join(", ") +
    "; " +
    ((100 * constrainable) / total).toFixed(0) +
    "% a constrained decoder could prevent)"
  );
}

export default makeGenerativeApproach({
  id: "a5",
  name: "Qwen2.5-0.5B-Instruct emitting JSON",
  dtype: "q4",
  maxTokens: 128,
});
