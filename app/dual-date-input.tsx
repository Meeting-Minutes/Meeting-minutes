"use client";

import { useSyncExternalStore } from "react";
import {
  adToBs,
  bsMonthDays,
  bsToAd,
  BS_MONTHS_NP,
  formatBsNp,
} from "@/lib/nepali-date";

const BS_MIN_YEAR = 2000;
const BS_MAX_YEAR = 2099;

const PREF_KEY = "dateCalendarPref";
const PREF_EVENT = "calprefchange";

function subscribe(cb: () => void) {
  window.addEventListener(PREF_EVENT, cb);
  return () => window.removeEventListener(PREF_EVENT, cb);
}

function getMode(): "bs" | "ad" {
  try {
    return localStorage.getItem(PREF_KEY) === "bs" ? "bs" : "ad";
  } catch {
    return "ad";
  }
}

/** Date picker with a BS ⇄ AD toggle. Value is always an AD ISO "YYYY-MM-DD"
 *  string; whichever calendar is active is editable and the other mirrors it.
 *  Calendar preference persists in localStorage across fields and pages. */
export default function DualDateInput({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
}) {
  const mode = useSyncExternalStore(subscribe, getMode, () => "ad" as const);

  function switchMode(next: "bs" | "ad") {
    try {
      localStorage.setItem(PREF_KEY, next);
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event(PREF_EVENT));
  }

  const bs = adToBs(value);
  // Anchor for the BS selects when no valid value exists yet: today.
  const anchor =
    bs ??
    adToBs(
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`,
    );

  function setBs(year: number, month: number, day: number) {
    const iso = bsToAd({ year, month, day });
    if (iso) onChange(iso);
  }

  const chip =
    "px-2 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer";
  const selectClass =
    "bg-bg-input border border-border rounded-lg px-2 py-1.5 text-sm focus:border-accent focus:outline-none";

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex gap-0.5 bg-surface border border-border/50 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => switchMode("bs")}
            className={`${chip} ${
              mode === "bs"
                ? "bg-accent/15 border-accent/30 text-accent"
                : "border-transparent text-text-muted hover:text-text-normal"
            }`}
          >
            बि.सं
          </button>
          <button
            type="button"
            onClick={() => switchMode("ad")}
            className={`${chip} ${
              mode === "ad"
                ? "bg-accent/15 border-accent/30 text-accent"
                : "border-transparent text-text-muted hover:text-text-normal"
            }`}
          >
            A.D.
          </button>
        </span>

        {value && bs && (
          <span className="text-[11px] text-text-muted truncate">
            {mode === "ad" ? `बि.सं ${formatBsNp(bs)}` : `${value} A.D.`}
          </span>
        )}
        {value && !bs && (
          <span className="text-[11px] text-danger text-right">
            Unsupported date — pick between 2000–2099 बि.सं
          </span>
        )}
      </div>

      {mode === "ad" ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-bg-input border border-border rounded-lg px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
      ) : (
        <span className="flex gap-1.5 w-full">
          <select
            aria-label="BS year"
            value={anchor?.year ?? ""}
            onChange={(e) =>
              setBs(Number(e.target.value), anchor!.month, Math.min(anchor!.day, bsMonthDays(Number(e.target.value), anchor!.month)))
            }
            className={`${selectClass} w-24 shrink-0`}
          >
            {anchor && <option value={anchor.year}>{anchor.year}</option>}
            {Array.from({ length: BS_MAX_YEAR - BS_MIN_YEAR + 1 }, (_, i) => BS_MIN_YEAR + i)
              .filter((y) => y !== anchor?.year)
              .map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
          </select>
          <select
            aria-label="BS month"
            value={anchor?.month ?? ""}
            onChange={(e) =>
              setBs(anchor!.year, Number(e.target.value), Math.min(anchor!.day, bsMonthDays(anchor!.year, Number(e.target.value))))
            }
            className={`${selectClass} flex-1 min-w-0`}
          >
            {anchor && <option value={anchor.month}>{BS_MONTHS_NP[anchor.month - 1]}</option>}
            {BS_MONTHS_NP.map((name, i) =>
              i + 1 !== anchor?.month ? (
                <option key={name} value={i + 1}>{name}</option>
              ) : null,
            )}
          </select>
          <select
            aria-label="BS day"
            value={anchor?.day ?? ""}
            onChange={(e) => setBs(anchor!.year, anchor!.month, Number(e.target.value))}
            className={`${selectClass} w-20 shrink-0`}
          >
            {(() => {
              const max = anchor ? bsMonthDays(anchor.year, anchor.month) : 31;
              return Array.from({ length: max }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ));
            })()}
          </select>
        </span>
      )}
    </div>
  );
}
