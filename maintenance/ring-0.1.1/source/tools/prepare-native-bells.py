"""Mute only the private demo's automatic round bells; HUD owns start/result audio."""
import argparse
import io
from pathlib import Path
import shutil
import wave

def prepare(game: Path, backups: Path):
    game=game.resolve();backups=backups.resolve()
    changed=[]
    for name in ['round_start.wav','round_end.wav']:
        target=(game/'assets/sounds/sounds_v2'/name).resolve()
        if not target.is_relative_to(game):raise RuntimeError('Unexpected native sound path')
        original=target.read_bytes()
        with wave.open(io.BytesIO(original),'rb') as reader:
            params=reader.getparams();frames=reader.readframes(params.nframes)
        silence=bytes([128 if params.sampwidth==1 else 0])*len(frames)
        if frames==silence:continue
        backups.mkdir(parents=True,exist_ok=True)
        backup=backups/('native-auto-'+name)
        if not backup.exists():shutil.copy2(target,backup)
        output=io.BytesIO()
        with wave.open(output,'wb') as writer:writer.setparams(params);writer.writeframes(silence)
        temporary=target.with_suffix('.tmp.wav');temporary.write_bytes(output.getvalue());temporary.replace(target)
        changed.append(name)
    return changed

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    if not args.apply:parser.error('--apply required for the private native copy')
    root=Path('D:/TikMnG/Hediye-Box-Private').resolve()
    print('Private automatic bells muted:',prepare(root/'native-game',root/'original-assets'))
