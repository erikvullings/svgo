import m from "mithril";
export type PreviewPanelAttrs = {
  previewSvg: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
};

function updatePreviewSvgSizing(container: Element): void {
  const svg = container.querySelector("svg");
  if (!svg) return;

  const hasWidth = svg.hasAttribute("width");
  const hasHeight = svg.hasAttribute("height");

  svg.classList.toggle("preview-svg", true);
  svg.classList.toggle("preview-svg-auto-size", !hasWidth && !hasHeight);
}

export const PreviewPanel: m.Component<PreviewPanelAttrs> = {
  oncreate({ dom }) {
    const container = (dom as Element).querySelector(".preview-container");
    if (container) {
      updatePreviewSvgSizing(container);
    }
  },
  onupdate({ dom }) {
    const container = (dom as Element).querySelector(".preview-container");
    if (container) {
      updatePreviewSvgSizing(container);
    }
  },
  view({ attrs }) {
    const { previewSvg, onZoomIn, onZoomOut, onResetZoom } = attrs;

    return m(".preview-panel#right-panel", [
      m(".panel-header", [
        m("span", "Optimized SVG"),
        previewSvg &&
          m("div.preview-controls", [
            m("button", { onclick: onZoomIn }, "+"),
            m("button", { onclick: onZoomOut }, "-"),
            m("button", { onclick: onResetZoom }, "Reset"),
          ]),
      ]),
      m(".preview-container", [
        previewSvg
          ? m.trust(previewSvg)
          : m("div.preview-placeholder", "Preview will appear here"),
      ]),
    ]);
  },
};
