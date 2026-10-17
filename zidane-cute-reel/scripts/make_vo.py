import sys, json, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
K, OUT, VOICE = sys.argv[1], sys.argv[2], sys.argv[3]
lines = [
  "If you run a factory, an office, or a hospital kitchen in Karachi, buying groceries is probably a headache.",
  "Five suppliers. Fifty calls. Prices that change every time.",
  "There's a simpler way. It's called Zidane.",
  "Go to zidane dot com dot p k, send us your list in any format, and we send back a clean, clear quote.",
  "Oil, rice, atta, masala, tea and dairy. One supplier, delivered on your schedule.",
  "Visit zidane dot com dot p k, today.",
]
k = Kokoro(f"{K}/kokoro-v1.0.int8.onnx", f"{K}/voices-v1.0.bin")
GAP = 0.45
sr = 24000
lead = np.zeros(int(0.4 * sr), dtype=np.float32)
parts = [lead]; t = len(lead) / sr; meta = []
for i, ln in enumerate(lines):
    s, sr = k.create(ln, voice=VOICE, speed=1.08, lang="en-us")
    s = s.astype(np.float32)
    # trim leading/trailing near-silence
    idx = np.where(np.abs(s) > 0.01)[0]
    s = s[max(0, idx[0] - 600): idx[-1] + 1200]
    meta.append({"i": i, "text": ln, "start": round(t, 3), "end": round(t + len(s) / sr, 3)})
    parts += [s, np.zeros(int(GAP * sr), dtype=np.float32)]
    t += len(s) / sr + GAP
audio = np.concatenate(parts)
audio = audio / (np.abs(audio).max() + 1e-6) * 0.9
sf.write(f"{OUT}/zidane-vo.wav", audio, sr)
# per-frame mouth envelope at 30 fps
fps = 30; hop = sr // fps
env = [float(np.sqrt(np.mean(audio[i*hop:(i+1)*hop] ** 2))) for i in range(int(len(audio) / hop) + 1)]
m = max(env) or 1
env = [round(min(1.0, (e / m) * 1.6), 3) for e in env]
json.dump({"duration": round(len(audio) / sr, 3), "lines": meta, "env": env}, open(f"{OUT}/zidane-vo.json", "w"))
print(json.dumps(meta, indent=1)); print("total", round(len(audio)/sr, 2))
