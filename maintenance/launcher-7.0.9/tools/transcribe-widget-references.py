import json
import os
import sys
from pathlib import Path

ROOT = Path('D:/TikMnG-Widget-References-20261025')
os.environ['HF_HOME'] = str(ROOT / 'models')
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
from faster_whisper import WhisperModel

model = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=8, download_root=str(ROOT / 'models'))
for entry in json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8')):
    out = Path(entry['out'])
    if (out / 'transcript.json').exists() and '--force' not in sys.argv:
        continue
    segments, info = model.transcribe(str(out / 'narration.wav'), language='tr', beam_size=5, vad_filter=True,
                                      initial_prompt='TikTok canlı yayın widget ayarları. Hediye, coin, beğeni, profil fotoğrafı, sıralama, bağlantı.')
    rows = []
    for segment in segments:
        rows.append({'start':segment.start, 'end':segment.end, 'text':segment.text, 'no_speech_prob':segment.no_speech_prob})
        print(entry['id'], round(segment.start, 1), segment.text, flush=True)
    (out / 'transcript.json').write_text(json.dumps({'language':info.language, 'segments':rows}, ensure_ascii=False, indent=2), encoding='utf-8')
    (out / 'transcript.txt').write_text('\n'.join(f"[{row['start']:.1f}-{row['end']:.1f}] {row['text']}" for row in rows), encoding='utf-8')
