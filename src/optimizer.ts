import m from "mithril";
import { optimize } from "svgo/browser";
import {
  NUMERIC_ATTRS,
  NUMERIC_LIST_ATTRS,
  KNOWN_SVG_ATTRS,
  roundNumericValueFixed,
  roundNumericList,
  roundPathData,
  collapseTransforms,
} from "./svgUtils";

type OptimizeOptions = {
  precision: number;
  pathPrecision: number;
  removeTspan: boolean;
  removeStyling: boolean;
  removeGroups: boolean;
  customWidth: number;
  customHeight: number;
  useCustomDimensions: boolean;
  removeDefaultValues: boolean;
  removeFontFamily: boolean;
  removeFontSize: boolean;
  convertSodipodiArcs: boolean;
  groupSimilarElements: boolean;
  groupingMode: "group" | "remove" | "none";
  viewMode: "code" | "tree";
  selectedElementPath: string | null;
  treeDoc: Document | null;
  isUpdatingFromTree: boolean;
};

type HistoryEntry = {
  originalSvg: string;
  optimizedSvg: string;
  options: OptimizeOptions;
};

export const vscodeApi =
  typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined;

const PRESERVE_ATTR_NAMES = new Set(["role", "tabindex"]);
const PRESERVE_ATTR_PREFIXES = ["data-", "aria-"];
const BLOCKED_ATTR_PREFIXES = ["inkscape:", "sodipodi:"];
const RESERVED_ATTR_NAME = "data-cx-id";

class SVGOptimizer {
  originalSvg: string;
  optimizedSvg: string;
  editor: MonacoEditorInstance | null;
  editorReady: boolean;
  editorTheme: "dark" | "light";
  history: HistoryEntry[];
  historyPointer: number;
  maxHistory: number;
  options: OptimizeOptions;
  unitConversion: Record<string, number>;
  isRestoringHistory: boolean;
  copyStatus: "idle" | "copied";
  copyResetTimer: ReturnType<typeof setTimeout> | null;

  constructor() {
    this.originalSvg = "";
    this.optimizedSvg = "";
    this.editor = null;
    this.editorReady = false;
    this.editorTheme = "dark";
    this.history = []; // Store history for undo/redo
    this.historyPointer = -1; // Pointer to current position in history
    this.maxHistory = 20; // Maximum number of history entries
    this.options = {
      precision: 1,
      pathPrecision: 2,
      removeTspan: true,
      removeStyling: true,
      removeGroups: false,
      customWidth: 100,
      customHeight: 100,
      useCustomDimensions: false,
      removeDefaultValues: true,
      removeFontFamily: false,
      removeFontSize: false,
      convertSodipodiArcs: true,
      groupSimilarElements: true,
      groupingMode: "group", // 'group', 'remove', or 'none'
      viewMode: "code", // 'code', 'tree'
      selectedElementPath: null, // JSON path or similar to track selected element
      treeDoc: null, // Parsed DOM for the Tree View
      isUpdatingFromTree: false, // Flag to prevent redundant re-parsing
    };
    this.unitConversion = {
      px: 1,
      pt: 1.25, // 1pt = 1.25px (1/72 inch * 96 px/inch)
      pc: 15, // 1pc = 12pt = 15px
      mm: 3.7795275591, // 1mm = 96/25.4 px
      cm: 37.795275591, // 1cm = 10mm
      in: 96, // 1in = 96px
    };
    this.isRestoringHistory = false;
    this.copyStatus = "idle";
    this.copyResetTimer = null;
    // Initialize with empty state
    this.saveToHistory();

    // Ensure we start with proper history state
    this.historyPointer = 0;
  }

  getSourceSvg(): string {
    if (this.editor) {
      return this.editor.getValue();
    }
    return this.originalSvg;
  }

  isOptimizationEnabled(): boolean {
    const hasRounding =
      this.options.precision > 0 || this.options.pathPrecision > 0;
    const hasToggles =
      this.options.removeDefaultValues ||
      this.options.removeFontFamily ||
      this.options.removeFontSize ||
      this.options.removeTspan ||
      this.options.removeStyling ||
      this.options.convertSodipodiArcs ||
      this.options.useCustomDimensions;
    const hasGrouping = this.options.groupingMode !== "none";
    return hasRounding || hasToggles || hasGrouping;
  }

  getPreviewSvg(): string {
    if (!this.isOptimizationEnabled()) {
      return this.getSourceSvg();
    }
    return this.optimizedSvg || this.getSourceSvg();
  }

  async initializeEditor(): Promise<void> {
    return new Promise<void>((resolve) => {
      require.config({
        paths: {
          vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs",
        },
      });
      require(["vs/editor/editor.main"], () => {
        // Wait for the DOM element to be available
        const checkContainer = () => {
          const container = document.getElementById("editor");
          if (container) {
            monaco.languages.register({ id: "xml" });
            monaco.languages.setLanguageConfiguration("xml", {
              brackets: [["<", ">"]],
              autoClosingPairs: [
                { open: "<", close: ">" },
                { open: '"', close: '"' },
                { open: "'", close: "'" },
              ],
            });
            this.editor = monaco.editor.create(container, {
              value:
                this.originalSvg ||
                "<!-- Paste your SVG code here or load a file -->",
              language: "xml",
              theme: this.editorTheme === "dark" ? "vs-dark" : "vs",
              automaticLayout: true,
              minimap: { enabled: false },
              wordWrap: "on",
              renderLineHighlight: "none",
            });

            this.editor.onDidChangeModelContent(() => {
              if (this.options.isUpdatingFromTree || this.isRestoringHistory)
                return;
              this.originalSvg = this.editor.getValue();
              this.updateTreeDoc();
              this.optimizeSvg();
              this.saveToHistory(); // Save to history after editing
              m.redraw();
            });

            this.editorReady = true;
            this.applyEditorTheme();
            // Save initial state after editor is initialized
            if (this.history.length === 0) {
              this.saveToHistory();
            }
            m.redraw(); // Trigger a redraw when editor is ready
            resolve();
          } else {
            // If container not found, try again in 50ms
            setTimeout(checkContainer, 50);
          }
        };
        checkContainer();
      });
    });
  }

  applyEditorTheme(): void {
    if (!this.editor) return;
    if (typeof monaco === "undefined") return;
    const themeName = this.editorTheme === "dark" ? "vs-dark" : "vs";
    monaco.editor.setTheme(themeName);
  }

  setEditorTheme(theme: "dark" | "light"): void {
    this.editorTheme = theme;
    this.applyEditorTheme();
  }

  shouldPreserveAttribute(name: string): boolean {
    if (!name) return false;
    const lower = name.toLowerCase();
    if (lower === RESERVED_ATTR_NAME) return false;
    if (BLOCKED_ATTR_PREFIXES.some((prefix) => lower.startsWith(prefix)))
      return false;
    if (lower.startsWith("xmlns")) return false;
    if (PRESERVE_ATTR_PREFIXES.some((prefix) => lower.startsWith(prefix)))
      return true;
    if (PRESERVE_ATTR_NAMES.has(lower)) return true;
    if (lower.includes(":")) return true;
    return !KNOWN_SVG_ATTRS.has(lower);
  }

  injectPreserveMarkers(svg: string): {
    svg: string;
    preserved: Map<string, Record<string, string>>;
  } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const preserved = new Map<string, Record<string, string>>();
    let counter = 0;

    doc.querySelectorAll("*").forEach((el) => {
      const attrsToPreserve: Record<string, string> = {};
      Array.from(el.attributes).forEach((attr) => {
        if (this.shouldPreserveAttribute(attr.name)) {
          attrsToPreserve[attr.name] = attr.value;
        }
      });

      if (Object.keys(attrsToPreserve).length > 0) {
        const id = `cx-${counter++}`;
        el.setAttribute(RESERVED_ATTR_NAME, id);
        preserved.set(id, attrsToPreserve);
      }
    });

    return { svg: new XMLSerializer().serializeToString(doc), preserved };
  }

  restorePreservedAttributes(
    svg: string,
    preserved: Map<string, Record<string, string>>,
  ) {
    if (!preserved || preserved.size === 0) return svg;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");

    preserved.forEach((attrs, id) => {
      const el = doc.querySelector(`[${RESERVED_ATTR_NAME}="${id}"]`);
      if (!el) return;
      Object.entries(attrs).forEach(([name, value]) => {
        if (!el.hasAttribute(name)) {
          el.setAttribute(name, value);
        }
      });
    });

    doc
      .querySelectorAll(`[${RESERVED_ATTR_NAME}]`)
      .forEach((el) => el.removeAttribute(RESERVED_ATTR_NAME));
    return new XMLSerializer().serializeToString(doc);
  }

  loadSvgString(svg: string): void {
    this.originalSvg = svg || "";
    if (this.editor) {
      this.options.isUpdatingFromTree = true;
      this.editor.setValue(this.originalSvg);
      this.options.isUpdatingFromTree = false;
    }
    this.updateTreeDoc();
    this.optimizeSvg();
    this.saveToHistory();
    m.redraw();
  }

  loadFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.originalSvg = String(
        (e.target && (e.target as FileReader).result) ?? "",
      );
      if (this.editor) {
        try {
          this.editor.setValue(this.originalSvg);
        } catch (err) {
          console.error("Failed to set editor value:", err);
          // Try to fix common SVG issues before setting
          try {
            // Try to sanitize the SVG by fixing common issues
            this.originalSvg = this.sanitizeSvg(this.originalSvg);
            this.editor.setValue(this.originalSvg);
          } catch (fixErr) {
            console.error("Failed to sanitize SVG:", fixErr);
            // Fall back to showing the SVG in a plain text modal
            alert(
              "The SVG file contains formatting issues that cannot be displayed in the editor. Please try a different file.",
            );
            return;
          }
        }
      } else {
        // If editor isn't ready yet, reinitialize it with the content
        setTimeout(() => {
          if (this.editor) {
            try {
              this.editor.setValue(this.originalSvg);
            } catch (err) {
              console.error("Failed to set editor value (delayed):", err);
            }
          }
        }, 100);
      }
      this.updateTreeDoc();
      this.optimizeSvg();

      // Always save to history after loading
      // First, trim history if we're not at the end
      if (this.historyPointer < this.history.length - 1) {
        // Trim history to current position
        this.history = this.history.slice(0, this.historyPointer + 1);
      }

      // Save current state to history
      this.saveToHistory();

      m.redraw();
    };
    reader.readAsText(file);
  }

  loadOptimizedFile(): void {
    const sourceSvg = this.getSourceSvg();
    if (!sourceSvg || !sourceSvg.trim() || !/<svg\b/i.test(sourceSvg)) {
      this.originalSvg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
      if (this.editor) {
        this.options.isUpdatingFromTree = true;
        this.editor.setValue(this.originalSvg);
        this.options.isUpdatingFromTree = false;
      }
      this.updateTreeDoc();
      this.optimizeSvg();
      this.saveToHistory();
      m.redraw();
      return;
    }
    this.optimizeSvg();
    if (this.optimizedSvg) {
      this.originalSvg = this.optimizedSvg;
      if (this.editor) {
        this.options.isUpdatingFromTree = true;
        this.editor.setValue(this.originalSvg);
        this.options.isUpdatingFromTree = false;
      }
      // Update tree doc to reflect the optimized content
      this.updateTreeDoc();
      this.saveToHistory();
      m.redraw();
    }
  }

  autocropCurrentSvg(): void {
    const sourceSvg = this.getSourceSvg();
    if (!sourceSvg || !sourceSvg.trim()) return;
    const croppedSvg = this.autocropSvg(sourceSvg, 3);
    this.originalSvg = croppedSvg;
    if (this.editor) {
      this.options.isUpdatingFromTree = true;
      this.editor.setValue(this.originalSvg);
      this.options.isUpdatingFromTree = false;
    }
    this.updateTreeDoc();
    this.optimizeSvg();
    this.saveToHistory();
    m.redraw();
  }

  roundNumbers(str: string, precision: number): string {
    return this.roundNumbersWithPrecision(str, precision, precision);
  }

  roundNumbersWithPrecision(
    svg: string,
    attrPrecision: number,
    pathPrecision: number,
  ): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");

    doc.querySelectorAll("*").forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name === "d") {
          attr.value = roundPathData(attr.value, pathPrecision);
          return;
        }
        if (NUMERIC_ATTRS.has(name)) {
          attr.value = roundNumericValueFixed(attr.value, attrPrecision);
          return;
        }
        if (NUMERIC_LIST_ATTRS.has(name)) {
          attr.value = roundNumericList(attr.value, attrPrecision);
        }
      });
    });

    return new XMLSerializer().serializeToString(doc);
  }

  removeTspanElements(svg: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");

    // Remove all tspan elements but keep their text content
    const tspans = doc.querySelectorAll("tspan");
    tspans.forEach((tspan) => {
      const parent = tspan.parentElement;
      if (parent) {
        // Move text content to parent
        if (tspan.textContent) {
          parent.insertBefore(doc.createTextNode(tspan.textContent), tspan);
        }
        parent.removeChild(tspan);
      }
    });

    return new XMLSerializer().serializeToString(doc);
  }

  removeStyling(svg: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");

    // Remove style elements
    const styles = doc.querySelectorAll("style");
    styles.forEach((style) => style.remove());

    // Remove style attributes
    const allElements = doc.querySelectorAll("*");
    allElements.forEach((el) => {
      el.removeAttribute("style");
      el.removeAttribute("class");
    });

    return new XMLSerializer().serializeToString(doc);
  }

  removeUnusedXlinkNamespace(svg: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const root = doc.querySelector("svg");
    if (!root) return svg;

    const hasXlinkHref = doc.querySelector("[xlink\\:href]");
    const hasHref = doc.querySelector("[href]");
    if (!hasXlinkHref && hasHref) {
      root.removeAttribute("xmlns:xlink");
    }
    if (!hasXlinkHref && !hasHref) {
      root.removeAttribute("xmlns:xlink");
    }

    return new XMLSerializer().serializeToString(doc);
  }

  removeDanglingNamespacedAttributes(svg: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");

    const xmlnsUri = "http://www.w3.org/2000/xmlns/";
    const xmlNsPrefix = "xmlns";
    const xmlPrefix = "xml";
    const xlinkPrefix = "xlink";

    const allElements = Array.from(doc.querySelectorAll("*"));
    allElements.forEach((el) => {
      const declaredPrefixes = new Set<string>([xmlNsPrefix, xmlPrefix]);

      let current: Element | null = el;
      while (current) {
        for (const attr of Array.from(current.attributes)) {
          if (attr.namespaceURI === xmlnsUri) {
            declaredPrefixes.add(attr.localName || "");
          } else if (attr.name === "xmlns") {
            declaredPrefixes.add("");
          }
        }
        current = current.parentElement;
      }

      Array.from(el.attributes).forEach((attr) => {
        if (attr.name === "xmlns" || attr.name.startsWith("xmlns:")) return;
        const prefix = attr.prefix || "";
        if (!prefix) return;
        if (prefix === xmlPrefix) return;
        if (prefix === xlinkPrefix && declaredPrefixes.has(xlinkPrefix)) return;
        if (!declaredPrefixes.has(prefix)) {
          el.removeAttribute(attr.name);
        }
      });
    });

    return new XMLSerializer().serializeToString(doc);
  }

  removeSvgRootDefaults(svg: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const root = doc.querySelector("svg") || doc.documentElement;
    if (!root) return svg;

    const defaults = {
      version: "1.1",
      baseProfile: "full",
      preserveAspectRatio: "xMidYMid meet",
    };

    Object.entries(defaults).forEach(([attr, value]) => {
      const current = root.getAttribute(attr);
      if (!current) return;
      if (current.trim() === value) {
        root.removeAttribute(attr);
      }
    });

    return new XMLSerializer().serializeToString(doc);
  }

  removeGroups(svg: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");

    // Flatten groups by moving their children to parent
    const groups = Array.from(doc.querySelectorAll("g"));
    groups.forEach((group) => {
      const parent = group.parentElement;
      if (parent) {
        // Move all children to parent
        while (group.firstChild) {
          parent.insertBefore(group.firstChild, group);
        }
        parent.removeChild(group);
      }
    });

    return new XMLSerializer().serializeToString(doc);
  }

  mergePathsAndCollapseGroups(svg: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const SVG_NS = "http://www.w3.org/2000/svg";

    const mergeableGroupAttrs = new Set([
      "fill",
      "stroke",
      "stroke-width",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-dasharray",
      "stroke-dashoffset",
      "stroke-miterlimit",
      "fill-rule",
      "opacity",
      "fill-opacity",
      "stroke-opacity",
      "clip-path",
      "mask",
      "filter",
      "vector-effect",
      "paint-order",
      "shape-rendering",
      "text-rendering",
    ]);

    function isPresentationAttr(name: string) {
      return mergeableGroupAttrs.has(name);
    }

    function normalizePathStart(d: string) {
      if (!d) return null;
      const trimmed = d.trim();
      if (!trimmed) return null;
      if (trimmed[0] === "M") return trimmed;
      if (trimmed[0] !== "m") return null;

      const rest = trimmed.slice(1).trim();
      if (!rest) return null;

      const parts = rest.split(/[\s,]+/).filter(Boolean);
      if (parts.length < 2) return null;
      const dx = parts[0];
      const dy = parts[1];
      const tail = parts.slice(2);

      if (tail.length === 0) {
        return `M${dx} ${dy}`;
      }

      const pairs = [];
      for (let i = 0; i < tail.length; i += 2) {
        if (i + 1 >= tail.length) return null;
        pairs.push(`${tail[i]} ${tail[i + 1]}`);
      }

      return `M${dx} ${dy} l ${pairs.join(" l ")}`;
    }

    function hasMarkerAttrs(element: Element) {
      return (
        element.hasAttribute("marker-start") ||
        element.hasAttribute("marker-mid") ||
        element.hasAttribute("marker-end")
      );
    }

    function canMergeGroup(group: Element) {
      const children = Array.from(group.children);
      if (children.length < 2) return false;
      if (!children.every((child) => child.tagName === "path")) return false;
      if (group.hasAttribute("transform")) return false;
      if (hasMarkerAttrs(group)) return false;
      if (children.some((child) => hasMarkerAttrs(child))) {
        return false;
      }
      return true;
    }

    function collectGroupAttrs(group: Element) {
      const attrs: Record<string, string> = {};
      Array.from(group.attributes).forEach((attr) => {
        if (isPresentationAttr(attr.name)) {
          attrs[attr.name] = attr.value;
        }
      });
      return attrs;
    }

    function getPathMergeKey(
      path: Element,
      groupAttrs: Record<string, string>,
    ): {
      key: string;
      effectiveAttrs: Record<string, string>;
      normalizedD: string;
    } | null {
      if (path.tagName !== "path") return null;
      if (hasMarkerAttrs(path)) return null;

      const d = path.getAttribute("d") || "";
      const normalizedD = normalizePathStart(d);
      if (!normalizedD) return null;

      const childAttrs: Record<string, string> = {};
      for (const attr of Array.from(path.attributes)) {
        if (attr.name === "d") continue;
        if (!isPresentationAttr(attr.name)) return null;
        childAttrs[attr.name] = attr.value;
      }

      const effectiveAttrs: Record<string, string> = { ...groupAttrs };
      Object.entries(childAttrs).forEach(([name, value]) => {
        effectiveAttrs[name] = value;
      });

      const key = JSON.stringify(
        Object.entries(effectiveAttrs).sort(([a], [b]) => a.localeCompare(b)),
      );

      return { key, effectiveAttrs, normalizedD };
    }

    function createMergedPathForRun(
      run: Element[],
      groupAttrs: Record<string, string>,
      effectiveAttrs: Record<string, string>,
      normalizedDs: string[],
    ): Element | null {
      if (run.length < 2) return null;

      const merged = doc.createElementNS(SVG_NS, "path");
      merged.setAttribute("d", normalizedDs.join(" "));

      Object.entries(effectiveAttrs).forEach(([name, value]) => {
        if (groupAttrs[name] !== value) {
          merged.setAttribute(name, value);
        }
      });

      const estimateOldSize = run.reduce(
        (sum, element) => sum + element.outerHTML.length,
        0,
      );
      const estimateNewSize = merged.outerHTML.length;
      if (estimateNewSize >= estimateOldSize) {
        return null;
      }

      return merged;
    }

    function mergePaths(group: Element) {
      const groupAttrs = collectGroupAttrs(group);
      const children = Array.from(group.children) as Element[];
      let mergedAny = false;
      let i = 0;

      while (i < children.length) {
        const current = children[i];
        const currentInfo = getPathMergeKey(current, groupAttrs);
        if (!currentInfo) {
          i++;
          continue;
        }

        const run = [current];
        const normalizedDs = [currentInfo.normalizedD];
        let j = i + 1;

        while (j < children.length) {
          const next = children[j];
          const nextInfo = getPathMergeKey(next, groupAttrs);
          if (!nextInfo || nextInfo.key !== currentInfo.key) break;
          run.push(next);
          normalizedDs.push(nextInfo.normalizedD);
          j++;
        }

        const merged = createMergedPathForRun(
          run,
          groupAttrs,
          currentInfo.effectiveAttrs,
          normalizedDs,
        );
        if (merged) {
          run[0].parentElement?.insertBefore(merged, run[0]);
          run.forEach((element) => element.remove());
          mergedAny = true;
        }

        i = j;
      }

      return mergedAny;
    }

    const groups = Array.from(doc.querySelectorAll("g"));
    groups.forEach((group) => {
      if (!canMergeGroup(group)) return;
      mergePaths(group);
    });

    // Collapse groups with a single child by moving presentation attrs to child
    const groupsToCollapse = Array.from(doc.querySelectorAll("g"));
    groupsToCollapse.forEach((group) => {
      const hasNonWhitespaceText = Array.from(group.childNodes).some((node) => {
        return node.nodeType === 3 && node.textContent.trim() !== "";
      });
      if (hasNonWhitespaceText) return;

      if (group.hasAttribute("transform")) return;

      const hasNonPresentationAttrs = Array.from(group.attributes).some(
        (attr) => !isPresentationAttr(attr.name),
      );
      if (hasNonPresentationAttrs) return;

      const children = Array.from(group.children);
      if (children.length !== 1) return;
      const child = children[0];

      Array.from(group.attributes).forEach((attr) => {
        if (!isPresentationAttr(attr.name)) return;
        if (!child.hasAttribute(attr.name)) {
          child.setAttribute(attr.name, attr.value);
        }
      });

      group.parentElement.insertBefore(child, group);
      group.remove();
    });

    return new XMLSerializer().serializeToString(doc);
  }

  removeDefaultValues(svg: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");

    const defaultValues = {
      "letter-spacing": ["0", "normal"],
      "word-spacing": ["0", "normal"],
      "paint-order": ["normal", "fill stroke markers", "markers stroke fill"],
      "fill-opacity": ["1"],
      "stroke-opacity": ["1"],
      opacity: ["1"],
      "clip-rule": ["nonzero"],
      "fill-rule": ["nonzero"],
      "stroke-miterlimit": ["4"],
      "stroke-linecap": ["butt"],
      "stroke-linejoin": ["miter", "round"],
      "xml:space": ["preserve"],
      "font-weight": ["400"],
    };

    const allElements = doc.querySelectorAll("*");
    allElements.forEach((el) => {
      Object.keys(defaultValues).forEach((attr) => {
        const value = el.getAttribute(attr);
        if (value && defaultValues[attr].includes(value)) {
          el.removeAttribute(attr);
        }
      });

      // Special handling for opacity >= 0.9
      const opacityValue = el.getAttribute("opacity");
      if (opacityValue) {
        const opacity = parseFloat(opacityValue);
        if (opacity >= 0.9) {
          el.removeAttribute("opacity");
        }
      }
    });

    return new XMLSerializer().serializeToString(doc);
  }

  removeFontAttributes(
    svg: string,
    removeFontFamily: boolean,
    removeFontSize: boolean,
  ): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");

    const allElements = doc.querySelectorAll("*");
    allElements.forEach((el) => {
      if (removeFontFamily) {
        el.removeAttribute("font-family");
      }
      if (removeFontSize) {
        el.removeAttribute("font-size");
      }
    });

    return new XMLSerializer().serializeToString(doc);
  }

  groupTextByAttributes(svg: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");

    // Find all text elements
    const textElements = Array.from(
      doc.querySelectorAll("text, tspan"),
    ) as Element[];

    if (textElements.length < 2) return svg; // Need at least 2 elements to group

    // Attributes we want to group by
    const groupableAttributes = [
      "font-family",
      "font-size",
      "text-anchor",
      "font-weight",
      "font-style",
    ];
    this.groupElementsByCommonAttributes(
      doc,
      ["text", "tspan"],
      groupableAttributes,
    );

    return new XMLSerializer().serializeToString(doc);
  }

  getGroupableAttributes(
    el: Element,
    groupableAttributes: string[],
  ): Record<string, string> {
    const attributes: Record<string, string> = {};
    groupableAttributes.forEach((attr) => {
      const value = el.getAttribute(attr);
      if (value !== null) {
        attributes[attr] = value;
      }
    });
    return attributes;
  }

  intersectGroupableAttributes(
    base: Record<string, string>,
    next: Record<string, string>,
  ): Record<string, string> {
    const intersection: Record<string, string> = {};
    Object.keys(base).forEach((attr) => {
      if (next[attr] === base[attr]) {
        intersection[attr] = base[attr];
      }
    });
    return intersection;
  }

  estimateGroupSavings(
    commonAttributes: Record<string, string>,
    elementCount: number,
  ): number {
    if (elementCount < 2) return 0;
    const attrSize = Object.entries(commonAttributes).reduce(
      (sum, [attr, value]) => {
        return sum + ` ${attr}="${value}"`.length;
      },
      0,
    );
    const groupOverhead = 7; // "<g></g>"
    return (elementCount - 1) * attrSize - groupOverhead;
  }

  groupRunByAttributes(
    parent: Element,
    run: Element[],
    groupableAttributes: string[],
  ): void {
    const grouped = new Set<Element>();
    let i = 0;

    while (i < run.length) {
      if (grouped.has(run[i])) {
        i++;
        continue;
      }

      let commonAttributes = this.getGroupableAttributes(
        run[i],
        groupableAttributes,
      );
      if (Object.keys(commonAttributes).length === 0) {
        i++;
        continue;
      }

      let bestGroup: {
        end: number;
        attrs: Record<string, string>;
        savings: number;
      } | null = null;
      let currentCommon: Record<string, string> = { ...commonAttributes };

      for (let j = i + 1; j < run.length; j++) {
        if (grouped.has(run[j])) break;

        const nextAttributes = this.getGroupableAttributes(
          run[j],
          groupableAttributes,
        );
        currentCommon = this.intersectGroupableAttributes(
          currentCommon,
          nextAttributes,
        );
        if (Object.keys(currentCommon).length === 0) break;

        const count = j - i + 1;
        const savings = this.estimateGroupSavings(currentCommon, count);
        if (savings > 0 && (!bestGroup || savings > bestGroup.savings)) {
          bestGroup = { end: j, attrs: { ...currentCommon }, savings };
        }
      }

      if (bestGroup) {
        const SVG_NS = "http://www.w3.org/2000/svg";
        const elementsToGroup = run.slice(i, bestGroup.end + 1);
        const group = parent.ownerDocument.createElementNS(SVG_NS, "g");

        Object.entries(bestGroup.attrs).forEach(([attr, value]) => {
          group.setAttribute(attr, value);
        });

        parent.insertBefore(group, elementsToGroup[0]);

        elementsToGroup.forEach((el) => {
          Object.keys(bestGroup.attrs).forEach((attr) => {
            el.removeAttribute(attr);
          });
          group.appendChild(el);
          grouped.add(el);
        });

        i = bestGroup.end + 1;
      } else {
        i++;
      }
    }
  }

  groupElementsByCommonAttributes(
    doc: Document,
    tagNames: string[],
    groupableAttributes: string[],
  ): void {
    const tagSet = new Set(tagNames.map((name) => name.toLowerCase()));
    const parents = new Set<Element>();

    doc.querySelectorAll(tagNames.join(",")).forEach((el) => {
      if (el.parentElement) parents.add(el.parentElement);
    });

    parents.forEach((parent) => {
      const children = Array.from(parent.children) as Element[];
      let i = 0;

      while (i < children.length) {
        const child = children[i];
        const childTag = child.tagName.toLowerCase();
        if (!tagSet.has(childTag)) {
          i++;
          continue;
        }

        const tagName = childTag;
        let runEnd = i;
        while (
          runEnd + 1 < children.length &&
          children[runEnd + 1].tagName.toLowerCase() === tagName
        ) {
          runEnd++;
        }

        const run = children.slice(i, runEnd + 1);
        this.groupRunByAttributes(parent, run, groupableAttributes);
        i = runEnd + 1;
      }
    });
  }

  groupSimilarElementsByType(svg: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");

    // Process different element types separately
    const elementTypes = [
      "path",
      "circle",
      "ellipse",
      "rect",
      "line",
      "polyline",
      "polygon",
    ];

    // Attributes that make sense to group for these element types
    const groupableAttributes = [
      "fill",
      "stroke",
      "stroke-width",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-dasharray",
      "stroke-dashoffset",
      "stroke-miterlimit",
      "fill-rule",
      "opacity",
      "fill-opacity",
      "stroke-opacity",
    ];

    this.groupElementsByCommonAttributes(
      doc,
      elementTypes,
      groupableAttributes,
    );

    return new XMLSerializer().serializeToString(doc);
  }

  combinePaths(svg: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const SVG_NS = "http://www.w3.org/2000/svg";

    const pathElements = Array.from(doc.querySelectorAll("path")) as Element[];
    if (pathElements.length < 2) return svg;

    // Group paths by their attributes (excluding 'd')
    const pathGroups = new Map<
      string,
      { attributes: Record<string, string>; paths: Element[] }
    >();

    pathElements.forEach((path) => {
      const attributes: Record<string, string> = {};
      Array.from(path.attributes).forEach((attr) => {
        if (attr.name !== "d") {
          attributes[attr.name] = attr.value;
        }
      });

      const signature = JSON.stringify(attributes);
      if (!pathGroups.has(signature)) {
        pathGroups.set(signature, { attributes, paths: [] });
      }
      const entry = pathGroups.get(signature);
      if (entry) entry.paths.push(path);
    });

    // Combine paths with identical attributes
    pathGroups.forEach(({ attributes, paths }) => {
      if (paths.length >= 2) {
        // Combine d attributes
        const combinedD = paths.map((path) => path.getAttribute("d")).join(" ");

        // Create new combined path
        const combinedPath = doc.createElementNS(SVG_NS, "path");
        combinedPath.setAttribute("d", combinedD);

        // Add other attributes
        Object.entries(attributes).forEach(([attr, value]) => {
          combinedPath.setAttribute(attr, value);
        });

        // Replace first path with combined path
        const firstPath = paths[0];
        firstPath.parentNode.insertBefore(combinedPath, firstPath);

        // Remove original paths
        paths.forEach((path) => path.remove());
      }
    });

    return new XMLSerializer().serializeToString(doc);
  }

  removeStrokeFromText(svg: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");

    // Find all text elements and remove stroke-related attributes
    const textElements = doc.querySelectorAll("text, tspan");
    textElements.forEach((el) => {
      el.removeAttribute("stroke");
      el.removeAttribute("stroke-width");
      el.removeAttribute("stroke-opacity");
      el.removeAttribute("stroke-dasharray");
      el.removeAttribute("stroke-dashoffset");
      el.removeAttribute("stroke-linecap");
      el.removeAttribute("stroke-linejoin");
      el.removeAttribute("stroke-miterlimit");
    });

    return new XMLSerializer().serializeToString(doc);
  }

  removeDuplicateDefs(svg: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");

    const defsElement = doc.querySelector("defs");
    if (!defsElement) return svg;

    // Get all children of defs
    const defChildren = Array.from(defsElement.children);
    const defsByContent = new Map<string, string>();
    const idMappings = new Map<string, string>();

    defChildren.forEach((child) => {
      // Create a normalized string representation of the element (without id)
      const childClone = child.cloneNode(true) as Element;
      childClone.removeAttribute("id");
      const normalized = new XMLSerializer().serializeToString(childClone);

      const originalId = child.getAttribute("id") || "";

      if (defsByContent.has(normalized)) {
        // This is a duplicate - map its ID to the first occurrence's ID
        const firstId = defsByContent.get(normalized);
        idMappings.set(originalId, firstId);

        // Remove the duplicate element
        child.remove();
      } else {
        // This is the first occurrence
        defsByContent.set(normalized, originalId);
      }
    });

    // Update all references in the document
    if (idMappings.size > 0) {
      const svgString = new XMLSerializer().serializeToString(doc);
      let updatedSvg = svgString;

      idMappings.forEach((newId, oldId) => {
        // Replace url(#oldId) with url(#newId)
        updatedSvg = updatedSvg.replace(
          new RegExp(`url\\(#${oldId}\\)`, "g"),
          `url(#${newId})`,
        );
        // Replace #oldId with #newId in other contexts
        updatedSvg = updatedSvg.replace(
          new RegExp(`#${oldId}`, "g"),
          `#${newId}`,
        );
      });

      return updatedSvg;
    }

    return new XMLSerializer().serializeToString(doc);
  }

  convertSodipodiArcs(svg: string): string {
    const SODIPODI_NS = "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd";
    const SVG_NS = "http://www.w3.org/2000/svg";

    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");

    const sodipodiArcs = Array.from(
      doc.querySelectorAll("circle, ellipse"),
    ).filter((el) => el.getAttributeNS(SODIPODI_NS, "type") === "arc");

    sodipodiArcs.forEach((arc) => {
      try {
        const cx = parseFloat(arc.getAttributeNS(SODIPODI_NS, "cx") || "0");
        const cy = parseFloat(arc.getAttributeNS(SODIPODI_NS, "cy") || "0");
        let rx = parseFloat(arc.getAttributeNS(SODIPODI_NS, "rx") || "0");
        let ry = parseFloat(arc.getAttributeNS(SODIPODI_NS, "ry") || "0");
        let startAngle = parseFloat(
          arc.getAttributeNS(SODIPODI_NS, "start") || "0",
        );
        let endAngle = parseFloat(
          arc.getAttributeNS(SODIPODI_NS, "end") || `${2 * Math.PI}`,
        );

        // Ensure radii are positive
        rx = Math.abs(rx);
        ry = Math.abs(ry);

        if (rx <= 0 || ry <= 0) {
          console.warn(
            "Skipping sodipodi arc with zero or negative radius:",
            arc,
          );
          // Clean up sodipodi attributes even if not converted
          Array.from(arc.attributes).forEach((attr) => {
            if (attr.name.startsWith("sodipodi:")) {
              arc.removeAttribute(attr.name);
            }
          });
          return; // Skip this arc
        }

        // Normalize angles to be within [0, 2*PI)
        startAngle = startAngle % (2 * Math.PI);
        if (startAngle < 0) startAngle += 2 * Math.PI;
        endAngle = endAngle % (2 * Math.PI);
        if (endAngle < 0) endAngle += 2 * Math.PI;

        const epsilon = 1e-6; // Small value for float comparison

        // Check if it's a full circle (or very close to it) AND a perfect circle (rx == ry)
        const isFullCircle =
          Math.abs(endAngle - startAngle) < epsilon ||
          Math.abs(Math.abs(endAngle - startAngle) - 2 * Math.PI) < epsilon;
        const isPerfectCircle = Math.abs(rx - ry) < epsilon;

        let newElement;

        if (isFullCircle && isPerfectCircle) {
          // Convert to a <circle> element for full circles
          newElement = doc.createElementNS(SVG_NS, "circle");
          newElement.setAttribute("cx", cx.toString());
          newElement.setAttribute("cy", cy.toString());
          newElement.setAttribute("r", rx.toString()); // For a circle, rx is the radius
        } else {
          // Convert to a <path> element for arcs/ellipses
          newElement = doc.createElementNS(SVG_NS, "path");
          const pathData = this.createEllipticalArcPath(
            cx,
            cy,
            rx,
            ry,
            startAngle,
            endAngle,
          );
          newElement.setAttribute("d", pathData);
        }

        // Copy all non-sodipodi attributes to the new element
        Array.from(arc.attributes).forEach((attr) => {
          if (
            !attr.name.startsWith("sodipodi:") &&
            !(
              newElement.tagName === "circle" &&
              (attr.name === "cx" || attr.name === "cy" || attr.name === "r")
            ) &&
            !(newElement.tagName === "path" && attr.name === "d")
          ) {
            newElement.setAttribute(attr.name, attr.value);
          }
        });

        arc.parentNode.replaceChild(newElement, arc);
      } catch (error) {
        console.warn("Failed to convert sodipodi arc:", error);
        // Even if conversion fails, remove sodipodi attributes to clean up the original element
        Array.from(arc.attributes).forEach((attr) => {
          if (attr.name.startsWith("sodipodi:")) {
            arc.removeAttribute(attr.name);
          }
        });
      }
    });

    return new XMLSerializer().serializeToString(doc);
  }

  createEllipticalArcPath(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    startAngle: number,
    endAngle: number,
  ) {
    // Convert polar coordinates to Cartesian for start and end points
    const startX = cx + rx * Math.cos(startAngle);
    const startY = cy + ry * Math.sin(startAngle);
    const endX = cx + rx * Math.cos(endAngle);
    const endY = cy + ry * Math.sin(endAngle);

    // Calculate the difference in angles to determine large-arc-flag and sweep-flag
    // The direction for sodipodi is usually positive (counter-clockwise on standard cartesian plane,
    // which translates to clockwise in SVG's Y-down coordinate system if sweep-flag is 1).
    let angleDiff = endAngle - startAngle;
    if (angleDiff < 0) {
      angleDiff += 2 * Math.PI; // Normalize angle difference to be positive
    }

    // large-arc-flag: 1 if angleDiff > PI, 0 otherwise
    const largeArcFlag = angleDiff > Math.PI ? 1 : 0;

    // sweep-flag: 1 for clockwise (positive angle increase), 0 for counter-clockwise.
    // Given sodipodi's positive angle convention for 'end' relative to 'start',
    // and SVG's default y-axis going down, a positive angle increase in sodipodi
    // usually means a clockwise sweep in SVG for the most direct path.
    // If endAngle < startAngle initially, it implies a counter-clockwise sweep.
    // However, after normalization, we need to be careful.
    // The simplest way to think about it for sodipodi's convention:
    // If endAngle is 'after' startAngle in the positive direction (0 to 2PI), sweepFlag should be 1.
    // If endAngle is 'before' startAngle (meaning it wrapped around), sweepFlag should be 0.
    // After normalization, if endAngle > startAngle, we assume positive sweep (clockwise for SVG).
    // If startAngle > endAngle, it means we crossed the 0/2PI boundary, implying a "negative" sweep,
    // which in SVG typically means `sweepFlag=0` if `endAngle` is reached by going CCW from `startAngle`.

    // A simpler heuristic for sweepFlag, assuming sodipodi's 'start' and 'end' define the arc
    // in a positive (counter-clockwise) direction on a standard mathematical coordinate system.
    // SVG's Y-axis is inverted. So, a counter-clockwise arc in math becomes a clockwise arc in SVG
    // if sweep-flag is 1.
    const sweepFlag = 1; // Assuming positive angle rotation from sodipodi translates to clockwise in SVG

    return `M ${startX} ${startY} A ${rx} ${ry} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}`;
  }

  // Helper to parse SVG length values (e.g., "10mm", "20px", "50")
  parseSvgLength(lengthStr: string | null, defaultVal = 0): number {
    if (typeof lengthStr !== "string") return defaultVal;

    const match = lengthStr.match(/^([\d.]+)([a-z]*)$/i);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase() || "px"; // Default to px if no unit

      if (this.unitConversion[unit]) {
        return value * this.unitConversion[unit];
      } else {
        // For unknown units, assume pixels if no unit is specified (e.g., "100")
        // If a unit is specified but unknown, it's safer to default to 0 or log a warning.
        console.warn(
          `Unknown SVG unit: "${unit}" in "${lengthStr}". Treating value as pixels.`,
        );
        return value; // Treat as pixels if unit is unrecognized
      }
    }
    // If no unit or conversion factor, just try to parse as float (plain number)
    return parseFloat(lengthStr) || defaultVal;
  }

  /**
   * Calculates the bounding box of the SVG content within its current coordinate system.
   * This method requires a browser environment to function correctly as it relies on
   * SVG DOM methods like `getBBox()`.
   * @param {string} svgString The SVG content as a string.
   * @returns {object|null} An object with {x, y, width, height} or null if calculation fails.
   */
  calculateContentBBox(
    svgString: string,
  ): { x: number; y: number; width: number; height: number } | null {
    // Create a temporary SVG element in a detached DOM fragment or hidden div
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.top = "-9999px";
    tempDiv.style.left = "-9999px";
    tempDiv.style.width = "0";
    tempDiv.style.height = "0";
    tempDiv.style.overflow = "hidden";
    document.body.appendChild(tempDiv); // Append to body to make getBBox work

    tempDiv.innerHTML = svgString;
    const svgElement = tempDiv.querySelector("svg");

    if (!svgElement) {
      document.body.removeChild(tempDiv);
      console.error(
        "No SVG element found in the provided string for BBox calculation.",
      );
      return null;
    }

    try {
      // Get the bounding box of the entire SVG content
      // This method accounts for all visible elements.
      // It returns an SVGRect which has x, y, width, height.
      // Important: This can fail or return 0,0,0,0 if the SVG is empty or has no renderable content.
      const bbox = svgElement.getBBox();

      // Check if bbox is valid (not empty)
      if (
        bbox.width === 0 &&
        bbox.height === 0 &&
        bbox.x === 0 &&
        bbox.y === 0
      ) {
        // This might indicate an empty SVG or elements with no rendering area.
        // Fallback to parsing viewBox or width/height if getBBox is effectively zero.
        // Or, if content is truly empty, return null.
        console.warn(
          "getBBox returned an empty bounding box. Trying to derive from SVG attributes.",
        );
        let currentWidth,
          currentHeight,
          minX = 0,
          minY = 0;
        let viewBoxAttr = svgElement.getAttribute("viewBox");
        if (viewBoxAttr) {
          const vbParts = viewBoxAttr.split(/\s+/).map(Number);
          minX = vbParts[0] || 0;
          minY = vbParts[1] || 0;
          currentWidth = vbParts[2] || 0;
          currentHeight = vbParts[3] || 0;
        } else {
          currentWidth = this.parseSvgLength(
            svgElement.getAttribute("width"),
            0,
          );
          currentHeight = this.parseSvgLength(
            svgElement.getAttribute("height"),
            0,
          );
        }

        if (currentWidth > 0 && currentHeight > 0) {
          return {
            x: minX,
            y: minY,
            width: currentWidth,
            height: currentHeight,
          };
        } else {
          console.error(
            "Could not determine content bounding box from getBBox or SVG attributes.",
          );
          return null;
        }
      }

      return {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      };
    } catch (e) {
      console.error("Error calculating SVG bounding box:", e);
      return null;
    } finally {
      document.body.removeChild(tempDiv); // Clean up the temporary element
    }
  }

  /**
   * Resizes an SVG by adjusting its viewBox and width/height attributes
   * to fit the content into a new canvas size while preserving aspect ratio.
   * @param {string} svg The SVG content as a string.
   * @param {number} newWidth The desired new width in pixels.
   * @param {number} newHeight The desired new height in pixels.
   * @returns {string} The resized SVG string.
   */
  resizeSvg(svg: string, newWidth: number, newHeight: number): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const svgElement = doc.documentElement;

    if (svgElement.tagName !== "svg") {
      console.error(
        "The provided SVG string does not contain an SVG element as its root.",
      );
      return svg;
    }

    if (!Number.isFinite(newWidth) || !Number.isFinite(newHeight)) {
      return svg;
    }

    const contentBBox = this.calculateContentBBox(svg);

    let finalViewBoxX, finalViewBoxY, finalViewBoxWidth, finalViewBoxHeight;

    if (contentBBox && contentBBox.width > 0 && contentBBox.height > 0) {
      // Apply flooring to x and y, and ceiling to the max x/y to ensure full visibility
      const x1 = Math.floor(contentBBox.x);
      const y1 = Math.floor(contentBBox.y);
      const x2 = Math.ceil(contentBBox.x + contentBBox.width);
      const y2 = Math.ceil(contentBBox.y + contentBBox.height);

      finalViewBoxX = x1;
      finalViewBoxY = y1;
      finalViewBoxWidth = x2 - x1;
      finalViewBoxHeight = y2 - y1;

      // Handle potential edge case where width/height might become 0 after rounding
      if (finalViewBoxWidth === 0 && contentBBox.width > 0) {
        finalViewBoxWidth = 1;
      }
      if (finalViewBoxHeight === 0 && contentBBox.height > 0) {
        finalViewBoxHeight = 1;
      }
    } else {
      console.warn(
        "Could not calculate content BBox reliably. Falling back to existing viewBox or a default.",
      );
      let currentWidth,
        currentHeight,
        minX = 0,
        minY = 0;
      let viewBoxAttr = svgElement.getAttribute("viewBox");

      if (viewBoxAttr) {
        const vbParts = viewBoxAttr.split(/\s+/).map(Number);
        minX = Math.floor(vbParts[0] || 0);
        minY = Math.floor(vbParts[1] || 0);
        currentWidth = Math.ceil(vbParts[2] || 0); // Round up width/height
        currentHeight = Math.ceil(vbParts[3] || 0);
      } else {
        minX = 0;
        minY = 0;
        currentWidth = Math.ceil(
          this.parseSvgLength(svgElement.getAttribute("width"), 100),
        );
        currentHeight = Math.ceil(
          this.parseSvgLength(svgElement.getAttribute("height"), 100),
        );
      }

      finalViewBoxX = minX;
      finalViewBoxY = minY;
      finalViewBoxWidth = currentWidth;
      finalViewBoxHeight = currentHeight;

      if (finalViewBoxWidth <= 0 || finalViewBoxHeight <= 0) {
        console.error(
          "Failed to determine a valid content area for resizing. Using a default 0 0 100 100 viewBox.",
        );
        finalViewBoxX = 0;
        finalViewBoxY = 0;
        finalViewBoxWidth = 100;
        finalViewBoxHeight = 100;
      }
    }

    // Set the new width and height for the SVG element
    svgElement.setAttribute("width", newWidth.toString());
    svgElement.setAttribute("height", newHeight.toString());

    // Set the viewBox with integer coordinates
    svgElement.setAttribute(
      "viewBox",
      `${finalViewBoxX} ${finalViewBoxY} ${finalViewBoxWidth} ${finalViewBoxHeight}`,
    );

    // preserveAspectRatio remains default 'xMidyMid meet' unless specified otherwise.

    return new XMLSerializer().serializeToString(doc);
  }

  /**
   * Crops the SVG viewBox to its content bounds with a margin.
   * @param {string} svg The SVG content as a string.
   * @param {number} margin The margin (in user units) to add around the content.
   * @returns {string} The cropped SVG string.
   */
  autocropSvg(svg: string, margin = 3): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const svgElement = doc.documentElement;

    if (svgElement.tagName !== "svg") {
      console.error(
        "The provided SVG string does not contain an SVG element as its root.",
      );
      return svg;
    }

    const contentBBox = this.calculateContentBBox(svg);
    if (!contentBBox || contentBBox.width <= 0 || contentBBox.height <= 0) {
      console.warn(
        "Could not calculate content BBox for autocrop. Leaving SVG unchanged.",
      );
      return svg;
    }

    const safeMargin = Number.isFinite(margin) ? margin : 0;
    const x1 = Math.floor(contentBBox.x - safeMargin);
    const y1 = Math.floor(contentBBox.y - safeMargin);
    const x2 = Math.ceil(contentBBox.x + contentBBox.width + safeMargin);
    const y2 = Math.ceil(contentBBox.y + contentBBox.height + safeMargin);

    let width = x2 - x1;
    let height = y2 - y1;

    if (width <= 0) width = 1;
    if (height <= 0) height = 1;

    svgElement.setAttribute("viewBox", `${x1} ${y1} ${width} ${height}`);
    return new XMLSerializer().serializeToString(doc);
  }

  sanitizeSvg(svg: string): string {
    if (!svg || typeof svg !== "string") return svg;

    try {
      // Try to parse and validate the SVG
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg, "image/svg+xml");
      const parseError = doc.querySelector("parsererror");
      if (parseError) {
        console.warn("SVG parsing error:", parseError.textContent);
        // Try to fix common issues
        svg = this.fixCommonSvgIssues(svg);
      }
    } catch (e) {
      console.warn("SVG sanitization failed, using original:", e);
    }
    return svg;
  }

  fixCommonSvgIssues(svg: string): string {
    // Try to fix common SVG issues
    let fixed = svg;

    // Fix malformed path data - handle missing numbers after operators
    // Pattern: ...124 6.8 18-12.51Z (where 18-12.51 should be separate numbers)
    fixed = fixed.replace(/(\d+)-(\d+(\.\d+)?)/g, "$1 $2");

    // Fix common encoding issues
    fixed = fixed.replace(/&gt;/g, ">");
    fixed = fixed.replace(/&lt;/g, "<");
    fixed = fixed.replace(/&amp;/g, "&");
    fixed = fixed.replace(/&quot;/g, '"');
    fixed = fixed.replace(/&apos;/g, "'");

    // Fix common whitespace issues
    fixed = fixed.replace(/>\s+</g, "><");

    return fixed;
  }

  updateTreeDoc(): void {
    const sourceSvg = this.getSourceSvg();
    if (!sourceSvg) {
      this.options.treeDoc = null;
      return;
    }
    const parser = new DOMParser();
    // Tree view reflects the editable source SVG
    const svgToParse = sourceSvg;
    this.options.treeDoc = parser.parseFromString(svgToParse, "image/svg+xml");
  }

  async optimizeSvg(): Promise<void> {
    const sourceSvg = this.getSourceSvg();
    if (!sourceSvg || !sourceSvg.trim() || !/<svg\b/i.test(sourceSvg)) {
      this.optimizedSvg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
      return;
    }

    if (!this.isOptimizationEnabled()) {
      this.optimizedSvg = sourceSvg;
      return;
    }

    try {
      let svg = sourceSvg;
      const preservedResult = this.injectPreserveMarkers(svg);
      svg = preservedResult.svg;

      // Convert sodipodi arcs BEFORE SVGO to prevent removal
      if (this.options.convertSodipodiArcs) {
        svg = this.convertSodipodiArcs(svg);
      }

      // First pass with SVGO
      const svgoResult = optimize(svg, {
        plugins: [
          "preset-default",
          "removeDoctype",
          "removeXMLProcInst",
          "removeComments",
          "removeMetadata",
          "removeTitle",
          "removeDesc",
          "removeUselessDefs",
          "removeEditorsNSData",
          "removeEmptyAttrs",
          "removeHiddenElems",
          "removeEmptyText",
          "removeEmptyContainers",
          "removeViewBox",
          "cleanupEnableBackground",
          "convertStyleToAttrs",
          "convertPathData",
          {
            name: "removeUnknownsAndDefaults",
            params: {
              keepDataAttrs: true,
              keepAriaAttrs: true,
              keepRoleAttr: true,
            },
          },
          "removeNonInheritableGroupAttrs",
          "removeUnusedNS",
          "cleanupIds",
          "cleanupNumericValues",
          "moveElemsAttrsToGroup",
          "moveGroupAttrsToElems",
          "collapseGroups",
          "removeRasterImages",
          "mergePaths",
          "convertShapeToPath",
          "sortAttrs",
          "removeDimensions",
        ],
      });

      svg = svgoResult.data;

      // Apply custom optimizations
      if (this.options.precision >= 0) {
        svg = collapseTransforms(svg);
        svg = this.roundNumbersWithPrecision(
          svg,
          this.options.precision,
          this.options.pathPrecision,
        );
      } else {
        svg = collapseTransforms(svg);
      }

      if (this.options.removeDefaultValues) {
        svg = this.removeDefaultValues(svg);
      }

      if (this.options.removeFontFamily || this.options.removeFontSize) {
        svg = this.removeFontAttributes(
          svg,
          this.options.removeFontFamily,
          this.options.removeFontSize,
        );
      }

      if (this.options.removeTspan) {
        svg = this.removeTspanElements(svg);
      }

      if (this.options.removeStyling) {
        svg = this.removeStyling(svg);
      }

      // Handle grouping based on mode
      if (this.options.groupingMode === "remove") {
        svg = this.removeGroups(svg);
      } else if (this.options.groupingMode === "group") {
        // Group similar elements only (disable aggressive path combining for now)
        svg = this.groupSimilarElementsByType(svg);
        // Note: combinePaths disabled as it's too aggressive
        // svg = this.combinePaths(svg);
      }

      // Remove duplicate definitions
      svg = this.removeDuplicateDefs(svg);

      // Remove stroke attributes from text elements
      svg = this.removeStrokeFromText(svg);

      // Group text elements by common attributes (always enabled for text optimization)
      svg = this.groupTextByAttributes(svg);

      // Merge simple path-only groups and collapse groups with a single child
      svg = this.mergePathsAndCollapseGroups(svg);

      // Remove unused xlink namespace if possible
      svg = this.removeUnusedXlinkNamespace(svg);

      // Remove default root attributes like version="1.1"
      svg = this.removeSvgRootDefaults(svg);

      if (this.options.useCustomDimensions) {
        svg = this.resizeSvg(
          svg,
          this.options.customWidth,
          this.options.customHeight,
        );
      }

      svg = this.restorePreservedAttributes(svg, preservedResult.preserved);
      svg = this.removeDanglingNamespacedAttributes(svg);

      this.optimizedSvg = svg;
    } catch (error) {
      console.error("Optimization error:", error);
      this.optimizedSvg = `<!-- Error optimizing SVG: ${error.message} -->\n${sourceSvg}`;
    }
  }

  downloadSvg(): void {
    const svg = this.getPreviewSvg();
    if (!svg) return;

    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "optimized.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getStats(): {
    originalSize: number;
    optimizedSize: number;
    reduction: number;
    reductionPercent: number;
  } {
    const sourceSvg = this.getSourceSvg() || "";
    const previewSvg = this.getPreviewSvg() || "";
    const originalSize = new Blob([sourceSvg]).size;
    const optimizedSize = new Blob([previewSvg]).size;
    const reduction = originalSize - optimizedSize;
    const reductionPercent =
      originalSize > 0 ? (reduction / originalSize) * 100 : 0;

    return {
      originalSize,
      optimizedSize,
      reduction,
      reductionPercent,
    };
  }

  formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  // History management methods
  saveToHistory(): void {
    if (this.isRestoringHistory) return;

    if (this.historyPointer < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyPointer + 1);
    }

    this.history.push({
      originalSvg: this.originalSvg,
      optimizedSvg: this.optimizedSvg,
      options: { ...this.options },
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.historyPointer = this.history.length - 1;
    this.notifyVscode();
    m.redraw();
  }

  notifyVscode(): void {
    if (!vscodeApi) return;
    vscodeApi.postMessage({
      type: "update-svg",
      svg: this.getSourceSvg() || "",
      optimizedSvg: this.getPreviewSvg() || "",
    });
  }

  canUndo(): boolean {
    return this.historyPointer > 0;
  }

  canRedo(): boolean {
    return this.historyPointer < this.history.length - 1;
  }

  undo(): void {
    if (!this.canUndo()) return;

    this.isRestoringHistory = true;
    this.historyPointer--;

    const state = this.history[this.historyPointer];
    this.originalSvg = state.originalSvg;
    this.optimizedSvg = state.optimizedSvg;
    this.options = { ...state.options };

    if (this.editor) {
      this.editor.setValue(this.originalSvg);
    }

    this.updateTreeDoc();
    this.optimizeSvg();
    this.isRestoringHistory = false;
    m.redraw();
  }

  redo(): void {
    if (!this.canRedo()) return;

    this.isRestoringHistory = true;
    this.historyPointer++;

    const state = this.history[this.historyPointer];
    this.originalSvg = state.originalSvg;
    this.optimizedSvg = state.optimizedSvg;
    this.options = { ...state.options };

    if (this.editor) {
      this.editor.setValue(this.originalSvg);
    }

    this.updateTreeDoc();
    this.optimizeSvg();
    this.isRestoringHistory = false;
    m.redraw();
  }
}

export const optimizer = new SVGOptimizer();
export type { OptimizeOptions, HistoryEntry };
export { SVGOptimizer };
