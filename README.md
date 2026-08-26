# business-of-sports.github.io

Web decks for the Business of Sports minor, David Eccles School of Business,
University of Utah. Published with GitHub Pages at the account root, so every
deck is one short path.

## Decks

| Deck | URL |
|---|---|
| Advisory Group Meeting No. 2 | https://business-of-sports.github.io/advisory-2/ |
| Faculty review one-pager     | https://business-of-sports.github.io/faculty-review/ |
| PLAYERS Academy              | https://business-of-sports.github.io/players-academy/ |
| About me                     | https://business-of-sports.github.io/about-me/ |
| Design concepts              | https://business-of-sports.github.io/concepts/ |

Every deck has a PDF at the same path with the trailing slash swapped for
`.pdf` — `/advisory-2/` is the deck, `/advisory-2.pdf` is the export. Pressing
**P** on any deck jumps to its PDF; Back returns you to the slide you left.

The root page lists nothing. Decks are reachable only by direct link — the repo
is public, so treat that as tidiness, not access control.

## Layout

```
_engine/        deck.v1.css / deck.v1.js — brand-agnostic, consumes --brand-* tokens
_brand/utah/    brand.css, fonts, logos, headshots, img
_legacy/        assets for the two pre-engine pages (players-academy, concepts)
<deck>/         one folder per deck, one segment of URL
```

A second institution becomes `_brand/<name>/` — a sibling, so no deck URL changes.

`.nojekyll` is required, not optional: without it Pages runs Jekyll, which
ignores every `_`-prefixed folder, and `_engine` and `_brand` would 404.

## Adding a deck

Copy an existing deck folder, keep the `../_engine/` and `../_brand/utah/`
references, name the folder as the URL you want to send.

## Regenerating a PDF

Chrome headless against the served deck, then Ghostscript at 150 dpi — raw
Chrome output runs 3-6x larger because it embeds images at full resolution:

    chrome --headless --no-pdf-header-footer --virtual-time-budget=30000 \
      --print-to-pdf=out.pdf http://localhost:PORT/advisory-2/
    gs -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress \
      -dDownsampleColorImages=true -dColorImageResolution=150 \
      -dNOPAUSE -dQUIET -dBATCH -sOutputFile=advisory-2.pdf out.pdf

Pagination comes from the `@media print` block — one slide per 13.333x7.5in
page, animations frozen finished, presenter chrome hidden. It lives in
`_engine/deck.v1.css` for engine decks, and inline for `players-academy` and
`concepts`, which predate the engine.

PDFs are binary and do not delta-compress: each regeneration adds a fresh full
copy to history. Squash or prune if that outgrows the working tree.

## Archive

Full build history through August 2026 lives in the repo this was migrated
from, which remains published and unchanged.
