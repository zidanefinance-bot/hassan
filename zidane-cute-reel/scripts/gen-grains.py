"""Dry pulses pouring into a bowl (granular clicks) -> public/sfx/grains.wav. usage: python3 scripts/gen-grains.py"""
import wave
import numpy as np
SR = 44100; rng = np.random.default_rng(7); DUR = 2.6
buf = np.zeros(int(DUR * SR))
t = np.arange(len(buf)) / SR
density = np.interp(t, [0, 0.15, 1.6, 2.6], [0, 900, 500, 0])  # grains per second
for i in np.nonzero(rng.random(len(buf)) < density / SR)[0]:
    n = int(SR * rng.uniform(0.002, 0.006)); f = rng.uniform(2500, 7500)
    k = np.arange(n) / SR
    click = np.sin(2 * np.pi * f * k) * np.exp(-k * rng.uniform(600, 1400)) * rng.uniform(0.2, 1)
    buf[i:i + n] += click[: len(buf) - i]
for d, g in [(0.011, 0.4), (0.023, 0.3), (0.037, 0.2)]:
    k = int(d * SR); buf[k:] += buf[:-k] * g
buf = buf / np.abs(buf).max() * 0.85
with wave.open("public/sfx/grains.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((buf * 32767).astype("<i2").tobytes())
print("ok")
