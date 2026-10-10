## How much each kind of error matters

- **Line-out jack type** (`outputConnectors`): matters. It decides whether the app warns "No matching
  connector" for an interface feeding studio monitors, and which cable or adapter the cable list names.
- **Headphone jack type** (`headphoneOutputConnectors`): matters little. Every pair of headphones in the
  catalog accepts both 3.5mm and TRS, so a wrong value cannot create a false warning. It can only
  mislabel the cable ("TRS cable" vs "3.5mm cable").
- **`maxPreampGain`**: matters. The gain rule compares it with a mic's required gain, so an
  overstated value hides a real shortfall and an understated one raises a false one (and offers a
  booster fix).

## What this register does not cover

- **The original 8 devices** checked in the first verification pass are not covered. Their list was lost
  (it is not in the repository, its history or any saved note), so no record can be written for them from
  evidence. If any of them is among the devices above it has a record from a later audit; the rest have none.
- **The "19 devices flagged during the 300-device build"** list was never found either, so nothing here
  traces back to it.
- **The earlier claim that the line-out and headphone jack types of 50 of the 60 audio interfaces were
  verified** has no per-device record behind it (no device list, no sources). Those 50 are not marked here.
  Only the nine interfaces that the first register named as inferred (plus the 18i20 question) have records.
- **Mics sampled in Part B**: their phantom-power fields and XLR output matched manufacturer text, but that
  text was only seen as search extracts, so those matches are not recorded as verified. Their records say only
  that `minPreampGain` is an estimate no manufacturer publishes.
- **The 2026-10-06 stratified sample found real errors outside everything examined before it**: 9 of its 30
  devices had a wrong field, 8 of them in a field that changes a compatibility verdict. The audits listed
  above followed those errors; they are not a sample of the rest of the catalog. Do not read the number of
  verified records as a measure of how accurate the catalog is. The devices with no record have not been
  looked at, and the audit's error rate suggests a meaningful share of them are wrong somewhere.
- **Removed from the catalog because the product does not exist:** the Scarlett 4i4 (2nd Gen) and the
  Mackie ProFX8v3. Saved or shared chains that held them show the "no longer in the catalog" notice.

## Open thread: `micPreampCount` may hold an input or channel count

Found 2026-10-08 while checking the last devices at 60 dB. Four mixers listed their input or channel count as the
number of mic preamps; each was corrected against a manufacturer page or spec sheet:

| Device | Catalog said | Manufacturer says |
|---|---|---|
| `mackie-onyx8` | 8 | 4 Onyx preamps |
| `mackie-1642vlz4` | 16 | 10 Onyx mic preamps |
| `behringer-xenyx-1622usb` | 10 | 4 XENYX mic preamps |
| `behringer-xenyx-x2222usb` | 16 | 8 XENYX mic preamps |

No rule reads `micPreampCount`, so no compatibility verdict changed, but the number is shown to the user.

**The other mixers have not been checked for the same fault.** That is a separate future pass, deliberately not
started here; do not assume the remaining counts are right. When it is done, compare each mixer's count with its
manufacturer's stated number of mic preamps (not its channel count, input count or XLR-plus-line combo count).

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

## Known flaky test run

The browser script `scripts/e2e/ui-layout.mjs` can fail with a `TimeoutError` (a 30-second wait on clicking
"Add" while building a long chain) on a slow run. On 2026-10-10 it failed twice, once inside the full suite and
once alone, and then passed 1362/1362 standalone; the failing runs were the slower ones (the passing standalone run
took 413 s, an earlier clean run 223 s, and the other scripts in the same suite ran two to three times slower).
It could not be reproduced with a plain add loop at 1440, 1024 or 390 px. It is recorded here as a known flaky run,
not investigated further. If it fails, re-run it on its own before suspecting the change under test.
