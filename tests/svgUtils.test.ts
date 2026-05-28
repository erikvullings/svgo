// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { collapseTransforms, roundPathData, roundNumericValueFixed } from "../src/svgUtils";

describe("roundPathData", () => {
  it("separates adjacent numbers after rounding to 0 decimals", () => {
    const input = "M109.1 124.3V33.1l-69.3.3v90.9z";
    const output = roundPathData(input, 0);
    expect(output).toBe("M109 124V33l-69 0v91z");
  });
});

describe("roundNumericValueFixed with zero-sensitive safety", () => {
  it("preserves opacity when rounding to 0 decimals", () => {
    expect(roundNumericValueFixed("0.3", 0, "opacity")).toBe(".3");
    expect(roundNumericValueFixed("0.31", 0, "opacity")).toBe(".3");
    expect(roundNumericValueFixed("0.05", 0, "opacity")).toBe(".1");
    expect(roundNumericValueFixed("0.004", 0, "opacity")).toBe(".004");
    expect(roundNumericValueFixed("0.0003", 0, "opacity")).toBe(".0003");
    expect(roundNumericValueFixed("0.00003", 0, "opacity")).toBe("0");
  });

  it("preserves stroke-width when rounding to 0 decimals", () => {
    expect(roundNumericValueFixed("0.4", 0, "stroke-width")).toBe(".4");
    expect(roundNumericValueFixed("0.002", 0, "stroke-width")).toBe(".002");
  });

  it("preserves width and height when rounding to 0 decimals", () => {
    expect(roundNumericValueFixed("0.25", 0, "width")).toBe(".3");
    expect(roundNumericValueFixed("0.025", 0, "height")).toBe(".03");
  });

  it("still rounds normal attributes (like coordinates) to 0", () => {
    expect(roundNumericValueFixed("0.3", 0, "x")).toBe("0");
    expect(roundNumericValueFixed("0.3", 0)).toBe("0");
  });
});

describe("collapseTransforms", () => {
  it("keeps transforms when userSpaceOnUse gradients are referenced", () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      '<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">' +
      '<stop offset="0" stop-color="#000"/>' +
      '<stop offset="1" stop-color="#fff"/>' +
      "</linearGradient>" +
      "</defs>" +
      '<path fill="url(#g)" d="M0 0h10v10z" transform="translate(5 5)"/>' +
      "</svg>";
    const output = collapseTransforms(input);
    expect(output).toContain('transform="translate(5 5)"');
  });

  it("follows gradient hrefs when deciding to keep transforms", () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      '<linearGradient id="base" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">' +
      '<stop offset="0" stop-color="#000"/>' +
      '<stop offset="1" stop-color="#fff"/>' +
      "</linearGradient>" +
      '<linearGradient id="ref" href="#base"/>' +
      "</defs>" +
      '<path fill="url(#ref)" d="M0 0h10v10z" transform="translate(5 5)"/>' +
      "</svg>";
    const output = collapseTransforms(input);
    expect(output).toContain('transform="translate(5 5)"');
  });
});
