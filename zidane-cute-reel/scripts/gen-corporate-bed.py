"""Synthesize a calm, royalty-free corporate music bed -> public/sfx/corp-bed.wav

Pure standard library. 96 BPM: soft detuned pad (Am–F–C–G), pulsing 8th-note bass,
light hi-hat ticks and a gentle pluck arpeggio. Run: python3 scripts/gen-corporate-bed.py
"""
import math, random, struct, sys, wave

SR = 44100
BPM = 96
BEAT = 60 / BPM
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 22.0
OUT = sys.argv[2] if len(sys.argv) > 2 else "public/sfx/corp-bed.wav"
N = int(SR * DUR)
buf = [0.0] * N
random.seed(3)

def midi(n): return 440 * 2 ** ((n - 69) / 12)

def add(start, length, fn, gain):
    s = int(start * SR)
    for i in range(int(length * SR)):
        j = s + i
        if j >= N: break
        buf[j] += fn(i / SR, length) * gain

def pad(freqs):
    def f(t, L):
        env = min(1, t / 0.6) * min(1, (L - t) / 0.6)
        return env * sum(math.sin(2*math.pi*fr*t) + 0.5*math.sin(2*math.pi*fr*1.004*t) + 0.25*math.sin(4*math.pi*fr*t) for fr in freqs) / len(freqs)
    return f

def bass(fr):
    return lambda t, L: math.exp(-t * 6) * math.sin(2*math.pi*fr*t) * min(1, t * 200)

def pluck(fr):
    return lambda t, L: math.exp(-t * 5) * (math.sin(2*math.pi*fr*t) + 0.3*math.sin(4*math.pi*fr*t)) * min(1, t * 300)

def hat(t, L): return math.exp(-t * 90) * (random.random() * 2 - 1)

chords = [(45, [57, 60, 64]), (41, [57, 60, 65]), (48, [55, 60, 64]), (43, [55, 59, 62])]  # Am F C G
bar = 4 * BEAT
for b in range(int(DUR / bar) + 1):
    root, tri = chords[b % 4]
    t0 = b * bar
    add(t0, bar + 0.3, pad([midi(n) for n in tri]), 0.22)
    for k in range(8):
        add(t0 + k * BEAT / 2, BEAT / 2, bass(midi(root)), 0.30 if k % 2 == 0 else 0.18)
    if b >= 1:  # arpeggio enters after the first bar
        for k in range(8):
            n = tri[k % 3] + (12 if k % 4 == 3 else 12)
            add(t0 + k * BEAT / 2, 0.5, pluck(midi(n)), 0.07)
    for k in range(8):
        add(t0 + k * BEAT / 2 + BEAT / 4, 0.04, hat, 0.03)

peak = max(abs(x) for x in buf) or 1
with wave.open(OUT, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(b"".join(struct.pack("<h", int(x / peak * 0.85 * 32767)) for x in buf))
print("wrote", OUT, DUR, "s")
