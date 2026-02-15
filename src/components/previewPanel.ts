import m from "mithril";
import { SVGOptimizer } from "../optimizer";

export type PreviewPanelAttrs = {
  optimizer: SVGOptimizer;
  previewSvg: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
};

export const PreviewPanel: m.Component<PreviewPanelAttrs> = {
  view({ attrs }) {
    const { optimizer, previewSvg, onZoomIn, onZoomOut, onResetZoom } = attrs;

    return m(".preview-panel#right-panel", [
      m(".panel-header", [
        m("span", "Optimized SVG"),
        previewSvg &&
          m("div.preview-controls", [
            m("button", { onclick: onZoomIn }, "+"),
            m("button", { onclick: onZoomOut }, "-"),
            m("button", { onclick: onResetZoom }, "Reset"),
          ]),
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
          : m("div.preview-placeholder", "Preview will appear here"),
      ]),
    ]);
  },
};
