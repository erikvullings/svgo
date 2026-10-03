// @vitest-environment jsdom
import m from "mithril";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SVGOptimizer } from "../src/optimizer";
import { Sidebar } from "../src/components/sidebar";

describe("Procyon host adapter", () => {
  const postMessage = vi.fn();
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10"/></svg>';

  beforeEach(() => {
    vi.resetModules();
    postMessage.mockReset();
    window.procyonPlugin = { loadToken: "test-window-token", postMessage };
    document.body.replaceChildren();
  });

  it("accepts only same-window loads with the matching token and valid payload", async () => {
    const { loadProcyonSvg } = await import("../src/procyon");
    const optimizer = new SVGOptimizer();
    const dispatch = (data: unknown, source: MessageEventSource | null = window) =>
      loadProcyonSvg(new MessageEvent("message", { data, source }), optimizer);

    dispatch({ type: "load-svg", svg, uri: "file:///image.svg", loadToken: "test-window-token" }, null);
    dispatch({ type: "load-svg", svg, uri: "file:///image.svg", loadToken: "wrong" });
    dispatch({ type: "load-svg", svg, uri: "file:///image.svg" });
    dispatch({ type: "load-svg", svg: 1, uri: "file:///image.svg", loadToken: "test-window-token" });
    expect(optimizer.getSourceSvg()).toBe("");

    dispatch({ type: "load-svg", svg, uri: "file:///image.svg", loadToken: "test-window-token" });
    expect(optimizer.getSourceSvg()).toBe(svg);
    expect(postMessage).not.toHaveBeenCalled();

    optimizer.loadSvgString('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("sends the current source exactly once per explicit save and never the preview", async () => {
    const { loadProcyonSvg, saveProcyonSvg } = await import("../src/procyon");
    const optimizer = new SVGOptimizer();
    saveProcyonSvg(optimizer);
    expect(postMessage).not.toHaveBeenCalled();

    optimizer.loadSvgString(svg);
    saveProcyonSvg(optimizer);
    expect(postMessage).not.toHaveBeenCalled();
    loadProcyonSvg(new MessageEvent("message", {
      data: { type: "load-svg", svg, uri: "file:///image.svg", loadToken: "test-window-token" },
      source: window,
    }), optimizer);
    optimizer.optimizedSvg = "<svg/>";
    saveProcyonSvg(optimizer);
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: "save-svg", svg });
  });

  it("shows Save only when offered by the host and wires the action", async () => {
    const { canSaveProcyonSvg, loadProcyonSvg, saveProcyonSvg } = await import("../src/procyon");
    const optimizer = new SVGOptimizer();
    const attrs = {
      optimizer,
      sourceSvg: svg,
      theme: "dark" as const,
      onToggleTheme: () => {},
      open: true,
      showFileActions: false,
      showDownload: false,
      onSave: () => saveProcyonSvg(optimizer),
      canSave: canSaveProcyonSvg(optimizer),
    };
    m.render(document.body, m(Sidebar, attrs));
    expect(document.querySelector('button[title="Download optimized SVG"]')).toBeNull();
    let save = document.querySelector<HTMLButtonElement>('button[title="Save SVG to Procyon"]');
    expect(save?.disabled).toBe(true);
    loadProcyonSvg(new MessageEvent("message", {
      data: { type: "load-svg", svg, uri: "file:///image.svg", loadToken: "test-window-token" },
      source: window,
    }), optimizer);
    m.render(document.body, m(Sidebar, { ...attrs, canSave: canSaveProcyonSvg(optimizer) }));
    save = document.querySelector<HTMLButtonElement>('button[title="Save SVG to Procyon"]');
    expect(save?.disabled).toBe(false);
    save?.click();
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: "save-svg", svg });

    m.render(document.body, m(Sidebar, { ...attrs, onSave: undefined, showDownload: true }));
    expect(document.querySelector('button[title="Save SVG to Procyon"]')).toBeNull();
    expect(document.querySelector('button[title="Download optimized SVG"]')).not.toBeNull();
  });

  it("handles Cmd/Ctrl+S even while the code editor or an input is focused", async () => {
    const { optimizer } = await import("../src/optimizer");
    const { loadProcyonSvg } = await import("../src/procyon");
    const { initializeGlobalHandlers } = await import("../src/ui");
    initializeGlobalHandlers();

    const editor = document.createElement("div");
    editor.id = "editor";
    document.body.append(editor);
    editor.dispatchEvent(new KeyboardEvent("keydown", {
      key: "s", metaKey: true, bubbles: true, cancelable: true,
    }));
    expect(postMessage).not.toHaveBeenCalled();
    loadProcyonSvg(new MessageEvent("message", {
      data: { type: "load-svg", svg, uri: "file:///image.svg", loadToken: "test-window-token" },
      source: window,
    }), optimizer);
    editor.dispatchEvent(new KeyboardEvent("keydown", {
      key: "s", metaKey: true, bubbles: true, cancelable: true,
    }));
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: "save-svg", svg });

    const input = document.createElement("input");
    document.body.append(input);
    const shortcut = new KeyboardEvent("keydown", {
      key: "s", ctrlKey: true, bubbles: true, cancelable: true,
    });
    input.dispatchEvent(shortcut);
    expect(shortcut.defaultPrevented).toBe(true);
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it("preserves automatic VS Code updates without the Procyon bridge", async () => {
    delete window.procyonPlugin;
    const vscodePostMessage = vi.fn();
    vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage: vscodePostMessage }));
    vi.resetModules();
    try {
      const { SVGOptimizer: VscodeOptimizer } = await import("../src/optimizer");
      const optimizer = new VscodeOptimizer();
      vscodePostMessage.mockClear();
      optimizer.loadSvgString(svg);
      expect(vscodePostMessage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        type: "update-svg",
        svg,
      }));
      expect(postMessage).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
