"""Synthesize the 60s "Zidane Mode" hype reel soundtrack -> public/sfx/hype-bed.wav (+ impact, riser one-shots).
Dhol-trap at 128 BPM: 32 bars = exactly 60s. Drops at bar 2 and bar 16, build on bars 12-15, final hit on bar 30.
usage: python3 scripts/gen-hype-audio.py"""
import wave
import numpy as np

SR = 44100
BPM = 128
BEAT = 60 / BPM
BAR = 4 * BEAT
DUR = 32 * BAR  # 60.0s
rng = np.random.default_rng(7)


def t_(length):
    return np.arange(int(length * SR)) / SR


def place(buf, start, x, gain=1.0):
    s = int(start * SR)
    e = min(len(buf), s + len(x))
    if s < len(buf):
        buf[s:e] += x[: e - s] * gain


def write(path, buf, peak=0.9):
    buf = np.tanh(buf / (np.abs(buf).max() or 1) * 1.6)  # soft clip for loudness
    buf = buf / np.abs(buf).max() * peak
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((buf * 32767).astype("<i2").tobytes())


def kick808(length=0.9):
    t = t_(length)
    f = 45 + 120 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)


def snare():
    t = t_(0.3)
    return rng.uniform(-1, 1, len(t)) * np.exp(-t * 18) * 0.8 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25) * 0.6


def clap():
    t = t_(0.25)
    env = sum(np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d) for d in (0, 0.012, 0.024))
    return rng.uniform(-1, 1, len(t)) * env * 0.7


def hat(open_=False):
    t = t_(0.25 if open_ else 0.05)
    n = rng.uniform(-1, 1, len(t))
    n = np.diff(n, prepend=0)  # crude high-pass
    return n * np.exp(-t * (14 if open_ else 90))


def dhol_bass():
    t = t_(0.5)
    f = 70 + 90 * np.exp(-t * 18)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)


def dhol_slap():
    t = t_(0.18)
    return rng.uniform(-1, 1, len(t)) * np.exp(-t * 45) * 0.8 + np.sin(2 * np.pi * 620 * t) * np.exp(-t * 30) * 0.5


def braam(f=55, length=1.6):  # big brassy cinematic stab
    t = t_(length)
    x = sum(np.sign(np.sin(2 * np.pi * f * k * t * (1 + 0.003 * i))) / k for i, k in enumerate((1, 1.005, 2, 3)))
    env = np.minimum(1, t * 30) * np.exp(-t * 1.6)
    return x * env * 0.35


def impact():
    t = t_(2.5)
    boom = np.sin(2 * np.pi * np.cumsum(30 + 80 * np.exp(-t * 6)) / SR) * np.exp(-t * 1.5)
    noise = rng.uniform(-1, 1, len(t)) * np.exp(-t * 4) * 0.5
    return boom + noise + braam(41, 2.5) * 0.8


def riser(length):
    t = t_(length)
    f = 200 + 1800 * (t / length) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    noise = np.diff(rng.uniform(-1, 1, len(t)), prepend=0) * 0.6
    return (tone + noise) * (t / length) ** 2


def bell(f):
    t = t_(0.9)
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) + 0.25 * np.sin(2 * np.pi * f * 5.4 * t)) * np.exp(-t * 7)


def sub(f, length):
    t = t_(length)
    return np.sin(2 * np.pi * f * t) * np.minimum(1, t * 80) * np.exp(-t * 1.2) * 0.8


buf = np.zeros(int(DUR * SR) + SR * 3)
K, SN, CL, DB, DS = kick808(), snare(), clap(), dhol_bass(), dhol_slap()
HC, HO = hat(), hat(True)
ROOTS = [55.0, 55.0, 43.65, 49.0]  # A, A, F, G sub line, one per bar
SCALE = [880, 1046.5, 1174.7, 1318.5, 1568, 1760]  # A minor pentatonic-ish bells
MELODY = [0, 2, 3, 2, 4, 3, 2, 1, 0, 2, 3, 5, 4, 3, 2, 0]


def groove(bar, full=True, bells=False):
    t0 = bar * BAR
    for st in (0, 1.5, 2.75) if full else (0,):
        place(buf, t0 + st * BEAT, K, 0.9)
    place(buf, t0 + 2 * BEAT, SN, 0.5); place(buf, t0 + 2 * BEAT, CL, 0.5)
    # bhangra chaal on the dhol
    for st, kind in [(0, "B"), (0.75, "S"), (1.0, "B"), (1.5, "S"), (2.25, "S"), (2.5, "B"), (3.0, "S"), (3.5, "B"), (3.75, "S")]:
        place(buf, t0 + st * BEAT, DB if kind == "B" else DS, 0.45 if kind == "B" else 0.3)
    # trap hats: 8ths with 16th/32nd rolls at the bar end
    for k in range(8):
        place(buf, t0 + k * BEAT / 2, HC, 0.18)
    if full:
        for k in range(6):
            place(buf, t0 + 3.5 * BEAT + k * BEAT / 12, HC, 0.14)
        place(buf, t0 + 1 * BEAT, HO, 0.08)
    place(buf, t0, sub(ROOTS[bar % 4], BAR * 0.95), 0.55 if full else 0.3)
    if bells:
        for k in range(8):
            place(buf, t0 + k * BEAT / 2, bell(SCALE[MELODY[(bar * 8 + k) % 16]]), 0.12)


# bars 0-1: hook. heartbeat kicks + dhol slaps speeding up, riser into the drop
for b in range(8):
    place(buf, b * BEAT, K, 0.5 + b * 0.05)
for k in range(16):
    place(buf, BAR + k * BEAT / 4, DS, 0.15 + k * 0.015)
place(buf, 0, riser(2 * BAR), 0.5)
# bars 2-5: drop 1
place(buf, 2 * BAR, impact(), 0.8)
for b in range(2, 6):
    groove(b)
place(buf, 2 * BAR, braam(55), 0.7)
# bars 6-11: product storm, bells join
for b in range(6, 12):
    groove(b, bells=True)
place(buf, 8 * BAR, braam(49), 0.4)
# bars 12-15: build. half-time, snare roll accelerating, riser, gap before drop
for b in range(12, 16):
    groove(b, full=False, bells=b < 14)
roll = 0
for b, div in [(14, 4), (15, 8)]:
    n = int(4 * div) - (2 if b == 15 else 0)
    for k in range(n):
        place(buf, b * BAR + k * BEAT / div, SN, 0.15 + 0.35 * roll / 47)
        roll += 1
place(buf, 12 * BAR, riser(4 * BAR - BEAT / 2), 0.6)
buf[int((16 * BAR - BEAT / 2) * SR): int(16 * BAR * SR)] *= 0.05  # the breath before the drop
# bars 16-21: drop 2
place(buf, 16 * BAR, impact(), 0.9)
for b in range(16, 22):
    groove(b, bells=True)
    place(buf, b * BAR, braam(ROOTS[b % 4]), 0.35)
# bars 22-25: who we serve. full groove, stab every 2 beats
for b in range(22, 26):
    groove(b)
    place(buf, b * BAR + 2 * BEAT, braam(ROOTS[b % 4] * 2, 0.5), 0.25)
place(buf, 25 * BAR, riser(BAR), 0.4)
# bars 26-29: finale groove
place(buf, 26 * BAR, impact(), 0.7)
for b in range(26, 30):
    groove(b, bells=True)
# bar 30: final hit, then tail to 60s
place(buf, 30 * BAR, impact(), 1.0)
place(buf, 30 * BAR, braam(41, 3.5), 0.8)
for k, f in enumerate([1760, 1568, 1318.5, 1046.5, 880]):
    place(buf, 30 * BAR + k * 0.09, bell(f), 0.25)

buf = buf[: int(DUR * SR)]
fade = int(0.4 * SR)
buf[-fade:] *= np.linspace(1, 0, fade)
write("public/sfx/hype-bed.wav", buf)
write("public/sfx/hype-impact.wav", impact())
write("public/sfx/hype-riser.wav", riser(1.5), 0.6)
print(f"wrote hype-bed.wav {DUR:.2f}s @ {BPM} BPM, hype-impact.wav, hype-riser.wav")
