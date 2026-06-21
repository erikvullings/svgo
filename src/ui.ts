import m from "mithril";
import { optimizer, vscodeApi } from "./optimizer";
import { Header } from "./components/header";
import { EditorPanel } from "./components/editorPanel";
import { PreviewPanel } from "./components/previewPanel";
import { Sidebar } from "./components/sidebar";

let svgScale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;

const STORAGE_THEME_KEY = "svgo-theme";
const STORAGE_SIDEBAR_KEY = "svgo-sidebar-open";
const STORAGE_SPLITTER_KEY = "svgo-splitter-percent";
const SPLITTER_MIN_PERCENT = 10;
const SPLITTER_MAX_PERCENT = 90;

function getStoredValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures (private mode / quota / unavailable storage)
  }
}

function clampSplitterPercent(percent: number): number {
  return Math.max(
    SPLITTER_MIN_PERCENT,
    Math.min(SPLITTER_MAX_PERCENT, percent),
  );
}

function readTheme(): "dark" | "light" | "auto" {
  const stored = getStoredValue(STORAGE_THEME_KEY);
  if (stored === "dark" || stored === "light" || stored === "auto") {
    return stored;
  }
  return "dark";
}

function readSidebarOpen(): boolean {
  const stored = getStoredValue(STORAGE_SIDEBAR_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return true;
}

function readSplitterPercent(): number {
  const stored = Number(getStoredValue(STORAGE_SPLITTER_KEY));
  if (!Number.isFinite(stored)) return 50;
  return clampSplitterPercent(stored);
}

let theme: "dark" | "light" | "auto" = readTheme();
let sidebarOpen = readSidebarOpen();
let splitterPercent = readSplitterPercent();
let lastCopiedSvgFingerprint: string | null = null;
let pasteToastMessage = "";
let pasteToastTimer: ReturnType<typeof setTimeout> | null = null;

const showFileActions = true;
const showDownload = true;

function fingerprintSvg(svg: string): string {
  const normalized = svg.trim().replace(/\s+/g, " ");
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return `${normalized.length}:${hash}`;
}

function extractValidSvgFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || !/<svg\b/i.test(trimmed)) return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(trimmed, "image/svg+xml");
  const hasParseError = doc.querySelector("parsererror") !== null;
  const rootSvg = doc.querySelector("svg");
  if (hasParseError || !rootSvg) return null;

  return trimmed;
}

function handleGlobalSvgPaste(event: ClipboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (target?.closest && target.closest("#editor")) return;
  if (["INPUT", "TEXTAREA"].includes(target?.tagName || "")) return;

  const clipboardText = event.clipboardData?.getData("text/plain") || "";
  const svgText = extractValidSvgFromText(
    optimizer.fixInvalidHexColors(clipboardText),
  );
  if (!svgText) return;

  const incomingFingerprint = fingerprintSvg(svgText);
  if (
    lastCopiedSvgFingerprint &&
    incomingFingerprint === lastCopiedSvgFingerprint
  ) {
    return;
  }

  event.preventDefault();
  const shouldReplace = window.confirm(
    "Detected SVG content in clipboard. Replace the current SVG document?",
  );
  if (!shouldReplace) return;

  optimizer.loadSvgString(svgText);
  showPasteToast("SVG replaced from clipboard. Press Cmd/Ctrl+Z to undo.");
}

function showPasteToast(message: string): void {
  pasteToastMessage = message;
  if (pasteToastTimer) {
    clearTimeout(pasteToastTimer);
  }
  pasteToastTimer = setTimeout(() => {
    pasteToastMessage = "";
    pasteToastTimer = null;
    m.redraw();
  }, 2800);
  m.redraw();
}

function resolveTheme(nextTheme: "dark" | "light" | "auto") {
  if (nextTheme === "auto") {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return nextTheme;
}

function applyTheme(nextTheme: "dark" | "light" | "auto") {
  theme = nextTheme;
  const resolved = resolveTheme(theme);
  document.body.classList.toggle("theme-light", resolved === "light");
  setStoredValue(STORAGE_THEME_KEY, theme);
  optimizer.setEditorTheme(resolved);
}

function toggleTheme() {
  const next = theme === "dark" ? "light" : theme === "light" ? "auto" : "dark";
  applyTheme(next);
}

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  setStoredValue(STORAGE_SIDEBAR_KEY, String(sidebarOpen));
}

function applySplitterLayout(
  left: HTMLElement,
  right: HTMLElement,
  percent: number,
  totalHeight: number,
): void {
  const normalizedPercent = clampSplitterPercent(percent);
  const percentSplitter = (6 / totalHeight) * 100;
  left.style.flex = `0 0 ${normalizedPercent}%`;
  right.style.flex = `0 0 ${100 - normalizedPercent - percentSplitter}%`;
}

function applyTransform(): void {
  const svg = document.querySelector(
    ".preview-container svg",
  ) as HTMLElement | null;
  if (svg) {
    svg.style.transform = `translate(${panX}px, ${panY}px) scale(${svgScale})`;
    svg.style.transformOrigin = "0 0";
  }
}

function zoomSvg(factor: number): void {
  svgScale *= factor;
  applyTransform();
}

function resetZoom(): void {
  svgScale = 1;
  panX = 0;
  panY = 0;
  applyTransform();
}

function setupPanEvents(): void {
  const container = document.querySelector(
    ".preview-container",
  ) as HTMLElement | null;
  if (!container) return;

  container.addEventListener("mousedown", (e: MouseEvent) => {
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    container.style.cursor = "grabbing";
  });

  container.addEventListener("mousemove", (e: MouseEvent) => {
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyTransform();
  });

  container.addEventListener("mouseup", () => {
    isPanning = false;
    container.style.cursor = "default";
  });

  container.addEventListener("mouseleave", () => {
    isPanning = false;
    container.style.cursor = "default";
  });

  container.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      svgScale *= delta;
      applyTransform();
    },
    { passive: false },
  );
}

function copyToClipboard(): void {
  const sourceSvg = optimizer.getSourceSvg();
  if (!sourceSvg) {
    alert("No SVG content to copy");
    return;
  }

  navigator.clipboard
    .writeText(sourceSvg)
    .then(() => {
      lastCopiedSvgFingerprint = fingerprintSvg(sourceSvg);
      optimizer.copyStatus = "copied";
      if (optimizer.copyResetTimer) {
        clearTimeout(optimizer.copyResetTimer);
      }
      optimizer.copyResetTimer = setTimeout(() => {
        optimizer.copyStatus = "idle";
        optimizer.copyResetTimer = null;
        m.redraw();
      }, 2000);
      m.redraw();
    })
    .catch((err) => {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard");
    });
}

export const App: m.Component = {
  oncreate() {
    setTimeout(() => {
      optimizer.initializeEditor();
    }, 100);

    applyTheme(theme);

    if (window.matchMedia) {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        if (theme === "auto") applyTheme(theme);
      };
      if (typeof media.addEventListener === "function") {
        media.addEventListener("change", handleChange);
      } else {
        const legacyMedia = media as MediaQueryList & {
          addListener?: (
            listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void,
          ) => void;
        };
        if (typeof legacyMedia.addListener === "function") {
          legacyMedia.addListener(handleChange);
        }
      }
    }

    const dropZone = document.body;
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      const files = e.dataTransfer?.files;
      if (files && files.length > 0 && files[0].type === "image/svg+xml") {
        optimizer.loadFile(files[0]);
      }
    });
  },

  view() {
    const stats = optimizer.getStats();
    const isCopied = optimizer.copyStatus === "copied";
    const sourceSvg = optimizer.getSourceSvg();
    const previewSvg = optimizer.getPreviewSvg();
    const hasSource = Boolean(sourceSvg && sourceSvg.trim());

    const headerStats = {
      originalSizeLabel: optimizer.formatBytes(stats.originalSize),
      optimizedSizeLabel: optimizer.formatBytes(stats.optimizedSize),
      reductionLabel: `${stats.reduction > 0 ? "-" : ""}${optimizer.formatBytes(Math.abs(stats.reduction))} (${stats.reductionPercent.toFixed(1)}%)`,
      reductionClass:
        stats.reduction > 0
          ? "reduction-positive"
          : stats.reduction < 0
            ? "reduction-negative"
            : "",
    };

    const body: m.Children[] = [
      m(".app-shell", [
        m(Sidebar, {
          optimizer,
          sourceSvg,
          theme,
          onToggleTheme: toggleTheme,
          open: sidebarOpen,
          showFileActions,
          showDownload,
        }),
        m(".app-main", [
          m(Header, {
            stats: headerStats,
            onToggleSidebar: toggleSidebar,
            canOptimize: hasSource,
            onOptimize: () => optimizer.loadOptimizedFile(),
          }),
          m(
            ".main-content",
            {
              oncreate: () => {
                const splitter = document.getElementById("dragbar");
                const left = document.getElementById("left-panel");
                const right = document.getElementById("right-panel");
                if (!splitter || !left || !right) return;
                const container = splitter.parentElement as HTMLElement | null;
                const initialBounds = container?.getBoundingClientRect();
                const initialTotal =
                  initialBounds?.height ?? window.innerHeight;
                applySplitterLayout(left, right, splitterPercent, initialTotal);

                splitter.onmousedown = function (e) {
                  e.preventDefault();
                  document.onmousemove = function (event) {
                    const bounds = container?.getBoundingClientRect();
                    const total = bounds?.height ?? window.innerHeight;
                    const offset = event.clientY - (bounds?.top ?? 0);
                    splitterPercent = clampSplitterPercent(
                      (offset / total) * 100,
                    );
                    applySplitterLayout(left, right, splitterPercent, total);
                  };
                  document.onmouseup = function () {
                    document.onmousemove = null;
                    document.onmouseup = null;
                    setStoredValue(
                      STORAGE_SPLITTER_KEY,
                      String(splitterPercent),
                    );
                  };
                };
              },
            },
            [
              m(".editor-panel#left-panel", [
                m(EditorPanel, {
                  sourceSvg,
                  isCopied,
                  onCopy: copyToClipboard,
                }),
              ]),
              m("div#dragbar.dragbar"),
              m(PreviewPanel, {
                previewSvg,
                onZoomIn: () => zoomSvg(1.2),
                onZoomOut: () => zoomSvg(0.8),
                onResetZoom: () => resetZoom(),
              }),
            ],
          ),
        ]),
      ]),
      pasteToastMessage
        ? m(".app-toast[role=status][aria-live=polite]", pasteToastMessage)
        : null,
    ];

    return m("div", body);
  },
};

let globalHandlersInitialized = false;
export function initializeGlobalHandlers() {
  if (globalHandlersInitialized) return;
  globalHandlersInitialized = true;
  setupPanEvents();
  document.addEventListener("paste", handleGlobalSvgPaste);

  if (vscodeApi) {
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "load-svg") {
        optimizer.loadSvgString(data.svg || "");
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (["INPUT", "TEXTAREA"].includes(target.tagName)) return;
    if (target.closest && target.closest(".attr-dialog-backdrop")) return;
    if (target.closest && target.closest("#editor")) return;

    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (modKey && !e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      optimizer.undo();
      m.redraw();
      return;
    }

    if (
      modKey &&
      (e.key.toLowerCase() === "y" ||
        (e.shiftKey && e.key.toLowerCase() === "z"))
    ) {
      e.preventDefault();
      optimizer.redo();
      m.redraw();
      return;
    }

    const step = 20;
    const zoomStep = 1.1;
    switch (e.key) {
      case "ArrowUp":
        panY -= step;
        break;
      case "ArrowDown":
        panY += step;
        break;
      case "ArrowLeft":
        panX -= step;
        break;
      case "ArrowRight":
        panX += step;
        break;
      case "+":
      case "=":
        svgScale *= zoomStep;
        break;
      case "-":
      case "_":
        svgScale /= zoomStep;
        break;
      case "0":
        svgScale = 1;
        panX = 0;
        panY = 0;
        break;
      default:
        return;
    }
    applyTransform();
  });
}
