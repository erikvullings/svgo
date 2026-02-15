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
};

export const Header: m.Component<HeaderAttrs> = {
  view({ attrs }) {
    const { stats, onToggleSidebar } = attrs;
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
    [
      m("path[d=M3 6h18]"),
      m("path[d=M3 12h18]"),
      m("path[d=M3 18h18]"),
    ],
  );
}
