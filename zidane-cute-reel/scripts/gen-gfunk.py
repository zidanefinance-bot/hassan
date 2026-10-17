"""West-coast G-funk beat + "wasted" and "mission passed" stingers for the Karachi Vice reel.
-> public/sfx/gfunk-beat.wav, public/sfx/wasted.wav, public/sfx/passed.wav
92 BPM, E minor (Em9 - Cmaj7 - Am9 - B7), boom-bap drums, sub bass slides, whiny portamento lead, Rhodes.
Original composition. usage: python3 scripts/gen-gfunk.py [seconds]"""
import sys, wave
import numpy as np

SR = 44100
rng = np.random.default_rng(92)
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 19.0
BEAT = 60 / 92; BAR = 4 * BEAT; STEP = BEAT / 4


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
    e = min(len(buf), s + len(sig))
    buf[s:e] += sig[: e - s] * gain


def onepole(x, cutoff):
    """Simple low-pass; cutoff may be an array (sweeps)."""
    cutoff = np.broadcast_to(cutoff, x.shape)
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x); z = 0.0
    for i in range(len(x)):
        z += a[i] * (x[i] - z); y[i] = z
    return y


def verb(x, mix=0.25):
    out = x.copy()
    for d, g in [(0.029, 0.5), (0.037, 0.45), (0.053, 0.38), (0.071, 0.3), (0.113, 0.22), (0.167, 0.15)]:
        k = int(d * SR); out[k:] += x[:-k] * g * mix
    return out


# ── drum voices ──
def kick():
    t = tt(0.45); f = 45 + 95 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.tanh(np.sin(ph) * np.exp(-t * 7) * 2.2) + rng.standard_normal(len(t)) * np.exp(-t * 300) * 0.3

def snare():
    t = tt(0.35); n = rng.standard_normal(len(t))
    n = n - onepole(n, 1800)  # high-passed noise
    return n * np.exp(-t * 13) * 0.9 + np.sin(2 * np.pi * 185 * t) * np.exp(-t * 25) * 0.6

def clap():
    t = tt(0.25); n = rng.standard_normal(len(t)); env = np.zeros_like(t)
    for o in (0, 0.011, 0.022): env += (t >= o) * np.exp(-np.clip(t - o, 0, None) * 60)
    return (n - onepole(n, 1200)) * env * 0.5

def hat(open_=False):
    t = tt(0.3 if open_ else 0.06); n = rng.standard_normal(len(t))
    n = n - onepole(n, 7000)
    return n * np.exp(-t * (9 if open_ else 70)) * 0.5


def beat(dur):
    buf = np.zeros(int(dur * SR)); dr = np.zeros_like(buf)
    K, S, C = kick(), snare(), clap()
    # Em9, Cmaj7, Am9, B7 (roots + voicings)
    prog = [(40, [55, 59, 62, 66]), (36, [55, 59, 64, 67]), (33, [55, 60, 64, 71]), (35, [54, 57, 63, 66])]
    kick_steps = [0, 3, 7, 10, 11]
    lead = [  # (bar-relative beat, midi, length beats) – loops every 4 bars, enters bar 2
        [(0, 83, 1.5), (1.5, 81, 0.5), (2, 79, 1.0), (3, 76, 1.0)],
        [(0, 79, 1.0), (1, 76, 0.5), (1.5, 74, 0.5), (2, 76, 2.0)],
        [(0, 72, 1.0), (1, 74, 1.0), (2, 76, 1.5), (3.5, 79, 0.5)],
        [(0, 78, 2.0), (2, 75, 1.0), (3, 71, 1.0)],
    ]
    nbars = int(dur / BAR) + 1
    for b in range(nbars):
        t0 = b * BAR; root, ch = prog[b % 4]
        # drums (swung 16ths)
        for s in range(16):
            ts = t0 + s * STEP + (STEP * 0.18 if s % 2 else 0)
            if s in kick_steps and not (b % 4 == 3 and s == 11): add(dr, ts, K, 0.95)
            if s in (4, 12): add(dr, ts, S, 0.55); add(dr, ts, C, 0.5)
            if s % 2 == 0: add(dr, ts, hat(s == 14), 0.22 if s % 4 else 0.3)
            elif b % 2 and s in (9, 13): add(dr, ts, hat(), 0.12)
        # sub bass: root on 1, octave slide, fifth
        for (bt, n, ln) in [(0, root, 1.4), (1.75, root, 0.4), (2.5, root + 7, 0.5), (3, root + 12, 0.5), (3.5, root + 10, 0.5)]:
            t = tt(ln * BEAT); f = midi(n) * (1 + 0.06 * np.exp(-t * 25))
            ph = 2 * np.pi * np.cumsum(f) / SR
            sig = np.tanh((np.sin(ph) + 0.25 * np.sin(2 * ph)) * 1.6) * np.minimum(1, t / 0.008) * np.minimum(1, (ln * BEAT - t) / 0.03)
            add(buf, t0 + bt * BEAT, sig, 0.55)
        # Rhodes: FM bell-ish, tremolo, stab on 1 and the and-of-2
        for bt, ln in [(0, 1.9), (2.5, 1.5)]:
            t = tt(ln * BEAT + 0.4); sig = np.zeros_like(t)
            for n in ch:
                f = midi(n); idx = 1.6 * np.exp(-t * 6)
                sig += np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
            sig *= np.exp(-t * 1.6) * (1 + 0.25 * np.sin(2 * np.pi * 5 * t)) * np.minimum(1, t / 0.004)
            add(buf, t0 + bt * BEAT, sig, 0.07)
        # whiny lead with portamento + vibrato
        if b >= 1:
            prev = None
            for bt, n, ln in lead[(b - 1) % 4]:
                t = tt(ln * BEAT); start = prev if prev is not None else n - 2
                glide = start + (n - start) * (1 - np.exp(-t * 28))
                vib = 0.25 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.25)
                f = midi(glide + vib); ph = 2 * np.pi * np.cumsum(f) / SR
                sig = (np.sin(ph) + 0.12 * np.sin(2 * ph)) * np.minimum(1, t / 0.03) * np.minimum(1, (ln * BEAT - t) / 0.05)
                add(buf, t0 + bt * BEAT, sig, 0.13); prev = n
    mix = verb(buf, 0.3) + verb(dr, 0.12)
    return np.tanh(mix * 1.3)


def wasted():
    """Slow-motion tape stop on an Em chord, then a deep boom + ring."""
    d = 3.0; buf = np.zeros(int(d * SR)); t = tt(d)
    rate = np.where(t < 0.9, 1 - 0.8 * (t / 0.9) ** 1.5, 0.2)
    for n in (40, 52, 55, 59):
        ph = 2 * np.pi * np.cumsum(midi(n) * rate) / SR
        buf += np.sin(ph) * np.where(t < 0.9, 1, np.exp(-(t - 0.9) * 8)) * 0.18
    bt = tt(2.2); f = 38 + 60 * np.exp(-bt * 12)
    boom = np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-bt * 2.2) * 2.5)
    n = rng.standard_normal(len(bt)); n = onepole(n, 400) * np.exp(-bt * 5) * 2
    add(buf, 0.9, boom + n, 0.9)
    add(buf, 0.9, np.sin(2 * np.pi * 3100 * bt) * np.exp(-bt * 1.4) * np.minimum(1, bt / 0.2), 0.04)
    return verb(buf, 0.4)


def passed():
    """Mission-passed stinger: snare pickup, three brass stabs rising to E major, hit + shimmer."""
    d = 3.4; buf = np.zeros(int(d * SR))
    S, K = snare(), kick()
    for i in range(4): add(buf, i * STEP, S, 0.3 + i * 0.1)
    def brass(notes, ln):
        t = tt(ln); sig = np.zeros_like(t)
        for n in notes:
            for det in (1, 1.007, 0.994):
                sig += 2 * ((midi(n) * det * t) % 1) - 1
        cut = 600 + 3800 * np.exp(-t * 3) * np.minimum(1, t / 0.04)
        return onepole(sig / len(notes) / 3, cut) * np.minimum(1, t / 0.01) * np.minimum(1, (ln - t) / 0.08)
    at = BEAT
    for k, (notes, ln) in enumerate([([52, 59, 64], 0.22), ([54, 61, 66], 0.22), ([56, 64, 68, 71], 1.9)]):
        st = at + k * 0.3
        add(buf, st, brass(notes, ln), 0.8); add(buf, st, K, 0.6)
    t = tt(2.0); n = rng.standard_normal(len(t))
    add(buf, at + 0.6, (n - onepole(n, 5000)) * np.exp(-t * 2.5), 0.25)  # crash
    return verb(buf, 0.35)


if __name__ == "__main__":
    write("public/sfx/gfunk-beat.wav", beat(DUR))
    write("public/sfx/wasted.wav", wasted())
    write("public/sfx/passed.wav", passed())
    print("ok")
