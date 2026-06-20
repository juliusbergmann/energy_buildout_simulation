import { describe, expect, it } from "vitest";
import {
  createCurrentWeekSelection,
  createTimePeriodSelection,
  deriveTimePeriodSelectionFromRange,
  getIsoWeeksInYear,
  getTimeRange,
  isAfterCurrentTimePeriod,
  moveTimePeriod,
  updateTimePeriodInterval,
  updateTimePeriodYear
} from "@/lib/time-period";

describe("time-period range selection", () => {
  it("creates the default selection from the current calendar week", () => {
    const selection = createCurrentWeekSelection(new Date(2026, 5, 20, 12));

    expect(selection.interval).toBe("week");
    expect(selection.year).toBe(2026);
    expect(selection.week).toBe(25);
    expect(getTimeRange(selection)).toEqual({
      start: "2026-06-15",
      end: "2026-06-21"
    });
  });

  it("maps week 25 in 2026 to the Monday-Sunday ISO week range", () => {
    const selection = createTimePeriodSelection("week", "2026-06-20");

    expect(selection.year).toBe(2026);
    expect(selection.week).toBe(25);
    expect(getTimeRange(selection)).toEqual({
      start: "2026-06-15",
      end: "2026-06-21"
    });
  });

  it("calculates month and year ranges", () => {
    expect(getTimeRange(createTimePeriodSelection("month", "2026-02-20"))).toEqual({
      start: "2026-02-01",
      end: "2026-02-28"
    });
    expect(getTimeRange(createTimePeriodSelection("year", "2026-06-20"))).toEqual({
      start: "2026-01-01",
      end: "2026-12-31"
    });
  });

  it("steps across ISO week-year boundaries", () => {
    const week53 = createTimePeriodSelection("week", "2026-12-28");
    const nextWeek = moveTimePeriod(week53, 1);

    expect(getIsoWeeksInYear(2026)).toBe(53);
    expect(nextWeek.year).toBe(2027);
    expect(nextWeek.week).toBe(1);
    expect(getTimeRange(nextWeek)).toEqual({
      start: "2027-01-04",
      end: "2027-01-10"
    });
  });

  it("preserves sensible dates when changing interval or year", () => {
    const day = createTimePeriodSelection("day", "2024-02-29");
    const shiftedYear = updateTimePeriodYear(day, 2025);

    expect(getTimeRange(shiftedYear)).toEqual({
      start: "2025-02-28",
      end: "2025-02-28"
    });
    expect(getTimeRange(updateTimePeriodInterval(day, "month"))).toEqual({
      start: "2024-02-01",
      end: "2024-02-29"
    });
  });

  it("derives selector state from shared start and end parameters", () => {
    const selection = deriveTimePeriodSelectionFromRange("2026-06-15", "2026-06-21");

    expect(selection.interval).toBe("week");
    expect(selection.year).toBe(2026);
    expect(selection.week).toBe(25);
  });

  it("identifies periods after the current selectable interval", () => {
    const now = new Date("2026-06-20T12:00:00Z");
    const currentWeek = createTimePeriodSelection("week", "2026-06-20");

    expect(isAfterCurrentTimePeriod(currentWeek, now)).toBe(false);
    expect(isAfterCurrentTimePeriod(moveTimePeriod(currentWeek, 1), now)).toBe(true);
    expect(isAfterCurrentTimePeriod(createTimePeriodSelection("month", "2026-07-01"), now)).toBe(true);
    expect(isAfterCurrentTimePeriod(createTimePeriodSelection("year", "2027-01-01"), now)).toBe(true);
  });
});
