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
  it("opens Procyon in Tree mode with a closed sidebar and equal-height top/bottom preview", async () => {
    vi.useFakeTimers();
    localStorage.setItem("svgo-sidebar-open", "true");
    localStorage.setItem("svgo-splitter-percent", "75");
    localStorage.setItem("svgo-splitter-orientation", "horizontal");
    window.procyonPlugin = { loadToken: "layout-test", postMessage: vi.fn() };
    vi.resetModules();
    const { optimizer } = await import("../src/optimizer");
    const { App } = await import("../src/ui");
    vi.spyOn(optimizer, "initializeEditor").mockResolvedValue();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 1000, height: 800, left: 0, top: 0,
    } as DOMRect);

    optimizer.loadSvgString('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10"/></svg>');
    document.body.append(root);
    m.render(root, m(App));

    expect(document.body.classList.contains("theme-procyon")).toBe(true);
    expect(optimizer.options.viewMode).toBe("tree");
    expect(root.querySelector(".tree-view")).not.toBeNull();
    expect(root.querySelector(".editor-panel .panel-header")).toBeNull();
    expect(root.querySelector(".tree-layout.inspector-collapsed")).not.toBeNull();
    expect(root.querySelector(".properties-inspector")).toBeNull();
    const propertiesToggle = root.querySelector<HTMLButtonElement>(".inspector-toggle");
    expect(propertiesToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(root.querySelector(".sidebar")?.classList.contains("collapsed")).toBe(true);
    expect(root.querySelector(".main-content")?.classList.contains("is-vertical")).toBe(true);
    expect(root.querySelector(".main-content")?.firstElementChild?.id).toBe("left-panel");
    expect(root.querySelector("#right-panel")?.previousElementSibling?.id).toBe("dragbar");
    const leftPercent = Number.parseFloat(root.querySelector<HTMLElement>("#left-panel")!.style.flexBasis);
    const rightPercent = Number.parseFloat(root.querySelector<HTMLElement>("#right-panel")!.style.flexBasis);
    expect(leftPercent).toBeCloseTo(rightPercent);
    expect(leftPercent + rightPercent + (6 / 800) * 100).toBeCloseTo(100);
    expect(root.querySelector(".header .title")).toBeNull();
    expect(root.querySelector(".header [title='Save SVG to Procyon']")).not.toBeNull();
    expect(root.querySelector(".header [title='Copy source SVG to clipboard']")).toBeNull();
    expect(root.querySelector(".action-button.file-button")).toBeNull();
    expect(root.querySelector("#file-input")).toBeNull();

    propertiesToggle?.click();
    m.render(root, m(App));
    expect(root.querySelector(".properties-inspector")).not.toBeNull();
    expect(root.querySelector('[title="Hide properties"]')?.getAttribute("aria-expanded")).toBe("true");
    root.querySelector<HTMLButtonElement>('[title="Hide properties"]')?.click();
    m.render(root, m(App));
    expect(root.querySelector(".tree-layout.inspector-collapsed")).not.toBeNull();

    root.querySelector<HTMLButtonElement>(".menu-toggle")?.click();
    m.render(root, m(App));
    expect(root.querySelector(".sidebar")?.classList.contains("open")).toBe(true);
    expect(root.querySelector(".sidebar [title='Tree view']")?.getAttribute("aria-pressed")).toBe("true");
    expect(root.querySelector(".sidebar [title='Code view']")?.getAttribute("aria-pressed")).toBe("false");
    expect(root.querySelector(".action-button.file-button")).toBeNull();
    expect(root.querySelector(".sidebar [title='Copy source SVG to clipboard']")).not.toBeNull();
    expect(root.querySelector(".sidebar [title='Save SVG to Procyon']")).toBeNull();
    expect(root.querySelector('[title="Download optimized SVG"]')).toBeNull();

    optimizer.optimizedSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
    m.render(root, m(App));
    const splitToggle = root.querySelector<HTMLButtonElement>('[title="Switch to horizontal split"]');
    expect(splitToggle).not.toBeNull();
    splitToggle!.click();
    m.render(root, m(App));
    expect(root.querySelector(".main-content")?.classList.contains("is-horizontal")).toBe(true);
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

    optimizer.loadSvgString('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10"/></svg>');
    document.body.append(root);
    m.render(root, m(App));

    expect(document.body.classList.contains("theme-procyon")).toBe(false);
    expect(optimizer.options.viewMode).toBe("code");
    expect(root.querySelector(".sidebar")?.classList.contains("open")).toBe(true);
    expect(root.querySelector(".main-content")?.classList.contains("is-vertical")).toBe(true);
    expect(root.querySelector(".header .title")?.textContent).toContain("Advanced SVG Optimizer");
    expect(root.querySelector(".editor-panel .panel-header")?.textContent).toContain("Source SVG");
    root.querySelectorAll<HTMLButtonElement>(".editor-actions .view-toggle")[1]?.click();
    m.render(root, m(App));
    expect(root.querySelector(".properties-inspector")).not.toBeNull();
    expect(root.querySelector(".inspector-toggle")).toBeNull();
    expect(root.querySelector(".header [title='Copy source SVG to clipboard']")).not.toBeNull();
    expect(root.querySelector(".action-button.file-button")).not.toBeNull();
    expect(root.querySelector('[title="Download optimized SVG"]')).not.toBeNull();
    expect(root.querySelector('[title="Save SVG to Procyon"]')).toBeNull();
  });

  it("retains host-provided preferences without storing SVG content or layout", async () => {
    vi.useFakeTimers();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';
    localStorage.setItem("svgo-state-v1", JSON.stringify({
      sourceSvg: '<svg xmlns="http://www.w3.org/2000/svg"><text>old document</text></svg>',
      options: { precision: 0, viewMode: "code" },
    }));
    localStorage.setItem("svgo-theme", "dark");
    localStorage.setItem("svgo-sidebar-open", "true");
    localStorage.setItem("svgo-splitter-percent", "75");
    localStorage.setItem("svgo-splitter-orientation", "horizontal");
    const postMessage = vi.fn();
    const injectedSettings = {
      precision: 3, pathPrecision: 4, removeStyling: false,
      groupSimilarElements: false, customWidth: 320, useCustomDimensions: true,
      viewMode: "code", sourceSvg: svg,
    };
    window.procyonPlugin = {
      loadToken: "settings-test",
      theme: "light",
      settings: injectedSettings,
      postMessage,
    };
    vi.resetModules();
    const { SVGOptimizer } = await import("../src/optimizer");
    vi.spyOn(SVGOptimizer.prototype, "canUseLocalStorage").mockReturnValue(false);
    const first = new SVGOptimizer();
    expect(first.getSourceSvg()).toBe("");
    expect(first.options).toMatchObject({
      precision: 3, pathPrecision: 4, removeStyling: false,
      groupSimilarElements: false, customWidth: 320, useCustomDimensions: true,
      viewMode: "tree",
    });
    expect(postMessage).not.toHaveBeenCalled();
    first.loadSvgString(svg);
    expect(postMessage).not.toHaveBeenCalled();
    first.options.precision = 5;
    first.options.viewMode = "code";
    first.persistSessionState();

    expect(postMessage).toHaveBeenCalledTimes(1);
    const sent = postMessage.mock.calls[0][0];
    expect(sent).toMatchObject({
      type: "settings-change",
      settings: {
        precision: 5, pathPrecision: 4, removeStyling: false,
        groupSimilarElements: false, customWidth: 320, useCustomDimensions: true,
      },
    });
    expect(Object.keys(sent.settings)).toHaveLength(15);
    expect(JSON.stringify(sent)).not.toContain("svg");
    expect(JSON.stringify(sent)).not.toContain("viewMode");
    first.persistSessionState();
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("svgo-procyon-settings-v1")).toBeNull();
    expect(JSON.parse(localStorage.getItem("svgo-state-v1")!)).toMatchObject({
      options: { precision: 0 }, sourceSvg: expect.stringContaining("old document"),
    });

    window.procyonPlugin!.settings = sent.settings;
    const reopened = new SVGOptimizer();
    expect(reopened.getSourceSvg()).toBe("");
    expect(reopened.optimizedSvg).toBe("");
    expect(reopened.options).toMatchObject({
      precision: 5, pathPrecision: 4, removeStyling: false,
      groupSimilarElements: false, customWidth: 320, useCustomDimensions: true,
      viewMode: "tree",
    });
    expect(postMessage).toHaveBeenCalledTimes(1);
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
    expect(root.querySelector(".main-content")?.classList.contains("is-vertical")).toBe(true);
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

  it("lays out Monaco after switching a hosted document from Tree to Code", async () => {
    vi.useFakeTimers();
    window.procyonPlugin = { loadToken: "code-layout", postMessage: vi.fn() };
    vi.resetModules();
    const { optimizer } = await import("../src/optimizer");
    const { App } = await import("../src/ui");
    vi.spyOn(optimizer, "initializeEditor").mockResolvedValue();
    const layout = vi.fn();
    optimizer.editor = {
      getValue: () => '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
      setValue: vi.fn(),
      onDidChangeModelContent: vi.fn(),
      layout,
    };
    optimizer.editorReady = true;
    document.body.append(root);
    m.render(root, m(App));
    expect(layout).not.toHaveBeenCalled();
    root.querySelector<HTMLButtonElement>(".menu-toggle")?.click();
    m.render(root, m(App));
    root.querySelector<HTMLButtonElement>('[title="Code view"]')?.click();
    m.render(root, m(App));
    expect(root.querySelector(".sidebar")?.classList.contains("collapsed")).toBe(true);
    expect(root.querySelector("#editor")?.classList.contains("editor-hidden")).toBe(false);
    expect(layout).toHaveBeenCalledOnce();
    root.querySelector<HTMLButtonElement>(".menu-toggle")?.click();
    m.render(root, m(App));
    root.querySelector<HTMLButtonElement>('[title="Tree view"]')?.click();
    m.render(root, m(App));
    expect(root.querySelector("#editor")?.classList.contains("editor-hidden")).toBe(true);
    root.querySelector<HTMLButtonElement>(".menu-toggle")?.click();
    m.render(root, m(App));
    root.querySelector<HTMLButtonElement>('[title="Code view"]')?.click();
    m.render(root, m(App));
    expect(layout).toHaveBeenCalledTimes(2);
  });

  it("does not initialize Monaco in the hidden Procyon Tree view", async () => {
    vi.useFakeTimers();
    window.procyonPlugin = { loadToken: "deferred-editor", postMessage: vi.fn() };
    vi.resetModules();
    const { optimizer } = await import("../src/optimizer");
    const { App } = await import("../src/ui");
    const initializeEditor = vi.spyOn(optimizer, "initializeEditor").mockResolvedValue();
    document.body.append(root);
    m.render(root, m(App));
    vi.runOnlyPendingTimers();
    expect(initializeEditor).not.toHaveBeenCalled();

    root.querySelector<HTMLButtonElement>(".menu-toggle")?.click();
    m.render(root, m(App));
    root.querySelector<HTMLButtonElement>('[title="Code view"]')?.click();
    m.render(root, m(App));
    expect(root.querySelector("#editor")?.classList.contains("editor-hidden")).toBe(false);
    expect(initializeEditor).toHaveBeenCalledOnce();
    m.render(root, m(App));
    expect(initializeEditor).toHaveBeenCalledOnce();
  });
});
