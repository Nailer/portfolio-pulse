#!/usr/bin/env bash
# Rebuilds demo/portfolio-pulse-demo.mp4 end to end. Expects `npm run dev` on :3000.
set -euo pipefail
cd "$(dirname "$0")"
export TTS_DIR="${TTS_DIR:-$PWD/.tts}"
if [ ! -f "$TTS_DIR/kokoro.onnx" ]; then
  mkdir -p "$TTS_DIR"
  curl -sSL -o "$TTS_DIR/kokoro.onnx" https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
  curl -sSL -o "$TTS_DIR/voices.bin" https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
fi
[ -f build/fonts/fonts.css ] || ./fetch-fonts.sh
python3 tts.py            # narration -> build/audio/*.wav + build/timings.json
node record.mjs           # scenes -> build/clips/*.mp4
python3 assemble.py       # -> portfolio-pulse-demo.mp4
