#!/usr/bin/env python3
"""
hassan-ac.py  —  Midea AC ko greet karwao, aur bill ka hisaab rakho.

AC on karte hi:  bolta hai "Hassan bhai aa gaye" (har baar different line)
AC off karte hi: batata hai kitne ghante chala aur kitna bill bana
18 pe set karo:  taunt karta hai

----------------------------------------------------------------------
SETUP (ek hi baar) — ye laptop/Pi par chalayein jo AC ki SAME WiFi par ho
----------------------------------------------------------------------
  1)  pip install msmart-ng

  2)  AC dhoondo (cloud login chahiye — wahi email/password jo Midea app mein hai):
          msmart-ng discover --account you@email.com --password YOURPASS

      Output mein se ye char cheezein neeche CONFIG mein bhar dein:
          ip, id, token, key

  3)  python3 hassan-ac.py
----------------------------------------------------------------------
"""

import asyncio
import json
import platform
import random
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# ====================== CONFIG — yahan bharein ======================
HOST       = "192.168.1.50"      # AC ka IP (discover se mila)
DEVICE_ID  = 0                   # discover se mila 'id'
TOKEN      = ""                  # discover se mila 'token'
KEY        = ""                  # discover se mila 'key'

TARIFF_PKR = 52.0                # per unit (kWh) rate — apna bill dekh ke theek karein
AC_KW      = 1.5                 # AC ka average draw, kW (1 ton ~1.2, 1.5 ton ~1.8)

POLL_SEC   = 5                   # kitni der baad check kare
COLD_LIMIT = 20                  # is se neeche set kiya to taunt
STATE_FILE = Path(__file__).with_name("ac-log.json")
VOICE_DIR  = Path(__file__).with_name("voice")   # yahan mp3 rakho to wahi bajenge
# ====================================================================

ON_LINES = [
    "Hassan bhai aa gaye.",
    "AC chalu. Garmi lagi, haina?",
    "Welcome back Hassan.",
    "Theek hai, thanda kar deta hoon.",
    "Hassan bhai, AC haazir hai.",
    "Aa gaye? Chalo shuru karein.",
]

OFF_LINES = [
    "AC band. Hisaab suno —",
    "Theek hai, band kar diya.",
    "Bas? Chalo —",
]

COLD_LINES = [
    "{t} degree? Bill bhi utna hi aayega.",
    "{t} pe chala rahe ho. Qatal hai ye bijli ka.",
    "Arre {t}? Thoda reham karo meter pe.",
]


# ------------------------------- awaaz -------------------------------
def speak(text: str) -> None:
    """mp3 folder ho to wahi bajao, warna system ki awaaz use karo."""
    print(f"  🔊  {text}")

    if VOICE_DIR.is_dir():
        clips = sorted(VOICE_DIR.glob("*.mp3")) + sorted(VOICE_DIR.glob("*.wav"))
        if clips:
            _play_file(random.choice(clips))
            return

    system = platform.system()
    try:
        if system == "Darwin":
            subprocess.run(["say", text], check=False)
        elif system == "Windows":
            subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 f'Add-Type -AssemblyName System.Speech; '
                 f'(New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak("{text}")'],
                check=False,
            )
        else:
            for tool in ("spd-say", "espeak-ng", "espeak"):
                if shutil.which(tool):
                    subprocess.run([tool, text], check=False)
                    break
    except Exception as exc:
        print(f"  (awaaz nahi chali: {exc})", file=sys.stderr)


def _play_file(path: Path) -> None:
    system = platform.system()
    try:
        if system == "Darwin":
            subprocess.run(["afplay", str(path)], check=False)
        elif system == "Windows":
            subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 f'(New-Object Media.SoundPlayer "{path}").PlaySync()'],
                check=False,
            )
        else:
            for tool in ("mpg123", "ffplay", "aplay", "paplay"):
                if shutil.which(tool):
                    args = [tool, str(path)]
                    if tool == "ffplay":
                        args = [tool, "-nodisp", "-autoexit", str(path)]
                    subprocess.run(args, check=False)
                    break
    except Exception:
        pass


# ------------------------------- hisaab -------------------------------
def load_log() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"months": {}, "days": {}}


def save_log(log: dict) -> None:
    STATE_FILE.write_text(json.dumps(log, indent=2))


def add_runtime(log: dict, seconds: float) -> tuple[float, float, float]:
    """Runtime darj karo. Return: (is session ke ghante, aaj ke PKR, mahine ke PKR)."""
    now = datetime.now()
    day, month = now.strftime("%Y-%m-%d"), now.strftime("%Y-%m")

    log["days"][day] = log["days"].get(day, 0) + seconds
    log["months"][month] = log["months"].get(month, 0) + seconds
    save_log(log)

    cost = lambda sec: (sec / 3600) * AC_KW * TARIFF_PKR
    return seconds / 3600, cost(log["days"][day]), cost(log["months"][month])


# ------------------------------- main -------------------------------
async def main() -> None:
    try:
        from msmart.device import AirConditioner
    except ImportError:
        sys.exit("msmart-ng nahi mila.  chalayein:  pip install msmart-ng")

    if not TOKEN or not KEY or not DEVICE_ID:
        sys.exit("CONFIG khaali hai — pehle 'msmart-ng discover' chalayein, phir ip/id/token/key bharein.")

    ac = AirConditioner(ip=HOST, port=6444, device_id=int(DEVICE_ID))
    await ac.authenticate(TOKEN, KEY)
    print(f"✓ AC se juda — {HOST}\n")

    log = load_log()
    was_on: bool | None = None
    last_temp: float | None = None
    started_at: datetime | None = None

    while True:
        try:
            await ac.refresh()
        except Exception as exc:
            print(f"  … connection toota ({exc}) — dobara koshish", file=sys.stderr)
            await asyncio.sleep(POLL_SEC * 3)
            continue

        is_on = bool(ac.power)
        target = ac.target_temperature
        room = ac.indoor_temperature

        # ---- on / off badla? ----
        if was_on is not None and is_on != was_on:
            stamp = datetime.now().strftime("%H:%M")

            if is_on:
                started_at = datetime.now()
                print(f"[{stamp}]  AC ON   (set {target}°, room {room}°)")
                speak(random.choice(ON_LINES))

                if target is not None and target < COLD_LIMIT:
                    await asyncio.sleep(1.2)
                    speak(random.choice(COLD_LINES).format(t=int(target)))

            else:
                print(f"[{stamp}]  AC OFF")
                if started_at:
                    hrs, today_pkr, month_pkr = add_runtime(
                        log, (datetime.now() - started_at).total_seconds()
                    )
                    started_at = None
                    speak(random.choice(OFF_LINES))
                    await asyncio.sleep(0.8)
                    speak(
                        f"{hrs:.1f} ghante chala. "
                        f"Aaj ka {today_pkr:.0f} rupay. "
                        f"Is mahine ka {month_pkr:.0f} rupay."
                    )

        # ---- chalte chalte temperature neeche kiya? ----
        elif is_on and target is not None and last_temp is not None \
                and target < last_temp and target < COLD_LIMIT:
            speak(random.choice(COLD_LINES).format(t=int(target)))

        was_on, last_temp = is_on, target
        await asyncio.sleep(POLL_SEC)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nbye.")
