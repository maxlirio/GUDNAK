#!/bin/sh
# Rebuild everything the website serves from the card readings.
#
#   sh tools/build-site.sh
#
# Converts cards/images/**.png into web JPEGs + thumbnails under site/cards/,
# then writes site/data/cards.json. Safe to re-run; only changed cards are
# reconverted.
set -e
cd "$(dirname "$0")/.."

node tools/build-catalog.js

count=0
for src in cards/images/*/*.png; do
  rel=${src#cards/images/}
  dst="site/cards/${rel%.png}.jpg"
  thumb="site/cards/${rel%.png}.thumb.jpg"
  mkdir -p "$(dirname "$dst")"
  if [ ! -f "$dst" ] || [ "$src" -nt "$dst" ]; then
    sips -s format jpeg -s formatOptions 86 "$src" --out "$dst" >/dev/null
    sips -Z 360 -s format jpeg -s formatOptions 72 "$src" --out "$thumb" >/dev/null
    count=$((count + 1))
  fi
done
echo "converted $count card image(s)"

# Drop web images whose source card is gone.
for jpg in site/cards/*/*.jpg; do
  case "$jpg" in *.thumb.jpg) continue;; esac
  rel=${jpg#site/cards/}
  [ -f "cards/images/${rel%.jpg}.png" ] || { rm -f "$jpg" "${jpg%.jpg}.thumb.jpg"; echo "removed stale $rel"; }
done

node tools/build-sitedata.js
node tools/build-gamedata.js
