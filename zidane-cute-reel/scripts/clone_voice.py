"""Convert a source speech wav into the timbre of reference recordings with kNN-VC (all local).
usage: clone_voice.py <knnvc_src> <weights_dir> <source.wav> <out.wav> <ref1> [ref2 ...]"""
import sys, json, torch, torchaudio
SRC, W, SOURCE, OUT, *REFS = sys.argv[1:]
sys.path.insert(0, SRC)
from wavlm.WavLM import WavLM, WavLMConfig
from hifigan.models import Generator as HiFiGAN
from hifigan.utils import AttrDict
from matcher import KNeighborsVC
torch.set_num_threads(max(1, torch.get_num_threads()))
h = AttrDict(json.load(open(f"{SRC}/hifigan/config_v1_wavlm.json")))
gen = HiFiGAN(h); gen.load_state_dict(torch.load(f"{W}/prematch_g_02500000.pt", map_location="cpu")["generator"]); gen.eval(); gen.remove_weight_norm()
ck = torch.load(f"{W}/WavLM-Large.pt", map_location="cpu")
wl = WavLM(WavLMConfig(ck["cfg"])); wl.load_state_dict(ck["model"]); wl.eval()
vc = KNeighborsVC(wl, gen, h, "cpu")
import soundfile as sf, numpy as np
def to16k(p):
    a, sr = sf.read(p, dtype="float32", always_2d=True)
    w = torch.from_numpy(a.mean(1))[None]
    if sr != 16000: w = torchaudio.functional.resample(w, sr, 16000)
    return w
refs = [to16k(r) for r in REFS]
matching = vc.get_matching_set(refs)
print("matching set frames:", matching.shape)
q = vc.get_features(to16k(SOURCE))
out = vc.match(q, matching, topk=4)
sf.write(OUT, out.numpy(), 16000); print("wrote", OUT, out.shape[0] / 16000, "s")
