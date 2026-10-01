# Demo video

`portfolio-pulse-demo.mp4` is a narrated, captioned 1080p walkthrough of Portfolio Pulse: what it does, a live run-through of the dashboard, and how it works under the hood (architecture, the momentum-fingerprint correlation trick, the keyless/Pro API switch, the ticker-collision bug, and our API feedback).

The whole video is generated from code, so it can be re-cut whenever the app changes.

| File | Role |
| --- | --- |
| `script.json` | Scene list and narration: edit this to change what's said |
| `tts.py` | Renders narration offline with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) and records per-sentence timings |
| `slides.html` | Animated explainer slides; elements enter on the narration cue they belong to |
| `record.mjs` | Drives the real app with Playwright (cursor, typing, highlights) and captures frames, timed to the narration |
| `mock-quotes.json` | Sample quotes served to the app during recording (set `LIVE=1` to use the real CMC API instead) |
| `assemble.py` | Joins clips and audio, normalizes loudness, burns in captions |

## Rebuild

```bash
pip install kokoro-onnx soundfile   # plus ffmpeg and Playwright's Chromium
npm run dev                         # in the repo root, keep running
./demo/make.sh                      # optionally: LIVE=1 ./demo/make.sh
```
