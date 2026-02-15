import m from "mithril";
import { optimizer } from "../optimizer";
import { TreeView } from "../treeView";

export type EditorPanelAttrs = {
  sourceSvg: string;
  isCopied: boolean;
  onCopy: () => void;
};

export const EditorPanel: m.Component<EditorPanelAttrs> = {
  view({ attrs }) {
    const { sourceSvg, isCopied, onCopy } = attrs;

    return m(".editor-panel", [
      m(".panel-header", [
        m("span", "Source SVG"),
        sourceSvg ? m("span", `${sourceSvg.split("\n").length} lines`) : null,
        m(
          "div.editor-actions",
          [
            m(
              "button.view-toggle",
              {
                class:
                  optimizer.options.viewMode === "code" ? "active" : "",
                onclick: () => (optimizer.options.viewMode = "code"),
              },
              "Code",
            ),
            m(
              "button.view-toggle",
              {
                class:
                  optimizer.options.viewMode === "tree" ? "active" : "",
                onclick: () => (optimizer.options.viewMode = "tree"),
              },
              "Tree",
            ),
            m(
              "button.copy-btn",
              {
                onclick: () => onCopy(),
                title: "Copy to clipboard",
              },
              [
                isCopied
                  ? m(
                      "svg[width=16][height=16][viewBox=0 0 24 24][fill=none][stroke=currentColor][stroke-width=2][stroke-linecap=round][stroke-linejoin=round]",
                      [
                        m(
                          "path[stroke-linecap=round][stroke-linejoin=round][d=M20 6L9 17l-5-5]",
                        ),
                      ],
                    )
                  : m(
                      "svg[width=16][height=16][viewBox=0 0 24 24][fill=none][stroke=currentColor][stroke-width=2][stroke-linecap=round][stroke-linejoin=round]",
                      [
                        m(
                          "path[stroke-linecap=round][stroke-linejoin=round][d=M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2m-6 12h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z]",
                        ),
                        m(
                          "path[stroke-linecap=round][stroke-linejoin=round][d=M16 8v8m-4-5v5m-4-2v2]",
                        ),
                      ],
                    ),
                m("span", isCopied ? "Copied!" : "Copy"),
              ],
            ),
          ],
        ),
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
