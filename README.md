# Advanced SVG Optimizer

![Advanced SVG Optimizer Social Preview](https://erikvullings.github.io/svgo/android-chrome-512x512.png)

Advanced SVG Optimizer is a Mithril + SVGO web app, which adds several additional SVG optimizations on top of `svgo`, and it allows you to inspect the impact before accepting, such as:

- Using fewer decimals for attributes and paths
- Reorganizing text (manually) so grouping becomes more efficient
- Removing `tspan` elements and styling
- Converting Sodipodi arcs
- Grouping similar elements (so you can share attributes)
- Automatic cropping and resizing
- Settings and last SVG are stored in local storage

## Live Demo

[https://erikvullings.github.io/svgo](https://erikvullings.github.io/svgo)

## Features

- SVG optimization via SVGO plus custom passes.
- Tree + code editing.
- Live preview, zoom/pan, stats, and download.
- SVG-focused VS Code integration.

## Build And Run (Vite Required)

This project is built with Vite. Do not open `index.html` directly.

```bash
pnpm install
pnpm dev
```

For production output:

```bash
pnpm build
```

`pnpm build` writes the web app to `docs/` (used for GitHub Pages).

## Procyon plugin build

Run `pnpm build:procyon` to produce a self-contained web app at `dist/procyon/`
(entry point `dist/procyon/index.html`). This build includes Monaco locally,
unlike the standalone and VS Code builds, which retain their existing CDN setup.
Package the complete directory; it does not need network access for the editor.
When hosted by Procyon, the app starts in Tree mode with the sidebar closed,
shows the tree/editor above the SVG preview at equal height, hides the
standalone Open action and app title, and places Save in the header and Copy
in the sidebar menu. Standalone and VS Code keep their existing defaults.

Before loading the app, the isolated host injects
`window.procyonPlugin = { loadToken, theme, settings, postMessage }`. `loadToken` is an
unpredictable, nonempty string unique to each plugin window; `postMessage`
accepts `{ type: "save-svg", svg: string }`; `theme` is the effective Procyon
`"light"` or `"dark"` theme. `settings` is an optional partial object of the
15 optimization settings listed below, loaded from trusted host storage before
the app starts. After the window loads, the host delivers
`{ type: "load-svg", svg: string, uri: string, loadToken }` via
`window.postMessage` executed **inside that window**. The app accepts loads
only from the same window with the matching token. The host owns the URI and
must save the `svg` from an explicit Save button or Cmd/Ctrl+S to that document.
Editing and loading do not send save messages. The host should restrict its
message bridge to `save-svg` and `settings-change` and scope it to the current
document/window.
After each save attempt, the host reports
`{ type: "save-result", success: boolean, error?: string, loadToken }` through
the same in-window `postMessage` path. A failed save displays the host's error
(or a generic failure) until the next save or document load.
When an optimization setting changes, SVGO sends
`{ type: "settings-change", settings, sequence }` through the same trusted
bridge, containing the complete 15-field settings snapshot (not SVG content).
It coalesces further changes while waiting for a matching acknowledgment, and
sends no settings message at startup or for document edits alone. The host must
validate and persist this snapshot outside the incognito WebView, rejecting
unknown keys, and inject it into subsequent plugin windows. The fields are
`precision` (integer 0-5, default 1), `pathPrecision` (integer 0-5, default 2),
`customWidth` and `customHeight` (integers 1-100000, default 100), and booleans
`removeTspan`, `removeStyling`, `trimText`, `autoAutocrop`,
`useCustomDimensions`, `removeDefaultValues`, `removeFontFamily`,
`removeFontSize`, `convertSodipodiArcs`, `groupSimilarElements`, and
`groupTextElementsAtEnd`. Incoming partial settings use defaults for omitted
fields. The host reports each write with a token-bound
`{ type: "settings-result", success: boolean, error?: string, loadToken, sequence }`
through the same in-window message path; failures appear as a persistent
banner until a successful write. To close a panel, the host sends the trusted
`{ type: "flush-settings", loadToken }` message; SVGO immediately sends the
latest snapshot with a new `sequence` and `flush: true`, even if another write
is outstanding. The host processes writes in sequence order (discarding older
writes) and waits for that flush request to finish before closing the child.
Sequences start at 1 for each panel. Procyon does not depend on localStorage
for preference retention.
The host sends `{ type: "theme-change", theme, loadToken }` through the same
in-window message path when Procyon's effective theme changes. Without a host
theme, the plugin follows the system color scheme. Procyon mode uses the host's
surface, text, border, and accent colors for its light/dark palettes; standalone
SVGO keeps its existing colors. Procyon does not read or store
SVGO's standalone theme preference, SVG content, document URIs, history, or
view mode. Every new panel starts in Tree mode with the sidebar closed and an
equal top/bottom split. Changes to the sidebar and split remain session-local
even if previous layout values exist in storage. Standalone storage at
`svgo-state-v1` is not read in Procyon.
The preview and live SVG bounds measurement sanitize loaded markup before
inserting it into the DOM. Scripts, event handlers, foreignObject, external
references, and unsafe styles are removed from the rendered copy; the editable
source and Save payload remain unchanged. The host must still enforce a CSP
that blocks external resource origins and untrusted scripts while allowing
local assets and Monaco's blob worker.

## VS Code Extension: Use The App In VS Code

The extension lives in `extension/` and provides the command:

- `SVG Optimizer: Open View` (`svgOptimizer.open`)

Behavior:

- Opening or focusing an `.svg` file can auto-open the optimizer panel.
- The panel loads the current SVG and can write updates back to the file.

## VS Code Extension: Local Test Workflow

1. Build extension + bundled webview:

```bash
cd extension
npm install
pnpm vscode:prepublish
cd ..
```

1. Run the extension in a development instance:

```bash
code --extensionDevelopmentPath="$(pwd)/extension"
```

1. In the Extension Development Host window:

- Open an `.svg` file.
- Run `SVG Optimizer: Open View` from the Command Palette.

## Publish To VS Code Marketplace

Publishing is done with `@vscode/vsce` and a Marketplace publisher/PAT.

1. Ensure extension metadata is ready in `extension/package.json`:

- `name`
- `displayName`
- `publisher`
- `version`
- `engines.vscode`

1. Create a publisher and PAT (Marketplace `Manage` scope):

- [Publishing Extensions (official docs)](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Marketplace publisher management](https://marketplace.visualstudio.com/manage/publishers/)

1. Install `vsce`:

```bash
npm install -g @vscode/vsce
```

1. Build before packaging (out-of-the-box):

```bash
cd extension
npm run vscode:prepublish
```

1. Package and test the `.vsix` locally:

```bash
vsce package
code --install-extension *.vsix
```

1. Publish:

```bash
vsce login erikvullings
vsce publish
```

You can also auto-bump:

```bash
vsce publish patch
```

## Notes

- `vsce` enforces marketplace image/security rules. See the official publishing docs for current constraints.
- `npm run vscode:prepublish` now builds the web app and bundles it into `extension/webview/` so `vsce package`/`vsce publish` work without manual copying.

## License

[MIT](LICENSE)
