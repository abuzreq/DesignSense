# Why the browser SLM rungs failed, and what it would take to make one fast and accurate

Written 2026-09-16. Part 1 (critique) is grounded in the code and run logs
in this directory and the installed `@huggingface/transformers` source.
Parts 2–3 come from web research with sources inline; version numbers and
download sizes were checked against npm and Hugging Face on that date.
Part 4 is what it would take. Nothing here changes the shipped parser.

## Context

The evaluation ladder in `eval/README.md` ends with "no browser SLM enters
DesignSense", on these numbers:

| rung | what it is | exact | harmful | per item |
|---|---|---|---|---|
| A1C (shipped) | grammar + BM25 + composition | 81% | 10% | 0.2 ms |
| A4C | + MiniLM + trained head | 82% | 9% | ~1 ms |
| A5 | Qwen2.5-0.5B-Instruct, q4, prompted | 3% | 7% | 6.8 s (CPU) |
| Qwen2.5-1.5B, 8 items | same prompt | 25% | — | 18 s (CPU) |
| Llama-3.2-1B, 20 items | same prompt | 0% | 30% | 18 s (CPU) |
| TinyLlama-1.1B, 20 items | same prompt | 0% | 40% | 15 s (CPU) |

The user's question is whether that conclusion follows from the SLMs, or from
how they were used. This report argues the latter: **every generative rung was
run in the one configuration in which sub-2B models are known to be weakest
(zero training, long schema prompt, unconstrained decoding, CPU runtime), so the
ladder measured that configuration, not the model class.**

---

# Part 1 — Critique of the approach taken

## 1.1 The SLM was the only rung that received no task-specific knowledge

Every non-generative rung was given hand-built knowledge of the task:

- A1/A1C: an alias table (`ALIAS_GROUPS`), comparator lexicon, shapes, guards,
  a composition module, and 156 authored example phrasings in
  `eval/approaches/examples.mjs`.
- A4: the same 156 examples used to *train* a softmax head on frozen MiniLM
  vectors.

A5 got a 40-line command catalogue with **no descriptions** (`scope.zoom()`,
`analysis.representatives(n)` — the model cannot know what these do), the raw
column headers, six few-shot examples built mechanically from `columns[0]` and
`columns[1]`, and nothing else. It was asked to do intent, slot filling, entity
resolution, number extraction, composition, clarification and refusal in one
shot, from a schema it had never seen.

Sub-1B instruct models are not in-context learners of new schemas; they are
fine-tuning substrates. The comparison was therefore "hand-tuned symbolic system
vs. untrained statistical system", and the result was foreordained. The jump
from 0.5B (3%) to 1.5B (25%) on the same prompt measures general in-context
ability, not the ceiling of the generative approach.

## 1.2 The model was asked to do exactly what the project's own design rule forbids

`eval/README.md` establishes "retrieval for intent, grammar for arguments — a
statistical component must never produce a number", and the ladder confirms it:
encoders help intent and nothing else. A5 violated that rule on every axis:

- **Column names had to be copied character-for-character** (`out:Cooling[kWh]`,
  `Site_Cvr%`, `A/V ratio`). 18 rejections were `unknown_column`; many
  "correct" completions failed exact-match on a near-miss header string.
- **Numbers had to be emitted by the model**, including `range:[lo,hi]` and
  `k`, which is where tiny models are least reliable (`bad_scalar`).
- **Clarify candidates had to be enumerated exactly** to score — the gold for
  H001 is a four-element candidate list. No generative model reproduces that
  from a prompt; the grammar produces it from code.

The right division of labour for a small model is: model emits **intent + the
text spans it is reasoning about** (or an index into a short list), and the
existing `resolveColumn`, `parseNumbers` and clarify machinery in
`src/assistant/` turn those into arguments. That hybrid was never built or
measured.

## 1.3 Constrained decoding was estimated, not measured — and then over-interpreted

The rejection taxonomy (174 structural + 18 column-enum of 192) was the right
instrument. The inference drawn from TinyLlama ("75% valid, 0% exact, so
constraint buys validity not correctness") is not sound: TinyLlama-1.1B-Chat is
a 2023 model with weak instruction following, and its unconstrained validity
says nothing about what a *constrained, fine-tuned* model would score. Two
variables (training, constraint) were both unset; the conclusion treated one as
settled by the other.

Constraint also changes *which tokens are considered*, not just which are
accepted: with a JSON schema whose `dim` field is an enum of the live column
headers, the model's probability mass is renormalised over real columns, which
is a materially different task from free generation. Unmeasured.

## 1.4 The evaluation runtime is not the deployment runtime

All latency numbers came from `onnxruntime-node` on CPU (and one DirectML
probe). A browser would use ORT-Web's WebGPU execution provider or WebLLM's
hand-written WGSL kernels — neither was exercised. "6.8 s per utterance" and
"18 s per item" describe the harness, not the product, and the README's own
caveat ("on WebGPU it might be one to three seconds") was a guess. The DirectML
result (q4 slower than CPU) is a known kernel-coverage issue with `MatMulNBits`
on that execution provider, not evidence about GPUs.

Latency is also dominated by **prefill of a ~800-token prompt** (measured:
system prompt ≈ 550–630 tokens + shots ≈ 240–270 tokens, per dataset), repeated
on every query. Nothing cached the static prefix. A fine-tuned model needs only
the column list (~60–120 tokens) and the utterance.

## 1.5 Prompt-level defects in A5 that are fixable, not fundamental

- `unknown_arg` (89) dominates the rejections. The model invented `threshold`,
  `dimension`, `column` because the argument names in the catalogue are
  terse and undocumented, and no example demonstrated most of the 40 commands.
  A schema with one-line descriptions, or per-intent schemas, addresses this
  directly.
- The out-of-scope shot ("book me a flight") leaked: the model emitted "flight"
  as a topic. Anchoring on a single negative example is a known tiny-model
  failure; the fix is many diverse negatives in training data, not one in the
  prompt.
- Qwen3-0.6B was scored 0/8 because thinking mode was left on and it spent the
  128-token budget in `<think>`. `enable_thinking: false` in the chat template
  is a one-line fix. It was counted out on a configuration error.
- `max_new_tokens: 128` truncates multi-step `sequence` outputs in verbose JSON
  ("one unbalanced brace" for 1.5B). A compact output format removes this.
- No retry or repair: a single greedy sample, then discard.

## 1.6 The cascade tested the model on the cases nobody can do

A6 handed the SLM only A4's null cases — 8–14 utterances that the grammar could
not even begin to parse — and concluded a cascade "is worth nothing". But a
generative model's comparative advantages are elsewhere: paraphrase-heavy
utterances, world-knowledge abbreviation expansion (SVF → Sky View Factor),
multi-clause composition, and **ranking the grammar's clarify candidates**. None
of those routes was measured. The A1C figures below show where the headroom
actually is:

| A1C stratum | n | exact | harmful |
|---|---|---|---|
| ambiguous | 13 | 23% | 31% |
| synonym | 34 | 74% | 9% |
| none (intent only) | 54 | 78% | 11% |
| 2 clauses | 21 | 71% | 10% |
| 3–4 clauses | 7 | 57% | 43% |
| hard tier | 66 | 55% | 21% |

## 1.7 Sample sizes and the absence of a train split

- 1B-class models were scored on 20 items; 1.5B on 8. Fine as smoke tests, but
  the README reports them as percentages beside a 221-item number.
- There is no training set. The 221 items are the only labelled data and must
  stay held out. Nothing in the repo could have produced the thousands of pairs
  a fine-tune needs — which is itself the missing piece, not a reason the
  approach cannot work.

## 1.8 The "one untested variable" was testable in the existing harness

The README says constrained decoding was untestable because "transformers.js
has no grammar sampler". Checked against the installed copy
(`node_modules/@huggingface/transformers`, version 4.2.0):

- `generate()` accepts a `logits_processor` (`LogitsProcessorList`), and
  `LogitsProcessor` is an exported base class with a `_call(input_ids, logits)`
  hook (`src/generation/logits_process.js:13`, `src/models/modeling_utils.js:541`).
- `generate()` accepts and returns `past_key_values` (`DynamicCache`), so a
  prefilled system prompt can be reused across calls
  (`src/generation/parameters.js:33`).

A trie over the command names, argument names and the dataset's column headers
is ~150 lines as a custom processor and would have run inside `a5-qwen.mjs`
with no new runtime. As of 4.3.0 (published 2026-09-16) Hugging Face ships it
officially: `@huggingface/transformers-structured-output` provides a
`StructuredOutputProcessor` for JSON schema and regex, passed as
`logits_processor`. The variable was not untestable; it was untested.

## 1.9 What the critique does *not* overturn

- A1C at 81% for zero download and 0.2 ms is a very strong floor; it should
  stay the floor. Any SLM is progressive enhancement.
- WebGPU-only runtimes have no CPU fallback; the SLM can never be a dependency.
- Exact-match on canonical JSON with a harmful-rate metric is the right scoring
  and should not be softened for a generative model.
- The evidence that `abbreviation` and `ambiguous` strata are the hard core is
  correct. Those are the strata where a model with world knowledge plus a
  column enum could add value — precisely the ones it was never set up to try.

---

# Part 2 — What the research says: running an SLM fast on the GPU in a browser

## 2.1 Where the time actually goes

Two 2026 measurement papers cover exactly this size class:

- [arXiv 2604.02344](https://arxiv.org/html/2604.02344) (Feb 2026), WebLLM
  q4f16 in Chrome: **Qwen2.5-0.5B decodes at 51 tok/s, Qwen2.5-1.5B at 46
  tok/s** on an RTX-class Windows GPU; ~46/36 on Apple M2; **~9 tok/s in
  Firefox** on every platform. At batch 1 the bottleneck is per-dispatch
  overhead (24–36 µs on D3D12/Vulkan, ~1 ms in Firefox), not kernel speed;
  fusing dispatches gave +53%.
- [arXiv 2605.20706](https://arxiv.org/html/2605.20706v1) (May 2026, 16
  devices): prefill for sub-350M models exceeds 3,000 tok/s on discrete GPUs,
  ~150–300 tok/s on Apple M4-class integrated; a llama.cpp WebGPU backend
  beats WebLLM by 45–69% decode throughput and uses ~30% less memory.

Applied to DesignSense on an RTX 3060-class laptop (this machine's in-app
browser reports an NVIDIA Ampere adapter with `shader-f16` and a 2 GB
`maxBufferSize`, so nothing here is hypothetical):

| stage | A5 as evaluated (CPU, ~800-token prompt, ~60 JSON tokens) | fine-tuned 0.3–0.5B on WebGPU (~120-token prompt, ~25 compact tokens) |
|---|---|---|
| prefill | ~4–5 s | ~40–100 ms |
| decode | ~3–5 s at 12.8 tok/s | ~0.5 s at 50 tok/s |
| total | 6.8 s measured | **≈0.6 s** (derived, not measured) |

On an integrated GPU the derived figure is ~1–2 s; in Firefox ~3 s. The first
load pays a 255–500 MB download once (Cache API / OPFS) plus 3–10 s of shader
compilation per session.

## 2.2 The runtimes, as of September 2026

| runtime | version | GPU | constrained output | prefix / KV reuse | notes |
|---|---|---|---|---|---|
| **WebLLM** (MLC) | 0.2.85 (Sep 2026) | WebGPU only | XGrammar: `response_format` with `type:"json_object"` + stringified schema, or `type:"grammar"` EBNF | only across turns of one conversation object (`reuseKVCache`); prefix-cache PR #664 still open | custom fine-tune of an existing architecture needs only `convert_weight` + `gen_config`, reusing the prebuilt WASM; `tools` API is allow-listed to Hermes models, so use `response_format` |
| **transformers.js** | 4.3.0 (Sep 2026) | WebGPU (C++ ORT EP, rewritten in v4), WASM fallback | official `StructuredOutputProcessor` (json_schema, regex) as `logits_processor`; custom processors always worked | `DynamicCache` passed through `generate()`/pipeline (v4.1); reported 294→117 ms on turn 2 | largest model zoo (Gemma 3 270M, LFM2.5-350M, Qwen3-0.6B ONNX at 255–570 MB q4f16); ~35–40% slower decode than llama.cpp-WebGPU |
| **wllama** (llama.cpp) | 3.6.1 (Aug 2026) | WebGPU (v3.1) + multi-thread WASM | GBNF upstream, but no documented wllama API for it | server-context slot cache | fastest per published benchmarks; needs COOP/COEP headers; the CPU fallback path |
| **Chrome Prompt API** (Gemini Nano) | stable on the web since Chrome 148 (May 2026) | Chrome-managed | `responseConstraint` JSON schema / regex | n/a | zero download for the app, but Chrome-only, ≥22 GB free disk, >4 GB VRAM or 16 GB RAM; Edge has its own Phi-4-mini-backed API |
| MediaPipe LLM Web | maintenance mode | WebGPU | none documented | — | superseded by LiteRT-LM web preview (Gemma 4 E2B/E4B only) |

## 2.3 Facts that change the earlier conclusions

- **DirectML was the wrong probe.** DirectML is in maintenance mode with
  investment moved to the WebGPU EP ([Microsoft](https://learn.microsoft.com/en-us/windows/ai/new-windows-ml/webgpu-ep)),
  and the 10× int4 slowdown is a `MatMulNBits` issue on the CPU EP
  ([onnxruntime #23004](https://github.com/microsoft/onnxruntime/issues/23004)),
  so "GPU does almost nothing here" measured a deprecated path.
- **Speculative decoding is irrelevant** at this size and for 25–60 token
  outputs: WebLLM has none, and the literature shows setup cost exceeds
  savings under ~50 tokens ([arXiv 2601.11580](https://arxiv.org/abs/2601.11580)).
- **Gemma 3 270M is broken on ORT-Web WebGPU at fp16/q4f16** (garbage output
  from fp16 overflow; [onnxruntime #26732](https://github.com/microsoft/onnxruntime/issues/26732),
  open). fp32 works, WASM works. That steers a transformers.js path toward
  SmolLM2-360M, LFM2.5-350M or Qwen2.5-0.5B, and a Gemma path toward WebLLM.
- **JSON has a measurable "format tax"** that is larger for smaller models
  ([arXiv 2604.03616](https://arxiv.org/pdf/2604.03616)): a compact call
  syntax is both faster and more accurate.
- **WebGPU reach is ~82–85%** of users (caniuse, Mar 2026); Safari 26 and
  Firefox 141+ ship it, Firefox at unusable speed. The 15–18% without it, and
  Firefox, fall back to the shipped A1C parser, which already exists.

# Part 3 — What the research says (making a small model accurate)

## 3.1 Fine-tuning is the regime where sub-1B models work; prompting is not

The published before/after numbers for ≤1.5B models on strict, exact-match
tool-call tasks are large and consistent:

| model / task | prompted | fine-tuned | source |
|---|---|---|---|
| FunctionGemma 270M, Google "Mobile Actions" | 58% | 85% | [Google, Dec 2025](https://blog.google/technology/developers/functiongemma/) |
| FunctionGemma 270M, smart-home control (exact tool-call equivalence) | 38.8% | **96.7%** (120B teacher: 92.1%) | [distil labs](https://www.distillabs.ai/blog/making-functiongemma-work-multi-turn-tool-calling-at-270m-parameters/) |
| FunctionGemma 270M, banking assistant | 23.4% | **90.9%** (teacher 97.0%) | same |
| FunctionGemma 270M, shell commands | 9.9% | **96.0%** (teacher 97.0%) | same |
| FunctionGemma 270M, Hermes tool-use subset, tool-name accuracy | 88% | 98% (961 examples, 1 epoch) | [DataCamp](https://www.datacamp.com/tutorial/fine-tune-functiongemma) |
| xLAM-1B-fc-r (1.35B), BFCL overall | — | 78.9% (beat GPT-3.5-Turbo) | [APIGen, arXiv 2406.18518](https://arxiv.org/abs/2406.18518) |
| Granite-4.0-1B, BFCLv3 | — | 54.8 | [IBM](https://huggingface.co/blog/ibm-granite/granite-4-nano) |

The distil labs row is the closest analogue to DesignSense: a fixed, narrow
command surface, strict exact-match, a 270M model going from the 20–40% range
(where A5-class prompting lives) to the 90s. A survey of SLMs on function
calling (["Small Models, Big Tasks", EASE 2025](https://arxiv.org/abs/2504.19277))
finds zero-shot < few-shot < fine-tuned monotonically, and that the dominant
SLM failure is **output-format adherence, not semantics** — which is exactly
the 174-of-192 structural rejection profile A5 produced.

Classic seq2seq semantic parsing is the same story: T5-base fine-tuned reaches
57% exact on Spider (cross-domain text-to-SQL, far harder than one fixed
schema) and PICARD's constrained decoding lifts it to 66% ([arXiv 2306.08368](https://arxiv.org/pdf/2306.08368)).

## 3.2 How much data, and where it comes from

- Reported data points: 961 examples (DataCamp, 88→98% tool-name); ~5,000
  synthetic examples seeded from 20–100 hand-written ones (distil labs);
  FireAct's scaling curve shows little gain at 100–200 samples, real gains at
  500, still improving at 1,000 ([arXiv 2310.05915](https://arxiv.org/pdf/2310.05915)).
- Practical budget for DesignSense: **~100–300 verified examples per command,
  ~3,000–6,000 total** across the 37 executable commands plus `clarify`,
  `abstain`, `sequence`.
- The recipe to copy is APIGen's: generate liberally, then **verify by
  execution and discard**. For a DSL the "execution" stage is free: run the
  emitted command through `eval/validate.mjs`-style checks (command exists,
  args typed, columns exist in that dataset, numbers appear in the utterance).
- Pipeline: enumerate valid commands from the grammar × the six real column
  sets → render a canonical utterance → paraphrase 5–15 ways with a frontier
  model (typos, ellipsis, abbreviations, compound clauses) → keep gold fixed →
  de-duplicate by similarity → hold out the 221 authored items **and** a
  paraphrase-disjoint dev split.
- Every `clarify` and `abstain` must be a trained label with many diverse
  negatives, not one "book me a flight" shot.

## 3.3 Naming and schema design matter at this scale

- Small models hallucinate tool and argument names that match pretraining
  conventions ([PA-Tool, arXiv 2510.07248](https://arxiv.org/html/2510.07248v2)):
  renaming identifiers to pretraining-aligned forms cut schema-misalignment
  errors ~80%. A5's `unknown_arg` pile (89) is this effect: `dim`, `k`,
  `percent`, `directions` vs the model's `column`, `threshold`, `dimension`.
  For a fine-tuned model this matters less; for any prompted use it matters a
  lot.
- Prompt bloat is the other dominant failure: with every tool description in
  the prompt, accuracy was 13.6%; with only the relevant ones retrieved,
  43.1% ([RAG-MCP, arXiv 2505.03275](https://arxiv.org/html/2505.03275v1)).
  A5's 40-command catalogue every time is the bloated case.
- Fine-tuning bakes the schema into the weights: the prompt shrinks to the
  column list plus the utterance.

## 3.4 Decoding-side levers, with what they actually buy

- **Constrained decoding**: JSONSchemaBench (10k schemas) measured up to ~4
  points of *task* accuracy gain, no degradation, on top of 100% validity
  ([arXiv 2501.10868](https://arxiv.org/html/2501.10868v1)). Its value here is
  turning every structural rejection into a real attempt; it is not the thing
  that makes the model right. Use one grammar over the whole output — layering
  a schema on a separate tool-call format can make tokens unreachable
  ("Constraint Tax", [arXiv 2606.25605](https://arxiv.org/abs/2606.25605)).
- **Column enum in the grammar**: `dim`/`x`/`y` as an enum of the live headers
  renormalises probability over real columns. Cheap with XGrammar's JSON
  schema; also implementable as a trie in a custom logits processor.
- **Code-side slot resolution**: model emits a mention, code resolves it. The
  existing `resolveColumn`/`parseNumbers` in `src/assistant/lexicon.js` are
  the resolvers. This is the project's own "never produce a number" rule,
  applied to the SLM.
- **Verifier as reranker**: sample k candidates, keep those that pass the
  validator and whose numbers all occur in the utterance, pick by
  log-probability. Verification beats plain majority vote for small models
  ([arXiv 2608.11403](https://arxiv.org/html/2608.11403), [arXiv 2404.17140](https://arxiv.org/pdf/2404.17140)).
- **Decomposition**: intent first (tiny grammar: 40 names), then slots for
  that intent's schema only. Pairs naturally with per-intent grammars and
  keeps outputs short.
- **Abstention**: trained, not prompted; calibrate a threshold on the dev split.
  Small models benefit far less from prompted "say unclear if unsure".

## 3.5 The compact-output point

A5 asked for nested JSON with quoted header strings. A one-line call form
(`filter.range(dim=3, op=lte, value=8000)` with columns referenced by index
into the prompt's list) is roughly a third of the tokens, cannot produce an
unbalanced brace, and is trivially grammar-constrained. Fewer output tokens is
fewer chances to err at 270M–500M, and directly reduces decode latency.

# Part 4 — What it would take to run one fast and score well

## 4.1 The design that follows from Parts 1–3

Keep A1C as the floor. Add a fine-tuned small decoder as progressive
enhancement, used the way the ladder says statistical components should be
used: for intent, composition and paraphrase, with every argument resolved by
code.

```
utterance ──► A1C grammar (0.2 ms, always) ──► command or null/clarify
        └──► SLM (WebGPU, ~0.6 s, when available) ──► compact call(s)
                                                       │
                                     validator: command ∈ schema,
                                     column index ∈ prompt list,
                                     every number appears in utterance
                                                       │
                              merge: agree → run; grammar null → SLM;
                              grammar clarify → SLM picks among candidates;
                              disagree on intent → SLM only if its
                              log-prob margin clears a dev-set threshold
```

Five decisions, each backed by a measurement above:

1. **Fine-tune, do not prompt** (Part 3.1). Schema lives in the weights; the
   prompt is the column list and the utterance.
2. **Compact output, columns by index** (Parts 2.3, 3.5). Target string:
   `filter.range(dim=#3, op=lte, value=8000); view.sort(dim=#1, desc=1)`.
   Numbers are copied from the utterance and verified against it; column
   indices point into the prompt's list, so `unknown_column` cannot occur.
3. **Constrained decoding over that grammar** (Part 3.4). One grammar for the
   whole output; column enum bounded by the list length. XGrammar EBNF in
   WebLLM or a custom `LogitsProcessor` in transformers.js — the same grammar
   file drives both, and the eval harness.
4. **Code-side resolution and verification** (Part 3.4). `resolveColumn`,
   `parseNumbers` and the clarify machinery in `src/assistant/` stay the
   authority for arguments. The SLM never wins a slot the grammar has resolved
   with confidence; it wins intent, composition and clarify-selection.
5. **Runtime: transformers.js 4.3 first** (Part 2.2). It has WebGPU, official
   structured output, `DynamicCache` prefix reuse, a WASM fallback, and the
   harness already runs on it in Node, so eval and product share one code
   path. WebLLM is the second candidate if decode speed matters more than
   model choice. Chrome Prompt API is a one-day yardstick, not a product path.

## 4.2 Model candidates

| model | q4f16 download | why | risk |
|---|---|---|---|
| **SmolLM2-360M-Instruct** | 273 MB | works on ORT-Web WebGPU; in WebLLM prebuilt list (376 MB VRAM); well-documented SFT | weakest base ability |
| **LFM2.5-350M** | 255 MB | HF's own structured-output example; fastest CPU decode of the set | ONNX only; not in WebLLM prebuilt list |
| **Qwen2.5-0.5B-Instruct** | 483 MB | strongest base at this size (A5's 1.5B sibling already resolved `out:Cooling[kWh]` unaided); prebuilt in WebLLM; worked LoRA→MLC example exists | 151k vocab makes embeddings most of the file |
| FunctionGemma / Gemma 3 270M | 273 MB | best published fine-tune numbers (23–39% → 91–97%) | broken on ORT-Web WebGPU fp16/q4f16 (#26732); WebLLM has 1B only, so a 270M needs a custom compile |

Train two (SmolLM2-360M and Qwen2.5-0.5B), pick by the eval, not by prior.

## 4.3 Data: the missing artifact

The repo has 221 labelled items and 156 example phrasings. A fine-tune needs
~3,000–6,000 verified pairs (Part 3.2). Build them, never touching the 221:

1. **Enumerate** from `eval/schema.mjs`: every command × its argument shapes ×
   the six real column sets in `DATASETS`, with realistic values drawn from
   `DATASET_VALUES` and per-column ranges. Compound items from 2–4 clauses.
   `clarify` from genuinely ambiguous column families (`Floor Area *`),
   `abstain` from a large pool of off-topic and unsupported requests.
2. **Render** a canonical utterance per command from templates.
3. **Paraphrase** each 5–15 ways with a frontier model, instructed to cover the
   strata the eval defines: synonyms, tokenized headers, abbreviations (SVF,
   FSR, A/V), typos, ellipsis, spoken-order compounds. Gold stays fixed.
4. **Verify** every pair mechanically: command in schema, args typed, column
   indices valid, every number in the gold appears in the utterance (drop
   otherwise), no utterance within trigram-Dice 0.8 of any eval item.
5. **Split** paraphrase-disjoint dev (~10%) from train. The 221 items remain
   the test set, and the held-out human set the README already calls for is
   still the real one.

Estimated cost: one script, a few dollars of API calls, one afternoon.

## 4.4 Training and export

- Full SFT (not LoRA) at ≤0.5B is affordable and avoids merge pitfalls: 1–3
  epochs, lr 5e-5 cosine, seq len 256, on a free Colab T4 in under 20 minutes
  (Part 3.3 sources). Loss only on the assistant turn.
- Serialize the exact training-time prompt string and diff it against what
  the JS tokenizer's `apply_chat_template` produces — one-token drift collapses
  accuracy.
- Export: `optimum`/transformers.js conversion script → ONNX → q4f16 (and q8
  as a fallback if q4 costs accuracy at this size). For WebLLM:
  `mlc_llm convert_weight --quantization q4f16_1` + `gen_config`, reusing the
  prebuilt WASM for that architecture; pin the web-llm version to the
  compiler's ABI.
- **Re-run the eval on the quantized artifact in the browser**, not on the
  PyTorch model.

## 4.5 Evaluation changes

- `eval/approaches/a7-tuned.mjs`: same `makeGenerativeApproach` shape, but
  compact-format prompt, grammar-constrained `logits_processor`, `DynamicCache`
  prefix reuse, column-index resolution, number-in-utterance verifier.
- `eval/grammar/commands.ebnf` generated from `schema.mjs`, shared by the
  Node harness, the browser, and the synthetic-data verifier.
- A browser runner (Playwright with Chrome WebGPU, or the desktop app's
  browser pane) that loads the same items and reports real prefill/decode
  latency on WebGPU, so the README stops carrying CPU numbers as if they were
  product numbers.
- A8 cascade per the merge rules in 4.1, scored on the same three metrics
  plus declining recall. Also score the SLM **alone** so the gap is visible.
- One A0-style yardstick run of Chrome's Prompt API with `responseConstraint`
  on the 221 items — a day's work that answers whether a zero-download
  Chrome-only path is worth anything.

## 4.6 Gates, written before the runs

- **Data gate**: ≥3,000 verified pairs, every command ≥60, every stratum
  represented; dev-set exact ≥90% before any browser work.
- **Model gate (SLM alone on the 221)**: exact ≥ A1C's 81% *or* hard-tier
  exact ≥ 70% (A1C: 55%) with harmful ≤ 10%. Below both, stop; the numbers go
  in the README next to A5's.
- **Product gate (A8 cascade)**: overall exact ≥ 86%, harmful ≤ 8%, p50 on
  this laptop's WebGPU ≤ 1 s, no regression when WebGPU is absent.

## 4.7 What is honestly uncertain

- Transfer from synthetic paraphrases to the authored eval set (and to real
  users) is the whole bet. Published analogues are narrow-domain and score in
  the 90s; this task has 40 commands, six schemas and an `ambiguous` stratum
  the grammar itself scores 23% on. Expect a gap; the gates say how much.
- Quantization at 270–500M can cost more than "negligible"; q8 is the hedge.
- The 1 s latency figure is derived from published tok/s on similar hardware,
  not measured here. The browser runner in 4.5 is what measures it.
- ~15–18% of users have no WebGPU and get A1C only. That is acceptable only
  because A1C is already good, which is the strongest argument this report
  has for keeping it as the floor.

## 4.8 Effort, in order

| step | size |
|---|---|
| synthetic data generator + verifier (4.3) | 1 day |
| SFT notebook for two models + export (4.4) | 1 day |
| a7 approach + shared grammar + logits processor (4.5) | 1–2 days |
| browser latency runner (4.5) | 0.5 day |
| A8 cascade + gates + README (4.5–4.6) | 1 day |
| product wiring behind a feature flag, WebGPU detection, lazy load | 1–2 days |
