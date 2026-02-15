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
          m("div", { style: "display:flex; gap:0.5rem; align-items:center;" }, [
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
          : m(
              "div",
              { style: "color: #888; text-align: center" },
              "Preview will appear here",
            ),
      ]),
    ]);
  },
};
