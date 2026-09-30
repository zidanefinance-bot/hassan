"""Synthesize a short, bouncy, royalty-free music bed -> public/sfx/cute-bed.wav

Pure standard library. 124 BPM: plucky major-pentatonic melody, bouncy bass, soft
shaker and a clap on 2 and 4. Run: python3 scripts/gen-cute-bed.py
"""
import math, random, struct, wave

SR = 44100
BPM = 124
BEAT = 60 / BPM
DUR = 21.0
N = int(SR * DUR)
buf = [0.0] * N
random.seed(7)

def midi(n): return 440 * 2 ** ((n - 69) / 12)

def add(start, length, fn, gain):
    s = int(start * SR)
    for i in range(int(length * SR)):
        j = s + i
        if j >= N: break
        buf[j] += fn(i / SR) * gain

def pluck(f):
    # bright pluck: fundamental + octave + fifth, fast decay (ukulele-ish)
    return lambda t: math.exp(-t * 7) * (math.sin(2*math.pi*f*t) + 0.45*math.sin(4*math.pi*f*t) + 0.2*math.sin(6*math.pi*f*t)) * min(1, t * 400)

def bass(f):
    return lambda t: math.exp(-t * 5) * math.sin(2*math.pi*f*t + 0.6*math.sin(2*math.pi*f*t)) * min(1, t * 300)

def noise(decay):
    return lambda t: math.exp(-t * decay) * (random.random() * 2 - 1)

# I–V–vi–IV in C major, happy and simple
chords = [(48, [60, 64, 67]), (43, [59, 62, 67]), (45, [57, 60, 64]), (41, [57, 60, 65])]
melody = [72, 76, 79, 76, 74, 79, 81, 79, 76, 72, 74, 76, 79, 81, 84, 81]  # C pentatonic hops
bars = int(DUR / (4 * BEAT)) + 1
for b in range(bars):
    root, tri = chords[b % 4]
    t0 = b * 4 * BEAT
    for k in range(4):  # bouncy bass: root on beats, octave on the "and"
        add(t0 + k * BEAT, BEAT * 0.9, bass(midi(root)), 0.34)
        add(t0 + k * BEAT + BEAT / 2, BEAT * 0.4, bass(midi(root + 12)), 0.16)
    for k in range(8):  # offbeat chord stabs
        if k % 2 == 1:
            for n in tri:
                add(t0 + k * BEAT / 2, 0.25, pluck(midi(n)), 0.07)
    for k in range(8):  # melody in eighths, skip a few for bounce
        n = melody[(b * 8 + k) % len(melody)]
        if (b * 8 + k) % 5 == 4: continue
        add(t0 + k * BEAT / 2, 0.35, pluck(midi(n)), 0.16)
    for k in range(16):  # shaker
        add(t0 + k * BEAT / 4, 0.05, noise(70), 0.05 if k % 2 else 0.08)
    for k in (1, 3):  # clap
        add(t0 + k * BEAT, 0.15, noise(28), 0.22)

peak = max(abs(x) for x in buf) or 1
with wave.open("public/sfx/cute-bed.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(b"".join(struct.pack("<h", int(x / peak * 0.85 * 32767)) for x in buf))
print("wrote public/sfx/cute-bed.wav", DUR, "s")
