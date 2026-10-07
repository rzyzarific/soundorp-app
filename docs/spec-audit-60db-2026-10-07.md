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
| `allen-heath-zed60-14fx` | "69dB gain range", 8 mic/line inputs ([soundpro.com](https://soundpro.com/products/allen-heath-zed60-14fx-multipurpose-usb-mixer-with-fx) page) against the catalog's 60 dB and 6 | a range description; the trim range is also quoted as 60. **Later resolved: the gain is correct, see the follow-up below** |

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

## Follow-up, 2026-10-07: the fix pass

Corrections made (each from a manufacturer or retailer page, or a manufacturer document read as text):

| Device | Was | Now | Source |
|---|---|---|---|
| Yamaha MG20XU, MG10XU, MG12XU, MG16XU, MG06 | 60 | **64** | Yamaha technical specifications, "Analog Input Characteristics": MIC/LINE, PAD off, GAIN trim +64 dB |
| Behringer Xenyx 302USB | 60 | **55** | musiciansfriend.com: "+15dB to +55dB" |
| Focusrite Vocaster Two and One | 60 | **70** | us.focusrite.com |
| Golden Age Project Pre-73 | 60 | **80** | greentoe.com (20 to 80 dB; only the JR is 70) |
| Scarlett Solo (4th Gen) | 56 | **57** | us.focusrite.com |
| MOTU 8A | 60, mic preamps, phantom, XLR | **line inputs only**: those fields removed | motu.com |

Checked and found **correct at 60** (so not changed): Allen & Heath ZEDi-8, ZEDi-10, ZEDi-10FX (datasheets:
XLR mic gain "6dB to 60dB"), ZED-10FX and ZED Sixty-14FX (user guides: "+10dB to +60dB", "60dB max"),
Qu-16 ("-5 to +60dB") and SQ-5 ("0dB to +60dB"); Soundcraft Signature 12MTK ("Gain range is 10dB to 60dB").
The ZED60-14FX suspicion above came from a retailer's "69dB gain range" line and was wrong.

**Flagged `in_question`, value kept:** Antelope Zen Go, PreSonus Studio 26c and 1810c, ART Pro MPA II,
and the gain of Behringer UMC204HD, UMC1820, Xenyx QX1002USB, Q1202USB and 2442FX, Zoom H4essential,
UA LA-610 MkII, Yamaha AG06 MkII and MGP12X, Mackie Onyx Producer 2·2, Behringer MIC200, and Soundcraft
Notepad-12FX, EFX8, GB2, Ui12 and Spirit Folio.

### The 60 dB count now

**62 of 302 devices** (was 72 of 303): 34 mixers, 21 interfaces, 7 preamps.

| Of the 62 | Count |
|---|---|
| Confirmed 60 by a manufacturer document or page | 11 |
| Agree with 60 through a search extract only | 5 |
| Flagged `in_question` on gain | 19 |
| Not examined | 27 |

The 27 not examined: 13 Behringer or Mackie units (the Xenyx +10 to +60 dB and Onyx 60 dB lines, left out of
further sampling unless something specific flags them) and 14 others: PreSonus Studio 68c, Quantum 2626,
DP88 and Studio 192; MOTU M2 and M4; dbx 286s; Grace Design m101; IK Multimedia AXE I/O; Alto ZMX122FX;
TC-Helicon GoXLR; Tascam Series 208i; Zoom AMS-24; Steinberg UR44C.

## Second batch, 2026-10-07: the 14 not-yet-examined non-Behringer, non-Mackie devices

| Device | Was | Result | Source |
|---|---|---|---|
| `tascam-series-208i` | 60 dB, 8 preamps | **58 dB, 4 preamps** (corrected) | Tascam spec sheet: "Maximum gain 58 dB", four mic/line combo inputs |
| `zoom-ams-24` | 60 dB | **58 dB** (corrected) | Zoom manual: "Input gain -inf - +58 dB" |
| `alto-professional-zmx122fx` | 60 dB, 2 inputs | **50 dB, 4 mic inputs** (corrected) | [andertons.co.uk](https://www.andertons.co.uk/alto/alto-zmx122fx-input-mixer) and [bajaao.com](https://www.bajaao.com/products/alto-zmx122fx-8-channel-compact-mixer-with-effects) pages: "0 dB to 50 dB (Mic)" |
| `grace-design-m101` | 60 dB | **75 dB** (corrected) | [gracedesign.com](https://gracedesign.com/products/microphone-preamplifiers/m101/): mic input 10-65 dB plus 10 dB on the output trim, "overall maximum of 75dB" |
| `dbx-286s` | outputs XLR, TRS | **TRS only** (corrected); gain 0 to +60 dB confirmed | dbx datasheet: "LINE OUTPUT (1/4" TRS)" |
| `presonus-studio-68c` | 2 preamps | **4 preamps** (corrected) | presonus.com |
| `motu-m2`, `motu-m4` | 60 dB | confirmed | MOTU M-Series user guide: "Gain range 0 to +60 dB" |
| `steinberg-ur44c` | 60 dB | confirmed | UR44C operation manual: "Gain Range +6 dB - +60 dB" |
| `presonus-studio-68c`, `-quantum-2626`, `-studio-192`, `-dp88` | 60 dB | `in_question` | PreSonus gives a "gain control range" (80, 60, 60) or nothing; a range is not a stated maximum |
| `ik-multimedia-axe-io` | 60 dB | `in_question` | IK gives only +12 dBu at min gain and -37 dBu at max gain for 0 dBFS, a 49 dB span |
| `tc-helicon-goxlr` | 60 dB | `in_question` | no gain figure found |

The Grace m101 figure counts the output trim, as the Great River MP-2NV's does; its mic-input stage alone is 65 dB.

### The 60 dB count after the second batch

**58 of 302 devices** (the first draw found 72 of 303): 33 mixers, 19 interfaces, 6 preamps.

| Of the 58 | Count |
|---|---|
| Confirmed 60 by a manufacturer document or page | 15 |
| Flagged `in_question` on gain | 30 |
| Not examined | 13 |

The 13 not examined are all Behringer or Mackie units (Xenyx 502, 1002FX, 1204USB, 1622USB, X2222USB, UMC202HD,
UMC404HD; Mackie Mix12FX, 1202VLZ4, 1642VLZ4, Onyx8, ProFX8v3, DL806), whose product lines really are 60 dB.
They stay out of further sampling unless something specific flags them.

## Not verified

- The four "agrees" by extract only, and every "probable" above, rest on text I could not read at the source.
- Pages that returned 403 or 404 include Sweetwater, B&H, Thomann, Allen & Heath's own site and
  Yamaha's specification pages.
