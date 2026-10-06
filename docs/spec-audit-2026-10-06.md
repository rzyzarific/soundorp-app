# Spec audit, 2026-10-06

An accuracy check of device specs that can change a compatibility verdict, against manufacturer
pages. Two parts: the devices already in question (Part A), and a stratified random sample of 30
devices (Part B). This is the report; the corrections it led to are in the commits that follow it.

## How a source was judged

- **page**: a manufacturer or retailer page that I fetched and read. The quoted wording comes from it.
- **extract**: text the search tool returned from that URL, for pages or PDFs I could not open
  directly (blocked, or a PDF whose text would not decode). Useful, but one step further from the page.
- A spec was treated as **confirmed wrong** only on a manufacturer **page**, or on two independent
  retailer **pages** that agree. A single review, or an **extract** alone, is recorded as evidence but
  was not enough to change a value.
- A device is **verified** when its verdict-affecting fields were found and matched, **wrong** when a
  confirmed source contradicts one, and **could not verify** when no source states the figure or the
  evidence did not meet the bar. No figure was taken from memory.
- Fields that change a verdict: `maxPreampGain`, `minPreampGain`, the phantom-power fields, and the
  connector lists. `micPreampCount` is **not** read by any rule, so an error there is recorded but is
  not counted as verdict-affecting.

## Part A: the devices already in question

Everything at exactly 55 dB was listed, along with the model families of the three earlier corrections.

| Device | Catalog | Source says | Result |
|---|---|---|---|
| `warm-audio-wa273-eq` | 66 dB, 1 channel | 80 dB, dual-channel ([warmaudio.com/mic-pre-wa73-eq](https://warmaudio.com/mic-pre-wa73-eq) page; [bswusa.com](https://bswusa.com/warm-audio-wa273-eq/) page) | **Wrong, fixed** → 80 dB, 2 channels |
| `warm-audio-wa273` | 80 dB, 1 channel | 80 dB, dual-channel ([warmaudio.com/mic-pre-wa73](https://warmaudio.com/mic-pre-wa73) page; [musicredone.com](https://musicredone.com/products/warm-audio-wa273) page) | Gain verified; channel count fixed → 2 |
| `warm-audio-wa412` | 70 dB | 65 dB, 4 channels ([warmaudio.com/wa412](https://warmaudio.com/wa412) page) | **Wrong, fixed** → 65 dB |
| `warm-audio-wa12` | 69 dB | 71 dB for the WA12 MKII, MSRP $449 ([warmaudio.com/wa12mkii](https://warmaudio.com/wa12mkii) page). The catalog's $449 matches the MKII; the original WA12 is listed as legacy at $499 | **Wrong, fixed** → 71 dB |
| `universal-audio-volt-2` | 55 dB | 55 dB ([uaudio.com](https://www.uaudio.com/products/volt-2-usb-audio-interface) page) | Verified |
| `great-river-mp2nv` | 70 dB | "maximum overall gain 70db" ([retrogearshop.com](https://retrogearshop.com/products/great-river-mp-2nv-two-channel-mic-preamp) page); "+70dB" on a distributor datasheet (extract) | Verified |
| `native-instruments-komplete-audio-2` | 55 dB | NI publishes no dB figure. "up to 50dB gain" in one review ([bonedo.de](https://www.bonedo.de/artikel/native-instruments-komplete-audio-1-und-2-test/2/) page) | **Unconfirmed, probably 50.** Not changed |
| `native-instruments-komplete-audio-6` | 55 dB | NI publishes no dB figure. "maximale Gain beträgt nach wie vor 50 dB" in one review ([bonedo.de](https://www.bonedo.de/artikel/native-instruments-komplete-audio-6-mk2/3) page) | **Unconfirmed, probably 50.** Not changed |
| `focusrite-scarlett-4i4-2gen` | 55 dB | Focusrite's own 2nd Gen download list has **no 4i4**: Solo, 2i2, 2i4, 6i6, 18i8, 18i20 ([downloads.focusrite.com](https://downloads.focusrite.com/focusrite/scarlett-2nd-gen) page). The 4i4 exists as a 3rd Gen and 4th Gen | **Product not found as named.** Not changed; needs a decision |

Counts: there are **four** devices at exactly 55 dB (Volt 2, Komplete Audio 2 and 6, Scarlett 4i4 2nd Gen),
not the three noted earlier. Volt 2 and MP2-NV have no siblings in the catalog; the Warm Audio
preamps (WA273-EQ, WA12, WA412) were checked as the WA273's family.

## Part B: the sample

- **Seed:** `20261006`. Algorithm in [`scripts/audit/sample.mjs`](../scripts/audit/sample.mjs): the catalog
  is sorted by id within each stratum, then drawn with a seeded partial Fisher-Yates shuffle
  (mulberry32). Reproduce with `node scripts/audit/sample.mjs`. The seed was fixed before the draw.
- **Strata:** 8 audio interfaces, 8 microphones, 6 preamps, 4 mixers, 4 from the remaining categories
  (monitors, headphones, DAWs) drawn as one pool.
- **Left out of the pool:** the nine devices checked in Part A, and the three in-line boosters (which
  are checked separately), so nothing is counted twice.

### Result

| Verdict | Devices |
|---|---|
| Verified | 12 |
| **Wrong** | **9** (8 affect a verdict, 1 is a channel count only) |
| Could not verify | 9 |

- **Verdict-affecting error rate: 8 of 30 = 27%** (95% interval about 14% to 44%). That is a floor:
  the 9 "could not verify" devices are counted as not wrong, and three of them look wrong.
- Among the 21 devices where a verdict could be reached, 8 of 21 = 38%.
- Devices with any wrong field: 9 of 30 = 30%.
- **Decision rule:** the threshold was 3. It was passed, so no full pass was started.

### Per device

Catalog values are those before the corrections. "Fixed" means the value was changed in the corrections
commit that follows this report.

#### Audio interfaces

| Device | Fields checked | Result | Source |
|---|---|---|---|
| `tascam-us-2x2` | gain 58, XLR/TRS in, USB-C, TRS out, TRS headphone | **Wrong: gain is 56 dB. Fixed.** Rest matches | [tascam.com/us/product/us-2x2hr/spec](https://tascam.com/us/product/us-2x2hr/spec) page |
| `behringer-umc1820` | gain 60, 8 preamps, ADAT, USB, +48V | Could not verify: preamps, +48V, ADAT, USB 2.0 and two headphone outputs match, but no gain figure is published on the page | [behringer.com/en/products/0805-AAN](https://www.behringer.com/en/products/0805-AAN) page |
| `presonus-studio-1810c` | gain 60, 4 preamps, USB-C, TRS out and headphone | Could not verify: the page gives a "Gain Control Range" of **80 dB**, which disagrees with 60, but a range is not clearly the maximum gain. Probable error. Preamps, USB-C, TRS match | [presonus.com/products/Studio-1810c/tech-specs](https://www.presonus.com/products/Studio-1810c/tech-specs) page |
| `behringer-umc204hd` | gain 60, 2 preamps, USB, TRS/RCA out | Could not verify: gain is not on the page; one review says 56 dB ([bonedo.de](https://www.bonedo.de/artikel/behringer-u-phoria-umc204hd-test), extract). Preamps, +48V, USB 2.0 and TRS/RCA outputs match | [behringer.com/en/products/0805-AAS](https://www.behringer.com/en/products/0805-AAS) page |
| `steinberg-ur22c` | gain 60, USB-C, TRS out | Verified: "+6 dB to +60 dB", USB Type-C, TRS outputs | [UR22C operation manual](https://download.steinberg.net/downloads_hardware/UR-C/Manuals/UR22C_Operation_Manual_English.pdf) extract |
| `zoom-h4essential` | gain 60, XLR/TRS in, USB-C, 3.5mm out | Could not verify: the maker says gain "adjustment unnecessary" (32-bit float), so the catalog's 60 dB is not a published spec. Inputs, +48V, USB-C and the stereo mini output match. A decision is needed on whether to drop the figure | [zoomcorp.com H4essential](https://zoomcorp.com/en/us/handheld-recorders/handheld-recorders/h4essential/) page |
| `apogee-duet-3` | gain 75, USB-C, 3.5mm headphone | **Wrong: gain is 65 dB. Fixed.** USB Type-C and the ⅛" headphone output match | [knowledge.apogeedigital.com](https://knowledge.apogeedigital.com/how-does-duet-3-compare-to-other-apogee-units) page |
| `focusrite-scarlett-2i2-4gen` | gain 56, 2 preamps, +48V | **Wrong: gain is 69 dB. Fixed.** 56 dB is the 3rd Gen figure | [us.focusrite.com/products/scarlett-2i2](https://us.focusrite.com/products/scarlett-2i2) page |

#### Microphones

For all eight, the phantom-power fields and the XLR output match the manufacturer. The `minPreampGain`
values are an estimate of how much clean gain the mic needs: no manufacturer publishes it, so it
cannot be verified against a source. The published sensitivity is recorded for reference.

| Device | needsPhantomPower | Published sensitivity | Source (extract) |
|---|---|---|---|
| `rode-nt55` | yes (+48V) ✓ | −38.0 dB re 1 V/Pa | [Rode datasheet](https://edge.rode.com/pdf/page/337/modules/1161/NT55MP_ds_V05.pdf) |
| `neumann-u87ai` | yes (48 V) ✓ | 28 mV/Pa (cardioid) | [neumann.com](https://www.neumann.com/en-us/products/microphones/u-87-ai) |
| `audio-technica-ae3000` | yes (11–52 V) ✓ | −43 dB re 1 V/Pa | [A-T AE3000 manual](https://docs.audio-technica.com/us/ae3000_english.pdf) |
| `audio-technica-at4053b` | yes (48 V) ✓ | −34 dB re 1 V/Pa | [A-T AT4053b sheet](https://docs.audio-technica.com/us/0001_0211_03_at4053b_submittal_sheet.pdf) |
| `royer-r121` | no ✓; `phantomPowerDamages: true`: Royer says it is safe on a console with phantom "provided that the cabling is wired properly", but a patch bay with phantom on gives "a brief but damaging phantom power jolt". The catalog's warning is the conservative reading, not contradicted | −47 dBV/Pa | [royerlabs.com/r-121](https://royerlabs.com/r-121/) |
| `shure-sm58` | no ✓; applying phantom does not damage it ✓ | −56.0 dBV/Pa | [shure.com SM58](https://www.shure.com/en-US/products/microphones/sm58) |
| `electro-voice-re20` | no ✓ (passive) | 1.5 mV/Pa | [electrovoice.com RE20](https://products.electrovoice.com/na/en/re20) |
| `rode-nt1a` | yes (P48 or P24) ✓ | −31.9 dB re 1 V/Pa | [Rode NT1-A datasheet](https://edge.rode.com/pdf/products/69/nt1a_ds_V03.pdf) |

Observation, not an error: the SM58 and RE20 have the same published sensitivity (about −56 dBV/Pa)
but catalog needs of 50 and 55 dB.

#### Preamps

| Device | Fields checked | Result | Source |
|---|---|---|---|
| `universal-audio-la610-mkii` | gain 65, 1 channel | Could not verify: the manual gives "a total of 77 dB" including 15 dB of compressor makeup gain, in 5 dB steps; the preamp-only figure was not found | [LA-610 MkII manual](http://media.uaudio.com/assetlibrary/l/a/la-610mkii_manual.pdf) extract |
| `universal-audio-solo-610` | gain 65 | **Wrong: "55 dB (1.6K ohm input), 60 dB (450 ohm input)". Fixed → 60** | [uaudio.com Solo/610](https://www.uaudio.com/hardware/mic-preamps/solo-610.html) page |
| `audient-mico` | gain 65, 1 channel | **Wrong: "18 to 66dB" per channel, two channels. Fixed → 66, 2** | [Sound on Sound review](https://www.soundonsound.com/reviews/audient-mico) page; Audient's spec page (extract) |
| `fmr-audio-rnp8380` | gain 60, 2 channels | **Wrong: "up to 66dB", two-channel; 12 steps of 6 dB from 0. Fixed → 66** | [united-music.by](https://united-music.by/fmr-audio-rnp-really-nice-preamp-model-rnp8380.html), [analoguehaven.com](https://analoguehaven.com/fmr-audio/rnp-8380) pages |
| `chandler-limited-tg2` | gain 60, 1 channel | **Wrong: "+5dB to +75dB", "Dual Mono". Fixed → 75, 2** | [proaudiodesign.com](https://www.proaudiodesign.com/products/chandler-limited-tg2-preamp), [zenproaudio.com](https://www.zenproaudio.com/chandler-limited-tg2-mic-preamp) pages |
| `rupert-neve-shelford-channel` | gain 66 | Verified: 12 positions of 6 dB, 0 to 66 dB | [rupertneve.com](https://rupertneve.com/products/shelford-channel) extract |

#### Mixers

| Device | Fields checked | Result | Source |
|---|---|---|---|
| `behringer-xenyx-qx1002usb` | gain 60, 2 preamps, +48V | Could not verify: 2 preamps and built-in USB match; gain and phantom are not on the page | [behringer.com/en/products/0601-AGB](https://www.behringer.com/en/products/0601-AGB) page |
| `mackie-profx10v3` | gain 60, 4 preamps, +48V | Verified: four Onyx preamps, "60dB of gain", 48V on all channels | [mackie.com ProFX10v3](https://mackie.com/en/products/mixers/profxv3-series/ProFX10v3.html) page |
| `yamaha-mg10xu` | gain 60, 4 mic inputs | Could not verify: Yamaha's technical specifications give a mic gain of **+64 dB** (pad off), which disagrees with 60, but the PDF could not be opened and the text came from a search extract. Probable error. 4 mic inputs match | [MG10XU specs](https://data.yamaha.com/files/download/other_assets/2/1507032/MG10XU_technical_specifications_En_B0.pdf) extract |
| `behringer-xenyx-q1202usb` | gain 60, 2 preamps, +48V | **Wrong (channel count only): "4 onboard studio-grade XENYX Mic Preamps". Fixed → 4.** +48V matches; gain is not on the page | [behringer.com/en/products/0601-AGC](https://www.behringer.com/en/products/0601-AGC) page |

#### Monitors, headphones, DAWs

| Device | Fields checked | Result | Source |
|---|---|---|---|
| `genelec-8010a` | inputs TRS, RCA | **Wrong: "1 x XLR Analog Input"; no RCA or ¼" input. Fixed → XLR** | [genelec.com/8010a](https://www.genelec.com/8010a) page |
| `shure-srh440` | inputs 3.5mm, TRS | Verified: 3.5 mm plug with a threaded ¼" adapter | [shure.com SRH440](https://www.shure.com/en-US/products/headphones/srh440) extract |
| `pro-tools-studio` | inputs: USB, Thunderbolt, ADAT, S/PDIF | Could not verify: software has no connectors; this is a generic modeling list shared by the DAW entries | none: not a published spec |
| `ardour` | same | Could not verify, as above | none |

## What this says about the catalog

- The errors are mostly **gain figures**, and in a recognisable pattern: round numbers (60, 65, 75) where
  the manufacturer gives something specific, and a previous-generation number kept on a new model (the
  Scarlett 2i2 4th Gen carried the 3rd Gen's 56 dB). Gain figures are the field that most often moves a
  verdict, so a full pass is justified, but it was not started.
- The estimate of "how much is wrong" is a floor, because a "could not verify" is not a "right".
- The `minPreampGain` values on mics, and the DAW connector lists, cannot be checked against any
  published source and need a different approach.

## What was not verified

- Pages that returned 403 or 404 to the fetch tool included Sweetwater, Full Compass, Vintage King, B&H,
  Thomann, zzounds, Native Instruments' specification pages, Focusrite's user guides, and Yamaha's
  specification pages. Sources named by the person who asked for the audit could not be opened.
- The "USB-A" entry on older interfaces is a modeling convention for the host link, not a port type
  that a manufacturer states; it was not checked.
- Prices were not checked.
