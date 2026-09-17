/**
 * A6 — A4 first, the generative model only where A4 has nothing.
 *
 * The point of a cascade is that the expensive rung is rare. A4 answers most
 * utterances in about a millisecond; only the ones it cannot read at all are
 * worth a second and a half of generation. So the question this rung settles
 * is not "is the model good" but "does the model earn its keep on exactly the
 * cases the grammar fails".
 *
 * Deferral is deliberately narrow. A4 returning `clarify` is a good answer,
 * not a failure, so it is kept; the model is asked only when A4 returns
 * nothing, or abstains for want of any reading rather than on principle.
 */

import a4 from "./a4-minilm-logreg.mjs";
import a5 from "./a5-qwen.mjs";

/**
 * Only a genuine blank defers.
 *
 * The first version also deferred on `abstain`, which cost a third of A4's
 * declining recall: a deliberate refusal is an answer, and handing it to a
 * second opinion throws a right answer away. A cascade may only be asked about
 * cases where the first rung produced nothing at all.
 */
function shouldDefer(result) {
  return result === null;
}

let deferred = 0;
let total = 0;
let rescued = 0;

export default {
  id: "a6",
  name: "A4, falling back to Qwen only where A4 has nothing",

  async warmup(items) {
    await a4.warmup(items);

    // Work out where A4 comes up empty, and pay for generation only there.
    let needed = items.filter((item) =>
      shouldDefer(a4.parse(item.utterance, { dataset: item.dataset, state: item.state || {} }))
    );
    deferred = needed.length;
    total = items.length;
    process.stdout.write("(" + deferred + "/" + total + " deferred) ");
    if (needed.length > 0) await a5.warmup(needed);

    rescued = needed.filter((item) =>
      a5.parse(item.utterance, { dataset: item.dataset, state: item.state || {} }) !== null
    ).length;
  },

  parse(utterance, context) {
    let first = a4.parse(utterance, context);
    if (!shouldDefer(first)) return first;
    let second = a5.parse(utterance, context);
    return second === null ? first : second;
  },

  notes() {
    let share = total ? ((100 * deferred) / total).toFixed(0) : "0";
    return {
      cascade: deferred + " of " + total + " utterances reached the model (" + share + "%)",
      rescued: rescued + " of those produced a valid command",
    };
  },
};
