"""Synthesize the Ramadan reel soundtrack -> public/sfx/ramadan-naat.wav
Soft, cozy naat-style instrumental: a hummed melody in maqam Hijaz on D (formant-filtered voice),
warm drone pad, gentle daf, oud plucks, chimes and a long reverb.
72 BPM = exactly 25 video frames per beat at 30fps; 60 beats = 50s.
usage: python3 scripts/gen-ramadan-audio.py   (needs numpy + scipy)"""
import wave
import numpy as np
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

SR = 44100
BPM = 72
BEAT = 60 / BPM
DUR = 60 * BEAT  # 50s
rng = np.random.default_rng(3)
buf = np.zeros(int((DUR + 4) * SR))


def t_(length):
    return np.arange(int(length * SR)) / SR


def place(x, start, gain=1.0):
    s = int(start * SR)
    e = min(len(buf), s + len(x))
    buf[s:e] += x[: e - s] * gain


def hz(name):
    names = {"D3": -19, "Eb3": -18, "F#3": -15, "G3": -14, "A3": -12, "Bb3": -11, "C4": -9, "D4": -7, "Eb4": -6, "F#4": -3, "G4": -2, "A4": 0, "D2": -31, "A2": -24}
    return 440 * 2 ** (names[name] / 12)


# ---------- hummed voice: additive source with glides + vibrato, through "oo/mm" formants
FORMANTS = [(300, 90, 1.0), (850, 120, 0.45), (2500, 200, 0.12)]


def formant(x, f, bw):
    r = np.exp(-np.pi * bw / SR)
    a = [1, -2 * r * np.cos(2 * np.pi * f / SR), r * r]
    return lfilter([1 - r], a, x)


def voice(notes, octave_shift=0):
    """notes: list of (name, beats). Returns a hummed line with portamento between notes."""
    total = sum(b for _, b in notes) * BEAT
    n = int(total * SR)
    f = np.zeros(n)
    amp = np.zeros(n)
    pos = 0
    prev = None
    for name, beats in notes:
        ln = int(beats * BEAT * SR)
        if name == "-":
            pos += ln
            prev = None
            continue
        target = hz(name) * 2 ** octave_shift
        seg = np.full(ln, target)
        if prev:  # 90ms glide from previous note, like a singer
            g = min(ln, int(0.09 * SR))
            seg[:g] = prev * (target / prev) ** (np.arange(g) / g)
        tt = np.arange(ln) / SR
        vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * tt) * np.clip((tt - 0.25) / 0.3, 0, 1)
        f[pos:pos + ln] = seg * vib
        env = np.minimum(1, tt / 0.08) * np.minimum(1, (ln / SR - tt) / 0.12)
        amp[pos:pos + ln] = np.maximum(amp[pos:pos + ln], env)
        prev = target
        pos += ln
    ph = 2 * np.pi * np.cumsum(f) / SR
    src = sum(np.sin(k * ph) / k ** 1.4 for k in range(1, 18))
    src += rng.normal(0, 0.02, n)  # breath
    out = sum(formant(src, fr, bw) * g for fr, bw, g in FORMANTS)
    amp = np.convolve(amp, np.ones(400) / 400, "same")  # smooth the envelope
    return out * amp


A = [("A3", 1), ("Bb3", .5), ("A3", .5), ("G3", 1), ("F#3", 1), ("G3", 1), ("A3", 2), ("-", 1)]
B = [("F#3", 1), ("G3", .5), ("F#3", .5), ("Eb3", 1), ("D3", 1), ("Eb3", 1), ("D3", 2), ("-", 1)]
C = [("D4", 1), ("C4", .5), ("Bb3", .5), ("A3", 1), ("G3", 1), ("A3", 1), ("Bb3", .5), ("A3", .5), ("G3", 2)]
D = [("F#3", 1), ("G3", 1), ("A3", 1), ("G3", .5), ("F#3", .5), ("Eb3", 1), ("D3", 3)]
for start, ph in [(4, A), (12, B), (20, C), (28, D), (36, A), (44, D)]:
    v = voice(ph)
    place(v / np.abs(v).max(), start * BEAT, 0.42)
    if start >= 20:  # a soft second voice an octave up joins for warmth
        v2 = voice(ph, 1)
        place(v2 / np.abs(v2).max(), start * BEAT, 0.12)


# ---------- drone pad: D + A, slow swell, low-passed
def pad(length):
    t = t_(length)
    x = sum(np.sin(2 * np.pi * hz(nm) * t * d) for nm in ("D2", "A2", "D3") for d in (1, 1.003))
    env = np.minimum(1, t / 4) * np.minimum(1, (length - t) / 3)
    return sosfilt(butter(2, 900, fs=SR, output="sos"), x) * env


place(pad(DUR + 2), 0, 0.10)


# ---------- daf: soft dum (centre) and tak (rim) with a little jingle
def dum():
    t = t_(0.5)
    return np.sin(2 * np.pi * np.cumsum(70 + 40 * np.exp(-t * 30)) / SR) * np.exp(-t * 9)


def tak():
    t = t_(0.12)
    n = sosfilt(butter(2, [1800, 5000], btype="band", fs=SR, output="sos"), rng.uniform(-1, 1, len(t)))
    return n * np.exp(-t * 40) * 2.5


for b in range(8, 52, 4):
    g = 0.5 if b < 12 else 1.0
    for st, kind in [(0, "D"), (1, "T"), (1.5, "T"), (2, "D"), (3, "T"), (3.5, "T")]:
        place(dum() if kind == "D" else tak(), (b + st) * BEAT, (0.30 if kind == "D" else 0.07) * g)


# ---------- oud plucks (Karplus-Strong) on chord tones
def pluck(f, length=1.8):
    N = int(SR / f)
    x = np.zeros(int(length * SR))
    x[:N] = rng.uniform(-1, 1, N)
    a = np.zeros(N + 2); a[0] = 1; a[N] = -0.497; a[N + 1] = -0.497
    y = lfilter([1], a, x)
    return sosfilt(butter(2, 2500, fs=SR, output="sos"), y)


ARP = [["D3", "A3", "D4", "A3"], ["G3", "Bb3", "D4", "Bb3"], ["Eb3", "G3", "Bb3", "G3"], ["D3", "F#3", "A3", "F#3"]]
for b in range(12, 52, 4):
    chord = ARP[(b // 4) % 4]
    for k in range(4):
        place(pluck(hz(chord[k])), (b + k) * BEAT, 0.16)
        if k % 2 == 0:
            place(pluck(hz(chord[(k + 2) % 4]) * 2, 1.0), (b + k + 0.5) * BEAT, 0.06)


# ---------- chimes: sparse sparkles from the scale
def chime(f):
    t = t_(2.5)
    return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t)) * np.exp(-t * 2.2)


SCALE = [hz(n) * 4 for n in ("D3", "Eb3", "F#3", "G3", "A3", "Bb3", "C4", "D4")]
for k in range(26):
    place(chime(SCALE[rng.integers(0, 8)]), rng.uniform(0, DUR - 4), 0.035)
for k, f in enumerate([SCALE[7], SCALE[4], SCALE[2], SCALE[0]]):  # final shimmer
    place(chime(f), 52 * BEAT + k * 0.18, 0.06)
place(pluck(hz("D3"), 4) + pluck(hz("A3"), 4), 52 * BEAT, 0.25)

# ---------- reverb and write
ir_t = t_(2.8)
ir = rng.normal(0, 1, len(ir_t)) * np.exp(-ir_t * 2.4)
ir = sosfilt(butter(1, 4000, fs=SR, output="sos"), ir)
wet = fftconvolve(buf, ir)[: len(buf)]
mix = buf + wet / np.abs(wet).max() * np.abs(buf).max() * 0.45
mix = mix[: int(DUR * SR)]
fade = int(2.5 * SR)
mix[-fade:] *= np.linspace(1, 0, fade) ** 2
mix[: int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))
mix = mix / np.abs(mix).max() * 0.85
with wave.open("public/sfx/ramadan-naat.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print(f"wrote ramadan-naat.wav {DUR:.1f}s @ {BPM} BPM")
