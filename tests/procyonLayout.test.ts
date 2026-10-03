// @vitest-environment jsdom
import m from "mithril";
import { afterEach, describe, expect, it, vi } from "vitest";

const root = document.createElement("div");

afterEach(() => {
  m.render(root, null);
  root.remove();
  delete window.procyonPlugin;
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("host-specific starting layout", () => {
  it("opens Procyon in Tree mode with a closed sidebar and equal-width side-by-side preview", async () => {
    vi.useFakeTimers();
    localStorage.setItem("svgo-sidebar-open", "true");
    localStorage.setItem("svgo-splitter-percent", "75");
    localStorage.setItem("svgo-splitter-orientation", "vertical");
    window.procyonPlugin = { loadToken: "layout-test", postMessage: vi.fn() };
    vi.resetModules();
    const { optimizer } = await import("../src/optimizer");
    const { App } = await import("../src/ui");
    vi.spyOn(optimizer, "initializeEditor").mockResolvedValue();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 1000, height: 800, left: 0, top: 0,
    } as DOMRect);

    document.body.append(root);
    m.render(root, m(App));

    expect(optimizer.options.viewMode).toBe("tree");
    expect(root.querySelector(".tree-view")).not.toBeNull();
    expect(root.querySelector(".sidebar")?.classList.contains("collapsed")).toBe(true);
    expect(root.querySelector(".main-content")?.classList.contains("is-horizontal")).toBe(true);
    const leftPercent = Number.parseFloat(root.querySelector<HTMLElement>("#left-panel")!.style.flexBasis);
    const rightPercent = Number.parseFloat(root.querySelector<HTMLElement>("#right-panel")!.style.flexBasis);
    expect(leftPercent).toBeCloseTo(rightPercent);
    expect(leftPercent + rightPercent + 0.6).toBeCloseTo(100);
    expect(root.querySelector(".header .title")).toBeNull();
    expect(root.querySelector(".header [title='Save SVG to Procyon']")).not.toBeNull();
    expect(root.querySelector(".header [title='Copy source SVG to clipboard']")).toBeNull();
    expect(root.querySelector(".action-button.file-button")).toBeNull();
    expect(root.querySelector("#file-input")).toBeNull();

    root.querySelector<HTMLButtonElement>(".menu-toggle")?.click();
    m.render(root, m(App));
    expect(root.querySelector(".sidebar")?.classList.contains("open")).toBe(true);
    expect(root.querySelector(".action-button.file-button")).toBeNull();
    expect(root.querySelector(".sidebar [title='Copy source SVG to clipboard']")).not.toBeNull();
    expect(root.querySelector(".sidebar [title='Save SVG to Procyon']")).toBeNull();
    expect(root.querySelector('[title="Download optimized SVG"]')).toBeNull();
  });

  it("preserves the standalone defaults and Open/Download actions", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const { optimizer } = await import("../src/optimizer");
    const { App } = await import("../src/ui");
    vi.spyOn(optimizer, "initializeEditor").mockResolvedValue();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 1000, height: 800, left: 0, top: 0,
    } as DOMRect);

    document.body.append(root);
    m.render(root, m(App));

    expect(optimizer.options.viewMode).toBe("code");
    expect(root.querySelector(".sidebar")?.classList.contains("open")).toBe(true);
    expect(root.querySelector(".main-content")?.classList.contains("is-vertical")).toBe(true);
    expect(root.querySelector(".header .title")?.textContent).toContain("Advanced SVG Optimizer");
    expect(root.querySelector(".header [title='Copy source SVG to clipboard']")).not.toBeNull();
    expect(root.querySelector(".action-button.file-button")).not.toBeNull();
    expect(root.querySelector('[title="Download optimized SVG"]')).not.toBeNull();
    expect(root.querySelector('[title="Save SVG to Procyon"]')).toBeNull();
  });

  it("retains Procyon preferences without storing or restoring SVG content or layout", async () => {
    vi.useFakeTimers();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';
    localStorage.setItem("svgo-state-v1", JSON.stringify({
      sourceSvg: '<svg xmlns="http://www.w3.org/2000/svg"><text>old document</text></svg>',
      options: { precision: 0, viewMode: "code" },
    }));
    localStorage.setItem("svgo-theme", "dark");
    localStorage.setItem("svgo-sidebar-open", "true");
    localStorage.setItem("svgo-splitter-percent", "75");
    localStorage.setItem("svgo-splitter-orientation", "vertical");
    window.procyonPlugin = { loadToken: "settings-test", theme: "light", postMessage: vi.fn() };
    vi.resetModules();
    const { SVGOptimizer } = await import("../src/optimizer");
    vi.spyOn(SVGOptimizer.prototype, "canUseLocalStorage").mockReturnValue(true);
    const first = new SVGOptimizer();
    expect(first.getSourceSvg()).toBe("");
    expect(first.options.precision).toBe(1);
    first.loadSvgString(svg);
    first.options.precision = 5;
    first.options.pathPrecision = 4;
    first.options.removeStyling = false;
    first.options.groupSimilarElements = false;
    first.options.customWidth = 320;
    first.options.useCustomDimensions = true;
    first.options.viewMode = "code";
    first.persistSessionState();

    const saved = localStorage.getItem("svgo-procyon-settings-v1");
    expect(saved).not.toBeNull();
    expect(saved).not.toContain("svg");
    expect(saved).not.toContain("viewMode");
    expect(JSON.parse(saved!)).toMatchObject({
      precision: 5, pathPrecision: 4, removeStyling: false,
      groupSimilarElements: false, customWidth: 320, useCustomDimensions: true,
    });
    expect(JSON.parse(localStorage.getItem("svgo-state-v1")!)).toMatchObject({
      options: { precision: 0 }, sourceSvg: expect.stringContaining("old document"),
    });

    const reopened = new SVGOptimizer();
    expect(reopened.getSourceSvg()).toBe("");
    expect(reopened.optimizedSvg).toBe("");
    expect(reopened.options).toMatchObject({
      precision: 5, pathPrecision: 4, removeStyling: false,
      groupSimilarElements: false, customWidth: 320, useCustomDimensions: true,
      viewMode: "tree",
    });
    const { optimizer } = await import("../src/optimizer");
    const { App } = await import("../src/ui");
    vi.spyOn(optimizer, "initializeEditor").mockResolvedValue();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 1000, height: 800, left: 0, top: 0,
    } as DOMRect);
    document.body.append(root);
    m.render(root, m(App));
    expect(document.body.classList.contains("theme-light")).toBe(true);
    expect(root.querySelector('[title="Toggle theme"]')).toBeNull();
    expect(localStorage.getItem("svgo-theme")).toBe("dark");
    expect(root.querySelector(".sidebar")?.classList.contains("collapsed")).toBe(true);
    expect(root.querySelector(".main-content")?.classList.contains("is-horizontal")).toBe(true);
    const left = Number.parseFloat(root.querySelector<HTMLElement>("#left-panel")!.style.flexBasis);
    const right = Number.parseFloat(root.querySelector<HTMLElement>("#right-panel")!.style.flexBasis);
    expect(left).toBeCloseTo(right);
    root.querySelector<HTMLButtonElement>(".menu-toggle")?.click();
    expect(localStorage.getItem("svgo-sidebar-open")).toBe("true");
  });

  it("keeps standalone SVG and option restoration unchanged", async () => {
    vi.resetModules();
    const { SVGOptimizer } = await import("../src/optimizer");
    vi.spyOn(SVGOptimizer.prototype, "canUseLocalStorage").mockReturnValue(true);
    const first = new SVGOptimizer();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10"/></svg>';
    first.loadSvgString(svg);
    first.options.precision = 4;
    first.options.viewMode = "tree";
    first.persistSessionState();

    expect(JSON.parse(localStorage.getItem("svgo-state-v1")!)).toMatchObject({
      sourceSvg: svg, options: { precision: 4, viewMode: "tree" },
    });
    expect(localStorage.getItem("svgo-procyon-settings-v1")).toBeNull();
    const reopened = new SVGOptimizer();
    expect(reopened.getSourceSvg()).toBe(svg);
    expect(reopened.options.precision).toBe(4);
    expect(reopened.options.viewMode).toBe("tree");
  });
});
