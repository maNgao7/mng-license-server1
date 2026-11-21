"""Render Fetih's original fictional missile cues with Python, NumPy and SciPy."""

from pathlib import Path
import struct
import wave

import numpy as np
from scipy import signal

RATE = 48_000
PEAK_DBTP = -3.5
OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "audio"


def timeline(seconds):
    return np.arange(round(seconds * RATE)) / RATE


def ramp(t, start, end):
    fraction = np.clip((t - start) / (end - start), 0, 1)
    return fraction * fraction * (3 - 2 * fraction)


def burst(t, onset, attack, decay):
    return ramp(t, onset, onset + attack) * np.exp(-np.maximum(t - onset, 0) / decay)


def noise(rng, frames, low, high):
    band = signal.butter(2, (low, high), btype="bandpass", fs=RATE, output="sos")
    samples = signal.sosfilt(band, rng.standard_normal(frames))
    return samples / np.std(samples)


def stereo(mid, side=0):
    return np.column_stack((mid + side, mid - side))


def delayed(samples, seconds):
    offset = round(seconds * RATE)
    result = np.zeros_like(samples)
    result[offset:] = samples[:-offset]
    return result


def launch():
    t = timeline(6.7)
    frames = len(t)
    rng = np.random.default_rng(67124)
    turbulence = np.tanh(noise(rng, frames, 2, 19))
    chatter = np.tanh(noise(rng, frames, 21, 56))
    sub = np.tanh(noise(rng, frames, 32, 83))
    chest = np.tanh(noise(rng, frames, 74, 218))
    flame = np.tanh(noise(rng, frames, 185, 780))
    grit = np.tanh(noise(rng, frames, 620, 2200))
    air = np.tanh(noise(rng, frames, 1500, 6100))
    stereo_air = np.tanh(noise(rng, frames, 330, 4300))

    ignition = burst(t, 0.006, 0.025, 0.245)
    exhaust = ramp(t, 0.018, 0.13)
    approach = ramp(t, 0.43, 1.93)
    pressure = exhaust * (0.62 + approach * 0.43 + 0.11 * turbulence)
    flame_bite = 0.10 + 0.16 * approach + 0.035 * chatter
    surge = burst(t, 0.06, 0.17, 0.26)
    phase = 2 * np.pi * np.cumsum(43 + 15 * approach + 5 * turbulence) / RATE

    mid = pressure * (
        0.44 * sub + 0.44 * chest + (0.25 + 0.08 * chatter) * flame
        + flame_bite * grit + (0.044 + 0.084 * approach) * air
        + 0.10 * np.sin(phase) * (0.73 + 0.27 * turbulence)
    )
    crack = burst(t, 0.006, 0.008, 0.042)
    kick_hz = 43 + 77 * np.exp(-t / 0.082)
    kick = np.sin(2 * np.pi * np.cumsum(kick_hz) / RATE)
    mid += ignition * (1.11 * sub + 0.67 * chest + 0.92 * kick)
    mid += crack * (0.65 * grit + 0.25 * air)
    mid += surge * (0.32 * chest + 0.30 * flame + 0.29 * air)
    side = exhaust * (0.085 + 0.14 * approach) * stereo_air
    side += 0.16 * (delayed(mid, 0.026) - delayed(mid, 0.041))
    mix = np.tanh(stereo(mid, side) * 0.89)

    # The final loop frames blend into the audio immediately before loop start.
    # The short release after the loop is for auditioning the WAV outside Godot.
    center = round(3.22 * RATE)
    search = round(0.005 * RATE)
    nearby = mix[center - search:center + search]
    # Pick a quiet slope so an inclusive or exclusive WAV loop end sounds continuous.
    slope = np.maximum(abs(nearby[2:] - nearby[1:-1]), abs(nearby[2:] - nearby[:-2]))
    loop_start = center - search + 2 + int(np.argmin(np.max(slope, axis=1)))
    loop_end = round(6.40 * RATE)
    overlap = round(0.34 * RATE)
    blend = ramp(np.arange(overlap), 0, overlap - 1)[:, None]
    mix[loop_end - overlap:loop_end] = (
        mix[loop_end - overlap:loop_end] * (1 - blend)
        + mix[loop_start - overlap:loop_start] * blend
    )
    release = frames - loop_end
    mix[loop_end:] = mix[loop_start:loop_start + release] * (
        1 - ramp(np.arange(release), 0, release - 1)
    )[:, None]
    return mix, (loop_start, loop_end)


def impact():
    t = timeline(6.1)
    frames = len(t)
    rng = np.random.default_rng(98183)
    sub = np.tanh(noise(rng, frames, 28, 85))
    body = np.tanh(noise(rng, frames, 61, 245))
    crumble = np.tanh(noise(rng, frames, 170, 680))
    snap = np.tanh(noise(rng, frames, 550, 4800))
    air = np.tanh(noise(rng, frames, 1600, 7100))
    diffuse = np.tanh(noise(rng, frames, 48, 390))
    stereo_tail = np.tanh(noise(rng, frames, 68, 590))
    shake = 0.84 + 0.16 * np.tanh(noise(rng, frames, 2, 12))

    crack = burst(t, 0.0, 0.008, 0.055)
    pressure = burst(t, 0.012, 0.028, 0.38)
    falloff = burst(t, 0.085, 0.17, 1.38)
    phase = 2 * np.pi * np.cumsum(35 + 39 * np.exp(-t / 0.15)) / RATE
    core = crack * (0.79 * snap + 0.42 * air + 0.45 * crumble)
    core += pressure * (0.90 * sub + 0.76 * body + 0.47 * np.sin(phase))
    core += burst(t, 0.096, 0.018, 0.19) * (0.50 * body + 0.41 * crumble)

    tail = falloff * shake * (0.34 * sub + 0.46 * diffuse + 0.17 * crumble)
    space = falloff * (0.23 * stereo_tail + 0.12 * crumble)
    room = stereo(core + tail, space)
    reflected = signal.sosfilt(signal.butter(2, 650, fs=RATE, output="sos"), core)
    # Irregular returns smear out into the low, diffuse environmental decay.
    for delay, left, right in (
        (0.049, 0.30, 0.06), (0.087, 0.08, 0.34), (0.148, 0.23, 0.14),
        (0.244, 0.10, 0.24), (0.377, 0.18, 0.07), (0.526, 0.06, 0.15),
        (0.719, 0.11, 0.055), (0.920, 0.045, 0.085), (1.17, 0.055, 0.04),
    ):
        room += delayed(reflected, delay)[:, None] * [left, right]
    return np.tanh(room * 1.02) * (1 - ramp(t, 5.02, 6.098))[:, None]


def save(name, samples, loop=None):
    true_peak = np.max(np.abs(signal.resample_poly(samples, 4, 1, axis=0)))
    pcm = np.rint(samples * (32767 * 10 ** (PEAK_DBTP / 20) / true_peak)).astype("<i2")
    path = OUTPUT / name
    with wave.open(str(path), "wb") as file:
        file.setnchannels(2)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes(pcm.tobytes())

    if loop:
        # RIFF sampler metadata uses the inclusive end of a forward loop.
        loop_start, loop_end = loop
        sampler = struct.pack(
            "<15I", 0, 0, round(1e9 / RATE), 60, 0, 0, 0, 1, 0,
            0, 0, loop_start, loop_end - 1, 0, 0,
        )
        riff = path.read_bytes()
        chunk = b"smpl" + struct.pack("<I", len(sampler)) + sampler
        path.write_bytes(riff[:4] + struct.pack("<I", len(riff) - 8 + len(chunk)) + riff[8:] + chunk)
    print(f"{path.name} · {len(samples) / RATE:.2f} s · {path.stat().st_size} bytes")


if __name__ == "__main__":
    engine, points = launch()
    save("missile-launch.wav", engine, points)
    save("missile-impact.wav", impact())
