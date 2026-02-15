export const ROUNDABLE_ATTRS = new Set([
  'x', 'y', 'cx', 'cy',
  'width', 'height',
  'r', 'rx', 'ry'
]);

export const ZERO_SENSITIVE_ATTRS = new Set([
  'width', 'height',
  'r', 'rx', 'ry'
]);

export const NUMERIC_ATTRS = new Set([
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy',
  'r', 'rx', 'ry', 'width', 'height',
  'dx', 'dy', 'font-size', 'stroke-width',
  'opacity', 'fill-opacity', 'stroke-opacity',
  'stroke-dashoffset', 'stroke-miterlimit',
  'letter-spacing', 'word-spacing',
  'pathlength'
]);

export const NUMERIC_LIST_ATTRS = new Set([
  'viewbox', 'points', 'stroke-dasharray'
]);

export const KNOWN_SVG_ATTRS = new Set([
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

export function hasRoundableAttrs(node: Element): boolean {
  if (!node || node.nodeType !== 1) return false;

  for (const attr of Array.from(node.attributes || [])) {
    if (ROUNDABLE_ATTRS.has(attr.name)) return true;
  }

  return Array.from(node.children || []).some(child => hasRoundableAttrs(child));
}

export function extractTranslate(transform: string | null) {
  if (!transform) return { dx: 0, dy: 0, rest: '' };

  let dx = 0;
  let dy = 0;

  const rest = transform.replace(/translate\(\s*([^)]+)\)/g, (_: string, args: string) => {
    const parts = args.split(/[\s,]+/).map(Number);
    dx += parts[0] || 0;
    dy += parts[1] || 0;
    return '';
  }).trim();

  return { dx, dy, rest };
}

export function roundAttrsRecursive(node: Element) {
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

  Array.from(node.children).forEach(child => roundAttrsRecursive(child));
}

export function roundNumericValue(value: string, precision: number) {
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

export function roundNumericValueFixed(value: string, precision: number) {
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return value;
  if (precision === 0) return formatNumberCompact(Math.round(num));
  const rounded = parseFloat(num.toFixed(precision));
  return formatNumberCompact(rounded);
}

export function formatNumberCompact(num: number) {
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

export function roundNumericList(value: string, precision: number) {
  return value.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, match =>
    roundNumericValueFixed(match, precision)
  );
}

export function roundPathData(value: string, precision: number) {
  return value.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, match =>
    roundNumericValueFixed(match, precision)
  );
}

export function applyTranslateToPoints(value: string, dx: number, dy: number) {
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

export function translatePathData(pathData: string, dx: number, dy: number) {
  const temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  temp.setAttribute('d', pathData);
  if (!temp.getPathData) {
    return translatePathDataFallback(pathData, dx, dy);
  }

  let segments: PathDataSegment[];
  try {
    segments = temp.getPathData({ normalize: true });
  } catch (e) {
    try {
      segments = temp.getPathData() || [];
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

export function translatePathDataFallback(pathData: string, dx: number, dy: number) {
  const tokenRe = /([a-zA-Z])|([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/g;
  const tokens: Array<{ type: 'cmd' | 'num'; value: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(pathData)) !== null) {
    if (match[1]) {
      tokens.push({ type: 'cmd', value: match[1] });
    } else {
      tokens.push({ type: 'num', value: match[2] });
    }
  }

  if (tokens.length === 0) return null;

  const paramCounts: Record<string, number> = {
    m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0
  };

  let i = 0;
  let cmd: string | null = null;
  let firstCommand = true;
  let currentX = 0;
  let currentY = 0;
  let subStartX = 0;
  let subStartY = 0;
  const out: string[] = [];

  function readNumbers() {
    const nums: number[] = [];
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
    }

    if (!cmd) return null;

    const cmdLower = cmd.toLowerCase();
    const isAbs = cmd === cmd.toUpperCase();
    const paramCount = paramCounts[cmdLower];

    if (paramCount === 0) {
      out.push('Z');
      currentX = subStartX;
      currentY = subStartY;
      firstCommand = false;
      continue;
    }

    const numbers = readNumbers();
    if (numbers.length === 0) {
      return null;
    }

    for (let n = 0; n < numbers.length; n += paramCount) {
      const chunk = numbers.slice(n, n + paramCount);
      if (chunk.length < paramCount) return null;

      switch (cmdLower) {
        case 'm': {
          if (isAbs) {
            const nx = chunk[0] + dx;
            const ny = chunk[1] + dy;
            out.push('M', formatNumberCompact(nx), formatNumberCompact(ny));
            currentX = chunk[0];
            currentY = chunk[1];
            subStartX = chunk[0];
            subStartY = chunk[1];
          } else {
            if (firstCommand) {
              out.push('M', formatNumberCompact(chunk[0]), formatNumberCompact(chunk[1]));
              currentX = chunk[0];
              currentY = chunk[1];
              subStartX = chunk[0];
              subStartY = chunk[1];
            } else {
              out.push('m', formatNumberCompact(chunk[0]), formatNumberCompact(chunk[1]));
              currentX += chunk[0];
              currentY += chunk[1];
              subStartX = currentX;
              subStartY = currentY;
            }
          }
          break;
        }
        case 'l': {
          if (isAbs) {
            out.push('L',
              formatNumberCompact(chunk[0] + dx),
              formatNumberCompact(chunk[1] + dy)
            );
            currentX = chunk[0];
            currentY = chunk[1];
          } else {
            out.push('l',
              formatNumberCompact(chunk[0]),
              formatNumberCompact(chunk[1])
            );
            currentX += chunk[0];
            currentY += chunk[1];
          }
          break;
        }
        case 'h': {
          if (isAbs) {
            out.push('H', formatNumberCompact(chunk[0] + dx));
            currentX = chunk[0];
          } else {
            out.push('h', formatNumberCompact(chunk[0]));
            currentX += chunk[0];
          }
          break;
        }
        case 'v': {
          if (isAbs) {
            out.push('V', formatNumberCompact(chunk[0] + dy));
            currentY = chunk[0];
          } else {
            out.push('v', formatNumberCompact(chunk[0]));
            currentY += chunk[0];
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

export function collapseTransforms(svg: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) return svg;

  function canTranslate(el: Element) {
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

  function applyTranslate(el: Element, dx: number, dy: number) {
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
      if (points) {
        const translated = applyTranslateToPoints(points, dx, dy);
        el.setAttribute('points', translated);
      }
    }

    const xAttrs = ['x', 'x1', 'x2', 'cx'];
    const yAttrs = ['y', 'y1', 'y2', 'cy'];

    xAttrs.forEach(attr => {
      if (el.hasAttribute(attr)) {
        const val = parseFloat(el.getAttribute(attr) || '');
        if (Number.isFinite(val)) {
          el.setAttribute(attr, formatNumberCompact(val + dx));
        }
      }
    });

    yAttrs.forEach(attr => {
      if (el.hasAttribute(attr)) {
        const val = parseFloat(el.getAttribute(attr) || '');
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
