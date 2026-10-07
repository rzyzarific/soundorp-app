# The 60 dB question, 2026-10-07

72 of the 303 catalog devices had `maxPreampGain` of exactly 60. Real data for 72 different devices
should not all land on a round number, so this checks whether 60 is a placeholder. It follows the
[2026-10-06 audit](spec-audit-2026-10-06.md); the same evidence rules apply (a **page** is one I
fetched and read; an **extract** is text the search tool returned from a page I could not open).

## Where the 72 sit

| Category | At 60 | Of |
|---|---|---|
| Mixers | **40** | 40 (every mixer in the catalog) |
| Audio interfaces | 24 | 60 |
| Preamps | 8 | 43 |

By brand: Behringer 16, Mackie 9, Yamaha 7, Allen & Heath 7, Soundcraft 6, PreSonus 6, then smaller
groups (MOTU 3, Zoom 3, Steinberg 2, Focusrite 2, and one each for 11 other brands).

## The sample

- **Seed `20261007`**, drawn by [`scripts/audit/sample-at-60.mjs`](../scripts/audit/sample-at-60.mjs) from
  the 72, which are frozen in `scripts/audit/fixtures/at-60-2026-10-07.json` so that later corrections
  (which move devices off 60) do not change the draw. A test pins the 18 ids.
- The 10 devices at 60 that were already audited on 2026-10-06 were left out, leaving 62 eligible.
- **18 drawn:** 8 mixers, 6 interfaces, 4 preamps.

## Result

| Outcome | Count |
|---|---|
| Confirmed wrong (a page) | 5 |
| Probably wrong, unresolved | 4 |
| Agrees with 60 | 5 |
| No usable figure found | 4 |

- Confirmed wrong: 5 of 18 = 28%. Wrong or probably wrong: 9 of 18 = 50%.
- Of the 14 where a figure turned up, 9 disagree with 60.
- So 60 is a default, but not a pure placeholder: the 60s that hold up belong to the Mackie Onyx and
  Behringer Xenyx lines, whose real spec is 60 dB. The wrong ones are other brands and other product lines.

### Confirmed wrong

| Device | Catalog | Source says | Source |
|---|---|---|---|
| `yamaha-mg20xu` | 60 | mic gain **+20 to +64 dB**, 16 preamps | [musicredone.com](https://musicredone.com/products/yamaha-mg20xu-20-input-mixer-with-built-in-fx) page; Yamaha's technical-specifications PDF (extract) |
| `behringer-xenyx-302usb` | 60 | gain **+15 to +55 dB**, one mic input | [musiciansfriend.com](https://www.musiciansfriend.com/pro-audio/behringer-xenyx-302usb-usb-mixer/h78998000000000) page; retailer extracts |
| `focusrite-vocaster-two` | 60 | "Mic input gain range **70dB**" | [us.focusrite.com](https://us.focusrite.com/products/vocaster-two) page |
| `golden-age-pre-73` | 60 | **20 to 80 dB** (MKIII); the DLX, Premier and MKIV are also 80, only the JR is 70 | [greentoe.com](https://www.greentoe.com/product/Golden_Age_Project_PRE73MK3) page; Adorama and Muziker extracts |
| `motu-8a` | 60, 8 mic preamps, phantom power, XLR | **8 x ¼" TRS line inputs**, trim -4 to +20; "does not provide microphone preamplification or phantom power" | [motu.com 8A specs](https://motu.com/products/avb/8a/specs.html) page |

### Probably wrong, not changed

| Device | Evidence | Why it is only "probable" |
|---|---|---|
| `antelope-zen-go-synergy-core` | 65 dB, from the search results for soundpure, musicredone and zzounds | I could not open any of those pages |
| `presonus-studio-26c` | "Microphone Preamp Gain Control Range: 70 dB" ([presonus.com](https://au.presonus.com/products/studio-26c) page) | a *range* may not equal the maximum gain |
| `art-pro-mpa-ii` | 70 to 75 dB, extracts from retailer pages that disagree with each other | single extracts |
| `allen-heath-zed60-14fx` | "69dB gain range", 8 mic/line inputs ([soundpro.com](https://soundpro.com/products/allen-heath-zed60-14fx-multipurpose-usb-mixer-with-fx) page) against the catalog's 60 dB and 6 | a range description; the trim range is also quoted as 60 |

### Agrees with 60

`mackie-profx6v3`: "two ... Onyx preamps ... 60dB" ([mackie.com](https://mackie.com/en/products/mixers/profxv3-series/ProFX6v3.html) page). By extract only:
`behringer-xenyx-x1204usb` (+10 to +60), `behringer-xenyx-802` (+10 to +60, two preamps),
`zoom-uac-2` (0 to 60), `spl-crimson-3` (+7 to +60).

### No usable figure

`behringer-xenyx-2442fx` and `yamaha-ag06-mkii` (the pages give no gain figure),
`mackie-onyx-producer-2-2` (no figure found), and `behringer-mic200`: the gain knob is +26 to +60,
which agrees with 60, but 70 dB is quoted as the overall figure once the output stage is included.

## Neighbours of the confirmed errors

| Device | Catalog | Source says |
|---|---|---|
| `focusrite-vocaster-one` | 60 | **70** ([us.focusrite.com](https://us.focusrite.com/products/vocaster-one) page) |
| `focusrite-scarlett-solo-4gen` | 56 | **57** ([us.focusrite.com](https://us.focusrite.com/products/scarlett-solo) page) |

(The Solo 4th Gen is not 69 like the other 4th Gen models, so the 2i2's 56 was not a series-wide error.)

## What this means for the next step

The wrong values cluster in brands and lines other than Mackie Onyx and Behringer Xenyx. Those
confirmed-correct families are left out of further sampling unless something specific flags a
device. The next group to check is the rest of the 60s from Yamaha (MG series), Allen & Heath and
Soundcraft.

## Not verified

- The four "agrees" by extract only, and every "probable" above, rest on text I could not read at the source.
- Pages that returned 403 or 404 include Sweetwater, B&H, Thomann, Allen & Heath's own site and
  Yamaha's specification pages.
