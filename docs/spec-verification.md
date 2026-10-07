# Spec verification register

Written 2026-10-05. **Read-only audit: no spec values in `src/data/devices.json` were changed.**

This lists catalog entries whose specs are unverified, inferred, or in question, so they can be
checked against a manufacturer manual before anyone relies on them. Each entry gives the device id,
the field in doubt, the value currently in the catalog, why it is uncertain, and what would settle it.

## How much each kind of error matters

- **Line-out jack type** (`outputConnectors`): matters. It decides whether the app warns "No matching
  connector" for an interface feeding studio monitors, and which cable or adapter the cable list names.
- **Headphone jack type** (`headphoneOutputConnectors`): matters little. Every pair of headphones in the
  catalog accepts both 3.5mm and TRS, so a wrong value cannot create a false warning. It can only
  mislabel the cable ("TRS cable" vs "3.5mm cable").
- **`maxPreampGain`**: matters. The gain rule compares it with a mic's required gain, so an
  overstated value hides a real shortfall and an understated one raises a false one (and offers a
  booster fix).

## A. Interface line-out jack types, inferred (4 devices)

For these four, the line-out type was inferred rather than read from a spec that names it. The
headphone jack for the same device was inferred too, so it is listed alongside.

| Device id | Field in doubt | Current value | Why it is uncertain | What would settle it |
|---|---|---|---|---|
| `focusrite-scarlett-solo-4gen` | `outputConnectors` (line outs), `headphoneOutputConnectors` | `["USB-C","TRS"]`, `["TRS"]` | Focusrite's specifications page says "Line outputs (Balanced)" and lists a headphone output but never names the connector. TRS was inferred from "balanced" plus the 2i2 and 4i4 4th Gen pages, which do state 6.3 mm TRS. | Solo 4th Gen user guide, rear-panel section. |
| `focusrite-scarlett-4i4-2gen` | `outputConnectors`, `headphoneOutputConnectors` | `["USB-A","TRS"]`, `["TRS"]` | No specification page for the 4i4 **2nd** Gen turned up; searches returned the 3rd and 4th Gen and the 2i4 2nd Gen. The 2i4 2nd Gen was described as having balanced ¼″ outputs **and** four RCA outputs, so the 4i4 2nd Gen may have RCA outputs the catalog omits. | Scarlett 4i4 2nd Gen user guide, rear panel. |
| `focusrite-scarlett-4i4-3gen` | `outputConnectors`, `headphoneOutputConnectors` | `["USB-C","TRS"]`, `["TRS"]` | Sources said "four balanced outputs" and one headphone output without naming the jack. TRS was inferred from the 4th Gen sibling, which states 6.3 mm. | Scarlett 4i4 3rd Gen user guide, rear panel. |
| `tc-helicon-goxlr` | `outputConnectors`, `headphoneOutputConnectors` | `["USB-A","3.5mm"]`, `["3.5mm"]` | Rests on one thin search result (a 3.5 mm mini-jack line out, 3.5 mm headphone jack). No manufacturer page was read. The original (black, 2022) and newer (white, 2024) units differ, and it is unclear which the entry describes. | GoXLR manual for the revision being sold. |

## B. Interface headphone jack types, inferred (6 devices)

For five of the six, the **line outs were read from spec text** as balanced ¼″ jacks (TRS), and only
the headphone jack type is inferred. The exception is the 18i20, whose line-out connectors are only
partly confirmed; see section C.

| Device id | Field in doubt | Current value | Why it is uncertain | What would settle it |
|---|---|---|---|---|
| `focusrite-clarett-plus-2pre` | `headphoneOutputConnectors` | `["TRS"]` | Sources confirmed four balanced ¼″ TRS outputs and "a single headphone output" without the jack type. The 4Pre sibling is stated as 2 × ¼″ TRS. | Clarett+ 2Pre user guide. |
| `focusrite-scarlett-18i20-4gen` | `headphoneOutputConnectors` | `["TRS"]` | Two headphone outputs confirmed; the jack type was not stated on the pages found (one retailer line was garbled). | 18i20 4th Gen user guide, front panel. |
| `presonus-studio-24c` | `headphoneOutputConnectors` | `["TRS"]` | Sources say "1 stereo headphone output" without the connector. Main outs are confirmed ¼″ TRS. | Studio 24c owner's manual. |
| `focusrite-scarlett-2i2-3gen` | `headphoneOutputConnectors` | `["TRS"]` | Line outs confirmed as 6.3 mm; the headphone jack type was not stated. | Scarlett 2i2 3rd Gen user guide. |
| `universal-audio-apollo-twin-duo` | `headphoneOutputConnectors` | `["TRS"]` | Sources describe the Twin Duo's outputs (2 monitor, 4 line TRS, 1 stereo headphone) but state the headphone jack type only for the newer Apollo Twin X Gen 2 (¼″ TRS). Applied to the Duo by sibling. | Apollo Twin Duo hardware manual. |
| `presonus-studio-192` | `headphoneOutputConnectors` | `["TRS"]` | Sources confirm ten ¼″ balanced outputs and two headphone outputs (150 mW) without the headphone jack type. | Studio 192 owner's manual. |

## C. Open question: Scarlett 18i20 4th Gen XLR outputs

| Device id | Field in doubt | Current value | Why it is uncertain | What would settle it |
|---|---|---|---|---|
| `focusrite-scarlett-18i20-4gen` | `outputConnectors` (should it also include `"XLR"`?) | `["USB-C","ADAT","SPDIF","TRS"]` | Focusrite lists "10 line outputs inc. alt speaker switching" and one retailer says four balanced ¼″ line outputs, but **no source read names the connector for the main monitor outputs**. Whether they also appear on XLR was neither confirmed nor ruled out; the user guide was not read. | 18i20 4th Gen user guide, rear panel. If XLR is present, add it to `outputConnectors`. |

## D. Komplete Audio 2 preamp gain

| Device id | Field in doubt | Current value | Why it is uncertain | What would settle it |
|---|---|---|---|---|
| `native-instruments-komplete-audio-2` | `maxPreampGain` | `55` | Flagged by the project owner as an estimate. **I found no record of the source or of what was estimated** in the repository, git history or session notes, and I did not research this value. Two other entries carry exactly 55: `native-instruments-komplete-audio-6` and `universal-audio-volt-2` (the latter was corrected to 55 after manual verification), so 55 may be a placeholder. | Komplete Audio 2 spec sheet or manual: "mic preamp gain". |

## E. Previously corrected, plus one suspected sibling

The catalog commit (`8c483f3`, 2026-09-18) records three specs corrected after manual
verification against manufacturer spec sheets. Their current values match the corrections:

| Device id | Field | Corrected from → to | Current value |
|---|---|---|---|
| `universal-audio-volt-2` | `maxPreampGain` | 76 → 55 | `55` |
| `warm-audio-wa273` | `maxPreampGain` | 66 → 80 | `80` |
| `great-river-mp2nv` | `maxPreampGain` | 66 → 70 | `70` |

**Suspected, not verified (my observation):** `warm-audio-wa273-eq` has `maxPreampGain` of `66`,
which is exactly the wrong value that was corrected on `warm-audio-wa273`. They may share a preamp
design, so this could be the same error. Check it against the manufacturer spec sheet.

## F. The "19 devices flagged during the 300-device build": not found

I could not produce this list. I looked in:

- the git history, including every commit message (the catalog commit mentions only the 3
  corrections above);
- a text search of the repository for terms such as unverified, estimate, inferred and flagged;
- this project's saved notes, which are empty;
- the other saved session for this project, which is about Lemon Squeezy and contains nothing about specs.

Nothing in the repository identifies 19 devices, and the catalog has no field that marks a spec as
verified or not. If the list exists elsewhere, add it here:

| Device id | Field in doubt | Current value | Why it is uncertain | What would settle it |
|---|---|---|---|---|
| _(to be supplied)_ | | | | |

## Pattern to watch for: USB port types

The schema's connectors are `USB-A`, `USB-C` and `Thunderbolt`; it has no `USB-B`. Across interfaces and
mixers the catalog lists 38 devices as `USB-A`, 44 as `USB-C` and 8 as `Thunderbolt`. Many devices that
connect to a computer through a **USB-B** (or Micro-B) socket will have been entered as one of the other two.

Why it matters: the connector check never tells USB types apart (every DAW entry accepts USB-A, USB-C and
Thunderbolt), so no pass or warning depends on it. The **cable list** does: it prints the interface's own USB
entry as the cable to buy ("USB-C cable", "USB-A cable"), and the PDF reuses that list. A wrong type names the
wrong cable.

Known cases, each marked `in_question` on `outputConnectors` and left at its catalog value:

| Device | Catalog | What a source says | Evidence |
|---|---|---|---|
| `tascam-series-208i` | USB-C | "4-pin USB B-type" | Tascam's spec sheet |
| `ik-multimedia-axe-io` | USB-C | "B-Type USB socket" | IK's page |
| `yamaha-mg20xu` | USB-A | "1x USB-B 2.0" | a retailer page |
| `tc-helicon-goxlr` | USB-A | "1 x USB 2.0, type B" (GoXLR Mini) | a retailer page |
| `zoom-uac-2` | USB-C | "USB Type-B (USB 3.0)" | a retailer listing (search extract) |

The other entries have **not** been investigated. They are left to surface through normal sampling: when an
audited device's USB entry disagrees with its manufacturer's port, flag it the same way. If the pattern
turns out to be widespread, the better fix is a `USB-B` connector in the schema and cable list, not
device-by-device flags.

(This section is written by hand. When the register is regenerated from the catalog, carry it over.)

## What has and has not been verified

- **Verified during this work** (read from manufacturer or retailer specification text surfaced by
  web search; not hands-on and not from a manual unless stated): the line-out and headphone jack
  types of 50 of the 60 audio interfaces; the specs of the three in-line boosters (Cloudlifter
  CL-1, FetHead, DM1 Dynamite). The Scarlett Solo 3rd Gen was checked against Focusrite's own page.
- **Corrected earlier after manual verification:** the three specs in section E.
- **Everything else** was drafted from public spec sheets when the catalog was built and has not
  been re-checked since. The catalog has no per-field verified marker, so this register is the only
  record of what is in doubt.
- **Prices** are list prices dated September 2026 (`PRICES_AS_OF` in `src/lib/shoppingList.ts`) and
  are not individually verified.
