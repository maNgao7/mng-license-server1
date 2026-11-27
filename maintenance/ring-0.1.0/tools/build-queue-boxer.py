"""Bake both ring fighters from the private preview's recorded Vulkan colour pass.

Run in RenderDoc's Python shell with the reference frame open:
    exec(open(path_to_this_script, encoding='utf-8').read(), {'__file__': path_to_this_script, 'pyrenderdoc': pyrenderdoc})
Only the two fighters are exported. All measurements are in the game's world units.
"""
import base64
import hashlib
import json
import math
import struct
from pathlib import Path

FRAME_SHA = '04a0f3dabcf446d71c101e7530381488648161d02d7a681fc52d51d44e1b7bc2'
OUTPUT = Path(__file__).resolve().parents[1] / 'spectator/queue-boxer.json'


def extract(controller):
    import renderdoc as rd
    # This colour pass also contains ropes and a corner pad. The individual
    # fighter draws include their head/hair, four torso boxes and both gloves.
    controller.SetFrameEvent(545, True)
    pipe = controller.GetPipelineState()
    reflection = pipe.GetShaderReflection(rd.ShaderStage.Pixel)
    buffers = {}
    for item in pipe.GetReadWriteResources(rd.ShaderStage.Pixel):
        name = reflection.readWriteResources[item.access.index].name
        if name in ('ssbo106', 'ssbo134', 'ssbo137'):
            desc = item.descriptor
            buffers[name] = controller.GetBufferData(desc.resource, desc.byteOffset, 200 * {'ssbo106':176,'ssbo134':124,'ssbo137':192}[name])
    parts = [[], []]
    for event in [*range(545, 587), 608, 609, 610, 611]:
        controller.SetFrameEvent(event, True)
        mesh = controller.GetPostVSData(0, 0, rd.MeshDataStage.VSOut)
        if mesh.vertexByteStride != 80 or mesh.indexByteStride != 4 or mesh.numIndices not in (36, 2160):
            raise ValueError('Unexpected boxer geometry in colour pass')
        raw = controller.GetBufferData(mesh.indexResourceId, mesh.indexByteOffset, mesh.numIndices * 4)
        indices = struct.unpack('<%dI' % mesh.numIndices, raw)
        raw = controller.GetBufferData(mesh.vertexResourceId, mesh.vertexByteOffset, (max(indices)+1)*80)
        pos = [struct.unpack_from('<3f', raw, o+32) for o in range(0,len(raw),80)]
        normals = [struct.unpack_from('<3f', raw, o+48) for o in range(0,len(raw),80)]
        instance = struct.unpack_from('<I', raw, 72)[0]
        slot = struct.unpack_from('<I', buffers['ssbo106'], instance*176+152)[0] & 0xffff
        material = struct.unpack_from('<I', buffers['ssbo134'], slot*124)[0]
        color = struct.unpack_from('<3f', buffers['ssbo137'], material*192)
        kit = 0 if sum(v[0] for v in pos)<0 else 1
        parts[kit].append((event,pos,normals,indices,color))
    return parts


def pack(fmt, values):
    return base64.b64encode(struct.pack('<%d%s' % (len(values), fmt), *values)).decode('ascii')


def bake(parts, kit):
    by_event = {e:p for e,p,_,_,_ in parts}
    gloves = [p for _,p,_,ix,_ in parts if len(ix)==2160]
    if len(parts)!=23 or len(gloves)!=2:
        raise ValueError('Incomplete ring fighter')
    def mean(points):
        return [sum(v[i] for v in points)/len(points) for i in range(3)]
    # The captured frame is the private game's stationary pre-bell guard.
    # Both fighters have their feet planted, so their poses need no retargeting.
    feet = ((566,567),(570,571)) if kit==0 else ((586,545),(548,549))
    heels,toes=[[mean(by_event[f[i]]) for f in feet] for i in (0,1)]
    yaw=math.atan2(*(sum(t[j]-h[j] for h,t in zip(heels,toes)) for j in (0,2)))
    cy,sy=math.cos(yaw),math.sin(yaw)
    def local(v):
        x,y,z=v
        return (cy*x-sy*z,y,sy*x+cy*z)
    cloud=[local(v) for _,pos,*_ in parts for v in pos]
    center=[(min(v[i] for v in cloud)+max(v[i] for v in cloud))/2 for i in (0,2)]
    floor=min(v[1] for v in cloud)
    height=max(v[1] for v in cloud)-floor
    def point(v):
        x,y,z=local(v)
        return [x-center[0],y-floor,z-center[1]]
    position=[];triangles=[];colors=[];palette=[]; material_ids=[];lights=[]
    hat=[point(v) for v in by_event[(609,611)[kit]]]
    head_height=max(v[1] for v in hat)
    top=mean([v for v in hat if v[1]>head_height-.09])
    top[1]=head_height
    if any(abs(min(point(v)[1] for e in shoe for v in by_event[e]))>.025 for shoe in feet):
        raise ValueError("Waiting fighter must have both shoes on the deck")
    for _,pos,normals,idx,color in parts:
        base=len(position)//3
        triangles.extend(base+i for i in idx)
        if color not in palette:palette.append(color)
        for v,n in zip(pos,normals):
            position.extend(round(k*4096) for k in point(v))
            nx,ny,nz=local(n)
            lit=max(0,min(1,-.40*nx+.82*ny+.41*nz))
            lights.append(round(lit*31))
            material_ids.append(palette.index(color))
    for color in palette:
        for shade in range(32):
            gain=.135+.50*shade/31
            for c,tint in zip(color,(1.,.87,.75)):
                linear=(c+.005)*gain*tint
                colors.append(round(255*min(1,1.055*linear**(1/2.4)-.055 if linear>.0031308 else 12.92*linear)))
    return dict(height=round(height,5), crown=[round(k,5) for k in top], parts=len(parts),
                position=pack('h',position), triangles=pack('H',triangles), material=pack('B',material_ids),
                light=pack('B',lights), shades=pack('B',colors))


def write_model(controller, frame):
    if hashlib.sha256(Path(frame).read_bytes()).hexdigest()!=FRAME_SHA:
        raise ValueError('Select the reference frame for this version of the native game')
    kits=[bake(parts,i) for i,parts in enumerate(extract(controller))]
    OUTPUT.write_text(json.dumps(dict(frameSHA256=FRAME_SHA,kits=kits),separators=(',',':'))+'\n',encoding='ascii')

if 'pyrenderdoc' in globals():
    capture=pyrenderdoc.GetCaptureFilename()
    pyrenderdoc.Replay().BlockInvoke(lambda r: write_model(r,capture))

