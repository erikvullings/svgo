import m from "mithril";
import { optimizer } from "../optimizer";
import { TreeView } from "../treeView";

export type EditorPanelAttrs = {
  sourceSvg: string;
};

export const EditorPanel: m.Component<EditorPanelAttrs> = {
  view() {
    return m(".editor-panel", [
      m(".panel-header", m("span", "Source SVG")),
      m(".editor-container", [
        m("div#editor", {
          class:
            !optimizer.editorReady || optimizer.options.viewMode !== "code"
              ? "editor-hidden"
              : "",
        }),
        !optimizer.editorReady && optimizer.options.viewMode === "code"
          ? m(
              "div",
              {
                class: "editor-loading",
              },
              "Initializing editor...",
            )
          : null,
        optimizer.options.viewMode === "tree" ? m(TreeView) : null,
      ]),
    ]);
  },
};
