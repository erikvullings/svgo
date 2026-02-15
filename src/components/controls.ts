import m from "mithril";
import { SVGOptimizer } from "../optimizer";

export type ControlsAttrs = {
  optimizer: SVGOptimizer;
  sourceSvg: string;
};

export const Controls: m.Component<ControlsAttrs> = {
  view({ attrs }) {
    const { optimizer, sourceSvg } = attrs;
    return m(".controls", [
      m(".file-input", [
        m("input[type=file]", {
          id: "file-input",
          accept: ".svg,image/svg+xml",
          onchange: (e: Event) => {
            const input = e.target as HTMLInputElement;
            if (input.files && input.files[0]) {
              optimizer.loadFile(input.files[0]);
            }
          },
        }),
      ]),
      m("label.file-button", { for: "file-input" }, "Open SVG File"),
      m(
        "button[type=button][title=Load optimized SVG in editor]",
        {
          disabled: sourceSvg && sourceSvg.trim().length > 0 ? undefined : "disabled",
          onclick: () => optimizer.loadOptimizedFile(),
        },
        "Optimize",
      ),
      m(
        "button[type=button][title=Autocrop viewBox to content]",
        {
          disabled: sourceSvg && sourceSvg.trim().length > 0 ? undefined : "disabled",
          onclick: () => optimizer.autocropCurrentSvg(),
        },
        "Autocrop",
      ),
      m(
        "button[type=button][title=Undo]",
        {
          disabled: !optimizer.canUndo(),
          onclick: () => {
            optimizer.undo();
            m.redraw();
          },
        },
        m(
          "svg[fill=none][viewBox=0 0 24 24][width=20][height=20]",
          m(
            "path[stroke=#000][stroke-linecap=round][stroke-width=2.5][d=M21 14c-.84-1.6-2.3-3-4.1-3.9a11 11 0 0 0-5.9-.96c-3.3.41-5.6 2.6-8.2 4.6m0-4.6v4.9h4.9]",
          ),
        ),
      ),
      m(
        "button[type=button][title=Redo].svg",
        {
          disabled: !optimizer.canRedo(),
          onclick: () => {
            optimizer.redo();
            m.redraw();
          },
        },
        m(
          "svg[fill=none][viewBox=0 0 24 24][width=20][height=20]",
          m(
            "path[stroke=#000][stroke-linecap=round][stroke-width=2.5][d=M3.1 14c.84-1.6 2.3-3 4.1-3.9a11 11 0 0 1 5.9-.96c3.3.41 5.6 2.6 8.2 4.6m0-4.6v4.9H16]",
          ),
        ),
      ),
      m(".option-group", [
        m(".checkbox-group", [
          m("label", "Precision:"),
          m("input.number-input[type=number]", {
            value: optimizer.options.precision,
            min: 0,
            max: 5,
            onchange: (e: Event) => {
              optimizer.options.precision = parseInt(
                (e.target as HTMLInputElement).value,
                10,
              );
              optimizer.optimizeSvg();
              optimizer.saveToHistory();
            },
          }),
        ]),
        m(".checkbox-group", [
          m("label", "Path precision:"),
          m("input.number-input[type=number]", {
            value: optimizer.options.pathPrecision,
            min: 0,
            max: 5,
            onchange: (e: Event) => {
              optimizer.options.pathPrecision = parseInt(
                (e.target as HTMLInputElement).value,
                10,
              );
              optimizer.optimizeSvg();
              optimizer.saveToHistory();
            },
          }),
        ]),
        m(".checkbox-group", [
          m("input[type=checkbox]", {
            id: "convert-sodipodi",
            checked: optimizer.options.convertSodipodiArcs,
            onchange: (e: Event) => {
              optimizer.options.convertSodipodiArcs = (
                e.target as HTMLInputElement
              ).checked;
              optimizer.optimizeSvg();
              optimizer.saveToHistory();
            },
          }),
          m("label", { for: "convert-sodipodi" }, "Convert sodipodi arcs"),
        ]),
        m(".checkbox-group", [
          m("input[type=checkbox]", {
            id: "remove-defaults",
            checked: optimizer.options.removeDefaultValues,
            onchange: (e: Event) => {
              optimizer.options.removeDefaultValues = (
                e.target as HTMLInputElement
              ).checked;
              optimizer.optimizeSvg();
              optimizer.saveToHistory();
            },
          }),
          m("label", { for: "remove-defaults" }, "Remove default values"),
        ]),
        m(".checkbox-group", [
          m("input[type=checkbox]", {
            id: "remove-font-family",
            checked: optimizer.options.removeFontFamily,
            onchange: (e: Event) => {
              optimizer.options.removeFontFamily = (
                e.target as HTMLInputElement
              ).checked;
              optimizer.optimizeSvg();
              optimizer.saveToHistory();
            },
          }),
          m("label", { for: "remove-font-family" }, "Remove font-family"),
        ]),
        m(".checkbox-group", [
          m("input[type=checkbox]", {
            id: "remove-font-size",
            checked: optimizer.options.removeFontSize,
            onchange: (e: Event) => {
              optimizer.options.removeFontSize = (
                e.target as HTMLInputElement
              ).checked;
              optimizer.optimizeSvg();
              optimizer.saveToHistory();
            },
          }),
          m("label", { for: "remove-font-size" }, "Remove font-size"),
        ]),
        m(".checkbox-group", [
          m("input[type=checkbox]", {
            id: "remove-tspan",
            checked: optimizer.options.removeTspan,
            onchange: (e: Event) => {
              optimizer.options.removeTspan = (
                e.target as HTMLInputElement
              ).checked;
              optimizer.optimizeSvg();
              optimizer.saveToHistory();
            },
          }),
          m("label", { for: "remove-tspan" }, "Remove tspan"),
        ]),
        m(".checkbox-group", [
          m("input[type=checkbox]", {
            id: "remove-styling",
            checked: optimizer.options.removeStyling,
            onchange: (e: Event) => {
              optimizer.options.removeStyling = (
                e.target as HTMLInputElement
              ).checked;
              optimizer.optimizeSvg();
              optimizer.saveToHistory();
            },
          }),
          m("label", { for: "remove-styling" }, "Remove styling"),
        ]),
        m(".checkbox-group", [
          m("label", { style: "margin-right: 1rem; font-weight: 600;" }, "Grouping:"),
          m("input[type=radio]", {
            id: "grouping-none",
            name: "grouping-mode",
            value: "none",
            checked: optimizer.options.groupingMode === "none",
            onchange: (e: Event) => {
              if ((e.target as HTMLInputElement).checked) {
                optimizer.options.groupingMode = "none";
                optimizer.options.removeGroups = false;
                optimizer.options.groupSimilarElements = false;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              }
            },
          }),
          m("label", { for: "grouping-none", style: "margin-right: 1rem;" }, "None"),
          m("input[type=radio]", {
            id: "grouping-group",
            name: "grouping-mode",
            value: "group",
            checked: optimizer.options.groupingMode === "group",
            onchange: (e: Event) => {
              if ((e.target as HTMLInputElement).checked) {
                optimizer.options.groupingMode = "group";
                optimizer.options.removeGroups = false;
                optimizer.options.groupSimilarElements = true;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              }
            },
          }),
          m("label", { for: "grouping-group", style: "margin-right: 1rem;" }, "Group similar"),
          m("input[type=radio]", {
            id: "grouping-remove",
            name: "grouping-mode",
            value: "remove",
            checked: optimizer.options.groupingMode === "remove",
            onchange: (e: Event) => {
              if ((e.target as HTMLInputElement).checked) {
                optimizer.options.groupingMode = "remove";
                optimizer.options.removeGroups = true;
                optimizer.options.groupSimilarElements = false;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              }
            },
          }),
          m("label", { for: "grouping-remove" }, "Remove groups"),
        ]),
        m(".checkbox-group", [
          m("input[type=checkbox]", {
            id: "custom-dimensions",
            checked: optimizer.options.useCustomDimensions,
            onchange: (e: Event) => {
              optimizer.options.useCustomDimensions = (
                e.target as HTMLInputElement
              ).checked;
              optimizer.optimizeSvg();
              optimizer.saveToHistory();
            },
          }),
          m("label", { for: "custom-dimensions" }, "Custom size:"),
          m("input.dimension-input[type=number]", {
            value: optimizer.options.customWidth,
            placeholder: "Width",
            onchange: (e: Event) => {
              optimizer.options.customWidth = parseInt(
                (e.target as HTMLInputElement).value,
                10,
              );
              if (optimizer.options.useCustomDimensions) {
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              }
            },
          }),
          m("span", "×"),
          m("input.dimension-input[type=number]", {
            value: optimizer.options.customHeight,
            placeholder: "Height",
            onchange: (e: Event) => {
              optimizer.options.customHeight = parseInt(
                (e.target as HTMLInputElement).value,
                10,
              );
              if (optimizer.options.useCustomDimensions) {
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              }
            },
          }),
        ]),
      ]),
    ]);
  },
};
