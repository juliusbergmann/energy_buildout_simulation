import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("preset control card styles", () => {
  it("keeps compact preset labels inside the card", () => {
    const controlsRule = ruleFor(".preset-controls");
    const buttonRule = ruleFor(".preset-controls button");

    expect(controlsRule).toContain("grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));");
    expect(buttonRule).toContain("min-width: 0;");
    expect(buttonRule).toContain("min-height: 38px;");
    expect(buttonRule).toContain("overflow-wrap: normal;");
    expect(buttonRule).toContain("word-break: normal;");
    expect(buttonRule).not.toContain("overflow-wrap: anywhere;");
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
