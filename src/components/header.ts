import m from "mithril";

export type HeaderStats = {
  originalSizeLabel: string;
  optimizedSizeLabel: string;
  reductionLabel: string;
  reductionClass: string;
};

export type HeaderAttrs = {
  stats: HeaderStats;
  theme: "dark" | "light";
  onToggleTheme: () => void;
};

export const Header: m.Component<HeaderAttrs> = {
  view({ attrs }) {
    const { stats, theme, onToggleTheme } = attrs;
    return m(".header", [
      m(".title", [
        m("img.logo", { src: "logo.svg", alt: "Logo" }),
        m("span", "Advanced SVG Optimizer"),
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
      m(
        "button.theme-toggle",
        { onclick: onToggleTheme, title: "Toggle theme" },
        theme === "dark" ? "Light" : "Dark",
      ),
    ]);
  },
};
