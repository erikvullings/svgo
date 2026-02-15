# Advanced SVG Optimizer

![Advanced SVG Optimizer Social Preview](https://erikvullings.github.io/svgo/android-chrome-512x512.png)

Advanced SVG Optimizer is a Mithril + SVGO web app with a VS Code extension wrapper.  
The extension opens the same app in a webview for SVG files.

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
npm run vscode:prepublish
cd ..
```

2. Run the extension in a development instance:

```bash
code --extensionDevelopmentPath="$(pwd)/extension"
```

3. In the Extension Development Host window:

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

2. Create a publisher and PAT (Marketplace `Manage` scope):
- [Publishing Extensions (official docs)](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Marketplace publisher management](https://marketplace.visualstudio.com/manage/publishers/)

3. Install `vsce`:

```bash
npm install -g @vscode/vsce
```

4. Build before packaging (out-of-the-box):

```bash
cd extension
npm run vscode:prepublish
```

5. Package and test the `.vsix` locally:

```bash
vsce package
code --install-extension *.vsix
```

6. Publish:

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
