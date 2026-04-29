#!/usr/bin/env python3
import argparse
import json
import pathlib
import sys

import numpy as np
import tensorflow as tf


def main() -> int:
  parser = argparse.ArgumentParser()
  parser.add_argument("--input", required=True)
  args = parser.parse_args()

  payload_path = pathlib.Path(args.input).resolve()
  payload = json.loads(payload_path.read_text())
  repo_root = pathlib.Path(payload["repoRoot"]).resolve()
  weights_path = pathlib.Path(payload["weightsPath"]).resolve()
  cases = payload["cases"]

  if not weights_path.exists():
    print(json.dumps({"error": f"weights not found: {weights_path}"}))
    return 1

  sys.path.insert(0, str(repo_root / "src"))
  from dungeon_runner.rl import actions_codec, observation  # noqa: WPS433
  from dungeon_runner.rl.model import PolicyValueModel  # noqa: WPS433

  model = PolicyValueModel(obs_dim=observation.OBS_DIM, n_actions=actions_codec.N_ACTIONS)
  model(
    tf.zeros((1, observation.OBS_DIM), dtype=tf.float32),
    tf.ones((1, actions_codec.N_ACTIONS), dtype=tf.float32),
    training=False,
  )
  model.load_weights(str(weights_path))

  results = []
  for case in cases:
    obs = np.asarray([case["features"]], dtype=np.float32)
    mask = np.asarray([case["legalMask"]], dtype=np.float32)
    obs_t = tf.constant(obs)
    mask_t = tf.constant(mask)
    unmasked = model.logits(model.trunk(obs_t, training=False), training=False).numpy()[0]
    masked = model(obs_t, mask_t, training=False)[0].numpy()[0]
    legal_indices = [i for i, v in enumerate(mask[0].tolist()) if v > 0]
    top_legal = sorted(legal_indices, key=lambda i: float(masked[i]), reverse=True)[:5]
    results.append(
      {
        "unmasked_logits": unmasked.tolist(),
        "masked_logits": masked.tolist(),
        "argmax_unmasked_index": int(np.argmax(unmasked)),
        "argmax_masked_index": int(np.argmax(masked)),
        "top_legal_indices": top_legal,
      }
    )

  print(json.dumps({"results": results}))
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
