// Self-check: bun run lib/nepali-date.check.ts
import { adToBs, bsToAd, bsMonthDays, formatBsNp } from "./nepali-date";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`FAIL ${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  }
}

// Anchor pair from the PCampus document
check("adToBs anchor", adToBs("2026-03-18"), { year: 2082, month: 12, day: 4 });
check("formatBsNp anchor", formatBsNp({ year: 2082, month: 12, day: 4 }), "२०८२/१२/०४");
check("bsToAd anchor", bsToAd({ year: 2082, month: 12, day: 4 }), "2026-03-18");

// Roundtrip sweep across the supported range (sampled)
for (let year = 1945; year <= 2040; year++) {
  for (const md of ["01-15", "03-01", "06-21", "12-31"]) {
    const iso = `${year}-${md}`;
    const bs = adToBs(iso);
    if (!bs) continue; // outside package range is fine
    if (Number(bs.year) < 2000 || Number(bs.year) > 2099) continue; // UI range only
    check(`roundtrip ${iso}`, bsToAd(bs), iso);
  }
}

// Month lengths stay in the real BS range of 29-32 days
check("bsMonthDays 2082/12", bsMonthDays(2082, 12) >= 29 && bsMonthDays(2082, 12) <= 32, true);
check("bsMonthDays 2081/1", bsMonthDays(2081, 1) >= 29 && bsMonthDays(2081, 1) <= 32, true);

// Out-of-range and garbage inputs degrade to null, never throw
check("out of range", adToBs("1900-01-01"), null);
check("garbage", adToBs("not-a-date"), null);
check("empty", adToBs(""), null);
check("bad bs", bsToAd({ year: 1000, month: 13, day: 40 }), null);

if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("All nepali-date checks passed.");
