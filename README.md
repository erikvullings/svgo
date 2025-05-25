# Advanced SVG Optimizer

![Advanced SVG Optimizer Social Preview](https://erikvullings.github.io/svgo/android-chrome-512x512.png)

An advanced online tool to optimize, clean, and resize SVG files directly in your browser. This single-page application leverages the power of SVGO and custom JavaScript transformations to provide fine-grained control over your SVG output, improving performance, reducing file size, and ensuring compatibility.

## 🚀 Live Demo

This application is designed to run as a standalone web app directly from a GitHub Pages deployment.

[**Visit the Live Demo Here**](https://your-username.github.io/your-repo-name/docs/) ## ✨ Features

* **Comprehensive SVG Optimization:** Utilizes a highly configurable SVGO core for standard optimizations like removing useless elements, comments, metadata, and cleaning up numeric values.
* **Custom Transformations:**
  * **Sodipodi Arc Conversion:** Automatically converts `sodipodi:arc` elements (commonly found in Inkscape SVGs) into native SVG `<path>` elements or efficient `<circle>` elements for full circles, ensuring better compatibility and rendering.
  * **Precision Control:** Adjust the floating-point precision of numeric values in your SVG.
  * **Styling & Group Removal:** Options to remove `<style>` tags, `style` attributes, `class` attributes, and flatten `<g>` (group) elements for simpler SVG structures.
  * **Default Value Removal:** Strips attributes that have their default values, further reducing file size.
  * **Font Attribute Control:** Options to remove `font-family` and `font-size` attributes for more flexible typography control via CSS.
  * **Intelligent Resizing:** Dynamically resizes the SVG to custom pixel dimensions while preserving the aspect ratio and ensuring all content remains visible, by adjusting the `viewBox` attribute with rounded integer values.
  * **`tspan` Removal:** Flattens `tspan` elements within text, simplifying text structures.
* **Interactive Editor & Preview:**
  * **Monaco Editor:** A powerful code editor for pasting and editing SVG code with syntax highlighting.
  * **Live Preview:** See the optimized SVG rendered in real-time.
* **Drag-and-Drop File Support:** Easily load SVG files by dragging them onto the application window.
* **Download Optimized SVG:** Download your cleaned and optimized SVG with a single click.
* **Size Statistics:** Instantly see the original size, optimized size, and percentage reduction of your SVG.

## 🛠️ How to Use

1. **Open the Live Demo:** Navigate to the [Live Demo URL](https://your-username.github.io/your-repo-name/docs/).
2. **Input SVG:**
   * **Paste Code:** Paste your SVG code directly into the left-hand editor.
   * **Upload File:** Click the "Load SVG File" button or drag and drop an `.svg` file onto the page.
3. **Adjust Options:** Use the checkboxes and input fields in the control panel to fine-tune the optimization settings.
4. **View Results:** The optimized SVG will appear in the right-hand preview panel, and its code will update in the editor (though the current implementation doesn't update the left editor with the optimized code). Size statistics will show the reduction.
5. **Download:** Click the "Download Optimized SVG" button to save your refined SVG file.

## 📂 Project Structure

This project is a single-page web application. All the code resides in the `docs` folder to facilitate easy deployment using GitHub Pages.

```bash
└── docs/
├── index.html          <-- The main application file
├── apple-touch-icon.png
├── android-chrome-192x192.png
├── android-chrome-512x512.png
├── favicon-16x16.png
├── favicon-32x32.png
├── favicon.ico
└── site.webmanifest
```

## ⚙️ Development

This project is built with:

* **Mithril.js:** A minimalist JavaScript framework for building single-page applications.
* **Monaco Editor:** The code editor that powers VS Code, embedded for SVG editing.
* **SVGO (Browser build):** The industry-standard Node.js-based SVG optimizer, compiled for browser use.
* **Pure JavaScript:** Custom SVG manipulation logic for advanced transformations not covered by SVGO's default plugins.

To run locally:

1.  Clone this repository: `git clone https://github.com/your-username/your-repo-name.git` 2.  Navigate to the `docs` folder: `cd your-repo-name/docs`
3.  Open `index.html` in your web browser. (You might need a local server for drag-and-drop or file loading to work correctly, e.g., `python3 -m http.server` or `npx serve`).

## 🤝 Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE). ---

**Note:** Remember to replace the placeholder URLs and social media handles (`https://your-app-domain.com/`, `https://your-username.github.io/your-repo-name/docs/`, `https://github.com/your-username/your-repo-name.git`, `@yourtwitterhandle`) with your actual project details before using this `README.md` file.