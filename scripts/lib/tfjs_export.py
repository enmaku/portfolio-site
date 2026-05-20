"""Load tensorflowjs save_keras_model without tensorflowjs package __init__ side effects.

tensorflowjs 3.x imports tensorflow_hub via converters/__init__.py, which fails on
Python 3.13 / recent TensorFlow. tensorflowjs also references removed NumPy 2 aliases
(np.object, np.bool) at import time in read_weights.py / write_weights.py.
"""

from __future__ import annotations

import importlib.util
import site
import sys
import types
from pathlib import Path


def patch_numpy_for_tensorflowjs() -> None:
  import numpy as np

  if not hasattr(np, "object"):
    np.object = object  # noqa: A003
  if not hasattr(np, "bool"):
    np.bool = np.bool_  # noqa: A003


def load_save_keras_model():
  patch_numpy_for_tensorflowjs()

  tfjs_root = _find_tensorflowjs_root()
  if tfjs_root is None:
    raise ImportError(
      "tensorflowjs is not installed in this Python environment; "
      "pip install tensorflowjs in the venv used by PYTHON_BIN",
    )

  if "tensorflowjs" not in sys.modules:
    pkg = types.ModuleType("tensorflowjs")
    pkg.__path__ = [str(tfjs_root)]
    sys.modules["tensorflowjs"] = pkg

  if "tensorflowjs.converters" not in sys.modules:
    converters_pkg = types.ModuleType("tensorflowjs.converters")
    converters_pkg.__path__ = [str(tfjs_root / "converters")]
    sys.modules["tensorflowjs.converters"] = converters_pkg

  _load_module("tensorflowjs.quantization", tfjs_root / "quantization.py")
  _load_module("tensorflowjs.read_weights", tfjs_root / "read_weights.py")
  _load_module("tensorflowjs.write_weights", tfjs_root / "write_weights.py")
  _load_module("tensorflowjs.converters.common", tfjs_root / "converters" / "common.py")
  khc = _load_module(
    "tensorflowjs.converters.keras_h5_conversion",
    tfjs_root / "converters" / "keras_h5_conversion.py",
  )
  return khc.save_keras_model


def _find_tensorflowjs_root() -> Path | None:
  for site_dir in site.getsitepackages():
    candidate = Path(site_dir) / "tensorflowjs"
    if (candidate / "read_weights.py").is_file():
      return candidate
  return None


def _load_module(name: str, path: Path):
  spec = importlib.util.spec_from_file_location(name, path)
  if spec is None or spec.loader is None:
    raise ImportError(f"cannot load {name} from {path}")
  mod = importlib.util.module_from_spec(spec)
  sys.modules[name] = mod
  spec.loader.exec_module(mod)
  return mod
