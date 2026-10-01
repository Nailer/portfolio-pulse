"""Render the narration in script.json to per-scene WAVs + a timings file.

Uses Kokoro (offline neural TTS). Model files are not committed; download with:
  curl -sSL -o $TTS_DIR/kokoro.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
  curl -sSL -o $TTS_DIR/voices.bin  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
TTS_DIR = os.environ.get("TTS_DIR", os.path.join(HERE, ".tts"))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "build")

# Phonetic spellings in the narration -> how they should read in captions.
CAPTION_FIXES = [
    ("P and L", "P&L"),
    ("B T C", "BTC"),
    ("a four twenty-nine", "a 429"),
    ("slash API slash quotes", "/api/quotes"),
    ("version three, cryptocurrency, quotes latest", "v3/cryptocurrency/quotes/latest"),
    ("Next.js sixteen", "Next.js 16"),
    ("Tailwind four", "Tailwind 4"),
    ("localhost three thousand", "localhost:3000"),
    ("forty-one", "41"),
]


def caption(text: str) -> str:
    for spoken, shown in CAPTION_FIXES:
        text = text.replace(spoken, shown)
    return text


def main():
    with open(os.path.join(HERE, "script.json")) as f:
        script = json.load(f)
    os.makedirs(os.path.join(OUT, "audio"), exist_ok=True)
    kokoro = Kokoro(os.path.join(TTS_DIR, "kokoro.onnx"), os.path.join(TTS_DIR, "voices.bin"))

    timings = []
    for scene in script["scenes"]:
        sr = 24000
        parts = [np.zeros(int(script["sceneLead"] * sr), dtype=np.float32)]
        t = script["sceneLead"]
        cues = []
        for i, line in enumerate(scene["lines"]):
            samples, sr = kokoro.create(line, voice=script["voice"], speed=script["speed"], lang="en-us")
            dur = len(samples) / sr
            cues.append({"start": t, "end": t + dur, "text": caption(line)})
            parts.append(samples.astype(np.float32))
            t += dur
            if i < len(scene["lines"]) - 1:
                parts.append(np.zeros(int(script["sentenceGap"] * sr), dtype=np.float32))
                t += script["sentenceGap"]
        parts.append(np.zeros(int(script["sceneTail"] * sr), dtype=np.float32))
        audio = np.concatenate(parts)
        sf.write(os.path.join(OUT, "audio", f"{scene['id']}.wav"), audio, sr)
        timings.append({"id": scene["id"], "kind": scene["kind"], "duration": len(audio) / sr, "cues": cues})
        print(f"{scene['id']:<16} {len(audio) / sr:6.2f}s")

    with open(os.path.join(OUT, "timings.json"), "w") as f:
        json.dump(timings, f, indent=2)
    print(f"total {sum(s['duration'] for s in timings):.1f}s")


if __name__ == "__main__":
    main()
