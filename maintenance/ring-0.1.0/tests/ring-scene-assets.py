"""Offline RenderDoc check for the private pre-bell camera.

Open original-assets/queue-guard.rdc in RenderDoc 1.47, then run this file in
the Python shell. verify() also accepts the corresponding colour-pass draw
IDs from another saved frame. Use scale=1.0 for native width 72 (reference)
and scale=1.25 for width 90. The negative-Z edges stay fixed as the ring grows.
All coordinates are Bevy world coordinates, Y up.
"""
from hashlib import sha256
from math import isclose
import struct

import renderdoc as rd


# SHA-256 of mip 0 RGBA8 texels, independently decoded from the installed PNGs.
WOOD = '0cbb763e0c7380f7f19f0d6fed0b4dc0cf1fd42da22544d768991bc42d547ce2'
MAT = '5026ce9e86c1ab60d616938bbd81862ec6c29407a7a1f891c63ca7c245895b99'
CX = -0.5
ROPE_Y = (-1.92273, -1.17273, -0.42273, 0.32727)


def bounds(controller, event):
    controller.SetFrameEvent(event, True)
    mesh = controller.GetPostVSData(0, 0, rd.MeshDataStage.VSOut)
    # The same 80-byte colour-pass layout used by tools/build-queue-boxer.py.
    if mesh.vertexByteStride != 80 or mesh.indexByteStride != 4 or not mesh.numIndices:
        raise ValueError(f'Draw {event} has an unexpected post-VS layout')
    data = controller.GetBufferData(mesh.indexResourceId, mesh.indexByteOffset, mesh.numIndices * 4)
    indices = set(struct.unpack(f'<{mesh.numIndices}I', data))
    data = controller.GetBufferData(mesh.vertexResourceId, mesh.vertexByteOffset, (max(indices) + 1) * 80)
    points = [struct.unpack_from('<3f', data, i * 80 + 32) for i in indices]
    limits = [(min(axis), max(axis)) for axis in zip(*points)]
    return tuple((lo + hi) / 2 for lo, hi in limits), tuple(hi - lo for lo, hi in limits)


def close(actual, expected):
    return all(isclose(a, b, rel_tol=0, abs_tol=0.0001) for a, b in zip(actual, expected))


def verify(controller, scale=1.0, planes=(643, 646), ring=range(590, 608)):
    """planes: wood, mat. ring: the 16 rope draws and two visible back pads."""
    half = 7.2 * scale
    cz = -5.0 + half
    wood_half, mat_half = half + 11.5, half + 1.0
    textures = {t.resourceId: t for t in controller.GetTextures()}
    wood_event, mat_event = planes
    for event, plane_half, y, pixels, digest in (
        (wood_event, wood_half, -2.401, 512, WOOD),
        (mat_event, mat_half, -2.400, 2048, MAT),
    ):
        center, size = bounds(controller, event)
        side = 2 * plane_half
        if not close(center, (CX, y, cz)) or not close(size, (side, 0, side)):
            raise AssertionError(f'Plane {event}: center {center}, size {size}, expected {(CX, y, cz)}, side {side}')
        bindings = controller.GetPipelineState().GetReadOnlyResources(rd.ShaderStage.Pixel, True)
        maps = [textures[b.descriptor.resource] for b in bindings if b.descriptor.resource in textures]
        if not any(sha256(controller.GetTextureData(t.resourceId, rd.Subresource(0, 0, 0))).hexdigest() == digest
                   for t in maps if t.width == t.height == pixels and t.format.Name() == 'R8G8B8A8_SRGB'):
            raise AssertionError(f'Plane {event} is missing its original colour texture')

    pad_offset = half - 0.34
    expected = []
    for sign in (-1, 1):
        for y in ROPE_Y:
            expected.append(((CX + sign * half, y, cz), (0.157, 0.157, 2 * half)))
            expected.append(((CX, y, cz + sign * half), (2 * half, 0.157, 0.157)))
        # Only the two negative-Z pads are in this camera's colour pass.
        expected.append(((CX + sign * pad_offset, -0.75, cz - pad_offset), None))
    for event in ring:
        center, size = bounds(controller, event)
        for i, (position, extent) in enumerate(expected):
            size_ok = close(size, extent) if extent else isclose(size[1], 3.3, abs_tol=0.0001)
            if close(center, position) and size_ok:
                expected.pop(i)
                break
        else:
            raise AssertionError(f'Unexpected ring draw {event}: center {center}, size {size}')
    if expected:
        raise AssertionError(f'Missing ring draws for {expected}')
    return f'Center XZ ({CX}, {cz:g}), half-sides: ropes {half:g}, mat {mat_half:g}, wood {wood_half:g}'


if 'pyrenderdoc' in globals():
    pyrenderdoc.Replay().BlockInvoke(lambda controller: print(verify(controller)))
