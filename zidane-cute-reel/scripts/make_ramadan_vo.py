"""Urdu voiceover for the animated Ramadan story with Kokoro (open source, runs locally on CPU).
Kokoro has no Urdu voice; its Hindi voices speak the same spoken language, so the lines are written
in Devanagari. Subtitles (Roman Urdu) and timings go to public/vo/ramadan-vo.json.
usage: python3 scripts/make_ramadan_vo.py <kokoro_dir> [voice]"""
import json, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

K = sys.argv[1]
VOICE = sys.argv[2] if len(sys.argv) > 2 else "hm_omega"
LINES = [  # (spoken, subtitle)
    ("रमज़ान... सिर्फ़ रोज़ा नहीं, रहमत बाँटने का महीना है।", "Ramzan… sirf roza nahi, rehmat baantne ka mahina hai."),
    ("जब मेहनत करने वालों के हाथ में राशन पहुँचता है...", "Jab mehnat karne walon ke haath mein ration pahunchta hai…"),
    ("तो सिर्फ़ एक बैग नहीं, पूरे घर की ख़ुशी घर जाती है।", "…to sirf ek bag nahi, poore ghar ki khushi ghar jaati hai."),
    ("आटा, चावल, खजूर, रूह अफ़ज़ा... दस्तरख़्वान पर बरकत आ जाती है।", "Atta, chawal, khajoor, Rooh Afza… dastarkhwan par barkat aa jaati hai."),
    ("और रहमत... आगे बढ़ती रहती है।", "Aur rehmat… aage barhti rehti hai."),
    ("आओ, इस रमज़ान रहमतें बाँटें।", "Aao, is Ramzan rehmatein baantein."),
    ("ज़िदान रमज़ान पैकेजेस। कॉर्पोरेट, फ़ैक्ट्री और एन जी ओज़ के लिए। ज़िदान डॉट कॉम डॉट पी के।", "Zidane Ramzan packages: corporate, factory aur NGOs ke liye."),
]
k = Kokoro(f"{K}/kokoro-v1.0.onnx", f"{K}/voices-v1.0.bin")
out = []
for i, (spoken, sub) in enumerate(LINES):
    s, sr = k.create(spoken, voice=VOICE, speed=0.9, lang="hi")
    s = s.astype(np.float32)
    idx = np.where(np.abs(s) > 0.01)[0]
    s = s[max(0, idx[0] - 600): idx[-1] + 2400]
    s = s / (np.abs(s).max() + 1e-6) * 0.9
    sf.write(f"public/vo/ramadan-{i}.wav", s, sr)
    out.append({"i": i, "sub": sub, "dur": round(len(s) / sr, 3)})
json.dump({"voice": VOICE, "lines": out}, open("public/vo/ramadan-vo.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1))
