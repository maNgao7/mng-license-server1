"""Build the private game's in-swapchain HUD with the installed Vulkan toolchain."""
import argparse
import json
from pathlib import Path
import struct
import subprocess
import tempfile

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--zig',type=Path,required=True)
    p.add_argument('--headers',type=Path,required=True)
    p.add_argument('--glslang',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    a=p.parse_args()
    here=Path(__file__).resolve().parent
    a.output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='tikmng-hud-build-') as tmp:
        work=Path(tmp)
        declarations=[]
        for stage in ['vert','frag']:
            binary=work/(stage+'.spv')
            subprocess.run([a.glslang,'-V','--target-env','vulkan1.1','-o',binary,here/('hud.'+stage)],check=True)
            words=','.join(hex(w[0])+'u' for w in struct.iter_unpack('<I',binary.read_bytes()))
            declarations.append('static const uint32_t hud_'+stage+'[]={'+words+'};')
        (work/'hud_shaders.h').write_text('\n'.join(declarations))
        subprocess.run([a.zig,'cc','-target','x86_64-windows-gnu','-O2','-shared',
                        '-I'+str(a.headers),'-I'+str(work),here/'native_hud.c',
                        '-o',a.output/'tikmng-native-hud.dll'],check=True)
    (a.output/'native-hud.json').write_text(json.dumps({'file_format_version':'1.2.0','layer':{
        'name':'VK_LAYER_TikMnG_native_hud','type':'GLOBAL','library_path':'.\\tikmng-native-hud.dll',
        'api_version':'1.3.0','implementation_version':'1','description':'TikMnG private in-game HUD'}},indent=2))
    print('Native HUD layer compiled.')

if __name__=='__main__': main()
