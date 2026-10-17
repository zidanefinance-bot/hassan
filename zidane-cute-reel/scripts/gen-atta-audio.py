"""Warm desi bed for the atta-to-roti reel + rewind and tawa sizzle effects.
-> public/sfx/atta-bed.wav (tanpura drone, rabab-like plucks, synth tabla keherwa from 2.5 s), atta-rewind.wav, tawa-sizzle.wav
90 BPM, D major pentatonic. Original composition. usage: python3 scripts/gen-atta-audio.py"""
import wave
import numpy as np

SR = 44100
rng = np.random.default_rng(14)
DUR = 18.5
BEAT = 60 / 90


def write(path, x, to=0.89):
    x = x / (np.max(np.abs(x)) or 1) * to
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def midi(n): return 440 * 2 ** ((np.asarray(n, dtype=float) - 69) / 12)
def tt(s): return np.arange(int(s * SR)) / SR


def add(buf, start, sig, gain=1.0):
    s = int(start * SR)
    if s >= len(buf): return
    e = min(len(buf), s + len(sig)); buf[s:e] += sig[: e - s] * gain


def onepole(x, cutoff):
    a = 1 - np.exp(-2 * np.pi * cutoff / SR); y = np.empty_like(x); z = 0.0
    for i in range(len(x)):
        z += a * (x[i] - z); y[i] = z
    return y


def pluck(f, ln):
    n = int(SR / f); out = np.zeros(int(ln * SR)); ring = rng.uniform(-1, 1, n)
    for i in range(len(out)):
        v = ring[i % n]; out[i] = v; ring[i % n] = 0.5 * (v + ring[(i + 1) % n]) * 0.997
    return out


def verb(x, mix):
    out = x.copy()
    for d, g in [(0.03, 0.55), (0.047, 0.45), (0.071, 0.35), (0.11, 0.25), (0.17, 0.15)]:
        k = int(d * SR); out[k:] += x[:-k] * g * mix
    return out


def bed():
    n = int(DUR * SR); t = np.arange(n) / SR
    # tanpura drone: D2/A2/D3 with slow jawari shimmer
    drone = np.zeros(n)
    for m, g in [(38, 0.5), (45, 0.35), (50, 0.4), (57, 0.15)]:
        f = midi(m); ph = 2 * np.pi * f * t
        drone += g * (np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.23 * t + m)))
    drone *= np.minimum(1, t / 1.5) * 0.12
    # rabab-like plucks, pentatonic phrase (D E F# A B)
    mel = np.zeros(n)
    phrase = [(0, 74), (1, 76), (1.5, 78), (2, 81), (3, 78), (4, 76), (5, 74), (5.5, 71), (6, 74), (7, 69)]
    for rep in range(int(DUR / (8 * BEAT)) + 1):
        for b, m in phrase:
            st = 0.4 + rep * 8 * BEAT + b * BEAT
            if st < DUR - 0.5: add(mel, st, pluck(midi(m), 1.4), 0.35 if rep else 0.25)
    # synth tabla keherwa: dha ge na ti | na ka dhi na  (8 steps per bar of 4 beats)
    tab = np.zeros(n)
    def dayan(f=520, d=10):
        k = tt(0.35); return np.sin(2 * np.pi * f * k) * np.exp(-k * d) + 0.4 * np.sin(2 * np.pi * f * 2.02 * k) * np.exp(-k * d * 1.6)
    def bayan():
        k = tt(0.5); f = 90 + 60 * np.exp(-k * 9)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-k * 5)
    def ti():
        k = tt(0.08); nz = rng.standard_normal(len(k)); return (nz - onepole(nz, 3000)) * np.exp(-k * 60) * 0.5
    bols = ["dha", "ge", "na", "ti", "na", "ka", "dhi", "na"]
    start = 2.5; step = BEAT / 2
    k = 0
    while start + k * step < DUR - 1.2:
        b = bols[k % 8]; ts = start + k * step
        if b in ("dha", "dhi"): add(tab, ts, dayan(), 0.5); add(tab, ts, bayan(), 0.7)
        elif b == "ge": add(tab, ts, bayan(), 0.55)
        elif b == "na": add(tab, ts, dayan(560, 14), 0.4)
        elif b in ("ti", "ka"): add(tab, ts, ti(), 0.6)
        k += 1
    mix = verb(drone, 0.3) + verb(mel, 0.35) + verb(tab, 0.15)
    fade = np.minimum(1, np.maximum(0, (DUR - t) / 1.2))
    return np.tanh(mix * 1.2) * fade


def rewind():
    """Tape rewind: chirpy squeaks over a rising noise band."""
    d = 0.9; k = tt(d); out = np.zeros(len(k))
    nz = rng.standard_normal(len(k)); out += (onepole(nz, 3000) - onepole(nz, 800)) * np.interp(k, [0, 0.1, 0.8, 0.9], [0, 1, 1, 0])
    f = 600 * 2 ** (k * 3) * (1 + 0.3 * np.sign(np.sin(2 * np.pi * 14 * k)))
    out += np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.35 * np.interp(k, [0, 0.1, 0.8, 0.9], [0, 1, 1, 0])
    return out


def sizzle():
    d = 2.6; k = tt(d); nz = rng.standard_normal(len(k))
    hiss = (nz - onepole(nz, 4000)) * 0.3
    pops = np.zeros(len(k))
    for i in np.nonzero(rng.random(len(k)) < 60 / SR)[0]:
        m = int(SR * 0.004); pops[i:i + m] += rng.uniform(0.3, 1) * np.exp(-np.arange(len(pops[i:i + m])) / SR * 900)
    return (hiss + pops * (nz > 0)) * np.interp(k, [0, 0.2, 2.0, 2.6], [0, 1, 1, 0])


write("public/sfx/atta-bed.wav", bed())
write("public/sfx/atta-rewind.wav", rewind(), 0.6)
write("public/sfx/tawa-sizzle.wav", sizzle(), 0.6)
print("ok")
