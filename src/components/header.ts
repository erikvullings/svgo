import m from "mithril";

export type HeaderStats = {
  originalSizeLabel: string;
  optimizedSizeLabel: string;
  reductionLabel: string;
  reductionClass: string;
};

export type HeaderAttrs = {
  stats: HeaderStats;
  onToggleSidebar: () => void;
  canOptimize: boolean;
  onOptimize: () => void;
  canCopy: boolean;
  isCopied: boolean;
  onCopy: () => void;
};

export const Header: m.Component<HeaderAttrs> = {
  view({ attrs }) {
    const {
      stats,
      onToggleSidebar,
      canOptimize,
      onOptimize,
      canCopy,
      isCopied,
      onCopy,
    } = attrs;
    return m(".header", [
      m(".header-left", [
        m(
          "button.menu-toggle",
          { onclick: onToggleSidebar, title: "Toggle sidebar" },
          iconMenu(),
        ),
        m(".title", [
          m("img.logo", { src: "logo.svg", alt: "Logo" }),
          m("span", "Advanced SVG Optimizer"),
        ]),
      ]),
      m(".stats", [
        m(".header-actions", [
          m(
            "button.view-toggle.active.header-optimize-btn",
            {
              onclick: onOptimize,
              disabled: canOptimize ? undefined : true,
              title: "Apply optimized SVG to source",
            },
            "Optimize",
          ),
          m(
            "button.copy-btn.header-copy-btn",
            {
              onclick: onCopy,
              disabled: canCopy ? undefined : true,
              title: "Copy source SVG to clipboard",
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
                : iconCopy(),
              m("span", isCopied ? "Copied!" : "Copy"),
            ],
          ),
        ]),
        m(".stat", [
          m(".stat-label", "Original"),
          m(".stat-value", stats.originalSizeLabel),
        ]),
        m(".stat", [
          m(".stat-label", "Optimized"),
          m(".stat-value", stats.optimizedSizeLabel),
        ]),
        m(".stat", [
          m(".stat-label", "Reduction"),
          m(
            ".stat-value",
            { class: stats.reductionClass },
            stats.reductionLabel,
          ),
        ]),
      ]),
    ]);
  },
};

function iconMenu(): m.Vnode {
  return m(
    "svg.icon[viewBox=0 0 24 24][fill=none][stroke=currentColor][stroke-width=2]",
    [m("path[d=M3 6h18]"), m("path[d=M3 12h18]"), m("path[d=M3 18h18]")],
  );
}

function iconCopy(): m.Vnode {
  return m(
    "svg[width=16][height=16][viewBox=0 0 24 24][fill=none][stroke=currentColor][stroke-width=2][stroke-linecap=round][stroke-linejoin=round]",
    [
      m(
        "path[stroke-linecap=round][stroke-linejoin=round][d=M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2m-6 12h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z]",
      ),
      m(
        "path[stroke-linecap=round][stroke-linejoin=round][d=M16 8v8m-4-5v5m-4-2v2]",
      ),
    ],
  );
}
