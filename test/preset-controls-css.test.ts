import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("preset control card styles", () => {
  it("keeps compact preset labels inside the card", () => {
    const buttonRule = ruleFor(".preset-controls button");

    expect(buttonRule).toContain("min-width: 0;");
    expect(buttonRule).toContain("min-height: 38px;");
    expect(buttonRule).toContain("overflow-wrap: anywhere;");
    expect(stylesheet).not.toMatch(/\.preset-controls button span\s*\{/);
    expect(stylesheet).not.toMatch(/\.preset-controls small\s*\{/);
  });
});

function ruleFor(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]+)\\}`));

  expect(match?.groups?.body, `${selector} rule`).toBeDefined();

  return match?.groups?.body ?? "";
}
