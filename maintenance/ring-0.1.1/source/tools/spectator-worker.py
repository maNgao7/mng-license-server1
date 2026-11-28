"""Private pinned-game spectator bridge. Only its own copied process is managed."""
import ctypes
from ctypes import wintypes
import hashlib
import json
import pathlib
import re
import sys
import threading
import time
import os

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[2]
LOCAL_RUNTIME=HERE.parent/'runtime/probe-runtime'
sys.path.insert(0,str(LOCAL_RUNTIME if LOCAL_RUNTIME.exists() else ROOT/'tools/hediye-box-probe-runtime'))
import frida

sys.stdout.reconfigure(encoding='utf-8')
GAME=pathlib.Path(os.environ.get('TIKMNG_RING_NATIVE_GAME','D:/TikMnG/Hediye-Box-Private/native-game/boxing.exe'))
EXPECTED='9132d5631f59661f8bde912d6b1e5b9788c24fd7031bb1aa81d16b298b293e67'
OUTPUT_LOCK=threading.Lock()
def output(value):
    with OUTPUT_LOCK:
        print(json.dumps(value,ensure_ascii=False),flush=True)

def track_window(pid,stop):
    user=ctypes.WinDLL('user32',use_last_error=True)
    # Electron converts physical client bounds to device-independent pixels.
    # Ask Windows for physical coordinates even on mixed-scale displays.
    if hasattr(user,'SetThreadDpiAwarenessContext'):
        user.SetThreadDpiAwarenessContext(ctypes.c_void_p(-4))
    enumproc=ctypes.WINFUNCTYPE(wintypes.BOOL,wintypes.HWND,wintypes.LPARAM)
    user.GetForegroundWindow.restype=wintypes.HWND
    user.GetWindowThreadProcessId.argtypes=[wintypes.HWND,ctypes.POINTER(wintypes.DWORD)]
    user.GetWindowTextW.argtypes=[wintypes.HWND,wintypes.LPWSTR,ctypes.c_int]
    user.IsWindowVisible.argtypes=[wintypes.HWND]
    user.IsIconic.argtypes=[wintypes.HWND]
    user.GetClientRect.argtypes=[wintypes.HWND,ctypes.POINTER(wintypes.RECT)]
    user.ClientToScreen.argtypes=[wintypes.HWND,ctypes.POINTER(wintypes.POINT)]
    user.EnumWindows.argtypes=[enumproc,wintypes.LPARAM]
    # Bind the transparent HUD to this game so Windows keeps both at the same
    # desktop depth on Alt+Tab, Start, minimize and restore.
    overlay=int(sys.argv[1]) if len(sys.argv)==3 else 0
    overlay_pid=int(sys.argv[2]) if overlay else 0
    owner=None
    if overlay:
        set_owner=user.SetWindowLongPtrW if ctypes.sizeof(ctypes.c_void_p)==8 else user.SetWindowLongW
        set_owner.argtypes=[wintypes.HWND,ctypes.c_int,ctypes.c_ssize_t]
        set_owner.restype=ctypes.c_ssize_t
    previous=None
    title=ctypes.create_unicode_buffer(64)
    while not stop.wait(.12):
        windows=[]
        @enumproc
        def visit(hwnd,_):
            process=wintypes.DWORD()
            user.GetWindowThreadProcessId(hwnd,ctypes.byref(process))
            if process.value==pid and user.IsWindowVisible(hwnd):
                # This game also owns a zero-size, untitled helper window.
                if user.GetWindowTextW(hwnd,title,len(title)) and title.value=='Online Boxing 3D':
                    windows.append(hwnd)
                    return False
            return True
        user.EnumWindows(visit,0)
        value={'visible':False,'focused':False}
        if windows:
            hwnd=windows[0];rect=wintypes.RECT();origin=wintypes.POINT(0,0)
            if overlay and owner!=hwnd:
                process=wintypes.DWORD()
                user.GetWindowThreadProcessId(overlay,ctypes.byref(process))
                if process.value==overlay_pid:
                    ctypes.set_last_error(0)
                    prior=set_owner(overlay,-8,hwnd)  # GWLP_HWNDPARENT on a top-level window
                    if prior or not ctypes.get_last_error():owner=hwnd
            if not user.IsIconic(hwnd) and user.GetClientRect(hwnd,ctypes.byref(rect)) and user.ClientToScreen(hwnd,ctypes.byref(origin)):
                value={'handle':str(hwnd),'visible':True,'focused':user.GetForegroundWindow()==hwnd,'hudOwned':owner==hwnd,
                    'bounds':{'x':origin.x,'y':origin.y,'width':rect.right,'height':rect.bottom}}
                frame=wintypes.RECT()
                if ctypes.windll.dwmapi.DwmGetWindowAttribute(wintypes.HWND(hwnd),9,ctypes.byref(frame),ctypes.sizeof(frame))==0:
                    value['frame']={'width':frame.right-frame.left,'height':frame.bottom-frame.top,
                        'clientX':origin.x-frame.left,'clientY':origin.y-frame.top}
        if value!=previous:output({'type':'window','value':value});previous=value

def main():
    if hashlib.sha256(GAME.read_bytes()).hexdigest()!=EXPECTED:raise RuntimeError('Oyun sürümü uyumlu değil.')
    device=frida.get_local_device()
    if any(p.name.lower()=='boxing.exe' for p in device.enumerate_processes()):raise RuntimeError('Boks oyunu zaten açık. İkinci oyun açılmadı.')
    # Direct original ring; the verified native adapter chooses spectator AI.
    native_output=[];pid=None
    def game_output(process,descriptor,data):
        if process!=pid or not data:return
        text=data.decode('utf-8',errors='replace')[-2000:]
        if 'STEAM DATA' in text or 'SteamID' in text or 'steam_user' in text:return
        text=re.sub(r'\b\d{15,20}\b','[id]',text)
        for marker in ('FIGHT RESULT','REPLAYS SET PAUSED','After round'):
            if marker in text:output({'type':'diagnostic','source':'native-round','event':marker})
        if any(word in text.lower() for word in ('panic','fatal','error','warning','exception')):
            native_output.append(text)
            del native_output[:-8]
            output({'type':'diagnostic','source':'native-output','text':text})
    device.on('output',game_output)
    pid=device.spawn([str(GAME),'sparring_cpu_vs_cpu'],cwd=str(GAME.parent),stdio='pipe')
    session=None;stop=threading.Event()
    try:
        session=device.attach(pid)
        sources=['../assets/ring-layout.js','native-camera.js','spectator-camera.js','spectator-native.js']
        verified_path='globalThis.TikMngVerifiedGamePath='+json.dumps(str(GAME.resolve()).replace('\\','/').lower())+';\n'
        script=session.create_script(verified_path+'\n'.join((HERE/name).read_text(encoding='utf-8') for name in sources))
        def message(value,_):
            if value.get('type')=='send':output(value['payload'])
            elif value.get('type')=='error':
                output({'type':'state','value':{'phase':'error','health':[None,None],'error':value.get('description','Oyun bağlantısı hatası')}})
                output({'type':'diagnostic','stack':value.get('stack','')[:1600]})
        script.on('message',message)
        def detached(reason,crash=None):
            stop.set()
            output({'type':'game-closed','reason':reason,'detail':str(crash or '')[:2000],
                    'nativeOutput':''.join(native_output)[-4000:]})
        session.on('detached',detached)
        script.load();device.resume(pid)
        output({'type':'process','pid':pid})
        tracker=threading.Thread(target=track_window,args=(pid,stop),daemon=True);tracker.start()
        for line in sys.stdin:
            request=json.loads(line)
            if request.get('action')=='close':break
            try:
                action=request.get('action')
                if action not in ['start','stage','reset','sample','punch','camera','follow','zoom','camera_sample']:raise RuntimeError('Desteklenmeyen oyun işlemi.')
                method=getattr(script.exports_sync,action)
                value=method(request.get('value')) if action in ['punch','stage','reset','camera','zoom','follow'] else method()
                output({'type':'response','id':request.get('id'),'ok':True,'value':value})
            except Exception as error:
                error_text=str(error).splitlines()[0].removeprefix('Error: ')
                output({'type':'response','id':request.get('id'),'ok':False,'error':error_text[:400]})
            if stop.is_set():break
    finally:
        stop.set()
        if session:
            try:session.detach()
            except frida.InvalidOperationError:pass
        try:device.kill(pid)
        except (frida.ProcessNotFoundError,frida.InvalidOperationError):pass

if __name__=='__main__':
    try:main()
    except Exception as error:
        output({'type':'state','value':{'phase':'error','health':[None,None],'error':str(error)[:400]}})
        sys.exit(1)
