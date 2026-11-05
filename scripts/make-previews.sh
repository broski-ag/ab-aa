#!/usr/bin/env bash
# Makes the two things that make a video grid feel instant — the way YouTube / Instagram do it:
#
#   1. previews/<name>.mp4   a tiny silent looping clip for the grid tiles (typically 200-500 KB)
#   2. faststart/<name>.mp4  the FULL video re-muxed (no quality loss, no re-encode) so the player
#                            can start before the whole file has downloaded
#
# Usage:   scripts/make-previews.sh <folder-with-your-videos> [output-folder]
# Needs:   ffmpeg (https://ffmpeg.org). Works on .mp4 / .mov / .webm / .mkv.
#
# Then upload previews/ next to your videos and point `preview` at them in src/data/content.ts:
#     { src: `${CDN}/reels/1.mp4`, thumb: 11, preview: `${CDN}/previews/reels-1.mp4` }
# (and upload faststart/ over the originals if they were not already web-optimised).
set -euo pipefail

IN="${1:?usage: make-previews.sh <input-folder> [output-folder]}"
OUT="${2:-./video-out}"
PREVIEW_SECONDS="${PREVIEW_SECONDS:-8}"     # length of the grid loop
mkdir -p "$OUT/previews" "$OUT/faststart"

shopt -s nullglob nocaseglob
for f in "$IN"/*.{mp4,mov,webm,mkv}; do
  name="$(basename "${f%.*}")"
  # orientation decides the preview size: 360x640 for vertical, 640x360 for wide
  IFS=x read -r w h < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$f")
  if [ "$h" -gt "$w" ]; then scale="scale=360:-2"; else scale="scale=640:-2"; fi

  echo "→ $name  (${w}x${h})"
  # 1) preview: H.264 plays on every device with hardware decoding; no audio; fast-start; 24 fps
  ffmpeg -y -loglevel error -i "$f" -t "$PREVIEW_SECONDS" -an \
    -vf "$scale,fps=24" -c:v libx264 -profile:v main -preset slow -crf 29 \
    -pix_fmt yuv420p -movflags +faststart "$OUT/previews/$name.mp4"

  # 2) full video: only move the index (moov atom) to the front — instant, lossless
  if [[ "$f" == *.mp4 || "$f" == *.MP4 || "$f" == *.mov ]]; then
    ffmpeg -y -loglevel error -i "$f" -c copy -movflags +faststart "$OUT/faststart/$name.mp4"
  fi
done

echo "Done. Previews: $OUT/previews   Full videos (faststart): $OUT/faststart"
du -sh "$OUT/previews" "$OUT/faststart" 2>/dev/null || true
