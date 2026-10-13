"""Soft, hopeful piano + string-pad bed for the Pink October reel -> public/sfx/pink-piano.wav
72 BPM, C - G/B - Am - F progression, gentle arpeggios, warm pad, simple stereo-less reverb tail.
usage: python3 scripts/gen-pink-piano.py [seconds]"""
import math, struct, sys, wave
SR = 44100
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 18.0
N = int(SR * (DUR + 2))
buf = [0.0] * N

def midi(n): return 440 * 2 ** ((n - 69) / 12)

def add(start, length, fn, gain):
    s = int(start * SR)
    for i in range(int(length * SR)):
        j = s + i
        if j >= N: break
        buf[j] += fn(i / SR) * gain

def piano(f):
    # felt-piano: a few inharmonic partials, soft attack, long decay
    parts = [(1, 1.0), (2.002, 0.45), (3.006, 0.18), (4.01, 0.08)]
    return lambda t: sum(a * math.sin(2 * math.pi * f * k * t) * math.exp(-t * (1.2 + k * 0.9)) for k, a in parts) * min(1, t * 120)

def pad(fs, L):
    def f(t):
        env = min(1, t / 1.2) * min(1, max(0, (L - t)) / 1.2)
        return env * sum(math.sin(2 * math.pi * x * t) + 0.5 * math.sin(2 * math.pi * x * 1.003 * t + 1) for x in fs) / len(fs)
    return f

BEAT = 60 / 72
BAR = 4 * BEAT
prog = [  # (bass, chord tones, arpeggio)
    (36, [60, 64, 67], [60, 64, 67, 72, 67, 64, 67, 72]),   # C
    (35, [59, 62, 67], [59, 62, 67, 71, 67, 62, 67, 71]),   # G/B
    (33, [57, 60, 64], [57, 60, 64, 69, 64, 60, 64, 69]),   # Am
    (29, [57, 60, 65], [57, 60, 65, 69, 65, 60, 65, 72]),   # F
]
melody = [76, 0, 74, 72, 74, 0, 71, 0, 72, 0, 76, 79, 77, 0, 76, 74]  # gentle top line, 0 = rest
bars = int(DUR / BAR) + 1
for b in range(bars):
    bass, tri, arp = prog[b % 4]
    t0 = b * BAR
    add(t0, BAR + 1.2, pad([midi(n) for n in tri], BAR + 1.2), 0.10)
    add(t0, BAR, piano(midi(bass + 12)), 0.30)
    for k, n in enumerate(arp):
        add(t0 + k * BEAT / 2, 2.5, piano(midi(n)), 0.13 if k % 2 else 0.17)
    if b >= 1:  # melody enters on bar 2
        for k in range(4):
            n = melody[(b * 4 + k) % len(melody)]
            if n: add(t0 + k * BEAT, 3.0, piano(midi(n)), 0.22)

# simple reverb: a few feedback delays
out = buf[:]
for d, g in [(0.083, 0.32), (0.127, 0.26), (0.191, 0.21), (0.263, 0.16)]:
    D = int(d * SR)
    for i in range(D, N):
        out[i] += out[i - D] * g * 0.55
# fade out the last 1.5 s
L = int(DUR * SR)
out = out[:L]
for i in range(int(1.5 * SR)):
    out[L - 1 - i] *= i / (1.5 * SR)
peak = max(abs(x) for x in out) or 1
with wave.open("public/sfx/pink-piano.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(b"".join(struct.pack("<h", int(x / peak * 0.85 * 32767)) for x in out))
print("wrote public/sfx/pink-piano.wav", DUR, "s")
