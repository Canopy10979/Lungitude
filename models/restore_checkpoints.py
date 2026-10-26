"""Reassemble the published EfficientNet checkpoint and verify its original hash."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "models/manifest.json").read_text())
entry = next(model for model in manifest["models"] if model["id"] == "efficientnet_b0")
target = root / entry["artifact"]
parts = [target.with_name(target.name + f".part{number}") for number in range(1, 4)]
content = b"".join(part.read_bytes() for part in parts)
if len(content) != entry["bytes"] or hashlib.sha256(content).hexdigest() != entry["sha256"]:
    raise SystemExit("Checkpoint verification failed; no checkpoint written.")
target.write_bytes(content)
print("Restored and verified:", entry["artifact"])
