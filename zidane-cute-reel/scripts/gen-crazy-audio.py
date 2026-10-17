"""Soundtrack for the "Crazy Zidane" reel -> public/sfx/crazy-bed.wav, timed to the voiceover scenes.
Tense ticking build -> hard cut + record scratch on "Stop" -> 140 BPM electro-funk drop on "Meet Zidane" -> final hit.
Scene lengths must match src/crazy/CrazyZidane.tsx (VO duration + PAD frames at 30fps).
usage: python3 scripts/gen-crazy-audio.py   (after make_crazy_vo.py)"""
import json, wave
import numpy as np

SR, FPS, BPM = 44100, 30, 140
BEAT = 60 / BPM
PAD = [10, 10, 36, 10, 10, 10, 10, 60]
lines = json.load(open("public/vo/crazy-vo.json"))["lines"]
lens = [round(l["dur"] * FPS) + PAD[i] for i, l in enumerate(lines)]
starts = np.cumsum([0] + lens[:-1]) / FPS
DUR = sum(lens) / FPS
rng = np.random.default_rng(5)
buf = np.zeros(int((DUR + 3) * SR))


def t_(n):
    return np.arange(int(n * SR)) / SR


def place(x, at, g=1.0):
    s = int(at * SR); e = min(len(buf), s + len(x))
    if 0 <= s < len(buf): buf[s:e] += x[: e - s] * g


def kick():
    t = t_(0.4); return np.sin(2 * np.pi * np.cumsum(50 + 140 * np.exp(-t * 35)) / SR) * np.exp(-t * 8)


def clap():
    t = t_(0.22)
    env = sum(np.exp(-np.clip(t - d, 0, None) * 50) * (t >= d) for d in (0, 0.01, 0.02))
    return np.diff(rng.uniform(-1, 1, len(t)), prepend=0) * env


def hat(o=False):
    t = t_(0.2 if o else 0.04); return np.diff(rng.uniform(-1, 1, len(t)), prepend=0) * np.exp(-t * (18 if o else 110))


def saw(f, n, cut=0.5):
    t = t_(n); ph = (f * t) % 1
    x = (2 * ph - 1) * 0.6 + np.sign(np.sin(2 * np.pi * f * 0.5 * t)) * 0.4
    return x * np.minimum(1, t * 200) * np.exp(-t * (1 / max(cut, 0.05)))


def tick():
    t = t_(0.03); return np.sin(2 * np.pi * 3000 * t) * np.exp(-t * 150)


def impact():
    t = t_(2.0)
    return np.sin(2 * np.pi * np.cumsum(35 + 90 * np.exp(-t * 7)) / SR) * np.exp(-t * 1.8) + rng.uniform(-1, 1, len(t)) * np.exp(-t * 5) * 0.4


def scratch():
    t = t_(0.5); f = 300 + 900 * np.abs(np.sin(2 * np.pi * 4 * t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4) * 0.8 + rng.uniform(-1, 1, len(t)) * 0.2 * np.exp(-t * 6)


def riser(n):
    t = t_(n); return (np.sin(2 * np.pi * np.cumsum(200 + 2200 * (t / n) ** 2) / SR) * 0.3 + np.diff(rng.uniform(-1, 1, len(t)), prepend=0) * 0.5) * (t / n) ** 2


BASS = [55, 55, 65.4, 49]  # A A C G
ARP = [440, 523.3, 659.3, 523.3, 784, 659.3, 523.3, 659.3]
# 1) tense build over scenes 0-1: ticking clock, pulsing low bass, alarm blips
build_end = starts[2]
n = 0
tt = 0.0
while tt < build_end:
    place(tick(), tt, 0.35)
    if n % 2 == 0: place(kick(), tt, 0.35)
    if n % 4 == 2: place(saw(110, 0.25, 0.1), tt, 0.25)
    n += 1; tt += BEAT / 2
place(riser(build_end - starts[1]), starts[1], 0.4)
# 2) "Stop.": hard cut + scratch, then silence until the drop
place(scratch(), starts[2], 0.7)
# 3) drop: electro-funk groove from scene 3 to the end card
drop, end = starts[3], starts[7]
place(impact(), drop, 0.9)
b = 0
while drop + b * BEAT < end:
    at = drop + b * BEAT
    place(kick(), at, 0.8)
    place(hat(), at + BEAT / 2, 0.25)
    if b % 2 == 1: place(clap(), at, 0.5)
    if b % 4 == 3: place(hat(True), at + BEAT / 2, 0.15)
    root = BASS[(b // 4) % 4]
    place(saw(root, BEAT * 0.45, 0.15), at + BEAT / 2, 0.45)  # offbeat bass
    place(saw(root, BEAT * 0.3, 0.1), at + BEAT * 0.75, 0.3)
    for k in range(2):
        place(saw(ARP[(b * 2 + k) % 8], BEAT * 0.3, 0.06), at + k * BEAT / 2, 0.12)
    b += 1
for s in starts[4:7]:
    place(riser(0.6), s - 0.6, 0.25)
# 4) end card: final hit and a ringing chord
place(impact(), end, 1.0)
for f in (220, 277.2, 329.6, 440):
    t = t_(3); place(np.sin(2 * np.pi * f * t) * np.exp(-t * 1.2), end, 0.15)

buf = buf[: int(DUR * SR)]
f = int(0.5 * SR); buf[-f:] *= np.linspace(1, 0, f)
buf = np.tanh(buf / np.abs(buf).max() * 1.5); buf = buf / np.abs(buf).max() * 0.9
with wave.open("public/sfx/crazy-bed.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((buf * 32767).astype("<i2").tobytes())
print("wrote crazy-bed.wav", round(DUR, 2), "s; scene starts", [round(s, 2) for s in starts])
