// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  createSvgElementFromTemplate,
  insertSvgElementFromTemplate,
} from "../src/elementTemplates";

function parseSvg(input: string): Document {
  return new DOMParser().parseFromString(input, "image/svg+xml");
}

describe("SVG element templates", () => {
  it("creates visible defaults for primitive elements", () => {
    const doc = parseSvg('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const circle = createSvgElementFromTemplate(doc, "circle");
    const text = createSvgElementFromTemplate(doc, "text");

    expect(circle?.tagName).toBe("circle");
    expect(circle?.getAttribute("cx")).toBe("25");
    expect(circle?.getAttribute("r")).toBe("20");
    expect(circle?.getAttribute("fill")).toBe("#ccc");
    expect(text?.textContent).toBe("Text Content");
    expect(text?.getAttribute("font-size")).toBe("16");
  });

  it("inserts a template as a child of the target element", () => {
    const doc = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><g id="target"></g></svg>',
    );
    const target = doc.querySelector("#target");
    const inserted = insertSvgElementFromTemplate(doc, target, "rect", "child");

    expect(inserted?.tagName).toBe("rect");
    expect(target?.children.length).toBe(1);
    expect(target?.firstElementChild).toBe(inserted);
  });

  it("inserts a template as the next sibling of the target element", () => {
    const doc = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><circle id="a"/><path id="b"/></svg>',
    );
    const target = doc.querySelector("#a");
    const inserted = insertSvgElementFromTemplate(
      doc,
      target,
      "line",
      "sibling",
    );
    const children = Array.from(doc.querySelector("svg")?.children ?? []);

    expect(inserted?.tagName).toBe("line");
    expect(children.map((child) => child.tagName)).toEqual([
      "circle",
      "line",
      "path",
    ]);
  });

  it("returns null for unsupported tag names without changing the document", () => {
    const doc = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><g id="target"></g></svg>',
    );
    const target = doc.querySelector("#target");
    const inserted = insertSvgElementFromTemplate(
      doc,
      target,
      "script",
      "child",
    );

    expect(inserted).toBeNull();
    expect(target?.children.length).toBe(0);
  });
});
