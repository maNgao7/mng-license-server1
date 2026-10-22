"""Private JSON-lines worker. stdout is protocol-only; no input text is logged."""
import base64
import contextlib
import hashlib
import io
import json
import logging
import os
from pathlib import Path
import socket
import sys
import wave

MAX_LINE = 16 * 1024 * 1024
MODEL = {
    "t3_mtl23ls_v3.safetensors": (2143989928, "5abca8321ede76f8e61f1cc0d19aea6c946b28871017ce8726f8a69203f05953"),
    "s3gen.pt": (1057165844, "9b9ff07e60b20c136e2b1b3d7563a24604e8d2c4c267888d1ee929dd0151d2a3"),
    "ve.pt": (5698626, "4b16d836bc598509860f6fa068165a8bb5e9ac84f05582dfcf278a5a372879f1"),
    "conds.pt": (107374, "6552d70568833628ba019c6b03459e77fe71ca197d5c560cef9411bee9d87f4e"),
    "Cangjie5_TC.json": (1920163, "7073fd9de919443ae88e0bd2449917a65fe54898a4413ed1edcc4b67f28bce8c"),
    "grapheme_mtl_merged_expanded_v1.json": (69989, "69632f47220a788a52ce2661d096453c5655e9bf25289d89a8d832c46ee07dbf"),
}
IDS = {"d2-00331", "d2-00919", "d1-00525", "d1-02311", "d1-02057", "d2-00703", "d1-01027", "d1-00884", "d1-00781", "d1-00727"}


class SafeError(Exception):
    pass


def no_network(*_args, **_kwargs):
    raise SafeError("CHATTERBOX_NETWORK_DISABLED")


def offline():
    os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1",
                      DO_NOT_TRACK="1", TOKENIZERS_PARALLELISM="false", OMP_NUM_THREADS="6",
                      MKL_NUM_THREADS="6", OPENBLAS_NUM_THREADS="6", TQDM_DISABLE="1")
    socket.socket.connect = no_network
    socket.socket.connect_ex = no_network
    socket.create_connection = no_network
    socket.getaddrinfo = no_network
    logging.disable(logging.CRITICAL)


def read_json(file):
    if file.is_symlink() or not file.is_file() or file.stat().st_size > 65536:
        raise SafeError("CHATTERBOX_PACK_INVALID")
    return json.loads(file.read_text(encoding="utf-8-sig"))


def verify_file(file, size, expected, root):
    if file.is_symlink() or not file.is_file() or not file.resolve().is_relative_to(root) or file.stat().st_size != size:
        raise SafeError("CHATTERBOX_PACK_INVALID")
    digest = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != expected:
        raise SafeError("CHATTERBOX_PACK_INVALID")


def verify_pack(root):
    root = root.resolve(strict=True)
    model = root / "model-v3"
    if not model.exists():
        model = root / "model"
    metadata = read_json(model / "tikmng-model-manifest.json")
    if metadata.get("repo") != "ResembleAI/chatterbox" or metadata.get("revision") != "5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18" or len(metadata.get("files", [])) != len(MODEL):
        raise SafeError("CHATTERBOX_PACK_INVALID")
    for name, (size, digest) in MODEL.items():
        matches = [entry for entry in metadata["files"] if entry.get("name") == name and entry.get("bytes") == size and entry.get("sha256") == digest]
        if len(matches) != 1:
            raise SafeError("CHATTERBOX_PACK_INVALID")
        verify_file(model / name, size, digest, root)
    manifest = read_json(root / "references" / "manifest.json")
    voices = {}
    if len(manifest.get("voices", [])) != 10:
        raise SafeError("CHATTERBOX_PACK_INVALID")
    for voice in manifest["voices"]:
        identity = voice.get("id")
        if identity not in IDS or identity in voices or voice.get("file") != identity + ".flac":
            raise SafeError("CHATTERBOX_PACK_INVALID")
        reference = root / "references" / voice["file"]
        size = voice.get("bytes", 0)
        if not isinstance(size, int) or not 44 <= size <= 4 * 1024 * 1024:
            raise SafeError("CHATTERBOX_PACK_INVALID")
        verify_file(reference, size, voice.get("sha256"), root)
        voices[identity] = (reference, size, voice["sha256"])
    return root, model, voices


def load(root):
    root, directory, references = verify_pack(Path(root))
    cache = root / "cache"
    cache.mkdir(exist_ok=True)
    os.environ["HF_HOME"] = str(cache / "hf")
    os.environ["NUMBA_CACHE_DIR"] = str(cache / "numba")
    import torch
    import chatterbox.models.tokenizers.tokenizer as tokenizer

    # Upstream eagerly initializes Chinese downloads for every language. Only its
    # Chinese converter is disabled; Turkish tokenization and watermarking remain.
    def turkish_only_init(self, model_dir=None):
        self.word2cj, self.cj2word, self.segmenter = {}, {}, None
    tokenizer.ChineseCangjieConverter.__init__ = turkish_only_init
    tokenizer.ChineseCangjieConverter.__call__ = no_network
    torch.set_num_threads(6)
    torch.set_num_interop_threads(1)
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    model = ChatterboxMultilingualTTS.from_local(directory, device="cpu", t3_model="v3")
    if model.watermarker is None:
        raise SafeError("CHATTERBOX_WATERMARK_REQUIRED")
    return root, model, references


def synthesize(state, message):
    root, model, references = state
    if set(message) != {"v", "id", "type", "text", "voiceId", "rate"}:
        raise SafeError("CHATTERBOX_INPUT")
    text, identity = message.get("text"), message.get("voiceId")
    if not isinstance(text, str) or not text.strip() or len(text) > 500 or any((ord(c) < 32 and c not in "\t\n\r") or ord(c) == 127 or 0xD800 <= ord(c) <= 0xDFFF for c in text):
        raise SafeError("CHATTERBOX_INPUT")
    if not isinstance(identity, str) or identity not in references:
        raise SafeError("CHATTERBOX_VOICE_INVALID")
    if type(message.get("rate")) not in (int, float) or message["rate"] != 1:
        raise SafeError("CHATTERBOX_RATE_UNSUPPORTED")
    reference, size, digest = references[identity]
    verify_file(reference, size, digest, root)
    import torch
    import numpy as np
    torch.manual_seed(17)
    with torch.inference_mode():
        audio = model.generate(text, language_id="tr", audio_prompt_path=str(reference), cfg_weight=0.5)
    data = audio.squeeze().detach().cpu().numpy()
    if data.ndim != 1 or not data.size or data.size * 2 + 44 > 12 * 1024 * 1024 or not np.isfinite(data).all():
        raise SafeError("CHATTERBOX_INVALID_AUDIO")
    output = io.BytesIO()
    with wave.open(output, "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(model.sr)
        stream.writeframes((np.clip(data, -1, 1) * 32767).astype("<i2").tobytes())
    return {"audioBase64": base64.b64encode(output.getvalue()).decode("ascii"), "mimeType": "audio/wav"}


def emit(protocol, message):
    encoded = json.dumps(message, ensure_ascii=True, separators=(",", ":"))
    if len(encoded) >= MAX_LINE:
        raise SafeError("CHATTERBOX_OUTPUT_LIMIT")
    protocol.write(encoded + "\n")
    protocol.flush()


def main():
    offline()
    protocol = sys.stdout
    # Discard third-party logs/progress, including anything that could echo text.
    with open(os.devnull, "w", encoding="utf-8") as sink, contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
        state = None
        while True:
            line = sys.stdin.buffer.readline(8193)
            if not line:
                return
            identity = 0
            try:
                if len(line) > 8192 or not line.endswith(b"\n"):
                    return
                request = json.loads(line)
                if not isinstance(request, dict) or request.get("v") != 1 or type(request.get("id")) is not int or not 1 <= request["id"] <= 2**53 - 1:
                    raise SafeError("CHATTERBOX_INPUT")
                identity = request["id"]
                if request.get("type") == "init" and state is None and set(request) == {"v", "id", "type", "root"} and isinstance(request["root"], str):
                    state = load(request["root"])
                    emit(protocol, {"v": 1, "id": identity, "type": "ready"})
                elif request.get("type") == "synthesize" and state is not None:
                    result = synthesize(state, request)
                    emit(protocol, {"v": 1, "id": identity, "type": "audio", **result})
                else:
                    raise SafeError("CHATTERBOX_INPUT")
            except Exception as exc:
                code = str(exc) if isinstance(exc, SafeError) else "CHATTERBOX_FAILED"
                emit(protocol, {"v": 1, "id": identity, "type": "error", "code": code})
                if state is None:
                    return


if __name__ == "__main__":
    main()
