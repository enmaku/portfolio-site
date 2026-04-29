#!/usr/bin/env python3
import argparse
import json
import pathlib
import sys

import tensorflow as tf
import tensorflowjs as tfjs

LOGIT_MASK = -1.0e9


def main() -> int:
  parser = argparse.ArgumentParser()
  parser.add_argument("--repo-root", required=True)
  parser.add_argument("--weights", required=True)
  parser.add_argument("--output-dir", required=True)
  args = parser.parse_args()

  repo_root = pathlib.Path(args.repo_root).resolve()
  weights_path = pathlib.Path(args.weights).resolve()
  output_dir = pathlib.Path(args.output_dir).resolve()

  if not weights_path.exists():
    print(f"weights file not found: {weights_path}", file=sys.stderr)
    return 1

  sys.path.insert(0, str(repo_root / "src"))
  from dungeon_runner.rl import actions_codec, observation  # noqa: WPS433
  from dungeon_runner.rl.model import PolicyValueModel  # noqa: WPS433

  model = PolicyValueModel(obs_dim=observation.OBS_DIM, n_actions=actions_codec.N_ACTIONS)
  obs = tf.zeros((1, observation.OBS_DIM), dtype=tf.float32)
  mask = tf.ones((1, actions_codec.N_ACTIONS), dtype=tf.float32)
  model(obs, mask, training=False)
  model.load_weights(str(weights_path))

  export_model = build_export_model(observation.OBS_DIM, actions_codec.N_ACTIONS)
  copy_weights(model, export_model)

  output_dir.mkdir(parents=True, exist_ok=True)
  tfjs.converters.save_keras_model(export_model, str(output_dir))
  normalize_tfjs_model_json(output_dir / "model.json")
  return 0


def build_export_model(obs_dim: int, n_actions: int) -> tf.keras.Model:
  model = tf.keras.Sequential(name="policy_logits_model")
  model.add(tf.keras.layers.InputLayer(input_shape=(obs_dim,), name="obs"))
  for i, width in enumerate((512, 512, 512, 256), start=1):
    model.add(tf.keras.layers.Dense(width, activation=None, name=f"hidden_{i}"))
    model.add(tf.keras.layers.LayerNormalization(name=f"ln_{i}"))
    model.add(tf.keras.layers.Activation("relu", name=f"act_{i}"))
  model.add(tf.keras.layers.Dense(n_actions, name="logits"))
  return model


def copy_weights(source: tf.keras.Model, target: tf.keras.Model) -> None:
  for i in range(1, 5):
    target.get_layer(f"hidden_{i}").set_weights(source.trunk.get_layer(f"hidden_{i}").get_weights())
    target.get_layer(f"ln_{i}").set_weights(source.trunk.get_layer(f"ln_{i}").get_weights())
  target.get_layer("logits").set_weights(source.logits.get_weights())


def normalize_tfjs_model_json(model_json_path: pathlib.Path) -> None:
  data = json.loads(model_json_path.read_text())
  model_name = (
    data.get("modelTopology", {})
    .get("model_config", {})
    .get("config", {})
    .get("name")
  )
  layers = (
    data.get("modelTopology", {})
    .get("model_config", {})
    .get("config", {})
    .get("layers", [])
  )
  for layer in layers:
    if layer.get("class_name") != "InputLayer":
      continue
    config = layer.get("config", {})
    batch_shape = config.pop("batch_shape", None)
    if batch_shape is not None and "batchInputShape" not in config:
      config["batchInputShape"] = batch_shape
  if model_name:
    prefix = f"{model_name}/"
    for manifest in data.get("weightsManifest", []):
      for weight in manifest.get("weights", []):
        name = weight.get("name")
        if isinstance(name, str) and name.startswith(prefix):
          weight["name"] = name[len(prefix) :]
  model_json_path.write_text(json.dumps(data))


if __name__ == "__main__":
  raise SystemExit(main())
