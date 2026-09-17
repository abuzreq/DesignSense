#!/usr/bin/env bash
# Sweeps the article's browser SLMs over the same prompt, validator and metrics.
#
# Node is pinned by absolute path: nvm-windows switches the global symlink, and
# this project's dev server pins Node 15 (fibers), which cannot run the harness.
set -u

NODE="C:/Users/abuzr/AppData/Roaming/nvm/v24.19.0/node.exe"
OUT="eval/slm-sweep"
mkdir -p "$OUT"

echo "=== A (gate): full run, Qwen2.5-0.5B, for the rejection taxonomy"
"$NODE" eval/harness.mjs a5 > "$OUT/a5-qwen-0.5b-full.txt" 2>&1
grep -E "overall|invalid|rejected|constrained|generate" "$OUT/a5-qwen-0.5b-full.txt" | head -8

for spec in \
  "llama-3.2-1b|onnx-community/Llama-3.2-1B-Instruct" \
  "tinyllama-1.1b|Xenova/TinyLlama-1.1B-Chat-v1.0" \
  "smollm2-1.7b|HuggingFaceTB/SmolLM2-1.7B-Instruct"
do
  name="${spec%%|*}"
  model="${spec##*|}"
  echo "=== B: $name ($model)"
  A5_MODEL="$model" "$NODE" eval/harness.mjs a5 --limit=20 \
    > "$OUT/$name.txt" 2>&1
  grep -E "overall|invalid|rejected|generate" "$OUT/$name.txt" | head -6
done

echo "=== sweep complete"
