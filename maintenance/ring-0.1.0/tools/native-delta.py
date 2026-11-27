"""Verified binary compatibility delta using the Windows MSDelta API."""
import ctypes as c
from ctypes import wintypes as w
from pathlib import Path
import sys,hashlib,json,zipfile,tempfile
class Input(c.Structure):_fields_=[('data',c.c_void_p),('size',c.c_size_t),('editable',w.BOOL)]
class Output(c.Structure):_fields_=[('data',c.c_void_p),('size',c.c_size_t)]
dll=c.WinDLL('msdelta',use_last_error=True)
dll.DeltaFree.argtypes=[c.c_void_p];dll.DeltaFree.restype=w.BOOL
dll.CreateDeltaB.argtypes=[c.c_int64,c.c_int64,c.c_int64,Input,Input,Input,Input,Input,c.c_void_p,w.DWORD,c.POINTER(Output)]
dll.CreateDeltaB.restype=w.BOOL
dll.ApplyDeltaB.argtypes=[c.c_int64,Input,Input,c.POINTER(Output)];dll.ApplyDeltaB.restype=w.BOOL
def run(mode,source,other,target):
    a=c.create_string_buffer(Path(source).read_bytes());b=c.create_string_buffer(Path(other).read_bytes())
    ai=Input(c.addressof(a),len(a)-1,False);bi=Input(c.addressof(b),len(b)-1,False);out=Output()
    ok=dll.CreateDeltaB(1,0,0,ai,bi,Input(),Input(),Input(),None,0,c.byref(out)) if mode=='create' else dll.ApplyDeltaB(0,ai,bi,c.byref(out))
    if not ok:raise c.WinError(c.get_last_error())
    try:Path(target).write_bytes(c.string_at(out.data,out.size))
    finally:dll.DeltaFree(out.data)
if __name__=='__main__':
    mode,source,other,target=sys.argv[1:5]
    if mode.startswith('apply') and len(sys.argv)>5 and hashlib.sha256(Path(source).read_bytes()).hexdigest()!=sys.argv[5]:raise RuntimeError('Demo kaynağı doğrulanamadı.')
    if mode=='create-chunks':
        a=Path(source).read_bytes();b=Path(other).read_bytes();chunks=[]
        with tempfile.TemporaryDirectory(prefix='ring-delta-') as folder,zipfile.ZipFile(target,'w',zipfile.ZIP_STORED) as archive:
            base=Path(folder)
            for i,offset in enumerate(range(0,len(b),4*1024*1024)):
                start=max(0,offset-256*1024);end=min(len(a),offset+4*1024*1024+256*1024)
                (base/'a').write_bytes(a[start:end]);(base/'b').write_bytes(b[offset:offset+4*1024*1024])
                run('create',base/'a',base/'b',base/'delta')
                archive.write(base/'delta',str(i));chunks.append({'file':str(i),'offset':start,'length':end-start})
            archive.writestr('manifest.json',json.dumps({'sourceHash':hashlib.sha256(a).hexdigest(),'targetHash':hashlib.sha256(b).hexdigest(),'targetBytes':len(b),'chunks':chunks}))
    elif mode=='apply-chunks':
        a=Path(source).read_bytes();result=bytearray()
        with tempfile.TemporaryDirectory(prefix='ring-delta-') as folder,zipfile.ZipFile(other) as archive:
            base=Path(folder);manifest=json.loads(archive.read('manifest.json'))
            if hashlib.sha256(a).hexdigest()!=manifest['sourceHash']:raise RuntimeError('Demo kaynağı doğrulanamadı.')
            for chunk in manifest['chunks']:
                (base/'a').write_bytes(a[chunk['offset']:chunk['offset']+chunk['length']]);(base/'delta').write_bytes(archive.read(chunk['file']))
                run('apply',base/'a',base/'delta',base/'b');result.extend((base/'b').read_bytes())
            if len(result)!=manifest['targetBytes'] or hashlib.sha256(result).hexdigest()!=manifest['targetHash']:raise RuntimeError('Uyumluluk kopyası doğrulanamadı.')
            Path(target).write_bytes(result)
    else:run(mode,source,other,target)
