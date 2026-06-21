import m from "mithril";
import { optimizer } from "../optimizer";
import { TreeView } from "../treeView";

export type EditorPanelAttrs = {
  sourceSvg: string;
};

export const EditorPanel: m.Component<EditorPanelAttrs> = {
  view({ attrs }) {
    const { sourceSvg } = attrs;

    return m(".editor-panel", [
      m(".panel-header", [
        m("span", "Source SVG"),
        m("div.editor-actions", [
          m(
            "button.view-toggle",
            {
              class: optimizer.options.viewMode === "code" ? "active" : "",
              onclick: () => {
                optimizer.options.viewMode = "code";
                optimizer.persistSessionState();
              },
            },
            [iconCode(), m("span", "Code")],
          ),
          m(
            "button.view-toggle",
            {
              class: optimizer.options.viewMode === "tree" ? "active" : "",
              onclick: () => {
                optimizer.options.viewMode = "tree";
                optimizer.persistSessionState();
              },
            },
            [iconTree(), m("span", "Tree")],
          ),
        ]),
      ]),
      m(".editor-container", [
        m("div#editor", {
          class:
            !optimizer.editorReady || optimizer.options.viewMode !== "code"
              ? "editor-hidden"
              : "",
        }),
        !optimizer.editorReady
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

function iconCode(): m.Vnode {
  return m(
    "svg.icon[viewBox=0 0 24 24][fill=none][stroke=currentColor][stroke-width=1.8]",
    [m("path[d=M8 5l-5 7 5 7]"), m("path[d=M16 5l5 7-5 7]")],
  );
}

function iconTree(): m.Vnode {
  return m(
    "svg.icon[viewBox=0 0 24 24][fill=none][stroke=currentColor][stroke-width=1.8]",
    [
      m("circle[cx=6][cy=6][r=2]"),
      m("circle[cx=18][cy=6][r=2]"),
      m("circle[cx=12][cy=18][r=2]"),
      m("path[d=M8 6h8]"),
      m("path[d=M6 8v6h6]"),
      m("path[d=M18 8v6h-6]"),
    ],
  );
}
