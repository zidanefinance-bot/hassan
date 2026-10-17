"""80s synthwave bed + mission jingle -> public/sfx/synthwave.wav, public/sfx/mission.wav, public/sfx/slam.wav
110 BPM, Am-F-C-G, saw arps, gated-reverb snare, pumping bass. Pure stdlib.
usage: python3 scripts/gen-synthwave.py [seconds]"""
import math, random, struct, sys, wave
SR = 44100
random.seed(80)
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 22.0

def write(path, buf, to=0.88):
    peak = max(abs(x) for x in buf) or 1
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(x / peak * to * 32767)) for x in buf))

def midi(n): return 440 * 2 ** ((n - 69) / 12)
def saw(ph): return 2 * (ph % 1) - 1

N = int(SR * DUR); buf = [0.0] * N
def add(start, length, fn, gain, b=None):
    b = buf if b is None else b
    s = int(start * SR)
    for i in range(int(length * SR)):
        j = s + i
        if j >= len(b): break
        b[j] += fn(i / SR) * gain

BEAT = 60 / 110; BAR = 4 * BEAT
prog = [(45, [57, 60, 64]), (41, [53, 57, 60]), (48, [55, 60, 64]), (43, [55, 59, 62])]  # Am F C G
lp = 0.0
for b in range(int(DUR / BAR) + 1):
    root, ch = prog[b % 4]; t0 = b * BAR
    # pad: detuned saws, softened
    def pad(t, ch=ch):
        return sum(saw(midi(n) * t) + saw(midi(n) * 1.006 * t) for n in ch) / 6 * min(1, t / 0.3)
    add(t0, BAR, pad, 0.10)
    for k in range(16):  # 16th-note bass, octave bounce
        n = root - 12 + (12 if k % 4 == 2 else 0)
        add(t0 + k * BEAT / 4, BEAT / 4 * 0.9, lambda t, f=midi(n): saw(f * t) * math.exp(-t * 9), 0.26)
    for k in range(8):  # arp
        n = ch[k % 3] + 12 + (12 if k >= 4 else 0)
        add(t0 + k * BEAT / 2, BEAT / 2, lambda t, f=midi(n): (saw(f * t) * 0.6 + math.sin(2 * math.pi * f * 2 * t) * 0.4) * math.exp(-t * 6), 0.11)
    for k in range(4):  # kick on every beat
        add(t0 + k * BEAT, 0.3, lambda t: math.sin(2 * math.pi * (45 + 110 * math.exp(-t * 30)) * t) * math.exp(-t * 8), 0.55)
    for k in (1, 3):  # gated-reverb snare
        add(t0 + k * BEAT, 0.28, lambda t: (random.random() * 2 - 1) * (1 if t < 0.22 else 0) * (0.6 + 0.4 * math.exp(-t * 10)), 0.30)
    for k in range(8):  # hats
        add(t0 + k * BEAT / 2 + BEAT / 4, 0.04, lambda t: (random.random() * 2 - 1) * math.exp(-t * 90), 0.06)
for i in range(int(1.2 * SR)):
    buf[N - 1 - i] *= i / (1.2 * SR)
write("public/sfx/synthwave.wav", buf)

# mission passed jingle: rising arpeggio into a bright held chord
m = [0.0] * int(SR * 2.4)
for i, n in enumerate([60, 64, 67, 72]):
    add(i * 0.09, 0.5, lambda t, f=midi(n): (saw(f * t) * 0.5 + math.sin(2 * math.pi * f * t)) * math.exp(-t * 5), 0.4, m)
for n in [60, 64, 67, 72, 76]:
    add(0.36, 2.0, lambda t, f=midi(n): (saw(f * t) * 0.4 + saw(f * 1.004 * t) * 0.4 + math.sin(2 * math.pi * f * t) * 0.5) * min(1, t * 30) * math.exp(-t * 1.2), 0.25, m)
write("public/sfx/mission.wav", m)

# slam: sub hit + noise crack
s = [0.0] * int(SR * 1.0)
add(0, 0.9, lambda t: math.sin(2 * math.pi * (38 + 80 * math.exp(-t * 18)) * t) * math.exp(-t * 4), 1.0, s)
add(0, 0.2, lambda t: (random.random() * 2 - 1) * math.exp(-t * 25), 0.6, s)
write("public/sfx/slam.wav", s)
print("wrote synthwave.wav", DUR, "s, mission.wav, slam.wav")
