const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const TIME_INTERVALS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" }
] as const;

export type TimeInterval = (typeof TIME_INTERVALS)[number]["id"];

export type TimePeriodSelection = {
  interval: TimeInterval;
  year: number;
  month: number;
  week: number;
  day: string;
};

export type TimeRange = {
  start: string;
  end: string;
};

export function createTimePeriodSelection(interval: TimeInterval, anchorDate: string): TimePeriodSelection {
  const parsedDate = parseIsoDate(anchorDate);
  const date = Number.isNaN(parsedDate.getTime())
    ? new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))
    : parsedDate;
  const isoWeek = getIsoWeek(date);

  return normalizeTimePeriodSelection({
    interval,
    year: interval === "week" ? isoWeek.year : date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    week: isoWeek.week,
    day: formatIsoDate(date)
  });
}

export function createCurrentWeekSelection(now = new Date()): TimePeriodSelection {
  return createTimePeriodSelection("week", formatLocalDate(now));
}

export function deriveTimePeriodSelectionFromRange(start: string, end: string): TimePeriodSelection {
  const startDate = parseIsoDate(start);

  if (Number.isNaN(startDate.getTime())) {
    return createTimePeriodSelection("week", start);
  }

  if (start === end) {
    return createTimePeriodSelection("day", start);
  }

  const yearRange = getYearRange(startDate.getUTCFullYear());

  if (start === yearRange.start && end === yearRange.end) {
    return createTimePeriodSelection("year", start);
  }

  const monthRange = getMonthRange(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1);

  if (start === monthRange.start && end === monthRange.end) {
    return createTimePeriodSelection("month", start);
  }

  const isoWeek = getIsoWeek(startDate);
  const weekRange = getWeekRange(isoWeek.year, isoWeek.week);

  if (start === weekRange.start && end === weekRange.end) {
    return createTimePeriodSelection("week", start);
  }

  return createTimePeriodSelection("week", start);
}

export function getTimeRange(selection: TimePeriodSelection): TimeRange {
  const normalized = normalizeTimePeriodSelection(selection);

  if (normalized.interval === "day") {
    return {
      start: normalized.day,
      end: normalized.day
    };
  }

  if (normalized.interval === "week") {
    return getWeekRange(normalized.year, normalized.week);
  }

  if (normalized.interval === "month") {
    return getMonthRange(normalized.year, normalized.month);
  }

  return getYearRange(normalized.year);
}

export function moveTimePeriod(selection: TimePeriodSelection, offset: number): TimePeriodSelection {
  const range = getTimeRange(selection);
  const startDate = parseIsoDate(range.start);

  if (selection.interval === "day") {
    return createTimePeriodSelection("day", formatIsoDate(addDays(startDate, offset)));
  }

  if (selection.interval === "week") {
    return createTimePeriodSelection("week", formatIsoDate(addDays(startDate, offset * 7)));
  }

  if (selection.interval === "month") {
    return createTimePeriodSelection(
      "month",
      formatIsoDate(new Date(Date.UTC(selection.year, selection.month - 1 + offset, 1)))
    );
  }

  return normalizeTimePeriodSelection({
    ...selection,
    year: selection.year + offset
  });
}

export function updateTimePeriodInterval(
  selection: TimePeriodSelection,
  interval: TimeInterval
): TimePeriodSelection {
  return createTimePeriodSelection(interval, getTimeRange(selection).start);
}

export function updateTimePeriodYear(selection: TimePeriodSelection, year: number): TimePeriodSelection {
  if (selection.interval === "day") {
    const date = parseIsoDate(selection.day);
    const day = clampDayInMonth(year, date.getUTCMonth(), date.getUTCDate());

    return createTimePeriodSelection("day", formatIsoDate(new Date(Date.UTC(year, date.getUTCMonth(), day))));
  }

  return normalizeTimePeriodSelection({
    ...selection,
    year
  });
}

export function updateTimePeriodValue(selection: TimePeriodSelection, value: string | number): TimePeriodSelection {
  if (selection.interval === "day") {
    return createTimePeriodSelection("day", String(value));
  }

  if (selection.interval === "week") {
    return normalizeTimePeriodSelection({
      ...selection,
      week: Number(value)
    });
  }

  if (selection.interval === "month") {
    return normalizeTimePeriodSelection({
      ...selection,
      month: Number(value)
    });
  }

  return normalizeTimePeriodSelection(selection);
}

export function normalizeTimePeriodSelection(selection: TimePeriodSelection): TimePeriodSelection {
  const year = Math.trunc(selection.year);
  const safeYear = Number.isFinite(year) ? year : new Date().getUTCFullYear();
  const month = clamp(Math.trunc(selection.month), 1, 12);
  const maxWeek = getIsoWeeksInYear(safeYear);
  const week = clamp(Math.trunc(selection.week), 1, maxWeek);
  const day = normalizeDay(selection.day, safeYear);

  return {
    interval: selection.interval,
    year: selection.interval === "day" ? parseIsoDate(day).getUTCFullYear() : safeYear,
    month,
    week,
    day
  };
}

export function getIsoWeeksInYear(year: number) {
  const start = startOfIsoWeek(year, 1);
  const nextStart = startOfIsoWeek(year + 1, 1);

  return Math.round((nextStart.getTime() - start.getTime()) / MS_PER_DAY / 7);
}

export function getCurrentUtcYear() {
  return new Date().getUTCFullYear();
}

export function isAfterCurrentTimePeriod(selection: TimePeriodSelection, now = new Date()) {
  const normalized = normalizeTimePeriodSelection(selection);
  const currentSelection = createTimePeriodSelection(normalized.interval, formatLocalDate(now));

  return compareIsoDates(getTimeRange(normalized).start, getTimeRange(currentSelection).start) > 0;
}

export function clampToCurrentTimePeriod(selection: TimePeriodSelection, now = new Date()) {
  const normalized = normalizeTimePeriodSelection(selection);

  if (isAfterCurrentTimePeriod(normalized, now)) {
    return createTimePeriodSelection(normalized.interval, formatLocalDate(now));
  }

  return normalized;
}

function getYearRange(year: number): TimeRange {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`
  };
}

function getMonthRange(year: number, month: number): TimeRange {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));

  return {
    start: formatIsoDate(start),
    end: formatIsoDate(end)
  };
}

function getWeekRange(year: number, week: number): TimeRange {
  const start = startOfIsoWeek(year, week);

  return {
    start: formatIsoDate(start),
    end: formatIsoDate(addDays(start, 6))
  };
}

function startOfIsoWeek(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4IsoDay = getIsoDay(jan4);
  const weekOneStart = addDays(jan4, 1 - jan4IsoDay);

  return addDays(weekOneStart, (week - 1) * 7);
}

function getIsoWeek(date: Date) {
  const isoDay = getIsoDay(date);
  const thursday = addDays(date, 4 - isoDay);
  const year = thursday.getUTCFullYear();
  const weekOneStart = startOfIsoWeek(year, 1);
  const week = Math.floor((startOfUtcDay(date).getTime() - weekOneStart.getTime()) / MS_PER_DAY / 7) + 1;

  return { year, week };
}

function getIsoDay(date: Date) {
  return date.getUTCDay() || 7;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function normalizeDay(day: string, fallbackYear: number) {
  const date = parseIsoDate(day);

  if (Number.isNaN(date.getTime())) {
    return `${fallbackYear}-01-01`;
  }

  return formatIsoDate(date);
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return new Date(Number.NaN);
  }

  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    return new Date(Number.NaN);
  }

  return date;
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function clampDayInMonth(year: number, monthIndex: number, day: number) {
  return Math.min(day, new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate());
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function compareIsoDates(left: string, right: string) {
  return Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`);
}
