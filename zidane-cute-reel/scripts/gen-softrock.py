"""80s heartland soft-rock bed for the Karachi Vice VI trailer -> public/sfx/vi-rock.wav
120 BPM (bar = 2 s), D - A/C# - Bm - G. Chorused plucked-guitar arps with dotted-8th echo,
drums + bass enter at 8 s (big gated snare), final chord rings from 18 s. Original composition.
usage: python3 scripts/gen-softrock.py"""
import wave
import numpy as np

SR = 44100
rng = np.random.default_rng(6)
DUR = 23.0
BEAT = 0.5; BAR = 2.0


def write(path, x, to=0.89):
    x = x / (np.max(np.abs(x)) or 1) * to
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def midi(n): return 440 * 2 ** ((np.asarray(n, dtype=float) - 69) / 12)
def tt(sec): return np.arange(int(sec * SR)) / SR


def add(buf, start, sig, gain=1.0):
    s = int(start * SR)
    if s >= len(buf): return
    e = min(len(buf), s + len(sig)); buf[s:e] += sig[: e - s] * gain


def onepole(x, cutoff):
    a = 1 - np.exp(-2 * np.pi * cutoff / SR); y = np.empty_like(x); z = 0.0
    for i in range(len(x)):
        z += a * (x[i] - z); y[i] = z
    return y


def pluck(f, ln, bright=0.5):
    """Karplus-Strong string."""
    n = int(SR / f); out = np.zeros(int(ln * SR))
    ring = rng.uniform(-1, 1, n) * bright + rng.uniform(-1, 1, n) * (1 - bright) * 0.3
    for i in range(len(out)):
        v = ring[i % n]; out[i] = v
        ring[i % n] = 0.5 * (v + ring[(i + 1) % n]) * 0.996
    return out


def verb(x, mix):
    out = x.copy()
    for d, g in [(0.031, 0.6), (0.043, 0.5), (0.059, 0.45), (0.079, 0.38), (0.107, 0.3), (0.149, 0.22), (0.211, 0.15)]:
        k = int(d * SR); out[k:] += x[:-k] * g * mix
    return out


prog = [(38, [62, 66, 69, 74]), (37, [61, 64, 69, 73]), (35, [62, 66, 71, 74]), (31, [62, 67, 71, 74])]  # D, A/C#, Bm, G
gtr = np.zeros(int(DUR * SR)); pad = np.zeros_like(gtr); bass = np.zeros_like(gtr); dr = np.zeros_like(gtr)

# guitar arps (8ths) bars 0-8, final chord strum at 18 s
pattern = [0, 1, 2, 3, 2, 1, 2, 3]
cache = {}
for b in range(9):
    root, ch = prog[b % 4]
    for k, idx in enumerate(pattern):
        n = ch[idx] + (12 if (b >= 4 and k in (3, 7)) else 0)
        if n not in cache: cache[n] = pluck(midi(n), 1.6)
        add(gtr, b * BAR + k * BEAT / 2, cache[n], 0.32)
for i, n in enumerate([50, 57, 62, 66, 69, 74]):  # D chord strum
    add(gtr, 18.0 + i * 0.025, pluck(midi(n), 4.8, 0.7), 0.4)
# chorus + dotted-8th echo
d = int(0.0045 * SR); lfo = (np.sin(2 * np.pi * 0.8 * np.arange(len(gtr)) / SR) * d + d * 1.5).astype(int)
idx = np.clip(np.arange(len(gtr)) - lfo, 0, None)
gtr = gtr + gtr[idx] * 0.7
echo = gtr.copy(); k = int(0.375 * SR)
for r in range(1, 4): echo[k * r:] += gtr[:-k * r] * (0.35 ** r)
gtr = echo

# warm pad
for b in range(10):
    root, ch = prog[b % 4] if b < 9 else (38, [62, 66, 69, 74])
    ln = BAR if b < 9 else 5.0
    t = tt(ln + 0.3); sig = np.zeros_like(t)
    for n in ch:
        for det in (0.997, 1.003):
            sig += 2 * ((midi(n - 12) * det * t) % 1) - 1
    env = np.minimum(1, t / 0.4) * np.minimum(1, np.maximum(0, (ln + 0.3 - t) / 0.4))
    add(pad, b * BAR, onepole(sig, 900) * env, 0.05 if b < 4 else 0.07)

# bass: driving 8ths from 8 s
for b in range(4, 9):
    root, _ = prog[b % 4]
    for k in range(8):
        t = tt(BEAT / 2 * 0.92); f = midi(root)
        sig = np.tanh((np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * 1.5) * np.exp(-t * 3)
        add(bass, b * BAR + k * BEAT / 2, sig, 0.35)
add(bass, 18.0, np.sin(2 * np.pi * midi(38) * tt(4.5)) * np.exp(-tt(4.5) * 0.8), 0.4)

# drums
def kick():
    t = tt(0.4); f = 50 + 110 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8)
def snare():  # 80s gated reverb
    t = tt(0.42); n = rng.standard_normal(len(t)); n = n - onepole(n, 900)
    body = np.sin(2 * np.pi * 200 * t) * np.exp(-t * 20)
    gate = np.where(t < 0.3, 1.0, np.exp(-(t - 0.3) * 60))
    return (n * 0.7 * np.exp(-t * 4) + body * 0.8) * gate
def hat():
    t = tt(0.05); n = rng.standard_normal(len(t)); return (n - onepole(n, 7000)) * np.exp(-t * 80)
def tom(f):
    t = tt(0.5); return np.sin(2 * np.pi * np.cumsum(f * (1 + 0.4 * np.exp(-t * 20))) / SR) * np.exp(-t * 6)
def crash(ln=3.0):
    t = tt(ln); n = rng.standard_normal(len(t)); return (n - onepole(n, 4000)) * np.exp(-t * 1.5)

K, Sn = kick(), snare()
for i, f in enumerate([180, 180, 140, 140, 110, 110, 90, 90]):  # fill into 8 s
    add(dr, 7.0 + i * 0.125, tom(f), 0.5)
add(dr, 8.0, crash(), 0.35)
for b in range(4, 9):
    t0 = b * BAR
    for beat in range(4):
        tb = t0 + beat * BEAT
        add(dr, tb, K if beat in (0, 2) else Sn, 0.9 if beat in (0, 2) else 0.75)
        if beat == 2: add(dr, tb + 0.25, K, 0.6)
        add(dr, tb, hat(), 0.18); add(dr, tb + 0.25, hat(), 0.12)
for i, f in enumerate([200, 160, 130, 100]):  # fill into the logo
    add(dr, 17.5 + i * 0.125, tom(f), 0.55)
add(dr, 18.0, K, 1.0); add(dr, 18.0, crash(5.0), 0.45)

mix = verb(gtr, 0.35) + verb(pad, 0.4) + bass + verb(dr, 0.25)
tsec = np.arange(len(mix)) / SR
mix = mix * np.interp(tsec, [0, 7.8, 8.0], [1.9, 1.9, 1.0])  # lift the quiet intro
fade = np.minimum(1, np.maximum(0, (DUR - np.arange(len(mix)) / SR) / 1.5))
write("public/sfx/vi-rock.wav", np.tanh(mix * 1.1) * fade)
print("ok")
