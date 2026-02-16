import m from "mithril";
import type { Vnode, VnodeDOM } from "mithril";
import { optimizer } from "./optimizer";
import { hasRoundableAttrs, roundAttrsRecursive } from "./svgUtils";
import { getElementByPath, getElementInSvgByPath } from "./treeUtils";

type UncontrolledInputAttrs = {
  value: string;
  onChange: (nextValue: string) => void;
  type?: string;
};

type UncontrolledInputElement = HTMLInputElement & {
  _uncontrolledAttrs?: UncontrolledInputAttrs;
  _uncontrolledBound?: boolean;
};

type TreeNodeAttrs = {
  node: Element;
  path: string;
  isRoot?: boolean;
  prefix?: string;
  isLast?: boolean;
};

export const TreeView: m.Component = {
  view() {
    if (!optimizer.getSourceSvg()) return m(".tree-view", "No SVG loaded");
    // Always update tree doc to ensure it reflects current state
    optimizer.updateTreeDoc();

    const svg = optimizer.options.treeDoc.querySelector("svg");

    if (!svg) return m(".tree-view", "Invalid SVG");

    return m(".tree-view", [
      m(".tree-content", [
        m(TreeNode, {
          node: svg,
          path: "0",
          isRoot: true,
          prefix: "",
          isLast: true,
        }),
      ]),
    ]);
  },
};

let dragSourcePath = null;
let dragOverPath = null;

const COMMON_ATTRIBUTE_SUGGESTIONS = [
  "id",
  "class",
  "style",
  "transform",
  "opacity",
  "display",
  "visibility",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "stroke-opacity",
  "clip-path",
  "mask",
  "filter",
  "vector-effect",
  "shape-rendering",
  "paint-order",
  "pointer-events",
];

const ATTRIBUTE_SUGGESTIONS_BY_TAG = {
  svg: ["width", "height", "viewBox", "preserveAspectRatio"],
  g: ["transform", "opacity"],
  path: ["d", "pathLength"],
  rect: ["x", "y", "width", "height", "rx", "ry"],
  circle: ["cx", "cy", "r"],
  ellipse: ["cx", "cy", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
  polyline: ["points"],
  polygon: ["points"],
  text: [
    "x",
    "y",
    "dx",
    "dy",
    "text-anchor",
    "dominant-baseline",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "letter-spacing",
    "word-spacing",
  ],
  tspan: [
    "x",
    "y",
    "dx",
    "dy",
    "text-anchor",
    "dominant-baseline",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "letter-spacing",
    "word-spacing",
  ],
  image: ["href", "x", "y", "width", "height", "preserveAspectRatio"],
  use: ["href", "x", "y", "width", "height"],
  stop: ["offset", "stop-color", "stop-opacity"],
  lineargradient: [
    "x1",
    "y1",
    "x2",
    "y2",
    "gradientUnits",
    "gradientTransform",
  ],
  radialgradient: [
    "cx",
    "cy",
    "r",
    "fx",
    "fy",
    "gradientUnits",
    "gradientTransform",
  ],
  clippath: ["clipPathUnits"],
  mask: ["maskUnits", "maskContentUnits", "x", "y", "width", "height"],
  pattern: [
    "patternUnits",
    "patternContentUnits",
    "x",
    "y",
    "width",
    "height",
    "patternTransform",
  ],
  marker: [
    "markerWidth",
    "markerHeight",
    "refX",
    "refY",
    "orient",
    "markerUnits",
    "viewBox",
    "preserveAspectRatio",
  ],
  symbol: ["viewBox", "preserveAspectRatio"],
};

const attributeDialogState: {
  isOpen: boolean;
  path: string | null;
  tagName: string;
  name: string;
  value: string;
  suggestions: string[];
  filteredSuggestions: string[];
  selectedSuggestionIndex: number;
  showSuggestionList: boolean;
} = {
  isOpen: false,
  path: null,
  tagName: "",
  name: "",
  value: "",
  suggestions: [],
  filteredSuggestions: [],
  selectedSuggestionIndex: 0,
  showSuggestionList: false,
};

function getAttributeSuggestionsForElement(element: Element) {
  const tagName = element.tagName.toLowerCase();
  const specific = ATTRIBUTE_SUGGESTIONS_BY_TAG[tagName] || [];
  const existing = Array.from(element.attributes).map((attr) => attr.name);
  const merged = [...existing, ...specific, ...COMMON_ATTRIBUTE_SUGGESTIONS];
  return Array.from(new Set(merged));
}

function openAttributeDialog(path: string) {
  const doc = optimizer.options.treeDoc;
  const element = getElementByPath(doc, path);
  if (!element) return;

  attributeDialogState.isOpen = true;
  attributeDialogState.path = path;
  attributeDialogState.tagName = element.tagName.toLowerCase();
  attributeDialogState.name = "";
  attributeDialogState.value = "";
  attributeDialogState.suggestions = getAttributeSuggestionsForElement(element);
  attributeDialogState.filteredSuggestions = getRankedAttributeSuggestions(
    "",
    attributeDialogState.suggestions,
  );
  attributeDialogState.selectedSuggestionIndex = 0;
  attributeDialogState.showSuggestionList = false;
  m.redraw();
}

function closeAttributeDialog() {
  attributeDialogState.isOpen = false;
  attributeDialogState.path = null;
  attributeDialogState.tagName = "";
  attributeDialogState.name = "";
  attributeDialogState.value = "";
  attributeDialogState.suggestions = [];
  attributeDialogState.filteredSuggestions = [];
  attributeDialogState.selectedSuggestionIndex = 0;
  attributeDialogState.showSuggestionList = false;
  m.redraw();
}

function isSubsequence(query: string, target: string): boolean {
  if (!query) return true;
  let qi = 0;
  for (let i = 0; i < target.length; i++) {
    if (target[i] === query[qi]) {
      qi++;
      if (qi === query.length) return true;
    }
  }
  return false;
}

function getSuggestionScore(query: string, candidate: string): number {
  const q = query.toLowerCase().trim();
  const c = candidate.toLowerCase();
  if (!q) return 0;
  if (c === q) return 1000;
  if (c.startsWith(q)) return 900 - (c.length - q.length);
  if (c.includes(q)) return 700 - c.indexOf(q);

  const queryTokens = q.split(/[^a-z0-9]+/).filter(Boolean);
  const candidateTokens = c.split(/[^a-z0-9]+/).filter(Boolean);

  if (queryTokens.length > 1 && candidateTokens.length >= queryTokens.length) {
    const positionalPrefixMatch = queryTokens.every((token, index) => {
      const candidateToken = candidateTokens[index];
      return Boolean(candidateToken && candidateToken.startsWith(token));
    });
    if (positionalPrefixMatch) {
      return 850 - (candidateTokens.length - queryTokens.length);
    }
  }

  if (queryTokens.length > 0) {
    const tokenMatch = queryTokens.every((token) =>
      candidateTokens.some(
        (candidateToken) =>
          candidateToken.startsWith(token) || candidateToken.includes(token),
      ),
    );
    if (tokenMatch) return 500 - queryTokens.length;
  }

  const compactQuery = q.replace(/[^a-z0-9]/g, "");
  const compactCandidate = c.replace(/[^a-z0-9]/g, "");
  if (compactQuery && isSubsequence(compactQuery, compactCandidate)) {
    return 300 - (compactCandidate.length - compactQuery.length);
  }

  return -1;
}

function getRankedAttributeSuggestions(
  query: string,
  suggestions: string[],
): string[] {
  const ranked = suggestions
    .map((suggestion) => ({
      suggestion,
      score: getSuggestionScore(query, suggestion),
    }))
    .filter((item) => query.trim() === "" || item.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.suggestion.localeCompare(b.suggestion);
    })
    .slice(0, 12)
    .map((item) => item.suggestion);

  return ranked;
}

function updateAttributeSuggestionState(preferredSuggestion?: string): void {
  const ranked = getRankedAttributeSuggestions(
    attributeDialogState.name,
    attributeDialogState.suggestions,
  );
  attributeDialogState.filteredSuggestions = ranked;

  if (ranked.length === 0) {
    attributeDialogState.selectedSuggestionIndex = -1;
    return;
  }

  if (preferredSuggestion) {
    const preferredIndex = ranked.indexOf(preferredSuggestion);
    if (preferredIndex >= 0) {
      attributeDialogState.selectedSuggestionIndex = preferredIndex;
      return;
    }
  }

  const current = Math.max(
    0,
    Math.min(attributeDialogState.selectedSuggestionIndex, ranked.length - 1),
  );
  attributeDialogState.selectedSuggestionIndex = current;
}

function syncDialogValueFromExistingAttribute(): void {
  const doc = optimizer.options.treeDoc;
  const element = getElementByPath(
    doc as Document,
    attributeDialogState.path as string,
  );
  if (!element) return;

  const existingValue = element.getAttribute(attributeDialogState.name.trim());
  if (existingValue !== null && attributeDialogState.value === "") {
    attributeDialogState.value = existingValue;
  }
}

function acceptSelectedAttributeSuggestion(): boolean {
  const { filteredSuggestions, selectedSuggestionIndex } = attributeDialogState;
  if (
    filteredSuggestions.length === 0 ||
    selectedSuggestionIndex < 0 ||
    selectedSuggestionIndex >= filteredSuggestions.length
  ) {
    return false;
  }

  const selected = filteredSuggestions[selectedSuggestionIndex];
  if (!selected || selected === attributeDialogState.name) {
    return false;
  }

  attributeDialogState.name = selected;
  updateAttributeSuggestionState(selected);
  syncDialogValueFromExistingAttribute();
  attributeDialogState.showSuggestionList = false;
  return true;
}

function applyAttributeDialog() {
  const name = attributeDialogState.name.trim();
  if (!name) return;

  const doc = optimizer.options.treeDoc;
  const element = getElementByPath(doc, attributeDialogState.path);
  if (!element) {
    closeAttributeDialog();
    return;
  }

  element.setAttribute(name, attributeDialogState.value);
  updateFromTree(doc);
  closeAttributeDialog();
}

export function renderAttributeDialog(): m.Children {
  if (!attributeDialogState.isOpen) return null;

  return m(
    ".attr-dialog-backdrop",
    {
      onclick: (e: MouseEvent) => {
        if (e.target === e.currentTarget) closeAttributeDialog();
      },
    },
    [
      m(
        ".attr-dialog",
        {
          onclick: (e: MouseEvent) => e.stopPropagation(),
        },
        [
          m(
            ".attr-dialog-title",
            `Add attribute to <${attributeDialogState.tagName}>`,
          ),
          m(".field", [
            m("label", "Attribute"),
            m("input#attr-name-input", {
              value: attributeDialogState.name,
              oncreate: ({ dom }: VnodeDOM) =>
                (dom as HTMLInputElement).focus(),
              onfocus: () => {
                attributeDialogState.showSuggestionList =
                  attributeDialogState.name.trim() !== "";
              },
              oninput: (e: Event) => {
                attributeDialogState.name = (
                  e.target as HTMLInputElement
                ).value;
                attributeDialogState.showSuggestionList =
                  attributeDialogState.name.trim() !== "";
                updateAttributeSuggestionState();
                syncDialogValueFromExistingAttribute();
              },
              onkeydown: (e: KeyboardEvent) => {
                e.stopPropagation();

                if (e.key === "Escape") {
                  e.preventDefault();
                  closeAttributeDialog();
                  return;
                }

                if (e.key === "ArrowDown") {
                  attributeDialogState.showSuggestionList =
                    attributeDialogState.name.trim() !== "";
                  if (attributeDialogState.filteredSuggestions.length > 0) {
                    e.preventDefault();
                    attributeDialogState.selectedSuggestionIndex =
                      (attributeDialogState.selectedSuggestionIndex + 1) %
                      attributeDialogState.filteredSuggestions.length;
                  }
                  return;
                }

                if (e.key === "ArrowUp") {
                  attributeDialogState.showSuggestionList =
                    attributeDialogState.name.trim() !== "";
                  if (attributeDialogState.filteredSuggestions.length > 0) {
                    e.preventDefault();
                    const count = attributeDialogState.filteredSuggestions.length;
                    attributeDialogState.selectedSuggestionIndex =
                      (attributeDialogState.selectedSuggestionIndex - 1 + count) %
                      count;
                  }
                  return;
                }

                if (e.key === "Tab") {
                  if (acceptSelectedAttributeSuggestion()) {
                    e.preventDefault();
                  }
                  return;
                }

                if (e.key === "Enter") {
                  e.preventDefault();
                  if (acceptSelectedAttributeSuggestion()) return;
                  applyAttributeDialog();
                }
              },
            }),
            attributeDialogState.showSuggestionList &&
              attributeDialogState.name.trim() !== "" &&
              attributeDialogState.filteredSuggestions.length > 0 &&
              m(
                ".attr-suggestion-list",
                attributeDialogState.filteredSuggestions.map(
                  (suggestion, index) =>
                    m(
                      "button.attr-suggestion-item",
                      {
                        class:
                          index === attributeDialogState.selectedSuggestionIndex
                            ? "selected"
                            : "",
                        type: "button",
                        onmouseenter: () => {
                          attributeDialogState.selectedSuggestionIndex = index;
                        },
                        onmousedown: (e: MouseEvent) => {
                          e.preventDefault();
                        },
                        onclick: () => {
                          attributeDialogState.name = suggestion;
                          updateAttributeSuggestionState(suggestion);
                          syncDialogValueFromExistingAttribute();
                          attributeDialogState.showSuggestionList = false;
                          const nameInput = document.getElementById(
                            "attr-name-input",
                          ) as HTMLInputElement | null;
                          nameInput?.focus();
                        },
                      },
                      suggestion,
                    ),
                ),
              ),
          ]),
          m(".field", [
            m("label", "Value"),
            m("input", {
              value: attributeDialogState.value,
              oninput: (e: Event) => {
                attributeDialogState.value = (
                  e.target as HTMLInputElement
                ).value;
              },
              onkeydown: (e: KeyboardEvent) => {
                e.stopPropagation();
                if (e.key === "Escape") {
                  e.preventDefault();
                  closeAttributeDialog();
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyAttributeDialog();
                }
              },
            }),
          ]),
          m(".actions", [
            m("button.btn", { onclick: () => closeAttributeDialog() }, "Cancel"),
            m(
              "button.btn.primary",
              { onclick: () => applyAttributeDialog() },
              "Add",
            ),
          ]),
        ],
      ),
    ],
  );
}

// Uncontrolled Input Component to prevent Mithril redraws from interfering with typing
const UncontrolledInput: m.Component<UncontrolledInputAttrs> = {
  oncreate({ dom, attrs }: VnodeDOM<UncontrolledInputAttrs>) {
    const input = dom as UncontrolledInputElement;
    input._uncontrolledAttrs = attrs;
    input.value = attrs.value;
    input.size = Math.max(1, Math.min(20, input.value.length));

    if (!input._uncontrolledBound) {
      input._uncontrolledBound = true;

      input.addEventListener("keydown", (e: KeyboardEvent) => {
        e.stopPropagation();
        const currentAttrs = input._uncontrolledAttrs;
        if (!currentAttrs) return;

        if (e.key === "Escape") {
          input.value = currentAttrs.value;
          input.blur();
        }
        if (e.key === "Enter") {
          input.blur();
        }
      });

      input.addEventListener("input", (e: Event) => {
        const target = e.target as HTMLInputElement;
        target.size = Math.max(1, Math.min(20, target.value.length));
      });

      input.addEventListener("change", () => {
        const currentAttrs = input._uncontrolledAttrs;
        if (!currentAttrs) return;

        currentAttrs.type = "change"; // Signal change
        if (input.value !== currentAttrs.value) {
          currentAttrs.onChange(input.value);
        }
      });
    }
  },
  onupdate({ dom, attrs }: VnodeDOM<UncontrolledInputAttrs>) {
    const input = dom as UncontrolledInputElement;
    input._uncontrolledAttrs = attrs;
    // Only update value from model if we are NOT currently editing/focused
    if (document.activeElement !== input) {
      input.value = attrs.value;
      input.size = Math.max(1, Math.min(20, input.value.length));
    }
  },
  view() {
    return m("input.attr-value");
  },
};

const TreeNode: m.Component<TreeNodeAttrs> = {
  view({ attrs }: Vnode<TreeNodeAttrs>) {
    const node = attrs.node;
    const path = attrs.path;
    const isRoot = Boolean(attrs.isRoot);
    const prefix = attrs.prefix ?? "";
    const isLast = Boolean(attrs.isLast);
    if (!node || node.nodeType !== 1) return null;

    const isSelected = optimizer.options.selectedElementPath === path;

    // For text and tspan elements, we want to include both children and text content
    let children: Array<Element | Text> = [];
    if (node.tagName === "text" || node.tagName === "tspan") {
      // Include both regular children and text nodes
      const allNodes = Array.from(node.childNodes) as Array<Element | Text>;
      children = allNodes.filter(
        (n) =>
          n.nodeType === 1 ||
          (n.nodeType === 3 && (n.textContent || "").trim() !== ""),
      );
    } else {
      // For other elements, just use regular children
      children = Array.from(node.children) as Element[];
    }

    const currentPrefix = prefix;
    const childPrefix = prefix + (isLast ? "   " : "│  ");
    const ornament = isRoot ? "" : isLast ? "└─ " : "├─ ";

    return m(".tree-node-wrapper", [
      m(
        ".tree-node-header",
        {
          id: `node-${path.replace(/\./g, "-")}`,
          class: `${isSelected ? "selected" : ""} ${dragOverPath === path ? "drag-over" : ""}`,
          draggable: !isRoot,
          ondragstart: (e: DragEvent) => {
            dragSourcePath = path;
            e.dataTransfer.setData("text/plain", path);
            e.stopPropagation();
          },
          ondragover: (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragOverPath = path;
          },
          ondragleave: () => {
            if (dragOverPath === path) dragOverPath = null;
          },
          ondrop: (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const sourcePath = e.dataTransfer
              ? e.dataTransfer.getData("text/plain")
              : "";
            if (sourcePath && sourcePath !== path) {
              moveElementTo(sourcePath, path);
            }
            dragOverPath = null;
            dragSourcePath = null;
          },
          onclick: (e: MouseEvent) => {
            e.stopPropagation();
            optimizer.options.selectedElementPath = path;
            highlightElement(path);
            m.redraw();
          },
        },
        [
          m("span.tree-prefix", currentPrefix + ornament),
          m("span.tag-name", node.tagName),
          m(
            ".attributes",
            Array.from(node.attributes).map((attr) =>
              m(".attribute", [
                m("span.attr-name", attr.name),
                m("span", "="),
                m(".attr-value-container", [
                  m(UncontrolledInput, {
                    value: attr.value,
                    onChange: (newValue) => {
                      node.setAttribute(attr.name, newValue);
                      updateFromTree(node.ownerDocument);
                    },
                  }),
                  attr.value.length > 50 && m(".attr-value-full", attr.value),
                ]),
                m(
                  "button.attr-remove",
                  {
                    title: `Remove ${attr.name}`,
                    onclick: (e) => {
                      e.stopPropagation();
                      node.removeAttribute(attr.name);
                      updateFromTree(node.ownerDocument);
                    },
                  },
                  "×",
                ),
              ]),
            ),
          ),
          m(".node-controls", [
            m(
              "button.control-btn",
              {
                title: "Add attribute",
                onclick: (e) => {
                  e.stopPropagation();
                  openAttributeDialog(path);
                },
              },
              "+",
            ),

            // ⭕ round-to-zero button (only if useful)
            isSelected &&
              hasRoundableAttrs(node) &&
              m(
                "button.control-btn",
                {
                  title: "Round numeric attributes to 0 decimals",
                  onclick: (e) => {
                    e.stopPropagation();
                    roundAttrsRecursive(node);
                    updateFromTree(node.ownerDocument);
                  },
                },
                "0",
              ),

            !isRoot &&
              m(
                "button.control-btn",
                {
                  onclick: (e) => {
                    e.stopPropagation();
                    moveElement(path, -1);
                  },
                },
                "↑",
              ),

            !isRoot &&
              m(
                "button.control-btn",
                {
                  onclick: (e) => {
                    e.stopPropagation();
                    moveElement(path, 1);
                  },
                },
                "↓",
              ),

            m(
              "button.control-btn.danger",
              {
                onclick: (e) => {
                  e.stopPropagation();
                  node.remove();
                  updateFromTree(node.ownerDocument);
                },
              },
              "×",
            ),
          ]),
        ],
      ),
      m(
        ".tree-node-children",
        children.map((child, index) => {
          // For text nodes, create a special representation
          if (child.nodeType === 3) {
            // Text node - create a special TreeNode-like representation
            const isLastChild = index === children.length - 1;
            const textOrnament = isLastChild ? "└─ " : "├─ ";
            const textPath = `${path}.[-${index + 1}]`;
            return m(".tree-node-wrapper", [
              m(
                ".tree-node-header",
                {
                  class: "text-node",
                  oncreate: (vnode) => {
                    const dom = vnode.dom as HTMLElement;
                    dom.onclick = (e) => {
                      e.stopPropagation();
                      console.log("Text node clicked:", {
                        path: textPath,
                        child,
                      });
                      optimizer.options.selectedElementPath = textPath;
                      highlightElement(textPath);
                      m.redraw();
                    };
                  },
                },
                [
                  m("span.tree-prefix", childPrefix + textOrnament),
                  m("span.tag-name", "[Text Node]"),
                  m(".attributes", [
                    m(".attribute", [
                      m("span.attr-name", "content"),
                      m("span", "="),
                      m(".attr-value-container", [
                        m(UncontrolledInput, {
                          value: child.textContent,
                          onChange: (newValue) => {
                            child.textContent = newValue;
                            updateFromTree(node.ownerDocument);
                          },
                        }),
                        child.textContent.length > 50 &&
                          m(".attr-value-full", child.textContent),
                      ]),
                    ]),
                  ]),
                ],
              ),
            ]);
          } else {
            // Regular element child
            const elementChild = child as Element;
            return m(TreeNode, {
              node: elementChild,
              path: `${path}.${index}`,
              prefix: childPrefix,
              isLast: index === children.length - 1,
            });
          }
        }),
      ),
    ]);
  },
};

function updateFromTree(doc: Document): void {
  optimizer.options.isUpdatingFromTree = true;
  optimizer.originalSvg = new XMLSerializer().serializeToString(doc);
  if (optimizer.editor) {
    optimizer.editor.setValue(optimizer.originalSvg);
  }
  optimizer.updateTreeDoc();
  optimizer.optimizeSvg();
  optimizer.saveToHistory();
  optimizer.options.isUpdatingFromTree = false;
  m.redraw();
}

function moveElementTo(sourcePath: string, targetPath: string): void {
  if (sourcePath === targetPath) return;

  const doc = optimizer.options.treeDoc;
  const source = getElementByPath(doc, sourcePath);
  const target = getElementByPath(doc, targetPath);

  if (source && target) {
    const targetParent = target.parentElement;

    if (target.tagName === "g" || target.tagName === "svg") {
      target.insertBefore(source, target.firstChild);
    } else if (targetParent) {
      targetParent.insertBefore(source, target);
    }

    updateFromTree(doc);
  }
}

function moveElement(path: string, direction: number): void {
  const doc = optimizer.options.treeDoc;
  const element = getElementByPath(doc, path);

  if (element && element.parentElement) {
    const parent = element.parentElement;
    const index = Array.from(parent.children).indexOf(element);
    const newIndex = index + direction;

    if (newIndex >= 0 && newIndex < parent.children.length) {
      if (direction === -1) {
        parent.insertBefore(element, parent.children[newIndex]);
      } else {
        parent.insertBefore(element, parent.children[newIndex].nextSibling);
      }

      const pathParts = path.split(".");
      pathParts[pathParts.length - 1] = String(newIndex);
      optimizer.options.selectedElementPath = pathParts.join(".");

      updateFromTree(doc);
    }
  }
}

function highlightElement(path: string): void {
  console.log("highlightElement called with:", path);
  const previewContainer = document.querySelector(
    ".preview-container",
  ) as HTMLElement | null;
  const previewSvg = previewContainer
    ? (previewContainer.querySelector("svg") as SVGGraphicsElement | null)
    : null;
  if (!previewSvg) {
    console.log("No preview SVG found!");
    return;
  }

  previewSvg
    .querySelectorAll(".highlighted-preview")
    .forEach((el) => el.classList.remove("highlighted-preview"));

  const targetEl = getElementInSvgByPath(
    previewSvg,
    path,
  ) as SVGGraphicsElement | null;
  console.log("Target element:", targetEl);

  if (targetEl && typeof targetEl.getBBox === "function") {
    try {
      targetEl.classList.add("highlighted-preview");
      console.log("Element highlighted");
    } catch (e) {
      console.warn("Could not highlight element:", e);
    }
  } else {
    console.log(
      "Could not highlight element: targetEl not found or no getBBox",
    );
  }
}
