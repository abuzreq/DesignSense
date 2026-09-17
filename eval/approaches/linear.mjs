/**
 * Multinomial logistic regression, full-batch gradient descent, no dependency.
 *
 * A4's whole thesis: a linear head over frozen embeddings usually beats
 * nearest-neighbour over the same embeddings, because it can learn which
 * directions separate the classes instead of trusting raw cosine. With 37
 * commands and 384 dimensions the head is ~14k floats — about 55 KB, next to
 * nothing beside the encoder that produced its inputs.
 *
 * It is trained only on the example corpus in examples.mjs. Training on the
 * evaluation set would make every number here meaningless.
 */

function softmax(scores) {
  let top = -Infinity;
  for (let i = 0; i < scores.length; i++) if (scores[i] > top) top = scores[i];
  let sum = 0;
  let out = new Float64Array(scores.length);
  for (let i = 0; i < scores.length; i++) {
    out[i] = Math.exp(scores[i] - top);
    sum += out[i];
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

/**
 * `rows` are vectors, `targets` are class indices. Returns a predictor that
 * turns one vector into a probability per class.
 */
export function trainSoftmax(rows, targets, classCount, options) {
  let settings = options || {};
  let epochs = settings.epochs || 300;
  let rate = settings.rate || 1.0;
  let l2 = settings.l2 === undefined ? 1e-3 : settings.l2;
  let momentum = settings.momentum === undefined ? 0.9 : settings.momentum;

  let dims = rows[0].length;
  let n = rows.length;
  let weights = new Float64Array(classCount * dims);
  let bias = new Float64Array(classCount);
  let weightVelocity = new Float64Array(classCount * dims);
  let biasVelocity = new Float64Array(classCount);

  let logits = new Float64Array(classCount);
  let gradWeights = new Float64Array(classCount * dims);
  let gradBias = new Float64Array(classCount);

  for (let epoch = 0; epoch < epochs; epoch++) {
    gradWeights.fill(0);
    gradBias.fill(0);

    for (let i = 0; i < n; i++) {
      let row = rows[i];
      for (let c = 0; c < classCount; c++) {
        let sum = bias[c];
        let base = c * dims;
        for (let d = 0; d < dims; d++) sum += weights[base + d] * row[d];
        logits[c] = sum;
      }
      let probabilities = softmax(logits);
      for (let c = 0; c < classCount; c++) {
        let error = probabilities[c] - (c === targets[i] ? 1 : 0);
        if (error === 0) continue;
        let base = c * dims;
        for (let d = 0; d < dims; d++) gradWeights[base + d] += error * row[d];
        gradBias[c] += error;
      }
    }

    let scale = rate / n;
    for (let k = 0; k < weights.length; k++) {
      let gradient = gradWeights[k] / n + l2 * weights[k];
      weightVelocity[k] = momentum * weightVelocity[k] - rate * gradient;
      weights[k] += weightVelocity[k];
    }
    for (let c = 0; c < classCount; c++) {
      biasVelocity[c] = momentum * biasVelocity[c] - scale * gradBias[c];
      bias[c] += biasVelocity[c];
    }
  }

  return {
    parameters: classCount * (dims + 1),
    weights: weights,
    bias: bias,
    dims: dims,
    predict(row) {
      let scores = new Float64Array(classCount);
      for (let c = 0; c < classCount; c++) {
        let sum = bias[c];
        let base = c * dims;
        for (let d = 0; d < row.length; d++) sum += weights[base + d] * row[d];
        scores[c] = sum;
      }
      return softmax(scores);
    },
  };
}
