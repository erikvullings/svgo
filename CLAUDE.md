# Environment Setup
- Local macOS capabilities and optimized CLI tools are mapped in `~/.config/ai/tools.md`. Read this file to use optimized search/replace and parsing binaries.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Advanced SVG Optimizer - a single-page web application for optimizing, cleaning, and resizing SVG files directly in the browser. The project uses SVGO with custom TypeScript transformations for comprehensive SVG optimization.

## Architecture

### Core Components

- **Vite + TypeScript build**: Source lives in `src/`, built output goes to `docs/` for GitHub Pages deployment.
- **SVGOptimizer class** (`src/optimizer.ts`): All optimization logic — SVGO integration, custom transforms, import pipeline.
- **Mithril.js frontend** (`src/ui.ts`, `src/components/`): UI rendering and state management.
- **Monaco Editor**: Integrated VS Code editor for SVG code editing with syntax highlighting.
- **SVGO**: npm dependency (`svgo@4`) used for standard SVG optimizations.

### File Structure

```
├── src/
│   ├── main.ts                  # Entry point
│   ├── app.ts                   # App initialisation
│   ├── optimizer.ts             # SVGOptimizer class (all optimization logic)
│   ├── ui.ts                    # Top-level Mithril UI, drag-drop, paste handling
│   ├── treeView.ts              # SVG tree inspector view
│   ├── treeUtils.ts             # Tree manipulation helpers
│   ├── svgUtils.ts              # SVG utility functions
│   ├── elementTemplates.ts      # SVG element insertion templates
│   ├── styles.css               # Global styles
│   ├── types/global.d.ts        # Ambient type declarations
│   └── components/
│       ├── controls.ts          # Optimization controls sidebar content
│       ├── editorPanel.ts       # Monaco editor panel
│       ├── header.ts            # App header
│       ├── previewPanel.ts      # SVG preview panel
│       └── sidebar.ts           # Sidebar shell
├── tests/
│   ├── optimizer.test.ts        # Unit tests for SVGOptimizer methods
│   ├── svgUtils.test.ts
│   ├── elementTemplates.test.ts
│   └── examples/                # Sample SVG files used by tests
├── docs/                        # Built output (GitHub Pages — do not edit by hand)
├── tsconfig.json                # Includes both src/ and tests/
├── vite.config.ts
└── package.json
```

### Key Features Implementation

1. **Custom SVG Transformations** (all in `src/optimizer.ts`):
   - Invalid hex colour repair (`fixInvalidHexColors` method) — runs on every import
   - Sodipodi arc conversion (`convertSodipodiArcs` method)
   - Precision control for numeric values (`roundNumbers` method)
   - Style and group removal (`removeStyling`, `removeGroups` methods)
   - Default value removal (`removeDefaultValues` method)
   - Font attribute control (`removeFontAttributes` method)
   - Intelligent resizing with viewBox calculation (`resizeSvg` method)

2. **Interactive Features**:
   - Drag-and-drop file support
   - Real-time preview with zoom/pan controls
   - Live size statistics and reduction percentage
   - Downloadable optimized SVG output

## Development Workflow

### Local Development

```bash
pnpm install
pnpm dev        # starts Vite dev server
pnpm build      # builds to docs/
pnpm test       # runs Vitest unit tests
```

### Testing

- Unit tests use Vitest with a jsdom environment (`// @vitest-environment jsdom`).
- Test files live in `tests/`, example SVGs in `tests/examples/`.
- Run all tests: `pnpm test` or `npx vitest run`.

### Deployment

Built output in `docs/` is deployed automatically via GitHub Pages on push to `main`. Never edit `docs/` by hand — always rebuild via `pnpm build`.

## Key Implementation Details

### SVG Processing Pipeline

Every imported SVG string passes through `normalizeNamespaces()` first:

1. `stripXmlDeclarations` — removes `<?xml ...?>` preamble
2. `fixInvalidHexColors` — clamps out-of-range hex digits (e.g. `#pf5ccc` → `#ff5ccc`)
3. `normalizeXlinkHrefs` — converts `xlink:href` to `href`, adds missing namespace
4. `stripUndeclaredNamespacedContent` — removes undeclared namespace prefixes

Then `optimizeSvg()` runs the full pipeline:

1. Convert Sodipodi arcs before SVGO (to prevent removal)
2. Apply SVGO with comprehensive plugin set
3. Apply custom transformations (precision, defaults, styling, etc.)
4. Apply custom resizing if enabled
5. Display results and statistics

### Critical Methods in `src/optimizer.ts`

- `optimizeSvg()`: Main optimization pipeline orchestrator
- `normalizeNamespaces()`: Runs on every import — strips declarations, fixes colours, normalises namespaces
- `fixInvalidHexColors()`: Repairs hex colours with out-of-range digits
- `convertSodipodiArcs()`: Handles Inkscape-specific arc elements
- `resizeSvg()`: Intelligent SVG resizing with content bounding box calculation
- `calculateContentBBox()`: DOM-based SVG content measurement
- `loadSvgString()` / `loadFile()`: Entry points for SVG import

### State Management

- All state is managed within the `SVGOptimizer` class instance.
- Options object controls all optimization settings.
- Mithril.js handles UI reactivity and updates.
