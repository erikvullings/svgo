import m from 'mithril';
import { optimize } from 'svgo/browser';

const ROUNDABLE_ATTRS = new Set([
  'x', 'y', 'cx', 'cy',
  'width', 'height',
  'r', 'rx', 'ry'
]);

const ZERO_SENSITIVE_ATTRS = new Set([
  'width', 'height',
  'r', 'rx', 'ry'
]);

const NUMERIC_ATTRS = new Set([
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy',
  'r', 'rx', 'ry', 'width', 'height',
  'dx', 'dy', 'font-size', 'stroke-width',
  'opacity', 'fill-opacity', 'stroke-opacity',
  'stroke-dashoffset', 'stroke-miterlimit',
  'letter-spacing', 'word-spacing',
  'pathlength'
]);

const NUMERIC_LIST_ATTRS = new Set([
  'viewbox', 'points', 'stroke-dasharray'
]);

const KNOWN_SVG_ATTRS = new Set([
  'id', 'class', 'style', 'transform', 'opacity', 'display', 'visibility',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit',
  'stroke-opacity', 'clip-path', 'mask', 'filter', 'vector-effect',
  'shape-rendering', 'text-rendering', 'paint-order', 'pointer-events',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'width', 'height', 'd', 'points', 'pathlength',
  'dx', 'dy', 'font-family', 'font-size', 'font-weight', 'font-style',
  'text-anchor', 'dominant-baseline', 'letter-spacing', 'word-spacing',
  'viewbox', 'preserveaspectratio',
  'href', 'xlink:href',
  'offset', 'stop-color', 'stop-opacity',
  'gradientunits', 'gradienttransform', 'fx', 'fy',
  'markerwidth', 'markerheight', 'refx', 'refy', 'orient', 'markerunits',
  'patternunits', 'patterncontentunits', 'patterntransform',
  'maskunits', 'maskcontentunits', 'clippathunits',
  'version', 'baseprofile',
  'xmlns', 'xmlns:xlink', 'xml:space'
]);

const PRESERVE_ATTR_NAMES = new Set(['role', 'tabindex']);
const PRESERVE_ATTR_PREFIXES = ['data-', 'aria-'];
const BLOCKED_ATTR_PREFIXES = ['inkscape:', 'sodipodi:'];
const RESERVED_ATTR_NAME = 'data-cx-id';

function hasRoundableAttrs(node) {
  if (!node || node.nodeType !== 1) return false;

  for (const attr of Array.from(node.attributes || [])) {
    if (ROUNDABLE_ATTRS.has(attr.name)) return true;
  }

  return Array.from(node.children || []).some(hasRoundableAttrs);
}

function extractTranslate(transform) {
  if (!transform) return { dx: 0, dy: 0, rest: '' };

  let dx = 0;
  let dy = 0;

  const rest = transform.replace(/translate\(\s*([^)]+)\)/g, (_, args) => {
    const parts = args.split(/[\s,]+/).map(Number);
    dx += parts[0] || 0;
    dy += parts[1] || 0;
    return '';
  }).trim();

  return { dx, dy, rest };
}

function roundAttrsRecursive(node) {
  if (!node || node.nodeType !== 1) return;

  let dx = 0;
  let dy = 0;

  const transform = node.getAttribute('transform');
  if (transform) {
    const extracted = extractTranslate(transform);
    dx = extracted.dx;
    dy = extracted.dy;

    if (extracted.rest) {
      node.setAttribute('transform', extracted.rest);
    } else {
      node.removeAttribute('transform');
    }
  }

  for (const attr of Array.from(node.attributes)) {
    if (!ROUNDABLE_ATTRS.has(attr.name)) continue;

    let num = parseFloat(attr.value);
    if (!Number.isFinite(num)) continue;

    // Apply translation first
    if (attr.name === 'x' || attr.name === 'cx') {
      num += dx;
    } else if (attr.name === 'y' || attr.name === 'cy') {
      num += dy;
    }

    const rounded = Math.round(num);

    const newValue =
      ZERO_SENSITIVE_ATTRS.has(attr.name) && rounded === 0
        ? num.toFixed(1)
        : rounded.toFixed(0);

    node.setAttribute(attr.name, newValue);
  }

  Array.from(node.children).forEach(roundAttrsRecursive);
}

function roundNumericValue(value, precision) {
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return value;

  const absNum = Math.abs(num);
  let dynamicPrecision = precision;

  if (absNum >= 100) {
    dynamicPrecision = Math.max(0, precision - 2);
  } else if (absNum >= 10) {
    dynamicPrecision = Math.max(0, precision - 1);
  } else if (absNum >= 1) {
    dynamicPrecision = precision;
  } else {
    dynamicPrecision = Math.min(precision + 1, 5);
  }

  if (dynamicPrecision === 0) {
    return formatNumberCompact(Math.round(num));
  }

  const rounded = parseFloat(num.toFixed(dynamicPrecision));
  return formatNumberCompact(rounded);
}

function roundNumericValueFixed(value, precision) {
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return value;
  if (precision === 0) return formatNumberCompact(Math.round(num));
  const rounded = parseFloat(num.toFixed(precision));
  return formatNumberCompact(rounded);
}

function formatNumberCompact(num) {
  if (!Number.isFinite(num)) return String(num);
  if (num === 0) return '0';
  let result = num.toString();
  if (result.startsWith('0.')) {
    result = result.substring(1);
  } else if (result.startsWith('-0.')) {
    result = '-' + result.substring(2);
  }
  return result;
}

function roundNumericList(value, precision) {
  return value.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, match =>
    roundNumericValueFixed(match, precision)
  );
}

function roundPathData(value, precision) {
  return value.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, match =>
    roundNumericValueFixed(match, precision)
  );
}

function applyTranslateToPoints(value, dx, dy) {
  const parts = value.trim().split(/[\s,]+/).map(Number);
  if (parts.length < 2) return value;
  const result = [];
  for (let i = 0; i < parts.length; i += 2) {
    const x = parts[i];
    const y = parts[i + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return value;
    result.push(formatNumberCompact(x + dx), formatNumberCompact(y + dy));
  }
  return result.join(' ');
}

function translatePathData(pathData, dx, dy) {
  const temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  temp.setAttribute('d', pathData);
  if (!temp.getPathData) {
    return translatePathDataFallback(pathData, dx, dy);
  }

  let segments;
  try {
    segments = temp.getPathData({ normalize: true });
  } catch (e) {
    try {
      segments = temp.getPathData();
    } catch (err) {
      return translatePathDataFallback(pathData, dx, dy);
    }
  }
  segments.forEach(seg => {
    switch (seg.type) {
      case 'M':
      case 'L':
      case 'T':
        seg.values[0] += dx;
        seg.values[1] += dy;
        break;
      case 'H':
        seg.values[0] += dx;
        break;
      case 'V':
        seg.values[0] += dy;
        break;
      case 'C':
        seg.values[0] += dx;
        seg.values[1] += dy;
        seg.values[2] += dx;
        seg.values[3] += dy;
        seg.values[4] += dx;
        seg.values[5] += dy;
        break;
      case 'S':
      case 'Q':
        seg.values[0] += dx;
        seg.values[1] += dy;
        seg.values[2] += dx;
        seg.values[3] += dy;
        break;
      case 'A':
        seg.values[5] += dx;
        seg.values[6] += dy;
        break;
      default:
        break;
    }
  });

  return segments.map(seg => {
    const values = seg.values.length ? seg.values.join(' ') : '';
    return `${seg.type}${values ? ' ' + values : ''}`;
  }).join(' ');
}

function translatePathDataFallback(pathData, dx, dy) {
  const tokenRe = /([a-zA-Z])|([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/g;
  const tokens = [];
  let match;
  while ((match = tokenRe.exec(pathData)) !== null) {
    if (match[1]) {
      tokens.push({ type: 'cmd', value: match[1] });
    } else {
      tokens.push({ type: 'num', value: match[2] });
    }
  }

  if (tokens.length === 0) return null;

  const paramCounts = {
    m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0
  };

  let i = 0;
  let cmd = null;
  let firstCommand = true;
  let currentX = 0;
  let currentY = 0;
  let subStartX = 0;
  let subStartY = 0;
  const out = [];

  function readNumbers() {
    const nums = [];
    while (i < tokens.length && tokens[i].type === 'num') {
      nums.push(parseFloat(tokens[i].value));
      i += 1;
    }
    return nums;
  }

  while (i < tokens.length) {
    if (tokens[i].type === 'cmd') {
      cmd = tokens[i].value;
      i += 1;
    } else if (!cmd) {
      return null;
    }

    const lower = cmd.toLowerCase();
    const isAbs = cmd === cmd.toUpperCase();
    const paramCount = paramCounts[lower];
    if (paramCount === undefined) return null;

    if (lower === 'z') {
      out.push('Z');
      currentX = subStartX;
      currentY = subStartY;
      firstCommand = false;
      continue;
    }

    const nums = readNumbers();
    if (nums.length < paramCount || nums.length % paramCount !== 0) return null;

    for (let n = 0; n < nums.length; n += paramCount) {
      const chunk = nums.slice(n, n + paramCount);

      switch (lower) {
        case 'm': {
          const isFirstPair = n === 0;
          if (!isAbs && firstCommand) {
            currentX += chunk[0];
            currentY += chunk[1];
            out.push('M', formatNumberCompact(currentX + dx), formatNumberCompact(currentY + dy));
          } else if (isAbs) {
            currentX = chunk[0];
            currentY = chunk[1];
            if (isFirstPair) {
              out.push('M', formatNumberCompact(currentX + dx), formatNumberCompact(currentY + dy));
            } else {
              out.push('L', formatNumberCompact(currentX + dx), formatNumberCompact(currentY + dy));
            }
          } else {
            currentX += chunk[0];
            currentY += chunk[1];
            if (isFirstPair) {
              out.push('m', formatNumberCompact(chunk[0]), formatNumberCompact(chunk[1]));
            } else {
              out.push('l', formatNumberCompact(chunk[0]), formatNumberCompact(chunk[1]));
            }
          }
          if (isFirstPair) {
            subStartX = currentX;
            subStartY = currentY;
          }
          break;
        }
        case 'l': {
          if (isAbs) {
            currentX = chunk[0];
            currentY = chunk[1];
            out.push('L', formatNumberCompact(currentX + dx), formatNumberCompact(currentY + dy));
          } else {
            currentX += chunk[0];
            currentY += chunk[1];
            out.push('l', formatNumberCompact(chunk[0]), formatNumberCompact(chunk[1]));
          }
          break;
        }
        case 'h': {
          if (isAbs) {
            currentX = chunk[0];
            out.push('H', formatNumberCompact(currentX + dx));
          } else {
            currentX += chunk[0];
            out.push('h', formatNumberCompact(chunk[0]));
          }
          break;
        }
        case 'v': {
          if (isAbs) {
            currentY = chunk[0];
            out.push('V', formatNumberCompact(currentY + dy));
          } else {
            currentY += chunk[0];
            out.push('v', formatNumberCompact(chunk[0]));
          }
          break;
        }
        case 'c': {
          if (isAbs) {
            out.push('C',
              formatNumberCompact(chunk[0] + dx),
              formatNumberCompact(chunk[1] + dy),
              formatNumberCompact(chunk[2] + dx),
              formatNumberCompact(chunk[3] + dy),
              formatNumberCompact(chunk[4] + dx),
              formatNumberCompact(chunk[5] + dy)
            );
            currentX = chunk[4];
            currentY = chunk[5];
          } else {
            out.push('c',
              formatNumberCompact(chunk[0]),
              formatNumberCompact(chunk[1]),
              formatNumberCompact(chunk[2]),
              formatNumberCompact(chunk[3]),
              formatNumberCompact(chunk[4]),
              formatNumberCompact(chunk[5])
            );
            currentX += chunk[4];
            currentY += chunk[5];
          }
          break;
        }
        case 's': {
          if (isAbs) {
            out.push('S',
              formatNumberCompact(chunk[0] + dx),
              formatNumberCompact(chunk[1] + dy),
              formatNumberCompact(chunk[2] + dx),
              formatNumberCompact(chunk[3] + dy)
            );
            currentX = chunk[2];
            currentY = chunk[3];
          } else {
            out.push('s',
              formatNumberCompact(chunk[0]),
              formatNumberCompact(chunk[1]),
              formatNumberCompact(chunk[2]),
              formatNumberCompact(chunk[3])
            );
            currentX += chunk[2];
            currentY += chunk[3];
          }
          break;
        }
        case 'q': {
          if (isAbs) {
            out.push('Q',
              formatNumberCompact(chunk[0] + dx),
              formatNumberCompact(chunk[1] + dy),
              formatNumberCompact(chunk[2] + dx),
              formatNumberCompact(chunk[3] + dy)
            );
            currentX = chunk[2];
            currentY = chunk[3];
          } else {
            out.push('q',
              formatNumberCompact(chunk[0]),
              formatNumberCompact(chunk[1]),
              formatNumberCompact(chunk[2]),
              formatNumberCompact(chunk[3])
            );
            currentX += chunk[2];
            currentY += chunk[3];
          }
          break;
        }
        case 't': {
          if (isAbs) {
            out.push('T',
              formatNumberCompact(chunk[0] + dx),
              formatNumberCompact(chunk[1] + dy)
            );
            currentX = chunk[0];
            currentY = chunk[1];
          } else {
            out.push('t',
              formatNumberCompact(chunk[0]),
              formatNumberCompact(chunk[1])
            );
            currentX += chunk[0];
            currentY += chunk[1];
          }
          break;
        }
        case 'a': {
          if (isAbs) {
            out.push('A',
              formatNumberCompact(chunk[0]),
              formatNumberCompact(chunk[1]),
              formatNumberCompact(chunk[2]),
              formatNumberCompact(chunk[3]),
              formatNumberCompact(chunk[4]),
              formatNumberCompact(chunk[5] + dx),
              formatNumberCompact(chunk[6] + dy)
            );
            currentX = chunk[5];
            currentY = chunk[6];
          } else {
            out.push('a',
              formatNumberCompact(chunk[0]),
              formatNumberCompact(chunk[1]),
              formatNumberCompact(chunk[2]),
              formatNumberCompact(chunk[3]),
              formatNumberCompact(chunk[4]),
              formatNumberCompact(chunk[5]),
              formatNumberCompact(chunk[6])
            );
            currentX += chunk[5];
            currentY += chunk[6];
          }
          break;
        }
        default:
          return null;
      }
      firstCommand = false;
    }
  }

  return out.join(' ');
}

function collapseTransforms(svg) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) return svg;

    function canTranslate(el) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'g' || tag === 'svg') {
        return Array.from(el.children).every(child => canTranslate(child));
      }
      if (tag === 'path') {
        const d = el.getAttribute('d');
        if (!d) return true;
      if (typeof document.createElementNS === 'function') {
        const temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        if (typeof temp.getPathData === 'function') return true;
      }
      return translatePathDataFallback(d, 0, 0) !== null;
      }
      return true;
    }

  function applyTranslate(el, dx, dy) {
    if (dx === 0 && dy === 0) return true;

    const tag = el.tagName.toLowerCase();
    if (tag === 'g' || tag === 'svg') {
      if (!canTranslate(el)) return false;
      Array.from(el.children).forEach(child => {
        applyTranslate(child, dx, dy);
      });
      return true;
    }

    if (tag === 'path') {
      const d = el.getAttribute('d');
      if (d) {
        const translated = translatePathData(d, dx, dy);
        if (translated) {
          el.setAttribute('d', translated);
        } else {
          // Can't translate path reliably without path data API
          return false;
        }
      }
    }

    if (el.hasAttribute('points')) {
      const points = el.getAttribute('points');
      const translated = applyTranslateToPoints(points, dx, dy);
      el.setAttribute('points', translated);
    }

    const xAttrs = ['x', 'x1', 'x2', 'cx'];
    const yAttrs = ['y', 'y1', 'y2', 'cy'];

    xAttrs.forEach(attr => {
      if (el.hasAttribute(attr)) {
        const val = parseFloat(el.getAttribute(attr));
        if (Number.isFinite(val)) {
          el.setAttribute(attr, formatNumberCompact(val + dx));
        }
      }
    });

    yAttrs.forEach(attr => {
      if (el.hasAttribute(attr)) {
        const val = parseFloat(el.getAttribute(attr));
        if (Number.isFinite(val)) {
          el.setAttribute(attr, formatNumberCompact(val + dy));
        }
      }
    });

    for (const child of Array.from(el.children)) {
      if (!applyTranslate(child, dx, dy)) return false;
    }
    return true;
  }

  Array.from(doc.querySelectorAll('[transform]')).forEach(el => {
    const transform = el.getAttribute('transform');
    if (!transform) return;
    const extracted = extractTranslate(transform);
    if (extracted.rest) {
      // Only remove pure translate transforms
      el.setAttribute('transform', transform);
      return;
    }

    let applied = true;
    if (extracted.dx || extracted.dy) {
      applied = applyTranslate(el, extracted.dx, extracted.dy);
    }

    if (applied) {
      el.removeAttribute('transform');
    } else {
      el.setAttribute('transform', transform);
    }
  });

  return new XMLSerializer().serializeToString(doc);
}


// TypeScript-like implementation in JavaScript
class SVGOptimizer {
  constructor() {
    this.originalSvg = '';
    this.optimizedSvg = '';
    this.editor = null;
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
      groupingMode: 'group', // 'group', 'remove', or 'none'
      viewMode: 'code', // 'code', 'tree'
      selectedElementPath: null, // JSON path or similar to track selected element
      treeDoc: null, // Parsed DOM for the Tree View
      isUpdatingFromTree: false // Flag to prevent redundant re-parsing
    };
    this.unitConversion = {
      'px': 1,
      'pt': 1.25,  // 1pt = 1.25px (1/72 inch * 96 px/inch)
      'pc': 15,    // 1pc = 12pt = 15px
      'mm': 3.7795275591, // 1mm = 96/25.4 px
      'cm': 37.795275591, // 1cm = 10mm
      'in': 96     // 1in = 96px
    };
    this.isRestoringHistory = false;
    this.copyStatus = 'idle';
    this.copyResetTimer = null;
    // Initialize with empty state
    this.saveToHistory();

    // Ensure we start with proper history state
    this.historyPointer = 0;
  }

  getSourceSvg() {
    if (this.editor && typeof this.editor.getValue === 'function') {
      return this.editor.getValue();
    }
    return this.originalSvg;
  }

  isOptimizationEnabled() {
    const hasRounding = (this.options.precision > 0) || (this.options.pathPrecision > 0);
    const hasToggles = this.options.removeDefaultValues ||
      this.options.removeFontFamily ||
      this.options.removeFontSize ||
      this.options.removeTspan ||
      this.options.removeStyling ||
      this.options.convertSodipodiArcs ||
      this.options.useCustomDimensions;
    const hasGrouping = this.options.groupingMode !== 'none';
    return hasRounding || hasToggles || hasGrouping;
  }

  getPreviewSvg() {
    if (!this.isOptimizationEnabled()) {
      return this.getSourceSvg();
    }
    return this.optimizedSvg || this.getSourceSvg();
  }

  async initializeEditor() {
    return new Promise((resolve) => {
      require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs' } });
      require(['vs/editor/editor.main'], () => {
        // Wait for the DOM element to be available
        const checkContainer = () => {
          const container = document.getElementById('editor');
          if (container) {

            monaco.languages.register({ id: 'xml' });
            monaco.languages.setLanguageConfiguration('xml', {
              brackets: [['<', '>']],
              autoClosingPairs: [
                { open: '<', close: '>' },
                { open: '"', close: '"' },
                { open: "'", close: "'" }
              ]
            });
            this.editor = monaco.editor.create(container, {
              value: this.originalSvg || '<!-- Paste your SVG code here or load a file -->',
              language: 'xml',
              theme: 'vs-dark',
              automaticLayout: true,
              minimap: { enabled: false },
              wordWrap: 'on'
            });

            this.editor.onDidChangeModelContent(() => {
              if (this.options.isUpdatingFromTree || this.isRestoringHistory) return;
              this.originalSvg = this.editor.getValue();
              this.updateTreeDoc();
              this.optimizeSvg();
              this.saveToHistory(); // Save to history after editing
              m.redraw();
            });

            this.editorReady = true;
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

  shouldPreserveAttribute(name) {
    if (!name) return false;
    const lower = name.toLowerCase();
    if (lower === RESERVED_ATTR_NAME) return false;
    if (BLOCKED_ATTR_PREFIXES.some(prefix => lower.startsWith(prefix))) return false;
    if (lower.startsWith('xmlns')) return false;
    if (PRESERVE_ATTR_PREFIXES.some(prefix => lower.startsWith(prefix))) return true;
    if (PRESERVE_ATTR_NAMES.has(lower)) return true;
    if (lower.includes(':')) return true;
    return !KNOWN_SVG_ATTRS.has(lower);
  }

  injectPreserveMarkers(svg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const preserved = new Map();
    let counter = 0;

    doc.querySelectorAll('*').forEach(el => {
      const attrsToPreserve = {};
      Array.from(el.attributes).forEach(attr => {
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

  restorePreservedAttributes(svg, preserved) {
    if (!preserved || preserved.size === 0) return svg;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');

    preserved.forEach((attrs, id) => {
      const el = doc.querySelector(`[${RESERVED_ATTR_NAME}="${id}"]`);
      if (!el) return;
      Object.entries(attrs).forEach(([name, value]) => {
        if (!el.hasAttribute(name)) {
          el.setAttribute(name, value);
        }
      });
    });

    doc.querySelectorAll(`[${RESERVED_ATTR_NAME}]`).forEach(el => el.removeAttribute(RESERVED_ATTR_NAME));
    return new XMLSerializer().serializeToString(doc);
  }

  loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.originalSvg = e.target.result;
      if (this.editor) {
        try {
          this.editor.setValue(this.originalSvg);
        } catch (err) {
          console.error('Failed to set editor value:', err);
          // Try to fix common SVG issues before setting
          try {
            // Try to sanitize the SVG by fixing common issues
            this.originalSvg = this.sanitizeSvg(this.originalSvg);
            this.editor.setValue(this.originalSvg);
          } catch (fixErr) {
            console.error('Failed to sanitize SVG:', fixErr);
            // Fall back to showing the SVG in a plain text modal
            alert('The SVG file contains formatting issues that cannot be displayed in the editor. Please try a different file.');
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
              console.error('Failed to set editor value (delayed):', err);
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

  loadOptimizedFile() {
    const sourceSvg = this.getSourceSvg();
    if (!sourceSvg || !sourceSvg.trim()) return;
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

  autocropCurrentSvg() {
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

  roundNumbers(str, precision) {
    return this.roundNumbersWithPrecision(str, precision, precision);
  }

  roundNumbersWithPrecision(svg, attrPrecision, pathPrecision) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');

    doc.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        if (name === 'd') {
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

  removeTspanElements(svg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');

    // Remove all tspan elements but keep their text content
    const tspans = doc.querySelectorAll('tspan');
    tspans.forEach(tspan => {
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

  removeStyling(svg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');

    // Remove style elements
    const styles = doc.querySelectorAll('style');
    styles.forEach(style => style.remove());

    // Remove style attributes
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      el.removeAttribute('style');
      el.removeAttribute('class');
    });

    return new XMLSerializer().serializeToString(doc);
  }

  removeUnusedXlinkNamespace(svg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const root = doc.querySelector('svg');
    if (!root) return svg;

    const hasXlinkHref = doc.querySelector('[xlink\\:href]');
    const hasHref = doc.querySelector('[href]');
    if (!hasXlinkHref && hasHref) {
      root.removeAttribute('xmlns:xlink');
    }
    if (!hasXlinkHref && !hasHref) {
      root.removeAttribute('xmlns:xlink');
    }

    return new XMLSerializer().serializeToString(doc);
  }

  removeSvgRootDefaults(svg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const root = doc.querySelector('svg') || doc.documentElement;
    if (!root) return svg;

    const defaults = {
      version: '1.1',
      baseProfile: 'full',
      preserveAspectRatio: 'xMidYMid meet'
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

  removeGroups(svg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');

    // Flatten groups by moving their children to parent
    const groups = Array.from(doc.querySelectorAll('g'));
    groups.forEach(group => {
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

  mergePathsAndCollapseGroups(svg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const mergeableGroupAttrs = new Set([
      'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
      'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit',
      'fill-rule', 'opacity', 'fill-opacity', 'stroke-opacity',
      'clip-path', 'mask', 'filter', 'vector-effect', 'paint-order',
      'shape-rendering', 'text-rendering'
    ]);

    function isPresentationAttr(name) {
      return mergeableGroupAttrs.has(name);
    }

    function normalizePathStart(d) {
      if (!d) return null;
      const trimmed = d.trim();
      if (!trimmed) return null;
      if (trimmed[0] === 'M') return trimmed;
      if (trimmed[0] !== 'm') return null;

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

      return `M${dx} ${dy} l ${pairs.join(' l ')}`;
    }

    function canMergeGroup(group) {
      const children = Array.from(group.children);
      if (children.length < 2) return false;
      if (!children.every(child => child.tagName === 'path')) return false;
      if (group.hasAttribute('transform')) return false;
      if (group.hasAttribute('marker-start') || group.hasAttribute('marker-mid') || group.hasAttribute('marker-end')) return false;
      if (children.some(child => child.hasAttribute('marker-start') || child.hasAttribute('marker-mid') || child.hasAttribute('marker-end'))) {
        return false;
      }
      return true;
    }

    function collectGroupAttrs(group) {
      const attrs = {};
      Array.from(group.attributes).forEach(attr => {
        if (isPresentationAttr(attr.name)) {
          attrs[attr.name] = attr.value;
        }
      });
      return attrs;
    }

    function hasConflictingChildAttrs(groupAttrs, child) {
      return Object.entries(groupAttrs).some(([name, value]) => {
        if (!child.hasAttribute(name)) return false;
        return child.getAttribute(name) !== value;
      });
    }

    function getSharedPresentationAttrs(children, groupAttrs) {
      const shared = {};
      const hasValue = {};

      for (const child of children) {
        for (const attr of Array.from(child.attributes)) {
          if (attr.name === 'd') continue;
          if (!isPresentationAttr(attr.name)) return null;
          if (groupAttrs[attr.name] !== undefined) continue;

          if (hasValue[attr.name] === undefined) {
            hasValue[attr.name] = true;
            shared[attr.name] = attr.value;
          } else if (shared[attr.name] !== attr.value) {
            return null;
          }
        }
      }

      // Ensure all children have the same presentation attrs (no missing values)
      const sharedKeys = Object.keys(shared);
      for (const child of children) {
        for (const key of sharedKeys) {
          if (!child.hasAttribute(key)) {
            return null;
          }
        }
      }

      return shared;
    }

    function mergePaths(group) {
      const groupAttrs = collectGroupAttrs(group);
      const children = Array.from(group.children);

      if (children.some(child => hasConflictingChildAttrs(groupAttrs, child))) {
        return false;
      }

      const normalized = [];
      for (const child of children) {
        const d = child.getAttribute('d') || '';
        const normalizedD = normalizePathStart(d);
        if (!normalizedD) return false;
        normalized.push(normalizedD);
      }

      const sharedChildAttrs = getSharedPresentationAttrs(children, groupAttrs);
      if (!sharedChildAttrs) return false;

      const combined = normalized.join(' ');
      const merged = doc.createElementNS(SVG_NS, 'path');
      merged.setAttribute('d', combined);

      Object.entries(groupAttrs).forEach(([name, value]) => {
        merged.setAttribute(name, value);
      });

      Object.entries(sharedChildAttrs).forEach(([name, value]) => {
        if (!merged.hasAttribute(name)) {
          merged.setAttribute(name, value);
        }
      });

      if (children.length > 0) {
        Array.from(children[0].attributes).forEach(attr => {
          if (attr.name === 'd') return;
          if (!isPresentationAttr(attr.name)) return;
          if (merged.hasAttribute(attr.name)) return;
          merged.setAttribute(attr.name, attr.value);
        });
      }

      const estimateOldSize = group.outerHTML.length;
      const estimateNewSize = merged.outerHTML.length;
      if (estimateNewSize >= estimateOldSize) {
        return false;
      }

      group.parentElement.insertBefore(merged, group);
      group.remove();
      return true;
    }

    const groups = Array.from(doc.querySelectorAll('g'));
    groups.forEach(group => {
      if (!canMergeGroup(group)) return;
      mergePaths(group);
    });

    // Collapse groups with a single child by moving presentation attrs to child
    const groupsToCollapse = Array.from(doc.querySelectorAll('g'));
    groupsToCollapse.forEach(group => {
      const hasNonWhitespaceText = Array.from(group.childNodes).some(node => {
        return node.nodeType === 3 && node.textContent.trim() !== '';
      });
      if (hasNonWhitespaceText) return;

      if (group.hasAttribute('transform')) return;

      const hasNonPresentationAttrs = Array.from(group.attributes).some(attr => !isPresentationAttr(attr.name));
      if (hasNonPresentationAttrs) return;

      const children = Array.from(group.children);
      if (children.length !== 1) return;
      const child = children[0];

      Array.from(group.attributes).forEach(attr => {
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

  removeDefaultValues(svg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');

    const defaultValues = {
      'letter-spacing': ['0', 'normal'],
      'word-spacing': ['0', 'normal'],
      'paint-order': ['normal', 'fill stroke markers', 'markers stroke fill'],
      'fill-opacity': ['1'],
      'stroke-opacity': ['1'],
      'opacity': ['1'],
      'clip-rule': ['nonzero'],
      'fill-rule': ['nonzero'],
      'stroke-miterlimit': ['4'],
      'stroke-linecap': ['butt'],
      'stroke-linejoin': ['miter', 'round'],
      'xml:space': ["preserve"],
      'font-weight': ["400"],
    };

    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      Object.keys(defaultValues).forEach(attr => {
        const value = el.getAttribute(attr);
        if (value && defaultValues[attr].includes(value)) {
          el.removeAttribute(attr);
        }
      });

      // Special handling for opacity >= 0.9
      const opacityValue = el.getAttribute('opacity');
      if (opacityValue) {
        const opacity = parseFloat(opacityValue);
        if (opacity >= 0.9) {
          el.removeAttribute('opacity');
        }
      }
    });

    return new XMLSerializer().serializeToString(doc);
  }

  removeFontAttributes(svg, removeFontFamily, removeFontSize) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');

    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      if (removeFontFamily) {
        el.removeAttribute('font-family');
      }
      if (removeFontSize) {
        el.removeAttribute('font-size');
      }
    });

    return new XMLSerializer().serializeToString(doc);
  }

  groupTextByAttributes(svg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');

    // Find all text elements
    const textElements = Array.from(doc.querySelectorAll('text, tspan'));

    if (textElements.length < 2) return svg; // Need at least 2 elements to group

    // Attributes we want to group by
    const groupableAttributes = ['font-family', 'font-size', 'text-anchor', 'font-weight', 'font-style'];
    this.groupElementsByCommonAttributes(doc, ['text', 'tspan'], groupableAttributes);

    return new XMLSerializer().serializeToString(doc);
  }

  getGroupableAttributes(el, groupableAttributes) {
    const attributes = {};
    groupableAttributes.forEach(attr => {
      const value = el.getAttribute(attr);
      if (value !== null) {
        attributes[attr] = value;
      }
    });
    return attributes;
  }

  intersectGroupableAttributes(base, next) {
    const intersection = {};
    Object.keys(base).forEach(attr => {
      if (next[attr] === base[attr]) {
        intersection[attr] = base[attr];
      }
    });
    return intersection;
  }

  estimateGroupSavings(commonAttributes, elementCount) {
    if (elementCount < 2) return 0;
    const attrSize = Object.entries(commonAttributes).reduce((sum, [attr, value]) => {
      return sum + ` ${attr}="${value}"`.length;
    }, 0);
    const groupOverhead = 7; // "<g></g>"
    return (elementCount - 1) * attrSize - groupOverhead;
  }

  groupRunByAttributes(parent, run, groupableAttributes) {
    const grouped = new Set();
    let i = 0;

    while (i < run.length) {
      if (grouped.has(run[i])) {
        i++;
        continue;
      }

      let commonAttributes = this.getGroupableAttributes(run[i], groupableAttributes);
      if (Object.keys(commonAttributes).length === 0) {
        i++;
        continue;
      }

      let bestGroup = null;
      let currentCommon = { ...commonAttributes };

      for (let j = i + 1; j < run.length; j++) {
        if (grouped.has(run[j])) break;

        const nextAttributes = this.getGroupableAttributes(run[j], groupableAttributes);
        currentCommon = this.intersectGroupableAttributes(currentCommon, nextAttributes);
        if (Object.keys(currentCommon).length === 0) break;

        const count = j - i + 1;
        const savings = this.estimateGroupSavings(currentCommon, count);
        if (savings > 0 && (!bestGroup || savings > bestGroup.savings)) {
          bestGroup = { end: j, attrs: { ...currentCommon }, savings };
        }
      }

      if (bestGroup) {
        const SVG_NS = 'http://www.w3.org/2000/svg';
        const elementsToGroup = run.slice(i, bestGroup.end + 1);
        const group = parent.ownerDocument.createElementNS(SVG_NS, 'g');

        Object.entries(bestGroup.attrs).forEach(([attr, value]) => {
          group.setAttribute(attr, value);
        });

        parent.insertBefore(group, elementsToGroup[0]);

        elementsToGroup.forEach(el => {
          Object.keys(bestGroup.attrs).forEach(attr => {
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

  groupElementsByCommonAttributes(doc, tagNames, groupableAttributes) {
    const tagSet = new Set(tagNames.map(name => name.toLowerCase()));
    const parents = new Set();

    doc.querySelectorAll(tagNames.join(',')).forEach(el => {
      if (el.parentElement) parents.add(el.parentElement);
    });

    parents.forEach(parent => {
      const children = Array.from(parent.children);
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
        while (runEnd + 1 < children.length && children[runEnd + 1].tagName.toLowerCase() === tagName) {
          runEnd++;
        }

        const run = children.slice(i, runEnd + 1);
        this.groupRunByAttributes(parent, run, groupableAttributes);
        i = runEnd + 1;
      }
    });
  }

  groupSimilarElementsByType(svg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');

    // Process different element types separately
    const elementTypes = ['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'];

    // Attributes that make sense to group for these element types
    const groupableAttributes = [
      'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
      'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit',
      'fill-rule', 'opacity', 'fill-opacity', 'stroke-opacity'
    ];

    this.groupElementsByCommonAttributes(doc, elementTypes, groupableAttributes);

    return new XMLSerializer().serializeToString(doc);
  }

  combinePaths(svg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const pathElements = Array.from(doc.querySelectorAll('path'));
    if (pathElements.length < 2) return svg;

    // Group paths by their attributes (excluding 'd')
    const pathGroups = new Map();

    pathElements.forEach(path => {
      const attributes = {};
      Array.from(path.attributes).forEach(attr => {
        if (attr.name !== 'd') {
          attributes[attr.name] = attr.value;
        }
      });

      const signature = JSON.stringify(attributes);
      if (!pathGroups.has(signature)) {
        pathGroups.set(signature, { attributes, paths: [] });
      }
      pathGroups.get(signature).paths.push(path);
    });

    // Combine paths with identical attributes
    pathGroups.forEach(({ attributes, paths }) => {
      if (paths.length >= 2) {
        // Combine d attributes
        const combinedD = paths.map(path => path.getAttribute('d')).join(' ');

        // Create new combined path
        const combinedPath = doc.createElementNS(SVG_NS, 'path');
        combinedPath.setAttribute('d', combinedD);

        // Add other attributes
        Object.entries(attributes).forEach(([attr, value]) => {
          combinedPath.setAttribute(attr, value);
        });

        // Replace first path with combined path
        const firstPath = paths[0];
        firstPath.parentNode.insertBefore(combinedPath, firstPath);

        // Remove original paths
        paths.forEach(path => path.remove());
      }
    });

    return new XMLSerializer().serializeToString(doc);
  }

  removeStrokeFromText(svg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');

    // Find all text elements and remove stroke-related attributes
    const textElements = doc.querySelectorAll('text, tspan');
    textElements.forEach(el => {
      el.removeAttribute('stroke');
      el.removeAttribute('stroke-width');
      el.removeAttribute('stroke-opacity');
      el.removeAttribute('stroke-dasharray');
      el.removeAttribute('stroke-dashoffset');
      el.removeAttribute('stroke-linecap');
      el.removeAttribute('stroke-linejoin');
      el.removeAttribute('stroke-miterlimit');
    });

    return new XMLSerializer().serializeToString(doc);
  }

  removeDuplicateDefs(svg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');

    const defsElement = doc.querySelector('defs');
    if (!defsElement) return svg;

    // Get all children of defs
    const defChildren = Array.from(defsElement.children);
    const defsByContent = new Map();
    const idMappings = new Map();

    defChildren.forEach(child => {
      // Create a normalized string representation of the element (without id)
      const childClone = child.cloneNode(true);
      childClone.removeAttribute('id');
      const normalized = new XMLSerializer().serializeToString(childClone);

      const originalId = child.getAttribute('id');

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
        updatedSvg = updatedSvg.replace(new RegExp(`url\\(#${oldId}\\)`, 'g'), `url(#${newId})`);
        // Replace #oldId with #newId in other contexts
        updatedSvg = updatedSvg.replace(new RegExp(`#${oldId}`, 'g'), `#${newId}`);
      });

      return updatedSvg;
    }

    return new XMLSerializer().serializeToString(doc);
  }

  convertSodipodiArcs(svg) {
    const SODIPODI_NS = 'http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd';
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');

    const sodipodiArcs = Array.from(doc.querySelectorAll('circle, ellipse')).filter(el =>
      el.getAttributeNS(SODIPODI_NS, 'type') === 'arc'
    );

    sodipodiArcs.forEach(arc => {
      try {
        const cx = parseFloat(arc.getAttributeNS(SODIPODI_NS, 'cx') || '0');
        const cy = parseFloat(arc.getAttributeNS(SODIPODI_NS, 'cy') || '0');
        let rx = parseFloat(arc.getAttributeNS(SODIPODI_NS, 'rx') || '0');
        let ry = parseFloat(arc.getAttributeNS(SODIPODI_NS, 'ry') || '0');
        let startAngle = parseFloat(arc.getAttributeNS(SODIPODI_NS, 'start') || '0');
        let endAngle = parseFloat(arc.getAttributeNS(SODIPODI_NS, 'end') || `${2 * Math.PI}`);

        // Ensure radii are positive
        rx = Math.abs(rx);
        ry = Math.abs(ry);

        if (rx <= 0 || ry <= 0) {
          console.warn('Skipping sodipodi arc with zero or negative radius:', arc);
          // Clean up sodipodi attributes even if not converted
          Array.from(arc.attributes).forEach(attr => {
            if (attr.name.startsWith('sodipodi:')) {
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
        const isFullCircle = (Math.abs(endAngle - startAngle) < epsilon || Math.abs(Math.abs(endAngle - startAngle) - 2 * Math.PI) < epsilon);
        const isPerfectCircle = Math.abs(rx - ry) < epsilon;

        let newElement;

        if (isFullCircle && isPerfectCircle) {
          // Convert to a <circle> element for full circles
          newElement = doc.createElementNS(SVG_NS, 'circle');
          newElement.setAttribute('cx', cx.toString());
          newElement.setAttribute('cy', cy.toString());
          newElement.setAttribute('r', rx.toString()); // For a circle, rx is the radius
        } else {
          // Convert to a <path> element for arcs/ellipses
          newElement = doc.createElementNS(SVG_NS, 'path');
          const pathData = this.createEllipticalArcPath(cx, cy, rx, ry, startAngle, endAngle);
          newElement.setAttribute('d', pathData);
        }

        // Copy all non-sodipodi attributes to the new element
        Array.from(arc.attributes).forEach(attr => {
          if (!attr.name.startsWith('sodipodi:') &&
            !(newElement.tagName === 'circle' && (attr.name === 'cx' || attr.name === 'cy' || attr.name === 'r')) &&
            !(newElement.tagName === 'path' && attr.name === 'd')) {
            newElement.setAttribute(attr.name, attr.value);
          }
        });

        arc.parentNode.replaceChild(newElement, arc);

      } catch (error) {
        console.warn('Failed to convert sodipodi arc:', error);
        // Even if conversion fails, remove sodipodi attributes to clean up the original element
        Array.from(arc.attributes).forEach(attr => {
          if (attr.name.startsWith('sodipodi:')) {
            arc.removeAttribute(attr.name);
          }
        });
      }
    });

    return new XMLSerializer().serializeToString(doc);
  }

  createEllipticalArcPath(cx, cy, rx, ry, startAngle, endAngle) {
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
  parseSvgLength(lengthStr, defaultVal = 0) {
    if (typeof lengthStr !== 'string') return defaultVal;

    const match = lengthStr.match(/^([\d.]+)([a-z]*)$/i);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase() || 'px'; // Default to px if no unit

      if (this.unitConversion[unit]) {
        return value * this.unitConversion[unit];
      } else {
        // For unknown units, assume pixels if no unit is specified (e.g., "100")
        // If a unit is specified but unknown, it's safer to default to 0 or log a warning.
        console.warn(`Unknown SVG unit: "${unit}" in "${lengthStr}". Treating value as pixels.`);
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
  calculateContentBBox(svgString) {
    // Create a temporary SVG element in a detached DOM fragment or hidden div
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.top = '-9999px';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '0';
    tempDiv.style.height = '0';
    tempDiv.style.overflow = 'hidden';
    document.body.appendChild(tempDiv); // Append to body to make getBBox work

    tempDiv.innerHTML = svgString;
    const svgElement = tempDiv.querySelector('svg');

    if (!svgElement) {
      document.body.removeChild(tempDiv);
      console.error("No SVG element found in the provided string for BBox calculation.");
      return null;
    }

    try {
      // Get the bounding box of the entire SVG content
      // This method accounts for all visible elements.
      // It returns an SVGRect which has x, y, width, height.
      // Important: This can fail or return 0,0,0,0 if the SVG is empty or has no renderable content.
      const bbox = svgElement.getBBox();

      // Check if bbox is valid (not empty)
      if (bbox.width === 0 && bbox.height === 0 && bbox.x === 0 && bbox.y === 0) {
        // This might indicate an empty SVG or elements with no rendering area.
        // Fallback to parsing viewBox or width/height if getBBox is effectively zero.
        // Or, if content is truly empty, return null.
        console.warn("getBBox returned an empty bounding box. Trying to derive from SVG attributes.");
        let currentWidth, currentHeight, minX = 0, minY = 0;
        let viewBoxAttr = svgElement.getAttribute('viewBox');
        if (viewBoxAttr) {
          const vbParts = viewBoxAttr.split(/\s+/).map(Number);
          minX = vbParts[0] || 0;
          minY = vbParts[1] || 0;
          currentWidth = vbParts[2] || 0;
          currentHeight = vbParts[3] || 0;
        } else {
          currentWidth = this.parseSvgLength(svgElement.getAttribute('width'), 0);
          currentHeight = this.parseSvgLength(svgElement.getAttribute('height'), 0);
        }

        if (currentWidth > 0 && currentHeight > 0) {
          return { x: minX, y: minY, width: currentWidth, height: currentHeight };
        } else {
          console.error("Could not determine content bounding box from getBBox or SVG attributes.");
          return null;
        }
      }

      return {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height
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
  resizeSvg(svg, newWidth, newHeight) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const svgElement = doc.documentElement;

    if (svgElement.tagName !== 'svg') {
      console.error("The provided SVG string does not contain an SVG element as its root.");
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
      console.warn("Could not calculate content BBox reliably. Falling back to existing viewBox or a default.");
      let currentWidth, currentHeight, minX = 0, minY = 0;
      let viewBoxAttr = svgElement.getAttribute('viewBox');

      if (viewBoxAttr) {
        const vbParts = viewBoxAttr.split(/\s+/).map(Number);
        minX = Math.floor(vbParts[0] || 0);
        minY = Math.floor(vbParts[1] || 0);
        currentWidth = Math.ceil(vbParts[2] || 0); // Round up width/height
        currentHeight = Math.ceil(vbParts[3] || 0);
      } else {
        minX = 0;
        minY = 0;
        currentWidth = Math.ceil(this.parseSvgLength(svgElement.getAttribute('width'), 100));
        currentHeight = Math.ceil(this.parseSvgLength(svgElement.getAttribute('height'), 100));
      }

      finalViewBoxX = minX;
      finalViewBoxY = minY;
      finalViewBoxWidth = currentWidth;
      finalViewBoxHeight = currentHeight;

      if (finalViewBoxWidth <= 0 || finalViewBoxHeight <= 0) {
        console.error("Failed to determine a valid content area for resizing. Using a default 0 0 100 100 viewBox.");
        finalViewBoxX = 0;
        finalViewBoxY = 0;
        finalViewBoxWidth = 100;
        finalViewBoxHeight = 100;
      }
    }

    // Set the new width and height for the SVG element
    svgElement.setAttribute('width', newWidth.toString());
    svgElement.setAttribute('height', newHeight.toString());

    // Set the viewBox with integer coordinates
    svgElement.setAttribute('viewBox', `${finalViewBoxX} ${finalViewBoxY} ${finalViewBoxWidth} ${finalViewBoxHeight}`);

    // preserveAspectRatio remains default 'xMidyMid meet' unless specified otherwise.

    return new XMLSerializer().serializeToString(doc);
  }

  /**
   * Crops the SVG viewBox to its content bounds with a margin.
   * @param {string} svg The SVG content as a string.
   * @param {number} margin The margin (in user units) to add around the content.
   * @returns {string} The cropped SVG string.
   */
  autocropSvg(svg, margin = 3) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const svgElement = doc.documentElement;

    if (svgElement.tagName !== 'svg') {
      console.error("The provided SVG string does not contain an SVG element as its root.");
      return svg;
    }

    const contentBBox = this.calculateContentBBox(svg);
    if (!contentBBox || contentBBox.width <= 0 || contentBBox.height <= 0) {
      console.warn("Could not calculate content BBox for autocrop. Leaving SVG unchanged.");
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

    svgElement.setAttribute('viewBox', `${x1} ${y1} ${width} ${height}`);
    return new XMLSerializer().serializeToString(doc);
  }

  sanitizeSvg(svg) {
    if (!svg || typeof svg !== 'string') return svg;

    try {
      // Try to parse and validate the SVG
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg, 'image/svg+xml');
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        console.warn('SVG parsing error:', parseError.textContent);
        // Try to fix common issues
        svg = this.fixCommonSvgIssues(svg);
      }
    } catch (e) {
      console.warn('SVG sanitization failed, using original:', e);
    }
    return svg;
  }

  fixCommonSvgIssues(svg) {
    // Try to fix common SVG issues
    let fixed = svg;

    // Fix malformed path data - handle missing numbers after operators
    // Pattern: ...124 6.8 18-12.51Z (where 18-12.51 should be separate numbers)
    fixed = fixed.replace(/(\d+)-(\d+(\.\d+)?)/g, '$1 $2');

    // Fix common encoding issues
    fixed = fixed.replace(/&gt;/g, '>');
    fixed = fixed.replace(/&lt;/g, '<');
    fixed = fixed.replace(/&amp;/g, '&');
    fixed = fixed.replace(/&quot;/g, '"');
    fixed = fixed.replace(/&apos;/g, "'");

    // Fix common whitespace issues
    fixed = fixed.replace(/>\s+</g, '><');

    return fixed;
  }

  updateTreeDoc() {
    const sourceSvg = this.getSourceSvg();
    if (!sourceSvg) {
      this.options.treeDoc = null;
      return;
    }
    const parser = new DOMParser();
    // Tree view reflects the editable source SVG
    const svgToParse = sourceSvg;
    this.options.treeDoc = parser.parseFromString(svgToParse, 'image/svg+xml');
  }

  async optimizeSvg() {
    const sourceSvg = this.getSourceSvg();
    if (!sourceSvg || !sourceSvg.trim()) {
      this.optimizedSvg = '';
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
          'removeDoctype',
          'removeXMLProcInst',
          'removeComments',
          'removeMetadata',
          'removeTitle',
          'removeDesc',
          'removeUselessDefs',
          'removeEditorsNSData',
          'removeEmptyAttrs',
          'removeHiddenElems',
          'removeEmptyText',
          'removeEmptyContainers',
          'removeViewBox',
          'cleanupEnableBackground',
          'convertStyleToAttrs',
          'convertPathData',
          {
            name: 'removeUnknownsAndDefaults',
            params: {
              keepDataAttrs: true,
              keepAriaAttrs: true,
              keepRoleAttr: true
            }
          },
          'removeNonInheritableGroupAttrs',
          'removeUnusedNS',
          'cleanupIds',
          'cleanupNumericValues',
          'moveElemsAttrsToGroup',
          'moveGroupAttrsToElems',
          'collapseGroups',
          'removeRasterImages',
          'mergePaths',
          'convertShapeToPath',
          'sortAttrs',
          'removeDimensions'
        ]
      });

      svg = svgoResult.data;

      // Apply custom optimizations
      if (this.options.precision >= 0) {
        svg = collapseTransforms(svg);
        svg = this.roundNumbersWithPrecision(svg, this.options.precision, this.options.pathPrecision);
      } else {
        svg = collapseTransforms(svg);
      }

      if (this.options.removeDefaultValues) {
        svg = this.removeDefaultValues(svg);
      }

      if (this.options.removeFontFamily || this.options.removeFontSize) {
        svg = this.removeFontAttributes(svg, this.options.removeFontFamily, this.options.removeFontSize);
      }

      if (this.options.removeTspan) {
        svg = this.removeTspanElements(svg);
      }

      if (this.options.removeStyling) {
        svg = this.removeStyling(svg);
      }

      // Handle grouping based on mode
      if (this.options.groupingMode === 'remove') {
        svg = this.removeGroups(svg);
      } else if (this.options.groupingMode === 'group') {
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
        svg = this.resizeSvg(svg, this.options.customWidth, this.options.customHeight);
      }

      svg = this.restorePreservedAttributes(svg, preservedResult.preserved);

      this.optimizedSvg = svg;
    } catch (error) {
      console.error('Optimization error:', error);
      this.optimizedSvg = `<!-- Error optimizing SVG: ${error.message} -->\n${sourceSvg}`;
    }
  }

  downloadSvg() {
    const svg = this.getPreviewSvg();
    if (!svg) return;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'optimized.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getStats() {
    const sourceSvg = this.getSourceSvg() || '';
    const previewSvg = this.getPreviewSvg() || '';
    const originalSize = new Blob([sourceSvg]).size;
    const optimizedSize = new Blob([previewSvg]).size;
    const reduction = originalSize - optimizedSize;
    const reductionPercent = originalSize > 0 ? ((reduction / originalSize) * 100) : 0;

    return {
      originalSize,
      optimizedSize,
      reduction,
      reductionPercent
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // History management methods
  saveToHistory() {
    if (this.isRestoringHistory) return;

    if (this.historyPointer < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyPointer + 1);
    }

    this.history.push({
      originalSvg: this.originalSvg,
      optimizedSvg: this.optimizedSvg,
      options: { ...this.options }
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.historyPointer = this.history.length - 1;
    m.redraw();
  }


  canUndo() {
    return this.historyPointer > 0;
  }

  canRedo() {
    return this.historyPointer < this.history.length - 1;
  }

  undo() {
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

  redo() {
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

const TreeView = {
  view() {
    if (!optimizer.getSourceSvg()) return m('.tree-view', 'No SVG loaded');
    // Always update tree doc to ensure it reflects current state
    optimizer.updateTreeDoc();

    const svg = optimizer.options.treeDoc.querySelector('svg');

    if (!svg) return m('.tree-view', 'Invalid SVG');

    return m('.tree-view', [
      m('.tree-content', [
        m(TreeNode, { node: svg, path: '0', isRoot: true, prefix: '', isLast: true })
      ])
    ]);
  }
};

let dragSourcePath = null;
let dragOverPath = null;

const COMMON_ATTRIBUTE_SUGGESTIONS = [
  'id', 'class', 'style', 'transform', 'opacity', 'display', 'visibility',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit',
  'stroke-opacity', 'clip-path', 'mask', 'filter', 'vector-effect',
  'shape-rendering', 'paint-order', 'pointer-events'
];

const ATTRIBUTE_SUGGESTIONS_BY_TAG = {
  svg: ['width', 'height', 'viewBox', 'preserveAspectRatio'],
  g: ['transform', 'opacity'],
  path: ['d', 'pathLength'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
  text: ['x', 'y', 'dx', 'dy', 'text-anchor', 'dominant-baseline', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'word-spacing'],
  tspan: ['x', 'y', 'dx', 'dy', 'text-anchor', 'dominant-baseline', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'word-spacing'],
  image: ['href', 'x', 'y', 'width', 'height', 'preserveAspectRatio'],
  use: ['href', 'x', 'y', 'width', 'height'],
  stop: ['offset', 'stop-color', 'stop-opacity'],
  lineargradient: ['x1', 'y1', 'x2', 'y2', 'gradientUnits', 'gradientTransform'],
  radialgradient: ['cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits', 'gradientTransform'],
  clippath: ['clipPathUnits'],
  mask: ['maskUnits', 'maskContentUnits', 'x', 'y', 'width', 'height'],
  pattern: ['patternUnits', 'patternContentUnits', 'x', 'y', 'width', 'height', 'patternTransform'],
  marker: ['markerWidth', 'markerHeight', 'refX', 'refY', 'orient', 'markerUnits', 'viewBox', 'preserveAspectRatio'],
  symbol: ['viewBox', 'preserveAspectRatio']
};

const attributeDialogState = {
  isOpen: false,
  path: null,
  tagName: '',
  name: '',
  value: '',
  suggestions: []
};

function getAttributeSuggestionsForElement(element) {
  const tagName = element.tagName.toLowerCase();
  const specific = ATTRIBUTE_SUGGESTIONS_BY_TAG[tagName] || [];
  const existing = Array.from(element.attributes).map(attr => attr.name);
  const merged = [...existing, ...specific, ...COMMON_ATTRIBUTE_SUGGESTIONS];
  return Array.from(new Set(merged));
}

function openAttributeDialog(path) {
  const doc = optimizer.options.treeDoc;
  const element = getElementByPath(doc, path);
  if (!element) return;

  attributeDialogState.isOpen = true;
  attributeDialogState.path = path;
  attributeDialogState.tagName = element.tagName.toLowerCase();
  attributeDialogState.name = '';
  attributeDialogState.value = '';
  attributeDialogState.suggestions = getAttributeSuggestionsForElement(element);
  m.redraw();
}

function closeAttributeDialog() {
  attributeDialogState.isOpen = false;
  attributeDialogState.path = null;
  attributeDialogState.tagName = '';
  attributeDialogState.name = '';
  attributeDialogState.value = '';
  attributeDialogState.suggestions = [];
  m.redraw();
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

// Uncontrolled Input Component to prevent Mithril redraws from interfering with typing
const UncontrolledInput = {
  oncreate({ dom, attrs }) {
    dom.value = attrs.value;
    dom.size = Math.max(1, Math.min(20, dom.value.length));

    dom.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        dom.value = attrs.value;
        dom.blur();
      }
      if (e.key === 'Enter') {
        dom.blur();
      }
    });

    dom.addEventListener('input', (e) => {
      e.target.size = Math.max(1, Math.min(20, e.target.value.length));
    });

    dom.addEventListener('change', (e) => {
      attrs.type = 'change'; // Signal change
      if (dom.value !== attrs.value) {
        attrs.onChange(dom.value);
      }
    });
  },
  onupdate({ dom, attrs }) {
    // Only update value from model if we are NOT currently editing/focused
    if (document.activeElement !== dom) {
      dom.value = attrs.value;
      dom.size = Math.max(1, Math.min(20, dom.value.length));
    }
  },
  view({ attrs }) {
    return m('input.attr-value');
  }
};

const TreeNode = {
  view({ attrs }) {
    const { node, path, isRoot, prefix, isLast } = attrs;
    if (node.nodeType !== 1) return null;

    const isSelected = optimizer.options.selectedElementPath === path;

    // For text and tspan elements, we want to include both children and text content
    let children = [];
    if (node.tagName === 'text' || node.tagName === 'tspan') {
      // Include both regular children and text nodes
      const allNodes = Array.from(node.childNodes);
      children = allNodes.filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim() !== ''));
    } else {
      // For other elements, just use regular children
      children = Array.from(node.children);
    }

    const currentPrefix = prefix;
    const childPrefix = prefix + (isLast ? '   ' : '│  ');
    const ornament = isRoot ? '' : (isLast ? '└─ ' : '├─ ');

    return m('.tree-node-wrapper',
      [
        m('.tree-node-header', {
          id: `node-${path.replace(/\./g, '-')}`,
          class: `${isSelected ? 'selected' : ''} ${dragOverPath === path ? 'drag-over' : ''}`,
          draggable: !isRoot,
          ondragstart: (e) => {
            dragSourcePath = path;
            e.dataTransfer.setData('text/plain', path);
            e.stopPropagation();
          },
          ondragover: (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragOverPath = path;
          },
          ondragleave: () => {
            if (dragOverPath === path) dragOverPath = null;
          },
          ondrop: (e) => {
            e.preventDefault();
            e.stopPropagation();
            const sourcePath = e.dataTransfer.getData('text/plain');
            if (sourcePath && sourcePath !== path) {
              moveElementTo(sourcePath, path);
            }
            dragOverPath = null;
            dragSourcePath = null;
          },
          onclick: (e) => {
            e.stopPropagation();
            optimizer.options.selectedElementPath = path;
            highlightElement(path);
            m.redraw();
          }
        }, [
          m('span.tree-prefix', currentPrefix + ornament),
          m('span.tag-name', node.tagName),
          m('.attributes', Array.from(node.attributes).map(attr =>
            m('.attribute', [
              m('span.attr-name', attr.name),
              m('span', '='),
              m('.attr-value-container', [
                m(UncontrolledInput, {
                  value: attr.value,
                  onChange: (newValue) => {
                    node.setAttribute(attr.name, newValue);
                    updateFromTree(node.ownerDocument);
                  }
                }),
                attr.value.length > 50 && m('.attr-value-full', attr.value)
              ]),
              m('button.attr-remove', {
                title: `Remove ${attr.name}`,
                onclick: (e) => {
                  e.stopPropagation();
                  node.removeAttribute(attr.name);
                  updateFromTree(node.ownerDocument);
                }
              }, '×')
            ])
          )),
          m('.node-controls', [
            m('button.control-btn', {
              title: 'Add attribute',
              onclick: (e) => {
                e.stopPropagation();
                openAttributeDialog(path);
              }
            }, '+'),

            // ⭕ round-to-zero button (only if useful)
            isSelected && hasRoundableAttrs(node) && m('button.control-btn', {
              title: 'Round numeric attributes to 0 decimals',
              onclick: (e) => {
                e.stopPropagation();
                roundAttrsRecursive(node);
                updateFromTree(node.ownerDocument);
              }
            }, '0'),

            !isRoot && m('button.control-btn', {
              onclick: (e) => {
                e.stopPropagation();
                moveElement(path, -1);
              }
            }, '↑'),

            !isRoot && m('button.control-btn', {
              onclick: (e) => {
                e.stopPropagation();
                moveElement(path, 1);
              }
            }, '↓'),

            m('button.control-btn', {
              style: 'color: #f44336;',
              onclick: (e) => {
                e.stopPropagation();
                node.remove();
                updateFromTree(node.ownerDocument);
              }
            }, '×')
          ])
        ]),
        m('.tree-node-children', children.map((child, index) => {
          // For text nodes, create a special representation
          if (child.nodeType === 3) {
            // Text node - create a special TreeNode-like representation
            const isLastChild = index === children.length - 1;
            const textOrnament = isLastChild ? '└─ ' : '├─ ';
            const textPath = `${path}.[-${index + 1}]`;
            return m('.tree-node-wrapper', [
              m('.tree-node-header', {
                class: 'text-node',
                style: 'color: #9cdcfe;',
                oncreate: (vnode) => {
                  vnode.dom.onclick = (e) => {
                    e.stopPropagation();
                    console.log('Text node clicked:', { path: textPath, child });
                    optimizer.options.selectedElementPath = textPath;
                    highlightElement(textPath);
                    m.redraw();
                  };
                }
              }, [
                m('span.tree-prefix', childPrefix + textOrnament),
                m('span.tag-name', '[Text Node]'),
                m('.attributes', [
                  m('.attribute', [
                    m('span.attr-name', 'content'),
                    m('span', '='),
                    m('.attr-value-container', [
                      m(UncontrolledInput, {
                        value: child.textContent,
                        onChange: (newValue) => {
                          child.textContent = newValue;
                          updateFromTree(node.ownerDocument);
                        }
                      }),
                      child.textContent.length > 50 && m('.attr-value-full', child.textContent)
                    ])
                  ])
                ])
              ])
            ]);
          } else {
            // Regular element child
            return m(TreeNode, {
              node: child,
              path: `${path}.${index}`,
              prefix: childPrefix,
              isLast: index === children.length - 1,
            });
          }
        }))
      ]);
  }
};

function updateFromTree(doc) {
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

function moveElementTo(sourcePath, targetPath) {
  if (sourcePath === targetPath) return;

  const doc = optimizer.options.treeDoc;
  const source = getElementByPath(doc, sourcePath);
  const target = getElementByPath(doc, targetPath);

  if (source && target) {
    const targetParent = target.parentElement;

    if (target.tagName === 'g' || target.tagName === 'svg') {
      target.insertBefore(source, target.firstChild);
    } else if (targetParent) {
      targetParent.insertBefore(source, target);
    }

    updateFromTree(doc);
  }
}

function moveElement(path, direction) {
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

      const pathParts = path.split('.');
      pathParts[pathParts.length - 1] = newIndex;
      optimizer.options.selectedElementPath = pathParts.join('.');

      updateFromTree(doc);
    }
  }
}

function getElementByPath(doc, path) {
  const parts = path.split('.');
  let current = doc.querySelector('svg');
  if (parts[0] !== '0') return null;
  if (parts.length === 1) return current;

  for (let i = 1; i < parts.length; i++) {
    const index = parseInt(parts[i]);
    current = current.children[index];
    if (!current) return null;
  }
  return current;
}

function highlightElement(path) {
  console.log('highlightElement called with:', path);
  const previewContainer = document.querySelector('.preview-container');
  const previewSvg = previewContainer.querySelector('svg');
  if (!previewSvg) {
    console.log('No preview SVG found!');
    return;
  }

  previewSvg.querySelectorAll('.highlighted-preview').forEach(el => el.classList.remove('highlighted-preview'));

  const targetEl = getElementInSvgByPath(previewSvg, path);
  console.log('Target element:', targetEl);

  if (targetEl && targetEl.getBBox) {
    try {
      targetEl.classList.add('highlighted-preview');
      console.log('Element highlighted');
    } catch (e) {
      console.warn('Could not highlight element:', e);
    }
  } else {
    console.log('Could not highlight element: targetEl not found or no getBBox');
  }
}

function getElementInSvgByPath(svg, path) {
  const parts = path.split('.');
  let current = svg;
  if (parts[0] !== '0') {
    console.log('Invalid root:', path);
    return null;
  }

  console.log('Traversing path:', path, 'parts:', parts);

  for (let i = 1; i < parts.length; i++) {
    const indexStr = parts[i];
    console.log('  Part', i, ':', indexStr);

    // Handle array format for text nodes: [-1], [-2], etc.
    const arrayMatch = indexStr.match(/^\[-(\d+)\]$/);
    if (arrayMatch) {
      const textIndex = parseInt(arrayMatch[1]) - 1; // Convert to 0-based index
      console.log('  Found text node index:', textIndex);
      // Find the text node at this index
      const children = Array.from(current.childNodes);
      const textNodes = children.filter(n => n.nodeType === 3);
      console.log('  Total text nodes:', textNodes.length, 'textIndex:', textIndex);
      if (textNodes.length > textIndex) {
        current = textNodes[textIndex];
        console.log('  Text node found:', current.textContent.substring(0, 20) + '...');
      } else {
        console.log('  Text node not found!');
        return null;
      }
      continue;
    }

    let index = parseInt(indexStr);

    // Handle negative indices for text nodes
    if (index < 0) {
      // Find the text node at this index
      const children = Array.from(current.childNodes);
      const textNodes = children.filter(n => n.nodeType === 3);
      if (textNodes.length >= Math.abs(index)) {
        current = textNodes[Math.abs(index)];
      } else {
        return null;
      }
    } else {
      current = current.children[index];
      if (!current) {
        console.log('  Element not found at index:', index, 'total children:', current.children.length);
        return null;
      }
    }
  }
  console.log('Final element:', current.tagName || '[Text Node]');
  return current;
}


export const App = {
  oncreate() {
    setTimeout(() => {
      optimizer.initializeEditor();
    }, 100);

    // Set up drag and drop
    const dropZone = document.body;
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type === 'image/svg+xml') {
        optimizer.loadFile(files[0]);
      }
    });
  },

  view() {
    const stats = optimizer.getStats();
    const isCopied = optimizer.copyStatus === 'copied';
    const sourceSvg = optimizer.getSourceSvg();
    const previewSvg = optimizer.getPreviewSvg();

    const body = [
      m('.header', [
        m('.title', [
          m('img.logo', { src: 'logo.svg', alt: 'Logo' }),
          m('span', 'Advanced SVG Optimizer')
        ]),
        m('.stats', [
          m('.stat', [
            m('.stat-label', 'Original'),
            m('.stat-value', optimizer.formatBytes(stats.originalSize))
          ]),
          m('.stat', [
            m('.stat-label', 'Optimized'),
            m('.stat-value', optimizer.formatBytes(stats.optimizedSize))
          ]),
          m('.stat', [
            m('.stat-label', 'Reduction'),
            m('.stat-value', {
              class: stats.reduction > 0 ? 'reduction-positive' : stats.reduction < 0 ? 'reduction-negative' : ''
            }, `${stats.reduction > 0 ? '-' : ''}${optimizer.formatBytes(Math.abs(stats.reduction))} (${stats.reductionPercent.toFixed(1)}%)`)
          ])
        ])
      ]),

      m('.controls', [
        m('.file-input', [
          m('input[type=file]', {
            id: 'file-input',
            accept: '.svg,image/svg+xml',
            onchange: (e) => {
              if (e.target.files[0]) {
                optimizer.loadFile(e.target.files[0]);
              }
            }
          })
        ]),
        m('label.file-button', { for: 'file-input' }, 'Open SVG File'),
        m('button[type=button][title=Load optimized SVG in editor]', {
          disabled: sourceSvg && sourceSvg.trim().length > 0 ? undefined : 'disabled',
          onclick: () => optimizer.loadOptimizedFile(),
        }, 'Optimize'),
        m('button[type=button][title=Autocrop viewBox to content]', {
          disabled: sourceSvg && sourceSvg.trim().length > 0 ? undefined : 'disabled',
          onclick: () => optimizer.autocropCurrentSvg(),
        }, 'Autocrop'),
        m('button[type=button][title=Undo]', {
          disabled: !optimizer.canUndo(),
          onclick: () => {
            optimizer.undo();
            m.redraw();
          },
        },
          m('svg[fill=none][viewBox=0 0 24 24][width=20][height=20]',
            m('path[stroke=#000][stroke-linecap=round][stroke-width=2.5][d=M21 14c-.84-1.6-2.3-3-4.1-3.9a11 11 0 0 0-5.9-.96c-3.3.41-5.6 2.6-8.2 4.6m0-4.6v4.9h4.9]')
          ),

        ),
        m('button[type=button][title=Redo].svg', {
          disabled: !optimizer.canRedo(),
          onclick: () => {
            optimizer.redo();
            m.redraw();
          },
        },
          m('svg[fill=none][viewBox=0 0 24 24][width=20][height=20]',
            m('path[stroke=#000][stroke-linecap=round][stroke-width=2.5][d=M3.1 14c.84-1.6 2.3-3 4.1-3.9a11 11 0 0 1 5.9-.96c3.3.41 5.6 2.6 8.2 4.6m0-4.6v4.9H16]')
          ),
        ),

        m('.option-group', [
          m('.checkbox-group', [
            m('label', 'Precision:'),
            m('input.number-input[type=number]', {
              value: optimizer.options.precision,
              min: 0,
              max: 5,
              onchange: (e) => {
                optimizer.options.precision = parseInt(e.target.value);
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              }
            }),
          ]),

          m('.checkbox-group', [
            m('label', 'Path precision:'),
            m('input.number-input[type=number]', {
              value: optimizer.options.pathPrecision,
              min: 0,
              max: 5,
              onchange: (e) => {
                optimizer.options.pathPrecision = parseInt(e.target.value);
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              }
            }),
          ]),

          m('.checkbox-group', [
            m('input[type=checkbox]', {
              id: 'convert-sodipodi',
              checked: optimizer.options.convertSodipodiArcs,
              onchange: (e) => {
                optimizer.options.convertSodipodiArcs = e.target.checked;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              }
            }),
            m('label', { for: 'convert-sodipodi' }, 'Convert sodipodi arcs')
          ]),

          m('.checkbox-group', [
            m('input[type=checkbox]', {
              id: 'remove-defaults',
              checked: optimizer.options.removeDefaultValues,
              onchange: (e) => {
                optimizer.options.removeDefaultValues = e.target.checked;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              }
            }),
            m('label', { for: 'remove-defaults' }, 'Remove default values')
          ]),

          m('.checkbox-group', [
            m('input[type=checkbox]', {
              id: 'remove-font-family',
              checked: optimizer.options.removeFontFamily,
              onchange: (e) => {
                optimizer.options.removeFontFamily = e.target.checked;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              }
            }),
            m('label', { for: 'remove-font-family' }, 'Remove font-family')
          ]),

          m('.checkbox-group', [
            m('input[type=checkbox]', {
              id: 'remove-font-size',
              checked: optimizer.options.removeFontSize,
              onchange: (e) => {
                optimizer.options.removeFontSize = e.target.checked;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              }
            }),
            m('label', { for: 'remove-font-size' }, 'Remove font-size')
          ]),

          m('.checkbox-group', [
            m('input[type=checkbox]', {
              id: 'remove-tspan',
              checked: optimizer.options.removeTspan,
              onchange: (e) => {
                optimizer.options.removeTspan = e.target.checked;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              }
            }),
            m('label', { for: 'remove-tspan' }, 'Remove tspan')
          ]),

          m('.checkbox-group', [
            m('input[type=checkbox]', {
              id: 'remove-styling',
              checked: optimizer.options.removeStyling,
              onchange: (e) => {
                optimizer.options.removeStyling = e.target.checked;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              }
            }),
            m('label', { for: 'remove-styling' }, 'Remove styling')
          ]),

          m('.checkbox-group', [
            m('label', { style: 'margin-right: 1rem; font-weight: 600;' }, 'Grouping:'),
            m('input[type=radio]', {
              id: 'grouping-none',
              name: 'grouping-mode',
              value: 'none',
              checked: optimizer.options.groupingMode === 'none',
              onchange: (e) => {
                if (e.target.checked) {
                  optimizer.options.groupingMode = 'none';
                  optimizer.options.removeGroups = false;
                  optimizer.options.groupSimilarElements = false;
                  optimizer.optimizeSvg();
                  optimizer.saveToHistory();
                }
              }
            }),
            m('label', { for: 'grouping-none', style: 'margin-right: 1rem;' }, 'None'),

            m('input[type=radio]', {
              id: 'grouping-group',
              name: 'grouping-mode',
              value: 'group',
              checked: optimizer.options.groupingMode === 'group',
              onchange: (e) => {
                if (e.target.checked) {
                  optimizer.options.groupingMode = 'group';
                  optimizer.options.removeGroups = false;
                  optimizer.options.groupSimilarElements = true;
                  optimizer.optimizeSvg();
                  optimizer.saveToHistory();
                }
              }
            }),
            m('label', { for: 'grouping-group', style: 'margin-right: 1rem;' }, 'Group similar'),

            m('input[type=radio]', {
              id: 'grouping-remove',
              name: 'grouping-mode',
              value: 'remove',
              checked: optimizer.options.groupingMode === 'remove',
              onchange: (e) => {
                if (e.target.checked) {
                  optimizer.options.groupingMode = 'remove';
                  optimizer.options.removeGroups = true;
                  optimizer.options.groupSimilarElements = false;
                  optimizer.optimizeSvg();
                  optimizer.saveToHistory();
                }
              }
            }),
            m('label', { for: 'grouping-remove' }, 'Remove groups')
          ]),

          m('.checkbox-group', [
            m('input[type=checkbox]', {
              id: 'custom-dimensions',
              checked: optimizer.options.useCustomDimensions,
              onchange: (e) => {
                optimizer.options.useCustomDimensions = e.target.checked;
                optimizer.optimizeSvg();
                optimizer.saveToHistory();
              }
            }),
            m('label', { for: 'custom-dimensions' }, 'Custom size:'),
            m('input.dimension-input[type=number]', {
              value: optimizer.options.customWidth,
              placeholder: 'Width',
              onchange: (e) => {
                optimizer.options.customWidth = parseInt(e.target.value);
                if (optimizer.options.useCustomDimensions) {
                  optimizer.optimizeSvg();
                  optimizer.saveToHistory();
                }
              }
            }),
            m('span', '×'),
            m('input.dimension-input[type=number]', {
              value: optimizer.options.customHeight,
              placeholder: 'Height',
              onchange: (e) => {
                optimizer.options.customHeight = parseInt(e.target.value);
                if (optimizer.options.useCustomDimensions) {
                  optimizer.optimizeSvg();
                  optimizer.saveToHistory();
                }
              }
            })
          ])
        ])
      ]),


      m('.main-content', {
        oncreate: () => {
          const splitter = document.getElementById('dragbar');
          const left = document.getElementById('left-panel');
          const right = document.getElementById('right-panel');
          splitter.onmousedown = function (e) {
            e.preventDefault();
            document.onmousemove = function (e) {
              let percent = (e.clientX / (window.innerWidth)) * 100;
              let percentSplitter = 6 / window.innerWidth * 100;
              percent = Math.max(10, Math.min(90, percent));
              left.style.flex = `0 0 ${percent}%`;
              right.style.flex = `0 0 ${100 - percent - percentSplitter}%`;
            };
            document.onmouseup = function () {
              document.onmousemove = null;
              document.onmouseup = null;
            };
          };
        }
      }, [
        m('.editor-panel#left-panel', [

          m('.editor-panel', [
            m('.panel-header', [
              m('span', 'Source SVG'),
              sourceSvg ? m('span', `${sourceSvg.split('\n').length} lines`) : null,
              m('div', { style: 'display: flex; gap: 0.5rem;' }, [
                m('button', {
                  style: `background: ${optimizer.options.viewMode === 'code' ? '#4fc3f7' : '#444'}; font-size: 0.8rem; padding: 0.2rem 0.6rem;`,
                  onclick: () => optimizer.options.viewMode = 'code'
                }, 'Code'),
                m('button', {
                  style: `background: ${optimizer.options.viewMode === 'tree' ? '#4fc3f7' : '#444'}; font-size: 0.8rem; padding: 0.2rem 0.6rem;`,
                  onclick: () => optimizer.options.viewMode = 'tree'
                }, 'Tree'),
                m('button', {
                  style: 'background: #444; font-size: 0.8rem; padding: 0.2rem 0.6rem; cursor: pointer; border: none; border-radius: 4px; color: #e0e0e0; display: flex; align-items: center; gap: 0.3rem;',
                  onclick: () => copyToClipboard(),
                  title: 'Copy to clipboard'
                }, [
                  isCopied
                    ? m('svg[width=16][height=16][viewBox=0 0 24 24][fill=none][stroke=currentColor][stroke-width=2][stroke-linecap=round][stroke-linejoin=round]', [
                      m('path[stroke-linecap=round][stroke-linejoin=round][d=M20 6L9 17l-5-5"]')
                    ])
                    : m('svg[width=16][height=16][viewBox=0 0 24 24][fill=none][stroke=currentColor][stroke-width=2][stroke-linecap=round][stroke-linejoin=round]', [
                      m('path[stroke-linecap=round][stroke-linejoin=round][d=M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2m-6 12h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"]'),
                      m('path[stroke-linecap=round][stroke-linejoin=round][d=M16 8v8m-4-5v5m-4-2v2"]')
                    ]),
                  m('span', isCopied ? 'Copied!' : 'Copy')
                ])
              ])
            ]),
            m('.editor-container', [
              m('div#editor', {
                style: `height: 100%; ${!optimizer.editorReady || optimizer.options.viewMode !== 'code' ? 'display: none;' : ''}`
              }),
              !optimizer.editorReady ? m('div', { style: 'display: flex; align-items: center; justify-content: center; height: 100%; color: #888;' }, 'Initializing editor...') : null,
              optimizer.options.viewMode === 'tree' ? m(TreeView) : null
            ])
          ]),


        ]),
        m('div#dragbar', { style: 'width: 6px; cursor: col-resize; background: #666;' }),
        m('.preview-panel#right-panel', [

          m(".panel-header", [
            m("span", "Optimized SVG"),
            previewSvg && m('div', { style: 'display:flex; gap:0.5rem; align-items:center;' }, [
              m('button', { onclick: () => zoomSvg(1.2) }, '+'),
              m('button', { onclick: () => zoomSvg(0.8) }, '-'),
              m('button', { onclick: () => resetZoom() }, 'Reset'),
            ]),

            previewSvg && m('button.download-btn', {
              onclick: () => optimizer.downloadSvg()
            }, 'Download')
          ]),
          m('.preview-container', [
            previewSvg ?
              m.trust(previewSvg) :
              m('div', { style: 'color: #888; text-align: center' }, 'Preview will appear here')
          ])
        ])
      ])
    ];

    if (attributeDialogState.isOpen) {
      body.push(
        m('.attr-dialog-backdrop', {
          onclick: (e) => {
            if (e.target === e.currentTarget) closeAttributeDialog();
          }
        }, [
          m('.attr-dialog', {
            onclick: (e) => e.stopPropagation()
          }, [
            m('.attr-dialog-title', `Add attribute to <${attributeDialogState.tagName}>`),
            m('.field', [
              m('label', 'Attribute'),
              m('input#attr-name-input', {
                list: 'attr-suggestions',
                value: attributeDialogState.name,
                oncreate: ({ dom }) => dom.focus(),
                oninput: (e) => {
                  attributeDialogState.name = e.target.value;
                  const doc = optimizer.options.treeDoc;
                  const element = getElementByPath(doc, attributeDialogState.path);
                  if (element) {
                    const existingValue = element.getAttribute(attributeDialogState.name.trim());
                    if (existingValue !== null && attributeDialogState.value === '') {
                      attributeDialogState.value = existingValue;
                    }
                  }
                },
                onkeydown: (e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    closeAttributeDialog();
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyAttributeDialog();
                  }
                }
              })
            ]),
            m('datalist#attr-suggestions', attributeDialogState.suggestions.map(attr =>
              m('option', { value: attr })
            )),
            m('.field', [
              m('label', 'Value'),
              m('input', {
                value: attributeDialogState.value,
                oninput: (e) => {
                  attributeDialogState.value = e.target.value;
                },
                onkeydown: (e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    closeAttributeDialog();
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyAttributeDialog();
                  }
                }
              })
            ]),
            m('.actions', [
              m('button.btn', { onclick: () => closeAttributeDialog() }, 'Cancel'),
              m('button.btn.primary', { onclick: () => applyAttributeDialog() }, 'Add')
            ])
          ])
        ])
      );
    }

    return m('div', body);
  }
};


let svgScale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;

function applyTransform() {
  const svg = document.querySelector(".preview-container svg");
  if (svg) {
    svg.style.transform = `translate(${panX}px, ${panY}px) scale(${svgScale})`;
    svg.style.transformOrigin = "0 0";
  }
}

function zoomSvg(factor) {
  svgScale *= factor;
  applyTransform();
}

function resetZoom() {
  svgScale = 1;
  panX = 0;
  panY = 0;
  applyTransform();
}

function setupPanEvents() {
  const container = document.querySelector('.preview-container');
  if (!container) return;

  container.addEventListener('mousedown', (e) => {
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    container.style.cursor = 'grabbing';
  });

  container.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyTransform();
  });

  container.addEventListener('mouseup', () => {
    isPanning = false;
    container.style.cursor = 'default';
  });

  container.addEventListener('mouseleave', () => {
    isPanning = false;
    container.style.cursor = 'default';
  });

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    svgScale *= delta;
    applyTransform();
  }, { passive: false });
}

let globalHandlersInitialized = false;
export function initializeGlobalHandlers() {
  if (globalHandlersInitialized) return;
  globalHandlersInitialized = true;
  setupPanEvents();

  document.addEventListener('keydown', (e) => {
    // Don't pan or hijack shortcuts if typing or inside the code editor
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
    if (target.closest && target.closest('#editor')) return;

    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (modKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      optimizer.undo();
      m.redraw();
      return;
    }

    if (modKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      optimizer.redo();
      m.redraw();
      return;
    }

    const step = 20;
    const zoomStep = 1.1;
    switch (e.key) {
      case 'ArrowUp':
        panY -= step;
        break;
      case 'ArrowDown':
        panY += step;
        break;
      case 'ArrowLeft':
        panX -= step;
        break;
      case 'ArrowRight':
        panX += step;
        break;
      case '+':
      case '=':
        svgScale *= zoomStep;
        break;
      case '-':
      case '_':
        svgScale /= zoomStep;
        break;
      case '0':
        svgScale = 1;
        panX = 0;
        panY = 0;
        break;
      default:
        return;
    }
    applyTransform();
  });
}

function copyToClipboard() {
  const sourceSvg = optimizer.getSourceSvg();
  if (!sourceSvg) {
    alert('No SVG content to copy');
    return;
  }

  navigator.clipboard.writeText(sourceSvg).then(() => {
    optimizer.copyStatus = 'copied';
    if (optimizer.copyResetTimer) {
      clearTimeout(optimizer.copyResetTimer);
    }
    optimizer.copyResetTimer = setTimeout(() => {
      optimizer.copyStatus = 'idle';
      optimizer.copyResetTimer = null;
      m.redraw();
    }, 2000);
    m.redraw();
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  });
}
