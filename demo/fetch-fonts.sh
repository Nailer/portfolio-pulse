#!/usr/bin/env bash
# Self-hosts Geist + Geist Mono for slides.html (headless Chromium doesn't use the shell's proxy).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build/fonts
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
curl -sS -A "$UA" "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" > build/fonts/remote.css
cp build/fonts/remote.css build/fonts/fonts.css
grep -o 'https://fonts.gstatic.com[^)]*' build/fonts/remote.css | sort -u | while read -r url; do
  name=$(echo "$url" | md5sum | cut -c1-12).woff2
  curl -sS -o "build/fonts/$name" "$url"
  sed -i "s#$url#$name#g" build/fonts/fonts.css
done
echo "fonts: $(ls build/fonts/*.woff2 | wc -l) files"
