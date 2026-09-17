# Assistant evaluation set

221 utterances with structured gold labels, for deciding empirically what the
DesignSense assistant's natural-language layer should be built from.

```bash
node eval/validate.mjs
```

## Why the labels are structured

A gold label is a command, not a string:

```json
{"command":"filter.range","args":{"dim":"odometer","op":"lte","value":50000}}
```

So an approach can be scored on intent and on each argument separately. That
distinction is the whole point: picking the wrong tool and resolving "mileage"
to the wrong column are different failures with different fixes, and an
aggregate accuracy number hides which one you have.

## Layout

| File | What it holds |
|---|---|
| `schema.mjs` | The label space: every command and its argument names, plus the real CSV headers of the six bundled datasets |
| `dataset/easy.jsonl` | 75 items |
| `dataset/medium.jsonl` | 80 items |
| `dataset/hard.jsonl` | 66 items |
| `validate.mjs` | Type-checks every label and prints the distribution |

`schema.mjs` should eventually be derived from `src/assistant/commands.js`
rather than restating it, so the two cannot drift.

## The tiers

**Easy** — one clause, one intent, the column named as it appears in the
header, an explicit number, canonical phrasing. A regex baseline should get
most of these; if it doesn't, the baseline is broken rather than the tier.

**Medium** — exactly one complication: a synonym for the column (`mileage` →
`odometer`), an implicit direction (`cheapest` → price, min), a percentile, a
reference to the current state (`these`, `the rest`), a negation, or an
abbreviation that expands unambiguously (`sky view factor` → `out:SVF`).

**Hard** — two or more complications, or one that has no clean answer:
ambiguity that should produce a question, a column that does not exist, a
request outside what the tool can do, multi-clause composition where order
matters, or an abbreviation that collides with its neighbours.

## What the hard tier is actually testing

The six bundled datasets have genuinely hostile headers, and the hard tier is
built out of their real collisions rather than invented ones:

- **windows** has `out:DA [%]`, `out:CDA [%]`, `out:SDA [Area%]` and
  `out:UDI [%]`. "daylight autonomy" matches three of them, so the gold is a
  question (H005), while "spatial daylight autonomy" must land on SDA alone
  (H006) and a bare "DA" must beat the two columns that contain it (H008).
- **solar** has nine columns containing `Solar`. "solar above 500" cannot be
  answered (H003); "south facing solar" can (M053).
- **facade** has four columns containing `Floor Area` (H001), and its
  `out: FAR` header carries a space after the colon (H032). **solar**'s
  `in:Layer ` has a trailing space (H046). **massing**'s `Total Area` is the
  only column in any dataset with no `in:`/`out:` prefix (H058).
- **massing** has `total floor number` for Red, Green and Grey zones but not
  for ZoneT, so a plausible-sounding request has no referent (H053).
- **solar** uses `-999` as a missing-value sentinel, which no command handles
  (H043).

These are why an off-the-shelf embedding model is not the obvious answer: it
has no useful vector for `SVF`, `FSR`, `Site_Cvr%` or `A/V ratio`, and
abbreviations are where most of the entity difficulty sits.

## Asking and declining are labels too

24 items (12%) expect `clarify` or `abstain`. They matter more than the happy
path. An assistant that silently applies the wrong column is worse than one
that asks, because the filter chips make a *visible* mistake cheap and an
*invisible* one expensive. Any approach that scores well on the first 197
items and confidently misfires on these 24 is not shippable.

`clarify` carries the candidate set, so a near-miss (right question, wrong
candidates) is distinguishable from a wrong intent.

## Metrics to report

Never report only the first of these:

- **Intent accuracy** — the command id alone.
- **Slot exact-match** — all arguments correct given the right intent.
- **End-to-end exact-match** — the number that matters.
- **Harmful error rate** — executed a *different* valid command above the
  confidence threshold. Weight this heavily; a miss only shows "did you
  mean…", a confident misfire changes the user's results behind their back.
- **Abstain precision / recall** on the out-of-scope items.
- **Latency p50/p95** and **bytes downloaded**. Plot accuracy against bytes;
  that plot is the actual deliverable.

Report per tier and per entity stratum, not just overall.

## Known limits of this set

Stated plainly, because they bound what the numbers mean:

1. **It is seed data, and it is contaminated by construction.** Every item is
   marked `"source":"seed"` because one author wrote them. Whoever writes the
   parser will have absorbed these phrasings. A held-out set authored by
   people who have not seen the parser is still needed before any number here
   is quotable — colleagues or students, a few minutes each. Treat the seed
   set as a development set and report the human set separately.
2. **`used_cars` is 45% of items** because it is the default dataset. Fine for
   development, skewed for reporting.
3. **Composition is 13%** (28 items with two or more clauses). Probably still
   light relative to how people actually talk once they trust the tool.
4. **Only one item exercises an absent column** and two exercise typos. Both
   strata want more.
5. **Context is carried loosely.** Items that depend on prior state have an
   optional top-level `state` field, but there is no notion of a multi-turn
   conversation. If the assistant grows follow-ups ("and cheaper than that"),
   this schema needs a `history` field.
6. **Some golds encode conventions, not truths.** `show me the cheapest one`
   resolves to `inspect.item` while `which is the cheapest` resolves to
   `ask.extreme` (M025). `hide the rest` resolves to `scope.zoom` (M017).
   These are defensible but arguable; the `note` field records the reasoning
   so they can be revisited rather than silently disagreed with.
7. **H031 is aspirational.** "cars like this one but cheaper" expects a
   two-step sequence with a value relative to the inspected item. It marks the
   ceiling rather than a near-term target.

## Growing it

The compounding asset is real usage. `src/store/logger.js` already subscribes
to every action; log utterances the parser misses, triage them weekly, and
promote them into `hard.jsonl` with a hand-written gold. Templated and
LLM-paraphrased expansion is fine for reaching 1000+ items, but keep it in
separate files so the human-authored number stays reportable on its own.

---

# Results

```bash
node eval/harness.mjs            # every approach, side by side
node eval/harness.mjs a1 --errors
```

| | approach | intent | exact | harmful | no-parse | p50 | shipped bytes |
|---|---|---|---|---|---|---|---|
| A0 | keyword and regex | 37% | 34% | 15% | 51% | 24us | ~3 KB |
| A1 | grammar for slots, BM25 for intent | 84% | **79%** | 13% | 5% | 166us | ~15 KB |

Exact-match by tier:

| tier | A0 | A1 |
|---|---|---|
| easy | 83% | 97% |
| medium | 11% | 89% |
| hard | 8% | 47% |

## What the numbers say

**The easy tier did its job.** A0 gets 83% of it and almost nothing else, which
is what an afternoon of regex should look like. If a future approach scores
below that on easy, the approach is broken rather than the tier being hard.

**Medium is where rules earn their keep**: 11% to 89%. Nearly all of that is
the alias table plus the comparator and number grammar. No model involved.

**Hard is the open question at 47%**, and it splits cleanly:

- *abbreviation* 74% exact — the alias table carries this, and it is the
  stratum where an embedding model was supposed to help. It cannot: nothing
  off the shelf has a usable vector for `SVF`, `Site_Cvr%` or `A/V ratio`.
  Whatever is still missing here is more alias entries, not more parameters.
- *ambiguous* 23% and *absent* 0% — knowing when to ask or decline is the real
  gap, not paraphrase coverage.
- *composition* falls off a cliff: 83% at one clause, 62% at two, 40% at
  three, 0% at four. This is the stratum a small generative model would
  genuinely help with, and the only one.

**Harmful errors barely moved: 15% to 13%.** This is the most important line
in the table and the one that looks worst. A1 got much more accurate without
getting much safer, because it acts on partial readings — A0's multi-clause
behaviour is 100% harmful (it applies the first clause and silently drops the
rest) and A1 still does this often enough to matter. Declining recall is 13%
(3 of 24): when A1 should ask or refuse, it mostly acts instead.

That is a fixable design problem rather than a modelling one. A confidence
floor, and refusing to half-apply a compound request, should move it a long
way. **A2 should be measured on harmful rate first and accuracy second.**

## Where A1 actually fails

Reading the misses, in rough order of how much they cost:

1. **Declining is unimplemented, not inaccurate.** There is no real confidence
   estimate — `parseSingle` abstains only when it finds no column, no number
   and no confident intent. Everything else either parses or returns null.
2. **Composition is shallow.** Splitting on connectors, then parsing each part
   independently, cannot handle a clause that only makes sense with its
   neighbour ("the 10 cheapest **that still have** FAR above 1").
3. **Comparators are exact-match.** "prise bellow 8000" fails because
   "bellow" is not in the lexicon, even though the trigram fallback would
   catch "prise" → price. Typo tolerance should extend to comparators.
4. **No relative or computed values.** "but cheaper", "above average", "not
   too old" all need a value expressed against something else.
5. **Schema and data-quality questions have nowhere to go.** "how many zones
   are there", "ignore the missing values", "which direction gets the most
   sun" are all reasonable and all unanswerable by the current command set.

## One disputed label

H001 and H002 expect `clarify` between the four `Floor Area` columns in the
facade dataset. A1 resolves them to `out:Floor Area` on the rule that a column
named *exactly* what the user said beats columns that merely contain those
words — the same rule that lets a bare `DA` beat `SDA` and `CDA` in windows,
and that keeps `in:Fillet` usable alongside `in:Fillet Base`.

That rule is probably right, which would make these two golds wrong. **They
have been left unchanged** and marked `"disputed": true`, because editing a
gold after seeing an approach's score is how an eval stops meaning anything.
Settle it against the held-out human set instead. Cost to A1: 2 items, 0.9%.

## Honest caveats on these numbers

- Both approaches were written by the same hand as the eval set. The A1
  example corpus in `approaches/examples.mjs` deliberately shares no utterance
  with the dataset, but it cannot avoid sharing an author's instincts.
- A1's alias table was written against these six schemas. On a user's own CSV
  it starts empty, so the `abbreviation` stratum would be far worse. The
  runtime column-name matching has to carry that case, and this eval does not
  measure it. **A held-out dataset with unseen columns is the missing test.**
- "Shipped bytes" is source size, not a measured bundle.

## A1G — the hardening

A1's worst number was harmful rate, not accuracy: it acted on partial readings
rather than asking. `a1g-guarded.mjs` adds four guards, sharing all of A1's
code through `makeParser({ guarded: true })` so the two are genuinely
comparable:

1. **A vague adjective with no number asks for the number.** "show me cheap
   cars" has no threshold in it; picking one invents a number the user never
   said.
2. **A compound request is all or nothing.** If the sentence splits into four
   clauses and only three parse, nothing is applied. Three of four leaves the
   user with results they did not ask for and no sign anything was dropped.
3. **A unit the header contradicts is refused.** `in:Height [ft]` against
   "height in meters" is not a filter, it is a missing feature.
4. **A named family member that does not exist is refused, not guessed at.**
   massing has a floor count for three zones but not ZoneT.

| | intent | exact | harmful | declining recall | declining precision |
|---|---|---|---|---|---|
| A1  | 84% | 79% | 13% | 13% (3/24) | 38% (3/8) |
| A1G | 85% | 79% | **10%** | **33% (8/24)** | **50% (8/16)** |

On the hard tier, harmful falls 32% to 23%.

Exact match did not move, and that is the honest result: the guards convert
confident mistakes into questions, they do not produce more right answers.
That is the trade worth making — a question costs a click, a silent wrong
filter costs trust — but it should not be reported as an accuracy gain.

Two thirds of the declining items are still missed. The remaining gap is
mostly `clarify` candidate lists that do not match the gold text, and schema
or data-quality questions ("how many zones are there", "ignore the missing
values") that have no command to land on.

## The full ladder

Every rung from A1G up is the same grammar and the same guards, with only the
intent ranker and the column fallback swapped, through
`makeParser({ rank, embedColumns })`. A difference in the numbers is therefore
a difference in that one component.

| | approach | download | intent | exact | harmful | declining recall | per-query |
|---|---|---|---|---|---|---|---|
| A0 | keyword and regex | 0 | 37% | 34% | 15% | 0% | 24us |
| A1 | grammar + BM25 | 0 | 84% | 79% | 13% | 13% | 166us |
| A1G | + guards | 0 | 85% | 79% | 10% | 33% | 237us |
| A2 | + potion-base-8M | 30 MB | 85% | 80% | 11% | 38% | +78us |
| A3 | + MiniLM int8, kNN | 23 MB | 86% | 81% | 9% | 46% | +1015us |
| A4 | + trained linear head | 23 MB + 57 KB | **87%** | **81%** | **9%** | **54%** | +1037us |
| A5 | Qwen2.5-0.5B-Instruct q4 | ~400 MB | 5% | 3% | 7% | 0% | +6766us |
| A6 | A4, cascading to A5 | ~423 MB | 87% | 81% | 10% | 54% | +6766us on 4% |

Exact match by tier:

| tier | A0 | A1 | A1G | A2 | A3 | A4 | A5 | A6 |
|---|---|---|---|---|---|---|---|---|
| easy | 83% | 97% | 96% | 96% | 97% | 96% | 8% | 96% |
| medium | 11% | 89% | 89% | 89% | 89% | 89% | 1% | 89% |
| hard | 8% | 47% | 48% | 50% | 53% | **53%** | 0% | **53%** |

## Four findings

### 1. An encoder helps intent and nothing else

Per entity stratum, A1G, A2, A3 and A4 are *identical* — not close, the same:

| stratum | n | A1G | A2 | A3 | A4 |
|---|---|---|---|---|---|
| synonym | 34 | 71% | 71% | 71% | 71% |
| tokenized | 30 | 87% | 87% | 87% | 87% |
| abbreviation | 23 | 74% | 74% | 74% | 74% |
| ambiguous | 13 | 23% | 23% | 23% | 23% |

The semantic column fallback fired and changed no outcome. By the time it runs,
the alias table and trigram matching have resolved everything an encoder could,
and on `abbreviation` no encoder can help in principle: nothing off the shelf
has a usable vector for `SVF`, `Site_Cvr%` or `A/V ratio`.

Where the encoder does pay is the `none` stratum — utterances naming no column,
where the whole task is intent — 78% to 85%. **Retrieval for intent, grammar
for arguments was the right split.**

### 2. The linear head is the best value on the ladder

A4 is A3 with a softmax head over the same frozen vectors: 14,245 floats,
about 57 KB, trained in three seconds on `examples.mjs` and never on the
evaluation set. Exact match ties A3, but intent rises 86% to 87% and declining
recall rises 46% to 54%.

It helps most at knowing when it is unsure, which is exactly the axis that was
weakest. A linear head beating nearest-neighbour over the same embeddings is
the expected result, and it is nearly free once the encoder is paid for.

### 3. A generative model at browser-realistic size cannot do this job

Qwen2.5-0.5B-Instruct, q4, greedy, given the command catalogue, the dataset's
columns and six worked examples: **3% exact, 87% no-parse, 192 of 221
completions rejected by validation.**

The failures are not formatting. It invents commands (`ask.percentile`,
`ask.min_price`), argument names (`threshold`, `dimension`), columns
(`out:Sunny orientation`) and enum values (`op: "ltf"`). It latched onto the
word "flight" from the out-of-scope example and began emitting it as a topic.

One prompt bug was mine and worth recording: the first version of the few-shot
examples used `<measure>` placeholders, and the model copied the placeholder
into every answer — it was being taught to emit a token rather than to look a
column up. Rebuilding the examples from real columns of the dataset in play
fixed format compliance and changed nothing about the substance.

**The hypothesis this rung was built to test is falsified.** Composition was
supposed to be where a generative model earns its place. A5 scores 0% exact at
two, three and four clauses. At 0.5B it cannot produce a valid command at all,
so it cannot produce a valid compound one.

A larger model would do better. It would also not be a browser feature: this
one is ~400 MB and 6.8 seconds per utterance on CPU, before any of that.

### 4. A cascade is worth nothing when the fallback is worse than nothing

A6 defers to A5 only where A4 produced no reading at all: 8 of 221 utterances,
4%. One of those eight yielded a valid command. Intent, exact and declining
recall are identical to A4; harmful rises from 9% to 10%.

So the cascade costs ~400 MB and 6.8 s on the hard cases to achieve nothing,
and converts a few harmless blanks into confident mistakes.

One detail is a lesson about cascades rather than about this model. The first
version of A6 also deferred when A4 *abstained*, and that cost a third of its
declining recall (54% down to 46%) and a point of exact match: a deliberate
refusal is an answer, and sending it for a second opinion throws a right answer
away. **A cascade may only be asked about cases where the first rung produced
nothing — never about cases where it decided something.**

## What to build

**Ship A4.** 81% exact, 9% harmful, 54% declining recall. Structure it as
progressive enhancement, which the ladder already proves is safe:

- **A1G is the floor and ships in the bundle.** 79% exact, 10% harmful, zero
  download, ~15 KB, working before anything loads.
- **MiniLM plus the linear head arrives in the background.** Two points of
  exact match, a point off harmful, eight points of declining recall, 23 MB
  cached after first use, ~1 ms per query. Nothing breaks if it never arrives.
- **Skip A2.** Potion is the more elegant idea — a static lookup table at 78us
  — but it captures half the gain for more download than MiniLM.
- **Skip A5 and A6.** Not "later": the measured result is that they subtract.

The remaining headroom is not in the model. The hard tier sits at 53% for every
rung from A3 up, and the misses are composition, `clarify` wording, and schema
or data-quality questions with no command to land on. That is grammar and
command-surface work.

## Caveats on these numbers

- Every approach and the evaluation set share an author. The A1 example corpus
  and the A5 few-shot examples deliberately reuse no evaluation utterance, but
  they cannot avoid reusing an author's instincts. **The held-out human set is
  still the missing measurement.**
- A4's head is trained on ~160 examples across 37 classes. That is thin, and
  the most likely cheap win on the whole ladder is more examples per command.
- `columnFloor`, `columnMargin` and `rankScale` were set from probe runs rather
  than tuned against the evaluation set. Since the column fallback changed no
  stratum, the first two barely matter; `rankScale` puts every rung on one
  decision boundary, which is what makes them comparable.
- A5 used greedy decoding with post-hoc validation. Constrained decoding would
  raise its validity rate, and transformers.js has no grammar sampler today.
  It would not fix inventing a column that is not in the table.
- A7 — a frontier model as a yardstick for the ceiling — was not run. It needs
  an API key, and it is a measurement rather than a shippable rung. It is still
  worth one run: it would say whether the hard tier's 53% is near the ceiling
  or far from it.
- `@huggingface/transformers` is installed with `--no-save`. `package.json` is
  untouched and nothing under `src/` depends on it:

  ```bash
  npm install --no-save @huggingface/transformers
  ```

  Potion's ONNX is cached in `eval/.cache/` (gitignored). Qwen and MiniLM are
  cached by transformers.js under `node_modules`.
- `eval/last-run.txt` holds the full output of the run these tables come from.

---

# GPU, and other small models

```bash
node eval/bench-device.mjs [model]              # device timings
A5_MODEL=<hf-id> node eval/harness.mjs a5 --limit=8   # another model, same prompt
```

## GPU does almost nothing here

This machine has an RTX 3060 Laptop GPU, and the installed onnxruntime-node
ships `DirectML.dll`, so `device: "dml"` is a real execution provider. Measured
on Qwen2.5-0.5B-Instruct, 64 tokens, median of three runs after a warm-up pass:

| device / dtype | load | 64 tokens | throughput |
|---|---|---|---|
| cpu / q4 | 8.6s | 5015ms | 12.8 tok/s |
| dml / q4 | 6.1s | 24653ms | **2.6 tok/s** |
| dml / fp16 | 38.7s | 4377ms | 14.6 tok/s |

DirectML on int4 weights is **four times slower than CPU** — the 4-bit matmuls
are not natively accelerated, so it dequantises and loses more than it gains.
fp16 on the GPU beats CPU int4 by 14%, and pays 38.7s of load for it.

Two caveats before generalising. DirectML is not the fastest CUDA path, and
onnxruntime-web's WebGPU backend is a different implementation again. A
purpose-built WebGPU runtime (WebLLM/MLC ships hand-written kernels rather than
a generic EP) would do considerably better than either row above.

But the conclusion does not depend on which of those is fastest: **A5 failed on
validity, not on speed.** 192 of 221 completions were rejected because the model
invented commands, arguments and columns. No execution provider changes that. A
GPU makes a wrong answer arrive sooner.

## Capability arrives at about 1.5B

Same prompt, same validator, same eight items:

| model | valid | exact | per item |
|---|---|---|---|
| Qwen2.5-0.5B-Instruct q4 | 1/8 | 0% | 6.8s |
| Qwen3-0.6B q4 | 0/8 | 0% | 37.9s |
| Qwen2.5-1.5B-Instruct q4 | 6/8 | 25% | 18.1s |

Qwen3-0.6B is a reasoning model: it spent the whole 128-token budget inside
`<think>` and never reached the JSON. It would need the thinking mode disabled
in the chat template before it is a fair comparison.

**1.5B is a different animal.** It produced well-formed commands with real
column names, and resolved `south facing solar above 700` to `out:South_Solar`
and `sort by Cooling` to `out:Cooling[kWh]` unaided. Its remaining errors are
judgement, not syntax: it over-reaches for `clarify`, and it emitted one
`direction: "gt"` and one unbalanced brace.

So the honest shape of the generative option is: it starts working at roughly
1.5B, which is about 1 GB of weights and 18 s per utterance on this CPU. That
is not a feature you put behind a command bar that a stranger opens from a
share link. On WebGPU it might be one to three seconds, which is borderline
rather than impossible.

## The two levers that would matter more than a GPU

**Constrained decoding.** Every A5 failure that was *structural* — invented
command names, invented argument names, invalid enums, unbalanced braces — is
eliminated by construction if the sampler can only emit tokens the schema
allows. transformers.js has no grammar sampler today. Runtimes that do:

- **WebLLM (MLC)** — WebGPU only, hand-written kernels, and structured output
  against a JSON schema. The strongest browser option, and it addresses speed
  and validity at once.
- **wllama** — llama.cpp compiled to WASM, GBNF grammars, CPU only. Slower, but
  grammar-constrained and it runs where WebGPU does not.

Constrained decoding cannot fix *semantic* errors. It would not have stopped
1.5B choosing `clarify` where `ask.extreme` was wanted, and it cannot stop a
model naming a column that exists but is the wrong one.

**Fine-tuning a small model instead of prompting a larger one.** The asymmetry
worth exploiting is that the expensive model belongs in the build pipeline, not
the runtime: generate a few thousand (utterance, command) pairs with a frontier
model, fine-tune a 270M-400M model on them, ship that. A small model tuned for
one schema will beat a larger one reading that schema from a prompt, and the
prompt then shrinks from ~1200 tokens to almost nothing, which is most of the
latency. Candidates, all confirmed present on the hub but untested here:

| model | why |
|---|---|
| `onnx-community/gemma-3-270m-it-ONNX` | explicitly positioned for task-specific fine-tuning |
| `onnx-community/LFM2-350M-ONNX` | designed for on-device |
| `HuggingFaceTB/SmolLM2-360M-Instruct` | well-documented fine-tuning path |
| `onnx-community/Llama-3.2-1B-Instruct` | stronger, still under a gigabyte |

## What this does not change

A4 is at 81% exact, 9% harmful, for 23 MB and about a millisecond. Any
generative path has to beat that, and the measured gap is not close. The
argument for pursuing one is composition — the stratum where every non-
generative rung falls off (83% at one clause, 62% at two, 40% at three) — and
28 items is a thin basis for a 1 GB download.

The cheaper experiment is to fix composition in the grammar: parse clauses
against one another rather than independently, which is what "the 10 cheapest
**that still have** FAR above 1" actually needs.

---

# Fixing composition in the grammar

## What was wrong

A1G split on connectors — "and", "then", commas — and parsed each piece alone.
Two things defeat that, and both are how people actually talk:

```
"show only 4 cylinder toyotas with under 100k miles, sorted by price"
"the 10 cheapest options that still have FAR above 1"
```

The first packs three constraints into one clause with no connector between
them. The second states its operations in the wrong order to execute: the rank
is spoken first but must be applied last, over the filtered set.

## What replaced it

`composition.mjs` stops treating the sentence as the unit. It finds every
column mention, comparator and number as **spans over the tokens**, binds them
to one another by proximity, and reads the operations out of the bindings.
Connectors stop being load-bearing.

Three rules do most of the work:

1. **Binding is directional where English is directional.** A mention sitting
   immediately after a quantity is the head noun of that phrase, so "under
   100k **miles**" binds to odometer even though "cylinder" is nearer to the
   left. "sort by X" and "color by X" look forward past the verb rather than
   to whichever column is nearest.
2. **Rank is read before adjacency.** "the 20 cheapest" is a top-k, not
   `= 20`. A number that directly follows a comparator is already spoken for,
   so the rank takes the nearest number that is still free.
3. **Order is semantic, not positional.** A rank is computed over the filtered
   set and a zoom over the current result, so filters run first however late
   they were said. Everything else keeps the order it was spoken in, because
   "save these and clear the filters" means exactly what it says.

It returns null unless it finds two or more operations, so single-operation
utterances fall through to the existing shapes untouched — which the numbers
confirm: one-clause accuracy does not move at all.

## Results

`a1c` is A1G plus this; `a4c` is A4 plus this. Nothing else differs.

| | intent | exact | harmful | declining precision |
|---|---|---|---|---|
| A1G | 85% | 80% | 10% | 50% |
| A1C | 86% | 81% | 10% | 50% |
| A4 | 87% | 81% | 9% | 59% |
| **A4C** | **88%** | **82%** | **9%** | **68%** |

Exact match by clause count, A4 against A4C:

| clauses | n | A4 | A4C |
|---|---|---|---|
| 1 | 193 | 84% | 84% |
| 2 | 21 | 67% | **71%** |
| 3 | 5 | 40% | **60%** |
| 4 | 2 | 0% | **50%** |

Hard tier: 55% to **59%**. One-clause accuracy is unchanged, which is the
result that matters most — the change is additive rather than a rebalance.

Four of the five bugs found on the first run were general rather than
item-specific, and fixing them helped A1G too (the camelCase indexing fix is
why A1G moved from 79% to 80%): plural tolerance so "4 cylinder" reaches the
`cylinders` column; "after" and "before" as comparators; indexing the unsplit
spelling of a camelCase header, since `out:sDa(%)` normalises to "s da" and
nobody types that; and the directional binding above.

## What is still missing, and why the harness understates it

The two remaining four-clause failures need something this harness cannot
provide. "toyotas under 10000 made after 2010" names no column for either
number — a person reads 10000 as a price and 2010 as a year **from the values
themselves**.

The real app has exactly that: `dimensionBounds` over `state.data` in
`src/store/index.js`. A bare number could be bound to the column whose range
plausibly contains it, and a number in 1900-2100 to a year column. The
evaluation set carries only headers, so it cannot score that path.

**So the production parser has a lever the measured 82% does not include.**
Binding unattached numbers by data range is the next thing to build, and it
should be measured by extending the eval items with the column ranges rather
than by guessing at it here.

---

# Checking the shipped parser

```bash
python eval/port-check.py        # refresh approaches/ported/ from src/assistant
node eval/harness.mjs a1c a1p    # measured vs shipped
```

`src/assistant/` is the production parser; `eval/approaches/` is the research
record that produced it. They are separate files, which is a real duplication,
so `a1p-ported.mjs` scores the code that actually ships by feeding the frozen
headers through the app's own entry point.

After the port it matches A1C exactly -- 86%/81%/10% overall and identical on
every tier -- so the schema change (frozen headers to the loaded CSV) cost
nothing. Re-run it after any change to `src/assistant/`; a drift between a1c
and a1p is a porting bug.

---

# The browser SLM question, settled

```bash
bash eval/run-slm-sweep.sh          # the sweep; Node 24 pinned by absolute path
```

Prompted by an article recommending seven SLMs runnable in-browser, the
question was whether any should replace or supplement the shipped parser
(A1C: 81% exact, 10% harmful, zero download, ~0.2 ms).

## The seven picks

VRAM figures are WebLLM's own for the q4f16 build.

| # | Pick | VRAM | Result |
|---|---|---|---|
| 1 | Llama 3.2 1B Instruct | 879 MB | **0% exact**, 30% valid, 30% harmful, 18.2 s/item |
| 2 | Phi-3.5 Mini | 3,672 MB | not tested; 3.8B is not a browser feature for this tool |
| 3 | Qwen 2.5 1.5B Instruct | 1,629 MB | **25% exact**, 6/8 valid, 18.1 s/item |
| 4 | Gemma 2 2B IT | 1,895 MB | gated repo; needs an HF token |
| 5 | SmolLM2 1.7B Instruct | 1,774 MB | run stopped before completing |
| 6 | TinyLlama 1.1B Chat | 675 MB | **0% exact**, 75% valid, 40% harmful, 15.5 s/item |
| 7 | StableLM 2 1.6B | — | no ONNX export; transformers.js cannot load it |

## Part A: what a constrained decoder could have prevented

The one untested variable was constrained decoding. WebLLM has JSON-mode
structured generation; transformers.js has no grammar sampler, so every
generative number here came from post-hoc validation with 192 of 221
completions rejected. Classifying those 192 by what could have prevented them:

| reason | n | bucket |
|---|---|---|
| unknown_arg | 89 | structural |
| unknown_command | 51 | structural |
| unknown_column | 18 | column-enum |
| no_json | 14 | structural |
| bad_enum | 13 | structural |
| missing_arg | 5 | structural |
| bad_scalar | 2 | structural |

**174 structural + 18 column-enum = 100% preventable by a constrained
decoder.** Only 18 of 192 were the model inventing a column; the rest is plain
schema compliance, which a JSON grammar eliminates outright.

## The decision rule was wrong, and TinyLlama is why

The rule, written before the runs: pursue a WebLLM spike if ≥60% of rejections
are constrainable **and** the best untested pick reaches ≥50% valid
completions. Both conditions passed — 100% constrainable, and TinyLlama hit
75% valid.

**The rule should not be honoured, because its second condition was a bad
proxy and the data says so.** Validity was standing in for "could be right if
the structure were fixed". TinyLlama falsified that: 75% of its completions
parsed and validated, and **0% were correct**. Worse, valid-but-wrong arrives
as a harmful error rather than a harmless blank — 40% harmful against the
shipped parser's 10%.

So constrained decoding buys well-formedness, not correctness. That was always
the thing worth knowing, and it is now measured rather than assumed.

## Why this closes the path

1. **The ceiling is far below the floor.** Of A5's 29 valid completions about
   7 were right, a ~24% valid-to-correct rate. Rescuing all 192 rejections and
   assuming they were as good as today's valid ones — generous, since they
   failed for a reason — lands near **24% exact against 81% shipped**.
2. **Constraining a capable model adds little.** Qwen 2.5 1.5B, the strongest
   pick, already produced 6/8 structurally valid completions unconstrained.
   Its errors were judgement — reaching for `clarify` where `ask.extreme` was
   wanted — which no grammar touches.
3. **The only defensible role is tiny and already measured negative.** A1C
   returns nothing on 8 of 221 utterances (4%), so a cascade competes for at
   most ~4 points; A6 measured *worse* than A4 alone, converting harmless
   blanks into confident mistakes.
4. **WebGPU only, no CPU fallback.** Fine as enhancement, fatal as a
   dependency for a tool opened from a share link.

**Decision: no browser SLM enters DesignSense.** Not "later" — measured.

## What was not tested, stated plainly

- **SmolLM2 1.7B** was stopped mid-run and has no number. At 1.7B it is the
  closest untested model to Qwen 2.5 1.5B's 25%, so it is unlikely to change
  the conclusion, but that is inference, not measurement.
- **Gemma 2 2B** needs an HF token; **Phi-3.5 Mini** at 3.7 GB was skipped as
  out of scope; **StableLM 2** has no ONNX build.
- **No model was run with constrained decoding.** The taxonomy bounds what it
  could prevent; it does not measure what a constrained model would score.
  Closing the path rests on points 1-3 above, not on that gap.
- Everything ran on CPU. The earlier DirectML benchmark showed GPU was slower
  on q4 weights (2.6 vs 12.8 tok/s), so this is the faster path here, not a
  handicap. A WebGPU runtime with hand-written kernels would be faster and
  would not change any accuracy figure.

## Where the effort should go instead

Both already identified, both cheaper than any model:

1. **Bind bare numbers by data range.** "toyotas under 10000 made after 2010"
   names no column for either number; a person reads them from the values. The
   app has `dimensionBounds` over `state.data` in `src/store/index.js`, which
   this harness withholds — so the shipped 82% structurally understates
   production. Extend the eval items with per-column ranges, then implement in
   `src/assistant/composition.js`.
2. **More examples per command.** The intent head trains on ~160 examples
   across 37 classes in `src/assistant/examples.js`. Thin, and the cheapest
   remaining win.

---

# Corrections, and the report that supersedes this section

`SLM-REPORT.md` (2026-09-16) critiques the generative rungs above and finds
that they measured one configuration -- untrained, long schema prompt,
unconstrained decoding, CPU runtime -- rather than the model class. Three
statements in this file are wrong or unmeasured and are corrected there:

1. **"transformers.js has no grammar sampler"** was true of the built-ins only.
   The installed 4.2.0 accepts a custom `LogitsProcessor` and reuses
   `past_key_values`; 4.3.0 ships an official `StructuredOutputProcessor`.
   Constrained decoding was testable in this harness and was not tested.
2. **"GPU does almost nothing here"** measured DirectML, which is in
   maintenance mode; the int4 slowdown is a CPU-EP `MatMulNBits` issue. No
   WebGPU runtime was exercised, so no latency number in this file describes
   the browser.
3. **Qwen3-0.6B at 0/8** was a configuration error (thinking mode left on),
   not a capability result.

The "no browser SLM enters DesignSense" decision stands for *prompted* SLMs.
Whether a *fine-tuned* one earns a place is an open question with gates
written down in the report, and A1C remains the floor either way.

---

# The guided bar: retrieval over pre-designed instructions

```bash
node eval/train-head.mjs      # regenerates src/assistant/intent-head.json from examples.js
node eval/guided.mjs          # round-trip, intent recall, keystrokes, column recall; lexical vs fused
node eval/guided.mjs --grid   # plus a sweep of the fusion weights
```

Instead of reading one sentence and acting, the bar now retrieves the nearest
pre-designed instructions as the person types, and walks them through the
slots (column, comparator, number with the column's range, category values,
sets, views). Text stays the source of truth: suggestions only insert
canonical text, and Enter still goes through the parser, so the understood
chip, undo and the filter chips are unchanged. The modules are
`src/assistant/templates.js` (48 phrasings of 37 commands, typed slots),
`semantic.js` (MiniLM vectors over the phrasings and over column
descriptions built from the live headers, aliases, units and sample values,
fused with the lexical ranking by reciprocal rank) and `suggest.js` (the
engine). The encoder is a runtime CDN import, loaded in the background; the
lexical ranking serves until it arrives, and a dot in the bar says which.

## What the numbers are

Recall@k is the metric for a list you pick from, not exact match. Intent is
scored on the 197 executable items (clarify and abstain golds have no
instruction to retrieve); column recall on the items with a gold column.

| | lexical only | + MiniLM + intent head |
|---|---|---|
| round-trip: template renders parse back to their command | 49/49 | 49/49 |
| intent top-1 / top-3, all | 87% / 93% | 87% / 93% |
| gold command in the top 3 within 3 keystrokes | 65% | 65% |
| keystrokes to the gold command, mean | 6.0 | 5.3 |
| never reaches the top 3 | 1% | 0% |
| column top-1: exact / tokenized / abbreviation | 94% / 87% / 82% | 97% / 83% / 86% |
| **column top-1 / top-3: synonym** | **68% / 71%** | **82% / 96%** |

The encoder does exactly what the ladder predicted and nothing else: the
`synonym` stratum ("cost" for Price, "how old" for Year) moves from 68% to
82% at the top and 71% to 96% in the top three, `abbreviation` stays with the
alias table, and intent barely moves because the parser's own reading is
already the first item whenever the sentence parses. What did move intent
was wording: fifteen templates carry `also` phrasings in the way people
speak ("get rid of the expensive ones", "the ten cheapest", "no diesels"),
indexed for retrieval and never rendered, and they took top-3 on the hard
tier from 67% to 71% and the mean keystrokes from 7.9 to 6.0 before the
encoder is even loaded. The weight grid (`eval/guided-grid.txt`) is flat
across every setting, so the defaults stand.

Read as a product: on the hard tier the parser executes 55% of sentences
exactly, while the bar has the right instruction in a three-item list for 71%
of them and shows it *before* anything runs. The remaining share is where the
gold is a compound or an ambiguity the list cannot show as one line.

Encoding costs 2-5 ms per phrase in Node and noticeably more for the first
few phrases in the browser (WASM warm-up), which is why the bar debounces
and re-ranks when the vector arrives rather than waiting for it.

## An "and" inside a phrase is not a chain

"select the best trade off between year and price" parsed correctly but
suggested filters: the bar split at the last " and " to offer a chained
second instruction and ranked only the word "price". The connector now
splits only when the text before it already reads as exactly what the whole
reads as, or the whole is a sequence; when the tail changed the parser's
reading ("between year and price"), it belongs to the phrase. The parser
item is always computed on the whole sentence. This took intent top-3 from
89% to 93% and top-1 from 85% to 87%, and the fused ranking now reaches the
gold command for every item at some prefix.

## One bug the round-trip test found

`invert the selection` parsed as `scope.reset`. Four regex `\b` escapes in
`parser.js` (and its eval twin `a1-grammar.mjs`) had been written as literal
backspace bytes, so `\binvert\b` could never match and the sentence fell
through to the BM25 fallback. Fixing the bytes moves the shipped parser to
**87% intent, 82% exact, 9% harmful** (from 86/81/10); `a1c` and `a1p` still
agree. `eval/guided-run.txt` holds the run above.

## Caveats

- The eval headers carry no column types, so `guided.mjs` treats any column
  without listed category values as numeric. The app knows better.
- Keystroke counts simulate typing the eval utterances letter by letter; a
  person who sees a list types differently, which the held-out human set the
  README keeps asking for would show.
- Column recall is measured over the whole utterance; in the slot phase the
  query is the few letters typed since the last accepted part, which is an
  easier problem.

---

# Five sentences from use, and every instruction run against the store

The first real session with the bar produced five sentences that did not do
what was meant. Each is now an item in `eval/dataset/hard.jsonl` (H067-H071,
`source: "user"`), and each had a distinct cause:

| sentence | what happened | cause | fix |
|---|---|---|---|
| how many match depth = 9 | counted everything, said nothing about depth | "depth" is the whole name of `in:Depth` and an alias of `out:EffDepth`; the tie made the count shape drop its condition silently | a name beats an alias in `resolveColumn` (the DA-beats-SDA rule, generalised); a count with a condition asks when the column is ambiguous instead of forgetting it; `ask.count` finally evaluates `where` |
| which has the highest cooling and heating | asked which column was meant | two columns read as one ambiguity | `ask.extreme` and `ask.stats` over several named columns become a sequence, one answer each |
| cluster into 5 groups | "no command for that yet" | parsed fine; no runner | k-means in `answers.js` over the numeric columns, groups saved as sets Cluster 1..k; "five" and the other number words now count |
| exclude cylinders =0 | kept cylinders = 0 | exclude only flipped ≤ and ≥ | `op: "ne"`, run as a members filter; the chip reads "cylinders ≠ 0" |
| invert selection | chip said "select invert", nothing happened | the Lite store refuses `invertSelection`; the chip showed the command id | in Lite, invert is a filter to everything the current filters leave out; the chip uses the registry title |

Then every template was rendered with sample slots for the loaded used-cars
table and run through the real store from the bar, in Lite and again in
Expert, 74 runs in all. No exceptions, and each produced its chip, answer or
state change. That sweep found and fixed: `mode.set` always landed on Lite
(the action wanted the mode itself, not an object); no runner for
`view.open` / `view.close` (new `openLayout` / `closeLayout` mutations; the
clusters panel is Expert-only and says so), `set.update` (add to or remove
from a set, with "these" meaning the selection in Expert and the result set
in Lite), `analysis.similar` (nearest neighbours on the numeric columns, as
a members filter) and `ask.compare_sets` (sizes, overlap, and what
separates the sets, with a new "compare {set} with {set2}" template).

The shipped parser reads all five user sentences; the frozen A1C copy in
`eval/approaches/` misses four, so `a1c` and `a1p` no longer agree by
design: A1C is the measured baseline, `a1p` is the live code. On the 226
items the shipped parser is at **87% intent, 82% exact, 9% harmful**; the
guided bar at **87% / 93%** intent top-1 / top-3 (hard tier 79%), 66% of
gold commands in the top 3 within three keystrokes, none unreachable.

Clustering seeds by farthest-first traversal, which on a 46-row table makes
outliers into singleton groups (sizes 37, 6, 1, 1, 1). That is defensible
and deterministic, but a quantile-based seeding would read better on small
tables.

## Second round from use

- **Clicking a finished suggestion runs it**, the same as Enter on it; only
  an unfinished one fills the box. Typing resets the highlight to the first
  item, so Enter always runs the best reading of what is in the box now.
- **Statistics said outright** ("std of price", "median odometer",
  "standard deviation of price") no longer need a question prefix; `std`,
  `stdev` and `variance` are stat words. A number or a comparator in the
  sentence still keeps it out of the stats shape, so "keep the highest 5 by
  price" stays a rank.
- **Named sets.** The parser only knew "Set #N" and three literal names, so
  "delete Cluster 1" was read as clustering into one group. The live set
  list now travels in the schema, and the set shapes and `compare` consult
  it first ("compare Cluster 1 with the rest").
- **New commands**: `scope.out` ("zoom out", one step back out of a zoom or
  exclude, against `scope.reset` for everything) and `set.clear` ("delete
  all sets"). Both are in the registry, the templates, the examples and the
  eval label space.
- **A regression the new commands caused, and its fix.** With `set.clear`
  in the corpus, the bare clause "year" left over from "price and year"
  fell into the BM25 intent-only fallback and read as "delete every set".
  The fallback now refuses any clause that names a column or a set
  outright: such a clause is an argument, never an argument-free command.
  Harmful rate fell from 9% to **8%** on the 226 items.
- **A scoring artifact in `guided.mjs`.** The parser's reading of a compound
  sentence is a `sequence`, which the metric compared to the gold's first
  step and counted as a miss. Scored by first step like the gold, intent
  recall is **98% top-1 / 100% top-3** on the 202 executable items; the
  earlier 87% / 93% understated the bar by exactly those items.

## Third round: placement, Lite's toolbar, and what "select the highest" means

- **The bar sits in the toolbar row.** The app bar's second row is gone
  (60 px instead of 108). The input takes what the toolbar leaves, never
  less than 120 px, and grows to 380 px while in use; everything else --
  the understood chip, answers, clarify candidates, the hint and the
  suggestions -- floats in one panel under it, so the bar stays one row
  tall in both modes. Checked at 1600 px wide in Expert: no overflow. Enter or a click runs a finished
  instruction; the answer stays readable until the next keystroke.
- **Lite gets a Results group** with invert and save-as-set, and the Zoom
  group gains "zoom out" (one step back). The store's `invertSelection`
  now works in Lite as a filter to everything the current filters leave
  out, so the button, the assistant and Expert's invert share one action;
  the button is disabled until something is filtered out. Undo, redo and
  clear were already in Lite's filter bar and stay there. Selection
  operations (Add, Subtract, Toggle, Intersect) remain Expert-only: a Lite
  brush is a filter, not a selection, so there is nothing for them to
  combine.
- **Chips name the answer.** "A statistic of one dimension" became
  "average of price", "highest price", "how many with year ≥ 2010",
  "Set #1 vs the rest", "4 clusters", and so on for every command with
  arguments.
- **"select the highest cooling" narrows; it does not inspect.** A
  direction word and a column with no number, and no "which" or "the ...
  one", is now `filter.percentile` to the top or bottom tenth, said in the
  chip ("top 10% by cooling") so the band can be changed. Asking is still
  "which has the highest"; looking is "show me the highest one". Two eval
  items (H072, H073) hold the reading.
- **The supported-instructions list is clickable.** It lists the templates
  themselves, grouped as the registry groups commands, with "fill in 3" or
  "runs now" beside each. A click drops the instruction into the bar as a
  suggestion item: with slots, the first slot opens with its candidates
  (columns, comparators, numbers with the column's range); with none, it
  runs at once. `instructions()` in `src/assistant/index.js` builds the list.
- **The instruction list** gained "select the highest / lowest {column}",
  "how many have {column} {op} {value}", "compare {set} with the rest", and
  std as a stat word; 56 templates round-trip. The hints under the empty
  box and the help card were rewritten around what the system does now.

On the 228 items the shipped parser is at **88% intent, 82% exact, 9%
harmful**; the guided bar at 98% / 100% intent top-1 / top-3 on the 204
executable items, 67% of gold commands in the top 3 within three
keystrokes.

## Fourth round: disjunctions

Lite could hold one range per dimension. Brushing an axis again moved the
brush, and the scatterplot held one rectangle, so "years 2004–2012 or
1990–2000" had no way in. This round makes several brushes on one axis and
several rectangles on one scatterplot into one OR-ed filter, and teaches
the assistant an "or" on one column.

- **A range filter holds boxes.** `{ dims: ["year"], boxes: [{ year: [2004,
  2012] }, { year: [1990, 2000] }] }` matches an option inside any box; a
  box constrains only the dimensions it names, and filters still AND with
  each other. A scatterplot's rectangles are one filter over its two
  dimensions (`range:price|year`), so a point in the corner region between
  two rectangles, inside neither, is out. Per gesture, a brush dragged edge
  to edge is still no brush: its box is dropped and the others stay.
- **Chips read as the user asked.** `year 2004 – 2012 OR year 1990 – 2000`,
  with each box its own small chip and its own close, so one brush can go
  while the other stays; a rectangle reads `price 5k – 10k & year 2004 –
  2012`. Set criteria and zoom explanations use the same text.
- **The parallel coordinates draw their own brushes in Lite.** The
  library's multi-brush mode (`1D-axes-multi`) addresses brushes by axis
  position, which reordering axes breaks, clears a whole axis when one
  brush collapses, fires one `brushend` per brush on a click (several undo
  steps), and pins a restored brush so it cannot move. Lite now installs
  d3 brushes inside each axis group instead: the last brush on an axis is
  always empty and takes the next drag, a collapsed brush is dropped, a
  click on empty axis space clears the axis, and each gesture is one
  store step. Expert keeps the library's single brush per axis.
- **The scatterplot follows Bostock's multiple-brush pattern.** New brush
  groups go beneath the older ones so drawn rectangles stay draggable
  above the fresh overlay. With no rectangles of its own, the plot mirrors
  a lone brush on either plotted dimension as one rectangle it can drag
  (as before); dragging it moves that brush into the plot's own filter.
  Several brushes on one dimension stay on their axis and AND with the
  plot's rectangles.
- **The two charts mirror each other.** A scatterplot rectangle is drawn on
  the parallel coordinates as a brush on each of its two axes, the same
  brushes an axis gets when brushed directly, tied top to top and bottom to
  bottom by dashed lines so the pair reads as one rectangle. Those brushes
  can be dragged on the axes: the rectangle follows, and dropping one drops
  the rectangle. The other way, the brushes on the plotted dimensions show
  on the plot as the rectangles they imply, each brush on x crossed with
  each on y (two brushes on year alone are two bands across the plot);
  dragging one of those moves the brushes into the plot's own filter, which
  matches the same options. While a rectangle is drawn or moved, the plot
  reads out both ranges beside it ("price 3572 – 13,016", "year 2000 –
  2013").
- **Brushes resize by their ends.** Each axis brush has a 10-pixel grip at
  either end, shown while the pointer is over the brush; dragging a grip
  changes the range, dragging the middle moves it, as on the scatterplot.
- **Typed narrowing draws too.** "top 5 by price" and "select the highest
  cooling" (the top tenth) used to keep a list of ids, which no chart could
  draw. They are now ranges on their dimension: the value where those rows
  begin, applied to the dimension's brushes (or its whole span), so the
  chip reads `price ≥ 25,000` and the axis shows the brush. The rows kept
  are the same, ties aside. Category filters and "≠" stay id lists, like a
  gallery selection: there is no axis to draw them on.
- **The first click on the bar no longer stalls.** The encoder's table index
  (some three hundred encodings, on the main thread) was built on the first
  suggestion request, which froze the page for a few seconds after the model
  arrived. It is now built while the page is idle as soon as the encoder is
  ready, in batches of sixteen with a real pause between them, so a click
  during the build still lands.
- **A click on the plot clears only what the plot draws.** Its own
  rectangles, or the axis brushes it is mirroring as rectangles. A brush the
  plot is not drawing stays. Likewise a click on the empty part of an axis
  clears what that axis shows: its own brushes, and the rectangles with a
  brush on it.
- **Two kinds of clear.** An axis writes its own key only (`ranges: { year:
  [] }`), so clearing the year axis leaves a price × year rectangle alone;
  the assistant's "clear the filter on year" removes every range filter
  that names year, rectangle included.
- **Noise is not a change.** Brushes are read back from pixels, so
  `sameFilter` compares ranges within 1e-4 of the dimension's span and an
  untouched brush never becomes an undo entry.
- **"or" on one column.** `price under 5000 or over 20000` is
  `filter.range` with `op: "any"` and two clauses, run as two brushes on
  the price axis; `between 2004 and 2012 or between 1990 and 2000` the
  same with two betweens. The split happens only where the right-hand
  side starts a new comparison, so `year 2000 or above` and "or more" stay
  one clause. Excluding an "or" keeps the middle (`exclude price under 5000
  or over 20000` is between 5000 and 20000), since the negation of an or
  is an and; an "or" onto another column (`price under 5000 or year over
  2010`) is refused rather than applied as an and. The compound parser
  folds an "or"-introduced comparator into the range before it, so
  `... or over 20000 sorted by year` still composes. Items H074–H078 hold
  these readings; the two "or" templates make 58 that round-trip.

On the 233 items the shipped parser is at **88% intent, 83% exact, 9%
harmful** (the frozen A1C at 86 / 79 / 12); the guided bar at 98% / 100%
intent top-1 / top-3 on the 208 executable items, 66% of gold commands in
the top 3 within three keystrokes.
