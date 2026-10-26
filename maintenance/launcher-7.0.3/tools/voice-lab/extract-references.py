"""Extract ten CC BY 4.0 synthetic Turkish speaker references for private QA."""
import argparse
import hashlib
import json
from pathlib import Path
import pyarrow.parquet as pq

parser = argparse.ArgumentParser()
parser.add_argument("--source", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()
source = Path(args.source)
if hashlib.sha256(source.read_bytes()).hexdigest() != "5f7022efa9c2fc2f62c328812bf5b82792922bfe032a8ad09bcb7fbe848acf51":
    raise ValueError("Unverified reference source")
selected = {"d2-00331": "Ece", "d2-00919": "Mert", "d1-00525": "Ada", "d1-02311": "Efe",
            "d1-02057": "Derya", "d2-00703": "Arda", "d1-01027": "Neva", "d1-00884": "Bora",
            "d1-00781": "Beste", "d1-00727": "Usta"}
rows = {row["voice_id"]: row for row in pq.read_table(source).to_pylist() if row["voice_id"] in selected}
if len(rows) != len(selected):
    raise ValueError("Reference identity missing")
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
manifest = {"source": "https://huggingface.co/datasets/cloud0day3/alania-synthetic-speech-tr",
            "revision": "277dfc8a2322014099ff72688bcaee12480c4605", "license": "CC BY 4.0",
            "attribution": "Alania Turkish Synthetic Speech by PatientDesk AI",
            "licenseURL": "https://creativecommons.org/licenses/by/4.0/",
            "changes": "Ten reference clips extracted unchanged; local display names added by TikMnG. Any generated samples are adaptations.",
            "voices": []}
for voice_id, name in selected.items():
    row = rows[voice_id]
    suffix = Path(row["reference_audio"]["path"] or "reference.wav").suffix
    if suffix.lower() not in [".wav", ".flac", ".mp3", ".ogg"]:
        raise ValueError("Unknown reference encoding")
    data = row["reference_audio"]["bytes"]
    file = output / (voice_id + suffix)
    file.write_bytes(data)
    manifest["voices"].append({"id": voice_id, "name": name, "gender": row["gender"],
                               "description": row["voice_description"], "referenceText": row["reference_text"],
                               "file": file.name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
(output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"extracted": len(manifest["voices"]), "bytes": sum(voice["bytes"] for voice in manifest["voices"])}))
