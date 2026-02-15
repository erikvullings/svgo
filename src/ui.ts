import m from "mithril";
import { optimizer, vscodeApi } from "./optimizer";
import { Header } from "./components/header";
import { Controls } from "./components/controls";
import { EditorPanel } from "./components/editorPanel";
import { PreviewPanel } from "./components/previewPanel";
import { renderAttributeDialog } from "./treeView";

let svgScale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;

let theme: "dark" | "light" | "auto" =
  (localStorage.getItem("svgo-theme") as "dark" | "light" | "auto") || "dark";

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
  localStorage.setItem("svgo-theme", theme);
  optimizer.setEditorTheme(resolved);
}

function toggleTheme() {
  const next =
    theme === "dark" ? "light" : theme === "light" ? "auto" : "dark";
  applyTheme(next);
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
      if ("addEventListener" in media) {
        media.addEventListener("change", handleChange);
      } else if ("addListener" in media) {
        media.addListener(handleChange);
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
      m(Header, { stats: headerStats, theme, onToggleTheme: toggleTheme }),
      m(Controls, { optimizer, sourceSvg }),
      m(".main-content", {
        oncreate: () => {
          const splitter = document.getElementById("dragbar");
          const left = document.getElementById("left-panel");
          const right = document.getElementById("right-panel");
          if (!splitter || !left || !right) return;
          splitter.onmousedown = function (e) {
            e.preventDefault();
            document.onmousemove = function (event) {
              let percent = (event.clientX / window.innerWidth) * 100;
              let percentSplitter = (6 / window.innerWidth) * 100;
              percent = Math.max(10, Math.min(90, percent));
              left.style.flex = `0 0 ${percent}%`;
              right.style.flex = `0 0 ${100 - percent - percentSplitter}%`;
            };
            document.onmouseup = function () {
              document.onmousemove = null;
              document.onmouseup = null;
            };
          };
        },
      }, [
        m(".editor-panel#left-panel", [
          m(EditorPanel, { sourceSvg, isCopied, onCopy: copyToClipboard }),
        ]),
        m("div#dragbar.dragbar"),
        m(PreviewPanel, {
          optimizer,
          previewSvg,
          onZoomIn: () => zoomSvg(1.2),
          onZoomOut: () => zoomSvg(0.8),
          onResetZoom: () => resetZoom(),
        }),
      ]),
    ];

    const dialog = renderAttributeDialog();
    if (dialog) {
      body.push(dialog);
    }

    return m("div", body);
  },
};

let globalHandlersInitialized = false;
export function initializeGlobalHandlers() {
  if (globalHandlersInitialized) return;
  globalHandlersInitialized = true;
  setupPanEvents();

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
    if (target.closest && target.closest("#editor")) return;

    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (modKey && !e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      optimizer.undo();
      m.redraw();
      return;
    }

    if (modKey && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
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
