// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { SVGOptimizer } from "../src/optimizer";

describe("xlink href handling", () => {
  it("adds href alongside xlink:href", () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
      "<defs>" +
      '<linearGradient id="prefix__a"><stop offset="0" stop-color="#0297ff"/></linearGradient>' +
      '<linearGradient id="prefix__c" xlink:href="#prefix__a"/>' +
      "</defs>" +
      "</svg>";
    const optimizer = new SVGOptimizer();
    const converted = optimizer.convertXlinkHrefs(input);
    const cleaned = optimizer.removeUnusedXlinkNamespace(converted);

    expect(cleaned).toContain('href="#prefix__a"');
    expect(cleaned).toContain("xlink:href");
  });

  it("adds xmlns:xlink when missing", () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      '<linearGradient id="prefix__a"><stop offset="0" stop-color="#0297ff"/></linearGradient>' +
      '<linearGradient id="prefix__c" xlink:href="#prefix__a"/>' +
      "</defs>" +
      "</svg>";
    const optimizer = new SVGOptimizer();
    const normalized = optimizer.normalizeNamespaces(input);

    expect(normalized).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    expect(normalized).toContain('href="#prefix__a"');
    expect(normalized).toContain("xlink:href");
  });
});
