"""Joins build/clips + build/audio into the final video with burned-in captions."""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "portfolio-pulse-demo.mp4")
FADE = 0.35
MAX_WORDS = 13  # long sentences are split into several on-screen captions


def ts(t: float) -> str:
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def chunks(text: str):
    words = text.split()
    n = max(1, round(len(words) / MAX_WORDS + 0.3))
    size = -(-len(words) // n)
    return [" ".join(words[i:i + size]) for i in range(0, len(words), size)]


def write_ass(timings, path):
    lines = [
        "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1920", "PlayResY: 1080", "WrapStyle: 0", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
        "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: Cap,DejaVu Sans,38,&H00F4F3F1,&H00F4F3F1,&H40100D0B,&H00000000,0,0,0,0,100,100,0,0,3,14,0,2,260,260,46,1",
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    offset = 0.0
    for scene in timings:
        for cue in scene["cues"]:
            parts = chunks(cue["text"])
            total_chars = sum(len(p) for p in parts)
            t = cue["start"]
            for p in parts:
                d = (cue["end"] - cue["start"]) * len(p) / total_chars
                lines.append(f"Dialogue: 0,{ts(offset + t)},{ts(offset + t + d)},Cap,,0,0,0,,{p}")
                t += d
        offset += scene["duration"]
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


def main():
    with open(os.path.join(BUILD, "timings.json")) as f:
        timings = json.load(f)

    # Video segments: each slide is its own clip; consecutive app scenes share app.mp4.
    segments = []
    for scene in timings:
        if scene["kind"] == "app":
            if segments and segments[-1][0] == "app":
                segments[-1] = ("app", segments[-1][1] + scene["duration"])
            else:
                segments.append(("app", scene["duration"]))
        else:
            segments.append((scene["id"], scene["duration"]))

    inputs, filters = [], []
    for i, (clip, dur) in enumerate(segments):
        inputs += ["-i", os.path.join(BUILD, "clips", f"{clip}.mp4")]
        filters.append(
            f"[{i}:v]trim=0:{dur:.3f},setpts=PTS-STARTPTS,"
            f"fade=in:st=0:d={FADE},fade=out:st={dur - FADE:.3f}:d={FADE}[v{i}]"
        )
    n = len(segments)
    for j, scene in enumerate(timings):
        inputs += ["-i", os.path.join(BUILD, "audio", f"{scene['id']}.wav")]
    audio_in = "".join(f"[{n + j}:a]" for j in range(len(timings)))

    ass = os.path.join(BUILD, "captions.ass")
    write_ass(timings, ass)
    filters.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[vc]")
    filters.append(f"[vc]subtitles={ass}[vout]")
    filters.append(f"{audio_in}concat=n={len(timings)}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]")

    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-stats", *inputs,
        "-filter_complex", ";".join(filters), "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-pix_fmt", "yuv420p", "-r", "30",
        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", OUT,
    ], check=True)
    print(f"wrote {OUT} ({sum(d for _, d in segments):.1f}s)")


if __name__ == "__main__":
    main()
