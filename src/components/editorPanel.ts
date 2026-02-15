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
          "div",
          { style: "display: flex; gap: 0.5rem;" },
          [
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
    ]);
  },
};
