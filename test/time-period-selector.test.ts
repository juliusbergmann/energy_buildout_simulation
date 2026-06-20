import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimePeriodSelector } from "@/app/components/simulator-page";
import { createTimePeriodSelection, getTimeRange } from "@/lib/time-period";

afterEach(() => {
  vi.useRealTimers();
});

describe("TimePeriodSelector", () => {
  it("disables next-period arrows once the current interval is selected", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));

    const selection = createTimePeriodSelection("week", "2026-06-20");
    const range = getTimeRange(selection);
    const markup = renderToStaticMarkup(
      createElement(TimePeriodSelector, {
        selection,
        start: range.start,
        end: range.end,
        onSelectionChange: () => undefined
      })
    );

    expect(buttonTag(markup, "Previous week")).not.toContain("disabled");
    expect(buttonTag(markup, "Next week")).toContain("disabled");
    expect(buttonTag(markup, "Next year")).toContain("disabled");
  });
});

function buttonTag(markup: string, label: string) {
  return markup.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? "";
}
