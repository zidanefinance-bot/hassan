"""World Food Day soundtrack -> public/sfx/foodday-strings.wav (+ crumble, wind one-shots).
Karplus-Strong plucked strings (rabab-like) over a tanpura-style drone, 76 BPM, D-Bm-G-A.
usage: python3 scripts/gen-foodday-audio.py [seconds]"""
import math, random, struct, sys, wave
SR = 44100
random.seed(5)
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 18.0

def write(path, buf, peak_to=0.85):
    peak = max(abs(x) for x in buf) or 1
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(x / peak * peak_to * 32767)) for x in buf))

def midi(n): return 440 * 2 ** ((n - 69) / 12)

def pluck(f, length, bright=0.5):
    p = max(2, int(SR / f))
    line = [random.uniform(-1, 1) for _ in range(p)]
    # soften the excitation for a warmer tone
    for _ in range(int(3 * (1 - bright)) + 1):
        line = [(line[i] + line[i - 1]) * 0.5 for i in range(p)]
    out = []
    decay = 0.996
    for i in range(int(length * SR)):
        a = line[i % p]; b = line[(i + 1) % p]
        line[i % p] = decay * 0.5 * (a + b)
        out.append(a)
    return out

N = int(SR * DUR)
buf = [0.0] * N
def mix(start, samples, gain):
    s = int(start * SR)
    for i, v in enumerate(samples):
        j = s + i
        if j >= N: break
        buf[j] += v * gain

# drone: D2 + A2 with slow beating, swells in
for i in range(N):
    t = i / SR
    env = min(1, t / 2.5) * min(1, (DUR - t) / 2.0)
    buf[i] += env * 0.10 * (math.sin(2 * math.pi * 73.42 * t) + 0.7 * math.sin(2 * math.pi * 110.0 * t + 0.3 * math.sin(t * 0.7))
                             + 0.35 * math.sin(2 * math.pi * 146.83 * 1.002 * t))

BEAT = 60 / 76
BAR = 4 * BEAT
prog = [[62, 66, 69, 74], [59, 62, 66, 71], [55, 59, 62, 67], [57, 61, 64, 69]]  # D Bm G A
pattern = [0, 2, 1, 3, 2, 1, 3, 2]
melody = [78, 76, 74, 76, 81, 78, 76, 74, 79, 78, 76, 74, 76, 73, 74, 76]
for b in range(int(DUR / BAR) + 1):
    ch = prog[b % 4]; t0 = b * BAR
    mix(t0, pluck(midi(ch[0] - 12), 2.5, 0.3), 0.55)
    for k, idx in enumerate(pattern):
        mix(t0 + k * BEAT / 2, pluck(midi(ch[idx]), 1.6, 0.55), 0.30 if k % 2 else 0.38)
    if b >= 1:
        for k in range(4):
            if (b + k) % 3 == 2: continue
            mix(t0 + k * BEAT + 0.02, pluck(midi(melody[(b * 4 + k) % 16]), 2.2, 0.75), 0.30)
    for k in range(8):  # soft shaker on offbeats
        mix(t0 + k * BEAT / 2 + BEAT / 4, [random.uniform(-1, 1) * math.exp(-i / SR * 70) for i in range(int(0.06 * SR))], 0.05)
# gentle fade out
for i in range(int(1.8 * SR)):
    buf[N - 1 - i] *= i / (1.8 * SR)
write("public/sfx/foodday-strings.wav", buf)

# crumble: grainy crackle + low thud
cr = [0.0] * int(SR * 1.2)
for i in range(len(cr)):
    t = i / SR
    crackle = (random.random() * 2 - 1) * (1 if random.random() < 0.08 else 0.15) * math.exp(-t * 3.2)
    cr[i] = crackle * 0.8 + math.sin(2 * math.pi * (90 - 40 * t) * t) * math.exp(-t * 9) * 0.7
write("public/sfx/crumble.wav", cr)

# wind: filtered noise swell
wd = [0.0] * int(SR * 2.0); prev = 0.0
for i in range(len(wd)):
    t = i / SR
    prev = prev * 0.985 + (random.random() * 2 - 1) * 0.015
    wd[i] = prev * math.sin(math.pi * t / 2.0) * 6
write("public/sfx/wind.wav", wd, 0.6)
print("wrote foodday-strings.wav", DUR, "s, crumble.wav, wind.wav")
