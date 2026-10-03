// @vitest-environment jsdom
import m from "mithril";
import { afterEach, expect, it, vi } from "vitest";

const root = document.createElement("div");

afterEach(() => {
  m.render(root, null);
  root.remove();
  localStorage.clear();
  document.body.className = "";
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("starts in Tree despite a previous Code preference, then switches in the sidebar", async () => {
  localStorage.setItem("svgo-state-v1", JSON.stringify({
    sourceSvg: "",
    options: { viewMode: "code" },
  }));
  vi.resetModules();
  const { optimizer } = await import("../src/optimizer");
  const { EditorPanel } = await import("../src/components/editorPanel");
  const { Sidebar } = await import("../src/components/sidebar");
  optimizer.loadSvgString('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');

  expect(optimizer.options.viewMode).toBe("tree");
  document.body.append(root);
  const render = () => m.render(root, [
    m(Sidebar, {
      optimizer, sourceSvg: optimizer.getSourceSvg(), theme: "dark",
      onToggleTheme: () => {}, open: true, showFileActions: true, showDownload: true,
    }),
    m(EditorPanel, { sourceSvg: optimizer.getSourceSvg() }),
  ]);
  render();
  expect(root.querySelector(".editor-actions")).toBeNull();
  expect(root.querySelector(".tree-layout.inspector-collapsed")).not.toBeNull();
  expect(root.querySelector(".properties-inspector")).toBeNull();
  const buttons = root.querySelectorAll<HTMLButtonElement>(".view-actions button");
  expect([...buttons].map((button) => button.textContent)).toEqual(["Tree", "Code"]);
  expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
  root.querySelector<HTMLButtonElement>(".inspector-toggle")!.click();
  render();
  expect(root.querySelector(".properties-inspector")).not.toBeNull();
  buttons[1].click();
  render();
  expect(optimizer.options.viewMode).toBe("code");
  expect(root.querySelector(".tree-view")).toBeNull();
  expect(root.querySelector(".editor-loading")).not.toBeNull();
  optimizer.editorReady = true;
  render();
  expect(root.querySelector("#editor.editor-hidden")).toBeNull();
  expect(root.querySelector("#editor")).not.toBeNull();
  buttons[0].click();
  render();
  expect(root.querySelector(".tree-view")).not.toBeNull();
});

it("follows the app theme until the preview background is explicitly selected", async () => {
  vi.useFakeTimers();
  vi.resetModules();
  const { optimizer } = await import("../src/optimizer");
  vi.spyOn(optimizer, "initializeEditor").mockResolvedValue();
  const { App } = await import("../src/ui");
  optimizer.loadSvgString('<svg xmlns="http://www.w3.org/2000/svg"><rect width="8" height="8"/></svg>');
  document.body.append(root);
  const render = () => m.render(root, m(App));
  const background = () => root.querySelector(".preview-container")!.getAttribute("data-preview-background");
  render();
  expect(background()).toBe("dark");
  const themeButton = () => root.querySelector<HTMLButtonElement>('button[title="Toggle theme"]')!;
  themeButton().click();
  render();
  expect(background()).toBe("light");
  const selector = root.querySelector<HTMLSelectElement>(".preview-background-control select")!;
  expect([...selector.options].map((option) => option.text)).toEqual(["Light", "Dark", "Checkerboard"]);
  selector.value = "checkerboard";
  selector.dispatchEvent(new Event("change", { bubbles: true }));
  render();
  expect(background()).toBe("checkerboard");
  themeButton().click();
  render();
  expect(background()).toBe("checkerboard");
  expect(optimizer.getSourceSvg()).not.toContain("checkerboard");
  expect(optimizer.getPreviewSvg()).not.toContain("checkerboard");
});

it("uses the resolved system theme for Auto until a manual background override", async () => {
  vi.useFakeTimers();
  localStorage.setItem("svgo-theme", "auto");
  let onThemeChange: (() => void) | undefined;
  let systemDark = false;
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    get matches() { return systemDark; },
    addEventListener: (_type: string, callback: () => void) => { onThemeChange = callback; },
  })));
  vi.resetModules();
  const { optimizer } = await import("../src/optimizer");
  vi.spyOn(optimizer, "initializeEditor").mockResolvedValue();
  const { App } = await import("../src/ui");
  optimizer.loadSvgString('<svg xmlns="http://www.w3.org/2000/svg"><rect width="8" height="8"/></svg>');
  document.body.append(root);
  const render = () => m.render(root, m(App));
  const background = () => root.querySelector(".preview-container")!.getAttribute("data-preview-background");
  render();
  expect(background()).toBe("light");
  systemDark = true;
  onThemeChange?.();
  render();
  expect(background()).toBe("dark");
  const selector = root.querySelector<HTMLSelectElement>(".preview-background-control select")!;
  selector.value = "light";
  selector.dispatchEvent(new Event("change", { bubbles: true }));
  render();
  systemDark = false;
  onThemeChange?.();
  render();
  expect(background()).toBe("light");
  systemDark = true;
  onThemeChange?.();
  render();
  expect(background()).toBe("light");
});
