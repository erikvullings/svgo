// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
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

describe("fixInvalidHexColors", () => {
  it("collapses out-of-range hex digits to f on import", () => {
    const optimizer = new SVGOptimizer();
    expect(optimizer.fixInvalidHexColors('<path fill="#pf5ccc"/>')).toBe(
      '<path fill="#ff5ccc"/>',
    );
  });

  it("preserves casing when clamping", () => {
    const optimizer = new SVGOptimizer();
    expect(optimizer.fixInvalidHexColors('<stop stop-color="#G0Z"/>')).toBe(
      '<stop stop-color="#F0F"/>',
    );
  });

  it("fixes colours inside style attributes and css", () => {
    const optimizer = new SVGOptimizer();
    expect(
      optimizer.fixInvalidHexColors('<rect style="fill:#pf5ccc;stroke:#0g0"/>'),
    ).toBe('<rect style="fill:#ff5ccc;stroke:#0f0"/>');
  });

  it("leaves id references and valid colours untouched", () => {
    const optimizer = new SVGOptimizer();
    const input =
      '<path fill="#0297ff" marker-end="url(#p)" clip-path="url(#gradient)"/>';
    expect(optimizer.fixInvalidHexColors(input)).toBe(input);
  });
});

describe("removeDefaultValues", () => {
  it("removes overflow, enable-background, and xml:space defaults", () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 192" overflow="visible" enable-background="new 0 0 300 192" xml:space="preserve">' +
      '<path d="M0 0h10v10z"/>' +
      "</svg>";
    const optimizer = new SVGOptimizer();
    const output = optimizer.removeDefaultValues(input);
    expect(output).not.toContain('overflow="visible"');
    expect(output).not.toContain("enable-background");
    expect(output).not.toContain('xml:space="preserve"');
  });

  it("removes namespaced Illustrator metadata attrs and unused xmlns", () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:ns2="http://ns.adobe.com/AdobeIllustrator/10.0/" ns2:viewOrigin="0 0" ns2:rulerOrigin="0 0" ns2:pageBounds="0 360 360 0">' +
      '<path d="M0 0h10v10z"/>' +
      "</svg>";
    const optimizer = new SVGOptimizer();
    const output = optimizer.removeDefaultValues(input);
    expect(output).not.toContain("ns2:viewOrigin");
    expect(output).not.toContain("ns2:rulerOrigin");
    expect(output).not.toContain("ns2:pageBounds");
    expect(output).not.toContain("xmlns:ns2");
  });
});

describe("optimizeSvg", () => {
  it("removes ns2 namespace after optimization", async () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:ns2="http://ns.adobe.com/AdobeIllustrator/10.0/" ns2:viewOrigin="0 0" ns2:rulerOrigin="0 0" ns2:pageBounds="0 360 360 0">' +
      '<path d="M0 0h10v10z"/>' +
      "</svg>";
    const optimizer = new SVGOptimizer();
    optimizer.originalSvg = input;
    optimizer.options.removeDefaultValues = true;
    await optimizer.optimizeSvg();
    const output = optimizer.optimizedSvg;
    expect(output).not.toContain("xmlns:ns2");
    expect(output).not.toContain("ns2:viewOrigin");
    expect(output).not.toContain("ns2:rulerOrigin");
    expect(output).not.toContain("ns2:pageBounds");
    expect(output).not.toContain("parsererror");
    expect(output).toContain('<path d="M0 0h10v10z"/>');
  });
  it("removes ns2 namespace without namespace declaration after optimization", async () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg" ns2:viewOrigin="0 0" ns2:rulerOrigin="0 0" ns2:pageBounds="0 360 360 0">' +
      '<path d="M0 0h10v10z"/>' +
      "</svg>";
    const optimizer = new SVGOptimizer();
    optimizer.originalSvg = input;
    optimizer.options.removeDefaultValues = true;
    await optimizer.optimizeSvg();
    const output = optimizer.optimizedSvg;
    expect(output).not.toContain("xmlns:ns2");
    expect(output).not.toContain("ns2");
    expect(output).not.toContain("ns2:viewOrigin");
    expect(output).not.toContain("ns2:rulerOrigin");
    expect(output).not.toContain("ns2:pageBounds");
    expect(output).not.toContain("parsererror");
    expect(output).toContain('<path d="M0 0h10v10z"/>');
  });

  it("removes overflow and enable-background after optimization", async () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120.7 120.7" overflow="visible" enable-background="new 0 0 300 192">' +
      '<path d="M0 0h10v10z"/>' +
      "</svg>";
    const optimizer = new SVGOptimizer();
    optimizer.originalSvg = input;
    optimizer.options.removeDefaultValues = true;
    await optimizer.optimizeSvg();
    const output = optimizer.optimizedSvg;
    expect(output).not.toContain('overflow="visible"');
    expect(output).not.toContain("enable-background");
    expect(output).not.toContain("parsererror");
  });

  it("preserves non-zero opacity and stroke-width at 0 precision", async () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="10.4" cy="20.5" r="5.2" stroke="red" opacity="0.3" stroke-width="0.4" stop-opacity="0.25"/>' +
      "</svg>";
    const optimizer = new SVGOptimizer();
    optimizer.originalSvg = input;
    optimizer.options.precision = 0;
    optimizer.options.pathPrecision = 0;
    await optimizer.optimizeSvg();
    const output = optimizer.optimizedSvg;

    expect(output).toContain('cx="10"');
    expect(output).toContain('cy="21"');
    expect(output).toContain('opacity=".3"');
    expect(output).toContain('stroke-width=".4"');
    expect(output).toContain('stop-opacity=".3"');
    expect(output).toContain('r="5"');
  });

  it("preserves marker arrowheads for arrows example", async () => {
    const input = readFileSync("tests/examples/arrows.svg", "utf8");
    const optimizer = new SVGOptimizer();
    optimizer.originalSvg = input;
    await optimizer.optimizeSvg();
    const output = optimizer.optimizedSvg;

    expect(output).toContain("<marker");
    expect(output).toContain('overflow="visible"');
    expect(output).toContain('marker-end="url(#');
    expect(output).not.toContain('marker-end="url(#i)"');
    const markerIds = Array.from(
      output.matchAll(/<marker\b[^>]*\bid="([^"]+)"/g),
    ).map((match) => match[1]);
    const markerIdSet = new Set(markerIds);
    const markerRefs = Array.from(
      output.matchAll(/marker-end="url\(#([^"]+)\)"/g),
    ).map((match) => match[1]);
    expect(markerRefs.length).toBeGreaterThan(0);
    expect(markerRefs.every((id) => markerIdSet.has(id))).toBe(true);
    expect(output).not.toContain("parsererror");
  });

  it("preserves marker arrowheads when re-optimizing already-optimized SVG", async () => {
    const input = readFileSync("tests/examples/measurements.svg", "utf8");
    const optimizer = new SVGOptimizer();
    optimizer.originalSvg = input;
    await optimizer.optimizeSvg();
    const firstPass = optimizer.optimizedSvg;

    // Second pass: re-optimize the already-optimized output
    optimizer.originalSvg = firstPass;
    await optimizer.optimizeSvg();
    const secondPass = optimizer.optimizedSvg;

    // All paths that carry marker refs must still be separate (not merged)
    const markerPaths = Array.from(
      secondPass.matchAll(/marker-end="url\(#([^"]+)\)"/g),
    );
    expect(markerPaths.length).toBeGreaterThan(0);

    // No merged multi-subpath (space-separated M commands) on a marker-bearing path
    const mergedMarkerPath =
      /<path\b[^>]*marker-(?:start|end)="[^"]*"[^>]*\bd="[^"]*M[^"]*M/;
    expect(secondPass).not.toMatch(mergedMarkerPath);
  });
});
