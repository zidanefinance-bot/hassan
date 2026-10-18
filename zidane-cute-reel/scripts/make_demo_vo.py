"""Voiceover for the Zidane Books demo video, explained simply, the way you'd explain it to a child.
Kokoro (open source, local). Writes public/demo/vo-<i>.wav and public/demo/vo.json.
usage: python3 scripts/make_demo_vo.py <kokoro_dir> [voice]"""
import json, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

K = sys.argv[1]
VOICE = sys.argv[2] if len(sys.argv) > 2 else "af_heart"
LINES = [
    # (scene id, spoken line, short on-screen caption)
    ("intro", "Hi! This is Zidane Books. Think of it like a magic notebook for our business. It remembers everything, so we don't have to.", "A magic notebook for our business"),
    ("login", "Every person has their own key. Sales, Operations, Accounts, and the Director. Each one only sees their own work.", "Everyone has their own login"),
    ("home", "When you open it, the first page tells you one thing. What do I need to do today? Red boxes mean, do it now!", "First page = what to do today"),
    ("enquiry", "A customer calls and asks for rice. Sales writes it down. Who is the customer, what do they want, and how many. Done!", "Sales writes down the order"),
    ("job", "The customer says yes! So Sales presses, Create Job. A job is like a ticket that goes to the Operations team.", "Customer said yes → Create Job"),
    ("ops-start", "Operations opens the new job, and presses Start procurement. That means, let's go and buy the things!", "Operations starts buying"),
    ("buy", "This page shows everything we need to buy, for all the jobs together. We bought the rice, so we press Bought.", "What to buy → Bought"),
    ("bill", "Then Operations adds the supplier's bill, so we know what it cost us. The job's items fill in all by themselves.", "Add the supplier's bill"),
    ("ready", "Everything is ready! Operations presses Material ready, and Sales finds out straight away.", "Material ready → Sales knows"),
    ("dc", "Sales makes a delivery challan. The driver takes the goods, the customer signs it, and we mark it signed.", "Delivery challan → customer signs"),
    ("invoice", "Now Sales makes the invoice with one click. It already knows the items and the prices!", "Invoice in one click"),
    ("accounts", "Accounts checks the invoice, presses Verify, and writes down the money when the customer pays.", "Accounts checks and gets paid"),
    ("profit", "And the Director can see the whole story. What we sold, what it cost, and how much profit we made.", "Director sees the profit"),
    ("outro", "That's it! Ask, buy, deliver, and get paid. Zidane Books keeps everything neat and tidy.", "Ask → Buy → Deliver → Get paid"),
]
k = Kokoro(f"{K}/kokoro-v1.0.onnx", f"{K}/voices-v1.0.bin")
out = []
for i, (sid, text, cap) in enumerate(LINES):
    s, sr = k.create(text, voice=VOICE, speed=0.95, lang="en-us")
    s = s.astype(np.float32)
    idx = np.where(np.abs(s) > 0.01)[0]
    s = s[max(0, idx[0] - 400): idx[-1] + 2000]
    s = s / (np.abs(s).max() + 1e-6) * 0.92
    sf.write(f"public/demo/vo-{i}.wav", s, sr)
    out.append({"i": i, "id": sid, "text": text, "caption": cap, "dur": round(len(s) / sr, 3)})
json.dump({"voice": VOICE, "lines": out}, open("public/demo/vo.json", "w"), indent=1)
print("\n".join(f'{l["id"]:10s} {l["dur"]:5.2f}s' for l in out)); print("total", round(sum(l["dur"] for l in out), 1))
