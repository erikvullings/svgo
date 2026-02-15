import m from "mithril";
import { optimizer, vscodeApi } from "./optimizer";
import { TreeView, renderAttributeDialog } from "./treeView";

export const App: m.Component = {
  oncreate() {
    setTimeout(() => {
      optimizer.initializeEditor();
    }, 100);

    // Set up drag and drop
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
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type === "image/svg+xml") {
        optimizer.loadFile(files[0]);
      }
    });
  },

  view() {
    const stats = optimizer.getStats();
    const isCopied = optimizer.copyStatus === "copied";
    const sourceSvg = optimizer.getSourceSvg();
    const previewSvg = optimizer.getPreviewSvg();

    const body: m.Children[] = [
      m(".header", [
        m(".title", [
          m("img.logo", { src: "logo.svg", alt: "Logo" }),
          m("span", "Advanced SVG Optimizer"),
        ]),
        m(".stats", [
          m(".stat", [
            m(".stat-label", "Original"),
            m(".stat-value", optimizer.formatBytes(stats.originalSize)),
          ]),
          m(".stat", [
            m(".stat-label", "Optimized"),
            m(".stat-value", optimizer.formatBytes(stats.optimizedSize)),
          ]),
          m(".stat", [
            m(".stat-label", "Reduction"),
            m(
              ".stat-value",
              {
                class:
                  stats.reduction > 0
                    ? "reduction-positive"
                    : stats.reduction < 0
                      ? "reduction-negative"
                      : "",
              },
              `${stats.reduction > 0 ? "-" : ""}${optimizer.formatBytes(Math.abs(stats.reduction))} (${stats.reductionPercent.toFixed(1)}%)`,
            ),
          ]),
        ]),
      ]),

      m(".controls", [
        m(".file-input", [
          m("input[type=file]", {
            id: "file-input",
            accept: ".svg,image/svg+xml",
            onchange: (e) => {
              if (e.target.files[0]) {
                optimizer.loadFile(e.target.files[0]);
              }
            },
          }),
        ]),
        m("label.file-button", { for: "file-input" }, "Open SVG File"),
        m(
          "button[type=button][title=Load optimized SVG in editor]",
          {
            disabled:
              sourceSvg && sourceSvg.trim().length > 0 ? undefined : "disabled",
            onclick: () => optimizer.loadOptimizedFile(),
          },
          "Optimize",
        ),
        m(
          "button[type=button][title=Autocrop viewBox to content]",
          {
            disabled:
              sourceSvg && sourceSvg.trim().length > 0 ? undefined : "disabled",
            onclick: () => optimizer.autocropCurrentSvg(),
          },
          "Autocrop",
        ),
        m(
          "button[type=button][title=Undo]",
          {
            disabled: !optimizer.canUndo(),
            onclick: () => {
              optimizer.undo();
              m.redraw();
            },
          },
          m(
            "svg[fill=none][viewBox=0 0 24 24][width=20][height=20]",
            m(
              "path[stroke=#000][stroke-linecap=round][stroke-width=2.5][d=M21 14c-.84-1.6-2.3-3-4.1-3.9a11 11 0 0 0-5.9-.96c-3.3.41-5.6 2.6-8.2 4.6m0-4.6v4.9h4.9]",
            ),
          ),
        ),
        m(
          "button[type=button][title=Redo].svg",
          {
            disabled: !optimizer.canRedo(),
            onclick: () => {
              optimizer.redo();
              m.redraw();
            },
          },
          m(
            "svg[fill=none][viewBox=0 0 24 24][width=20][height=20]",
            m(
              "path[stroke=#000][stroke-linecap=round][stroke-width=2.5][d=M3.1 14c.84-1.6 2.3-3 4.1-3.9a11 11 0 0 1 5.9-.96c3.3.41 5.6 2.6 8.2 4.6m0-4.6v4.9H16]",
            ),
          ),
        ),

        m(".option-group", [
          m(".checkbox-group", [
            m("label", "Precision:"),
            m("input.number-input[type=number]", {
              value: optimizer.options.precision,
              min: 0,
              max: 5,
              onchange: (e) => {
                optimizer.options.precision = parseInt(e.target.value);
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              },
            }),
          ]),

          m(".checkbox-group", [
            m("label", "Path precision:"),
            m("input.number-input[type=number]", {
              value: optimizer.options.pathPrecision,
              min: 0,
              max: 5,
              onchange: (e) => {
                optimizer.options.pathPrecision = parseInt(e.target.value);
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              },
            }),
          ]),

          m(".checkbox-group", [
            m("input[type=checkbox]", {
              id: "convert-sodipodi",
              checked: optimizer.options.convertSodipodiArcs,
              onchange: (e) => {
                optimizer.options.convertSodipodiArcs = e.target.checked;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              },
            }),
            m("label", { for: "convert-sodipodi" }, "Convert sodipodi arcs"),
          ]),

          m(".checkbox-group", [
            m("input[type=checkbox]", {
              id: "remove-defaults",
              checked: optimizer.options.removeDefaultValues,
              onchange: (e) => {
                optimizer.options.removeDefaultValues = e.target.checked;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              },
            }),
            m("label", { for: "remove-defaults" }, "Remove default values"),
          ]),

          m(".checkbox-group", [
            m("input[type=checkbox]", {
              id: "remove-font-family",
              checked: optimizer.options.removeFontFamily,
              onchange: (e) => {
                optimizer.options.removeFontFamily = e.target.checked;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              },
            }),
            m("label", { for: "remove-font-family" }, "Remove font-family"),
          ]),

          m(".checkbox-group", [
            m("input[type=checkbox]", {
              id: "remove-font-size",
              checked: optimizer.options.removeFontSize,
              onchange: (e) => {
                optimizer.options.removeFontSize = e.target.checked;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              },
            }),
            m("label", { for: "remove-font-size" }, "Remove font-size"),
          ]),

          m(".checkbox-group", [
            m("input[type=checkbox]", {
              id: "remove-tspan",
              checked: optimizer.options.removeTspan,
              onchange: (e) => {
                optimizer.options.removeTspan = e.target.checked;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              },
            }),
            m("label", { for: "remove-tspan" }, "Remove tspan"),
          ]),

          m(".checkbox-group", [
            m("input[type=checkbox]", {
              id: "remove-styling",
              checked: optimizer.options.removeStyling,
              onchange: (e) => {
                optimizer.options.removeStyling = e.target.checked;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              },
            }),
            m("label", { for: "remove-styling" }, "Remove styling"),
          ]),

          m(".checkbox-group", [
            m(
              "label",
              { style: "margin-right: 1rem; font-weight: 600;" },
              "Grouping:",
            ),
            m("input[type=radio]", {
              id: "grouping-none",
              name: "grouping-mode",
              value: "none",
              checked: optimizer.options.groupingMode === "none",
              onchange: (e) => {
                if (e.target.checked) {
                  optimizer.options.groupingMode = "none";
                  optimizer.options.removeGroups = false;
                  optimizer.options.groupSimilarElements = false;
                  optimizer.optimizeSvg();
                  optimizer.saveToHistory();
                }
              },
            }),
            m(
              "label",
              { for: "grouping-none", style: "margin-right: 1rem;" },
              "None",
            ),

            m("input[type=radio]", {
              id: "grouping-group",
              name: "grouping-mode",
              value: "group",
              checked: optimizer.options.groupingMode === "group",
              onchange: (e) => {
                if (e.target.checked) {
                  optimizer.options.groupingMode = "group";
                  optimizer.options.removeGroups = false;
                  optimizer.options.groupSimilarElements = true;
                  optimizer.optimizeSvg();
                  optimizer.saveToHistory();
                }
              },
            }),
            m(
              "label",
              { for: "grouping-group", style: "margin-right: 1rem;" },
              "Group similar",
            ),

            m("input[type=radio]", {
              id: "grouping-remove",
              name: "grouping-mode",
              value: "remove",
              checked: optimizer.options.groupingMode === "remove",
              onchange: (e) => {
                if (e.target.checked) {
                  optimizer.options.groupingMode = "remove";
                  optimizer.options.removeGroups = true;
                  optimizer.options.groupSimilarElements = false;
                  optimizer.optimizeSvg();
                  optimizer.saveToHistory();
                }
              },
            }),
            m("label", { for: "grouping-remove" }, "Remove groups"),
          ]),

          m(".checkbox-group", [
            m("input[type=checkbox]", {
              id: "custom-dimensions",
              checked: optimizer.options.useCustomDimensions,
              onchange: (e) => {
                optimizer.options.useCustomDimensions = e.target.checked;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              },
            }),
            m("label", { for: "custom-dimensions" }, "Custom size:"),
            m("input.dimension-input[type=number]", {
              value: optimizer.options.customWidth,
              placeholder: "Width",
              onchange: (e) => {
                optimizer.options.customWidth = parseInt(e.target.value);
                if (optimizer.options.useCustomDimensions) {
                  optimizer.optimizeSvg();
                  optimizer.saveToHistory();
                }
              },
            }),
            m("span", "×"),
            m("input.dimension-input[type=number]", {
              value: optimizer.options.customHeight,
              placeholder: "Height",
              onchange: (e) => {
                optimizer.options.customHeight = parseInt(e.target.value);
                if (optimizer.options.useCustomDimensions) {
                  optimizer.optimizeSvg();
                  optimizer.saveToHistory();
                }
              },
            }),
          ]),
        ]),
      ]),

      m(
        ".main-content",
        {
          oncreate: () => {
            const splitter = document.getElementById("dragbar");
            const left = document.getElementById("left-panel");
            const right = document.getElementById("right-panel");
            splitter.onmousedown = function (e) {
              e.preventDefault();
              document.onmousemove = function (e) {
                let percent = (e.clientX / window.innerWidth) * 100;
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
        },
        [
          m(".editor-panel#left-panel", [
            m(".editor-panel", [
              m(".panel-header", [
                m("span", "Source SVG"),
                sourceSvg
                  ? m("span", `${sourceSvg.split("\n").length} lines`)
                  : null,
                m("div", { style: "display: flex; gap: 0.5rem;" }, [
                  m(
                    "button",
                    {
                      style: `background: ${optimizer.options.viewMode === "code" ? "#4fc3f7" : "#444"}; font-size: 0.8rem; padding: 0.2rem 0.6rem;`,
                      onclick: () => (optimizer.options.viewMode = "code"),
                    },
                    "Code",
                  ),
                  m(
                    "button",
                    {
                      style: `background: ${optimizer.options.viewMode === "tree" ? "#4fc3f7" : "#444"}; font-size: 0.8rem; padding: 0.2rem 0.6rem;`,
                      onclick: () => (optimizer.options.viewMode = "tree"),
                    },
                    "Tree",
                  ),
                  m(
                    "button",
                    {
                      style:
                        "background: #444; font-size: 0.8rem; padding: 0.2rem 0.6rem; cursor: pointer; border: none; border-radius: 4px; color: #e0e0e0; display: flex; align-items: center; gap: 0.3rem;",
                      onclick: () => copyToClipboard(),
                      title: "Copy to clipboard",
                    },
                    [
                      isCopied
                        ? m(
                            "svg[width=16][height=16][viewBox=0 0 24 24][fill=none][stroke=currentColor][stroke-width=2][stroke-linecap=round][stroke-linejoin=round]",
                            [
                              m(
                                'path[stroke-linecap=round][stroke-linejoin=round][d=M20 6L9 17l-5-5"]',
                              ),
                            ],
                          )
                        : m(
                            "svg[width=16][height=16][viewBox=0 0 24 24][fill=none][stroke=currentColor][stroke-width=2][stroke-linecap=round][stroke-linejoin=round]",
                            [
                              m(
                                'path[stroke-linecap=round][stroke-linejoin=round][d=M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2m-6 12h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"]',
                              ),
                              m(
                                'path[stroke-linecap=round][stroke-linejoin=round][d=M16 8v8m-4-5v5m-4-2v2"]',
                              ),
                            ],
                          ),
                      m("span", isCopied ? "Copied!" : "Copy"),
                    ],
                  ),
                ]),
              ]),
              m(".editor-container", [
                m("div#editor", {
                  style: `height: 100%; ${!optimizer.editorReady || optimizer.options.viewMode !== "code" ? "display: none;" : ""}`,
                }),
                !optimizer.editorReady
                  ? m(
                      "div",
                      {
                        style:
                          "display: flex; align-items: center; justify-content: center; height: 100%; color: #888;",
                      },
                      "Initializing editor...",
                    )
                  : null,
                optimizer.options.viewMode === "tree" ? m(TreeView) : null,
              ]),
            ]),
          ]),
          m("div#dragbar", {
            style: "width: 6px; cursor: col-resize; background: #666;",
          }),
          m(".preview-panel#right-panel", [
            m(".panel-header", [
              m("span", "Optimized SVG"),
              previewSvg &&
                m(
                  "div",
                  { style: "display:flex; gap:0.5rem; align-items:center;" },
                  [
                    m("button", { onclick: () => zoomSvg(1.2) }, "+"),
                    m("button", { onclick: () => zoomSvg(0.8) }, "-"),
                    m("button", { onclick: () => resetZoom() }, "Reset"),
                  ],
                ),

              previewSvg &&
                m(
                  "button.download-btn",
                  {
                    onclick: () => optimizer.downloadSvg(),
                  },
                  "Download",
                ),
            ]),
            m(".preview-container", [
              previewSvg
                ? m.trust(previewSvg)
                : m(
                    "div",
                    { style: "color: #888; text-align: center" },
                    "Preview will appear here",
                  ),
            ]),
          ]),
        ],
      ),
    ];

    const dialog = renderAttributeDialog();
    if (dialog) {
      body.push(dialog);
    }

    return m("div", body);
  },
};

let svgScale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;

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
    // Don't pan or hijack shortcuts if typing or inside the code editor
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
