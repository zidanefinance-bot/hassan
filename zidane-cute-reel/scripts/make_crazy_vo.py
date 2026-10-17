"""English voiceover for the "Crazy Zidane" animated reel with Kokoro (open source, local CPU).
Writes public/vo/crazy-<i>.wav and public/vo/crazy-vo.json (per-line duration, and words for kinetic captions).
usage: python3 scripts/make_crazy_vo.py <kokoro_dir> [voice]"""
import json, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

K = sys.argv[1]
VOICE = sys.argv[2] if len(sys.argv) > 2 else "am_michael"
LINES = [
    "Running a factory in Karachi? Feeding five hundred workers?",
    "Ten suppliers. Fifty phone calls. Prices that change every single day!",
    "Stop. Meet Zidane.",
    "Atta, rice, sugar, oil, daal, spices, tea and milk. Over a hundred products. One supplier.",
    "Send your list any way you like. Excel, PDF, WhatsApp, even a photo of a handwritten note.",
    "We send back a clean quote, and deliver right on schedule.",
    "Custom ration bags for your team, your NGO, your Ramadan program.",
    "Zidane Wholesale Solutions. Groceries for business. Visit zidane dot com dot p k.",
]
k = Kokoro(f"{K}/kokoro-v1.0.onnx", f"{K}/voices-v1.0.bin")
out = []
for i, text in enumerate(LINES):
    s, sr = k.create(text, voice=VOICE, speed=1.12, lang="en-us")
    s = s.astype(np.float32)
    idx = np.where(np.abs(s) > 0.01)[0]
    s = s[max(0, idx[0] - 400): idx[-1] + 1600]
    s = s / (np.abs(s).max() + 1e-6) * 0.92
    sf.write(f"public/vo/crazy-{i}.wav", s, sr)
    out.append({"i": i, "text": text, "dur": round(len(s) / sr, 3)})
json.dump({"voice": VOICE, "lines": out}, open("public/vo/crazy-vo.json", "w"), indent=1)
print(json.dumps(out, indent=1)); print("total", round(sum(l["dur"] for l in out), 2))
