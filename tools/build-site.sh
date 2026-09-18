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

python3 - <<'PY'
import json, glob, os
decks = []
for f in sorted(glob.glob('cards/decks/*.json')):
    d = json.load(open(f))
    if d.get('deck') == 'unfiled':
        continue
    cards = []
    for c in d['cards']:
        if c['type'] == 'mat':
            continue
        img = c.get('file', '').replace('images/', 'cards/').rsplit('.', 1)[0] if c.get('file') else None
        cards.append({
            'name': c['name'], 'type': c['type'], 'kind': c.get('kind'), 'power': c.get('power'),
            'cost': c.get('cost'), 'traits': c.get('traits', []), 'faction': c.get('faction'),
            'abilities': c.get('abilities', []), 'text': c.get('text'), 'keywords': c.get('keywords', []),
            'code': c.get('code'), 'credit': c.get('credit'), 'trap': c.get('trap', False),
            'img': img, 'mergedFrom': c.get('mergedFrom'), 'addedLater': c.get('addedLater'),
            'duplicate': bool(c.get('duplicateOf') or c.get('altArtOf')),
        })
    decks.append({'deck': d['deck'], 'faction': d.get('faction'), 'legal': d.get('legal', False),
                  'incomplete': d.get('incomplete'), 'note': d.get('note'), 'cards': cards})
os.makedirs('site/data', exist_ok=True)
json.dump({'decks': decks}, open('site/data/cards.json', 'w'), indent=1)
print('site data:', sum(len(x['cards']) for x in decks), 'cards across', len(decks), 'decks')
PY
