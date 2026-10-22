"""Private local benchmark, not a published launcher dependency."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import time

parser = argparse.ArgumentParser()
parser.add_argument("--model", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--reference")
parser.add_argument("--text", default="Merhaba, yayına hoş geldin. Bugün birlikte oyun oynuyoruz.")
parser.add_argument("--threads", type=int, default=6)
parser.add_argument("--batch", help="Manifest of licensed reference speakers")
parser.add_argument("--limit", type=int, default=4)
parser.add_argument("--offset", type=int, default=0)
args = parser.parse_args()
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["DO_NOT_TRACK"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ.setdefault("PKUSEG_HOME", str(Path(args.model).parent / "pkuseg-cache"))
started = time.perf_counter()
import torch
import soundfile as sf
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

torch.set_num_threads(max(1, min(args.threads, 12)))
torch.manual_seed(17)
model = ChatterboxMultilingualTTS.from_local(args.model, device="cpu", t3_model="v3")
loaded = time.perf_counter()
print(json.dumps({"stage": "loaded", "seconds": round(loaded - started, 2)}), flush=True)
if args.batch:
    batch_path = Path(args.batch)
    manifest = json.loads(batch_path.read_text(encoding="utf-8"))
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    report_file = output / "results.json"
    reports = json.loads(report_file.read_text(encoding="utf-8"))["samples"] if report_file.exists() else []
    for voice in manifest["voices"][args.offset:args.offset + max(1, min(10, args.limit))]:
        reference = batch_path.parent / voice["file"]
        if hashlib.sha256(reference.read_bytes()).hexdigest() != voice["sha256"]:
            raise ValueError("Unverified speaker reference")
        before = time.perf_counter()
        torch.manual_seed(17)
        wav = model.generate(args.text, language_id="tr", audio_prompt_path=str(reference), cfg_weight=0.5)
        seconds = time.perf_counter() - before
        file = output / (voice["id"] + ".wav")
        sf.write(file, wav.squeeze().numpy(), model.sr, subtype="PCM_16")
        report = {"id": voice["id"], "name": voice["name"], "gender": voice["gender"], "synthesisSeconds": round(seconds, 2),
                  "audioSeconds": round(wav.shape[-1] / model.sr, 2), "output": str(file),
                  "sha256": hashlib.sha256(file.read_bytes()).hexdigest()}
        reports = [entry for entry in reports if entry["id"] != voice["id"]] + [report]
        print(json.dumps(report), flush=True)
        (output / "results.json").write_text(json.dumps({"device": "cpu", "loadSeconds": round(loaded - started, 2),
            "source": manifest["source"], "license": manifest["license"], "samples": reports}, indent=2), encoding="utf-8")
    raise SystemExit(0)
wav = model.generate(args.text, language_id="tr", audio_prompt_path=args.reference, cfg_weight=0.0 if args.reference else 0.5)
finished = time.perf_counter()
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
sf.write(output, wav.squeeze().numpy(), model.sr, subtype="PCM_16")
duration = wav.shape[-1] / model.sr
report = {"model": "Chatterbox Multilingual V3", "device": "cpu", "threads": torch.get_num_threads(),
          "loadSeconds": round(loaded - started, 2), "synthesisSeconds": round(finished - loaded, 2),
          "audioSeconds": round(duration, 2), "realtimeFactor": round((finished - loaded) / duration, 2),
          "sampleRate": model.sr, "bytes": output.stat().st_size,
          "reference": str(Path(args.reference).name) if args.reference else "official built-in voice",
          "sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "output": str(output)}
output.with_suffix(".json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report), flush=True)
