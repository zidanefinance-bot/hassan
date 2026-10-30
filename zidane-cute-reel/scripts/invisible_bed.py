# Soft piano + pad bed for "The Invisible Department" (30 s). Synthesised, so no licensing question.
import sys
import numpy as np, soundfile as sf
SR = 44100; T = 31.0
t = np.arange(int(SR * T)) / SR
out = np.zeros_like(t)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
def piano(m, start, vel=0.5, dur=4.5):
    i0 = int(start * SR); n = int(dur * SR); tt = np.arange(n) / SR
    f = hz(m); s = np.zeros(n)
    for k, a in enumerate([1, 0.45, 0.22, 0.12, 0.06], 1):
        s += a * np.sin(2 * np.pi * f * k * tt * (1 + 0.0004 * k)) * np.exp(-tt * (1.2 + 0.9 * k))
    s *= (1 - np.exp(-tt * 300)) * vel
    end = min(len(out), i0 + n); out[i0:end] += s[: end - i0]
# Fmaj7 · Am7 · Dm9 · Bbmaj7, 7.5 s each; a slow broken chord, then a high note
chords = [[53, 57, 60, 64, 69], [57, 60, 64, 67, 72], [50, 57, 60, 64, 65], [46, 53, 57, 62, 65]]
for c, notes in enumerate(chords):
    base = c * 7.5
    for j, m in enumerate(notes): piano(m, base + j * 0.42, 0.42 if j else 0.55)
    piano(notes[-1] + 12, base + 3.6, 0.22); piano(notes[2] + 12, base + 5.2, 0.16)
    # pad: the chord held softly underneath
    i0 = int(base * SR); n = int(7.6 * SR); tt = np.arange(n) / SR
    env = np.minimum(1, tt / 2.5) * np.minimum(1, (7.6 - tt) / 1.5)
    pad = sum(np.sin(2 * np.pi * hz(m) * tt) + 0.3 * np.sin(2 * np.pi * hz(m) * 2.003 * tt) for m in notes[:3]) * 0.035 * env
    end = min(len(out), i0 + n); out[i0:end] += pad[: end - i0]
# a little room
wet = np.zeros_like(out)
for d, g in [(0.031, 0.35), (0.067, 0.28), (0.113, 0.22), (0.171, 0.16), (0.257, 0.11), (0.389, 0.07)]:
    k = int(d * SR); wet[k:] += out[:-k] * g
mix = out + 0.6 * wet
mix /= np.max(np.abs(mix)) / 0.5
st = np.stack([mix, np.roll(mix, int(0.012 * SR))], 1)
sf.write(sys.argv[1], st.astype(np.float32), SR)
