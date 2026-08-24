import NepaliDate from "nepali-date-converter";

// Bikram Sambat <-> Gregorian (AD). All functions take/return plain values so
// they work identically on client and server. Months are 1-indexed everywhere
// in this module; the underlying package is 0-indexed.

export type BsDate = { year: number; month: number; day: number };

export const BS_MONTHS_NP = [
  "वैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
  "कात्तिक", "मंसिर", "पुष", "माघ", "फागुन", "चैत",
];

function toDevDigits(s: string | number): string {
  const dev = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
  return String(s).replace(/\d/g, (d) => dev[Number(d)]);
}

/** AD ISO "YYYY-MM-DD" -> BS components. Local-timezone safe (no UTC parse).
 *  Returns null outside the supported range — the package clamps silently,
 *  so we validate by requiring an exact roundtrip. */
export function adToBs(iso: string): BsDate | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  try {
    const raw = new NepaliDate(new Date(`${iso}T00:00:00`)).getBS();
    const bs = { year: raw.year, month: raw.month + 1, day: raw.date };
    return bsToAd(bs) === iso ? bs : null;
  } catch {
    return null;
  }
}

/** BS components -> AD ISO "YYYY-MM-DD". Null if out of supported range. */
export function bsToAd(bs: BsDate): string | null {
  try {
    const ad = new NepaliDate(bs.year, bs.month - 1, bs.day).getAD();
    if (typeof ad?.year !== "number") return null;
    const mm = String(ad.month + 1).padStart(2, "0");
    const dd = String(ad.date).padStart(2, "0");
    return `${ad.year}-${mm}-${dd}`;
  } catch {
    return null;
  }
}

const dayCache = new Map<string, number>();

/** Days in a BS month (BS months have 29-32 days), probed via the converter. */
export function bsMonthDays(year: number, month: number): number {
  const key = `${year}-${month}`;
  let days = dayCache.get(key);
  if (!days) {
    days = 31;
    while (days > 28 && bsToAd({ year, month, day: days }) === null) days--;
    dayCache.set(key, days);
  }
  return days;
}

/** BS date as Devanagari-digit "YYYY/MM/DD", e.g. २०८२/१२/०४ */
export function formatBsNp(bs: BsDate): string {
  return toDevDigits(
    `${bs.year}/${String(bs.month).padStart(2, "0")}/${String(bs.day).padStart(2, "0")}`,
  );
}

/** Parse a written BS date — accepts Devanagari or ASCII digits with / - . separators. */
export function parseBsString(s: string): BsDate | null {
  const ascii = toAsciiDigits(String(s ?? "").trim());
  const m = ascii.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function toAsciiDigits(s: string): string {
  return s.replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d)));
}

export { toDevDigits };
