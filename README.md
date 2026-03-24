# PDF_MEISTER

Desktop Electron app to organize PDF pages without editing text content.

## Current MVP Features

- Drag and drop one or more PDF files.
- Load a PDF and remove pages.
- Add pages from another PDF into the current document.
- Reorder pages with Up/Down controls.
- Export as a new PDF file (does not overwrite by default).

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