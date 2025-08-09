# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Advanced SVG Optimizer - a single-page web application for optimizing, cleaning, and resizing SVG files directly in the browser. The project uses SVGO with custom JavaScript transformations for comprehensive SVG optimization.

## Architecture

### Core Components

- **Single HTML Application**: The entire application is contained in `docs/index.html` as a single-page app
- **SVGOptimizer Class**: The main JavaScript class handling all optimization logic (lines 306-958 in docs/index.html)
- **Mithril.js Frontend**: Uses Mithril.js framework for UI rendering and state management
- **Monaco Editor**: Integrated VS Code editor for SVG code editing with syntax highlighting
- **SVGO Integration**: Uses SVGO browser build for standard SVG optimizations

### Key Features Implementation

1. **Custom SVG Transformations**:
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
Since this is a client-side only application with no build process:

1. Navigate to the `docs` folder
2. Serve the files using a local HTTP server:
   ```bash
   cd docs
   python3 -m http.server
   # or
   npx serve
   ```
3. Open `index.html` in your browser

### File Structure
```
└── docs/
    ├── index.html          # Main application (contains all code)
    └── [various icons and manifest files for PWA support]
```

### No Build Process
- No package.json, no npm scripts, no build tools
- All dependencies are loaded via CDN (Mithril.js, Monaco Editor, SVGO)
- Direct file editing and browser refresh for development
- Deployment is simply committing to the `docs` folder for GitHub Pages

### Testing
- Manual testing through the web interface
- Load various SVG files and verify optimizations work correctly
- Test drag-and-drop functionality
- Verify all optimization options produce expected results

## Key Implementation Details

### SVG Processing Pipeline
1. Convert Sodipodi arcs before SVGO processing (to prevent removal)
2. Apply SVGO with comprehensive plugin set
3. Apply custom transformations (precision, defaults, styling, etc.)
4. Apply custom resizing if enabled
5. Display results and statistics

### Critical Methods
- `optimizeSvg()`: Main optimization pipeline orchestrator
- `convertSodipodiArcs()`: Handles Inkscape-specific arc elements
- `resizeSvg()`: Intelligent SVG resizing with content bounding box calculation
- `calculateContentBBox()`: DOM-based SVG content measurement

### State Management
- All state is managed within the `SVGOptimizer` class instance
- Options object controls all optimization settings
- Mithril.js handles UI reactivity and updates

## Deployment

The application is deployed via GitHub Pages from the `docs` folder. Any changes pushed to the main branch will automatically update the live application at the GitHub Pages URL.