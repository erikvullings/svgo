import m from "mithril";
import { SVGOptimizer } from "../optimizer";

export type ControlsAttrs = {
  optimizer: SVGOptimizer;
};

export const Controls: m.Component<ControlsAttrs> = {
  view({ attrs }) {
    const { optimizer } = attrs;
    return m(".controls", [
      m(".option-section", [
        m(".section-title", "Precision"),
        m(".checkbox-group.precision-row", [
          m("label", "General:"),
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
        m(".checkbox-group.precision-row", [
          m("label", "Path:"),
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
      ]),
      m(".option-section", [
        m(".section-title", "Cleanup"),
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
      ]),
      m(".option-section", [
        m(".section-title", "Grouping"),
        m(".checkbox-group.grouping", [
          // m("label", { class: "grouping-label" }, "Grouping:"),
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
          m(
            "label",
            { for: "grouping-none", class: "grouping-option" },
            "None",
          ),
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
          m(
            "label",
            { for: "grouping-group", class: "grouping-option" },
            "Group similar",
          ),
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
      ]),
      m(".option-section", [
        m(".section-title", "Custom Size"),
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
