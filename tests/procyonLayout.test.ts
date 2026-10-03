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
    expect(root.querySelector(".action-button.file-button")).toBeNull();
    expect(root.querySelector("#file-input")).toBeNull();

    root.querySelector<HTMLButtonElement>(".menu-toggle")?.click();
    m.render(root, m(App));
    expect(root.querySelector(".sidebar")?.classList.contains("open")).toBe(true);
    expect(root.querySelector(".action-button.file-button")).toBeNull();
    expect(root.querySelector('[title="Save SVG to Procyon"]')).not.toBeNull();
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
    expect(root.querySelector(".action-button.file-button")).not.toBeNull();
    expect(root.querySelector('[title="Download optimized SVG"]')).not.toBeNull();
    expect(root.querySelector('[title="Save SVG to Procyon"]')).toBeNull();
  });
});
