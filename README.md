# PDF_MEISTER

Desktop Electron app to organize PDF pages without editing text content.

## Project Structure

```text
.
|- src/
|  |- main/
|  |  |- main.js
|  |  |- preload.js
|  \- renderer/
|     |- index.html
|     |- styles.css
|     |- js/
|     |  |- main.js
|     |  |- dom.js
|     |  |- state.js
|     |  |- ui.js
|     |  |- pdf-module.js
|     |  |- image-convert-module.js
|     |  \- image-resize-module.js
|     \- templates/
|        \- image-resize-workspace.js
|- package.json
\- README.md
```

## Current MVP Features

- Drag and drop one or more PDF files.
- Load a PDF and remove pages.
- Add pages from another PDF into the current document.
- Reorder pages with Up/Down controls.
- Export as a new PDF file (does not overwrite by default).
- Convert images in batch (HEIC, HEIF, JPG, JPEG, PNG, WebP, AVIF, TIFF, BMP, GIF).
- Export converted images to JPEG, PNG, WebP, AVIF, or TIFF.
- Resize images in batch (scale with fit options: cover, contain, fill).
- Crop images in batch (extract custom regions with X, Y, Width, Height).
- Export resized/cropped images to JPEG, PNG, WebP, AVIF, or TIFF.

## Run

```bash
npm install
npm start
```

## How to Use

1. Drop a PDF in the app, or click Choose PDF.
2. Click Add Pages From PDF to append pages from another file.
3. Use Up/Down to reorder pages and Remove to delete pages.
4. Click Export New PDF to save the result.

## Notes

- This app is for page-level operations only.
- Text editing inside PDFs is intentionally out of scope.