"""Synthesize the truck-art reel soundtrack -> public/sfx/truck-dhol.wav (+ horn, bells one-shots).
Dhol-style bhangra loop (~100 BPM), shimmering bells, two-tone truck horn. Pure stdlib.
usage: python3 scripts/gen-truck-audio.py [seconds]"""
import math, random, struct, sys, wave
SR = 44100
random.seed(11)

def write(path, buf):
    peak = max(abs(x) for x in buf) or 1
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(x / peak * 0.88 * 32767)) for x in buf))

def add(buf, start, fn, length, gain):
    s = int(start * SR)
    for i in range(int(length * SR)):
        j = s + i
        if j >= len(buf): break
        buf[j] += fn(i / SR) * gain

def dhol_bass(t):  # pitch-dropping skin boom
    f = 70 + 90 * math.exp(-t * 18)
    return math.sin(2 * math.pi * f * t) * math.exp(-t * 7)

def dhol_slap(t):  # bright tilli side: noise + ring
    return (random.random() * 2 - 1) * math.exp(-t * 45) * 0.8 + math.sin(2 * math.pi * 620 * t) * math.exp(-t * 30) * 0.5

def bell(f):
    return lambda t: (math.sin(2 * math.pi * f * t) + 0.6 * math.sin(2 * math.pi * f * 2.76 * t) + 0.3 * math.sin(2 * math.pi * f * 5.4 * t)) * math.exp(-t * 6)

def horn(t):  # two-tone bright horn, sawtooth-ish
    f = 349 if t < 0.28 else 440
    env = min(1, t * 40) * (1 if t < 0.62 else max(0, 1 - (t - 0.62) * 12))
    ph = (f * t) % 1
    return (ph * 2 - 1) * 0.6 * env + math.sin(2 * math.pi * f * 2 * t) * 0.2 * env

dur = float(sys.argv[1]) if len(sys.argv) > 1 else 20.0
BPM = 104; beat = 60 / BPM
loop = [0.0] * int(SR * dur)
bar = 4 * beat
for b in range(int(dur / bar) + 1):
    t0 = b * bar
    # bhangra chaal: BOOM . ka BOOM | . ka BOOM ka
    for st, kind in [(0, "B"), (0.75, "S"), (1.0, "B"), (1.5, "S"), (2.25, "S"), (2.5, "B"), (3.0, "S"), (3.5, "B"), (3.75, "S")]:
        add(loop, t0 + st * beat, dhol_bass if kind == "B" else dhol_slap, 0.5 if kind == "B" else 0.18, 0.9 if kind == "B" else 0.45)
    for k in range(8):  # ghungroo-like shimmer on eighths
        add(loop, t0 + k * beat / 2, lambda t: (random.random() * 2 - 1) * math.exp(-t * 60), 0.06, 0.08)
write("public/sfx/truck-dhol.wav", loop)

b = [0.0] * int(SR * 1.6)
for i, f in enumerate([1320, 1760, 1480, 1980, 1660]):
    add(b, i * 0.07, bell(f), 1.4, 0.35)
write("public/sfx/truck-bells.wav", b)

h = [0.0] * int(SR * 0.9)
add(h, 0, horn, 0.85, 1.0)
write("public/sfx/truck-horn.wav", h)
print("wrote truck-dhol.wav", dur, "s, truck-bells.wav, truck-horn.wav")
