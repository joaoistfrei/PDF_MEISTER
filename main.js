const path = require('path');
const fs = require('fs/promises');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { PDFDocument } = require('pdf-lib');

let mainWindow;
let currentDoc = null;
let currentSourcePath = null;
let currentPageMeta = [];

function getSourceName(filePath) {
	const parsed = path.parse(filePath || 'document.pdf');
	return parsed.name || 'document';
}

function createPageMeta(filePath, pageCount) {
	const sourceName = getSourceName(filePath);
	return Array.from({ length: pageCount }, (_, i) => ({
		sourceName,
		sourcePageNumber: i + 1,
	}));
}

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 980,
		minHeight: 640,
		backgroundColor: '#f4f1e8',
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

	mainWindow.loadFile('index.html');
}

function ensureLoaded() {
	if (!currentDoc) {
		throw new Error('No PDF loaded. Drop a PDF file first.');
	}
}

function getPageCount() {
	return currentDoc ? currentDoc.getPageCount() : 0;
}

function getPageLabels() {
	const count = getPageCount();
	return Array.from({ length: count }, (_, i) => ({
		index: i,
		label: `#${
			currentPageMeta[i]?.sourcePageNumber ?? i + 1
		}-${currentPageMeta[i]?.sourceName ?? 'document'}`,
	}));
}

async function getCurrentBytes() {
	ensureLoaded();
	const bytes = await currentDoc.save();
	return Buffer.from(bytes);
}

function defaultOutputPath() {
	const source = currentSourcePath || 'output.pdf';
	const parsed = path.parse(source);
	const outputName = `${parsed.name}_edited.pdf`;
	return path.join(parsed.dir || app.getPath('documents'), outputName);
}

app.whenReady().then(() => {
	createWindow();

	ipcMain.handle('open-pdf-dialog', async () => {
		const result = await dialog.showOpenDialog(mainWindow, {
			title: 'Select a PDF',
			properties: ['openFile'],
			filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
		});

		if (result.canceled || result.filePaths.length === 0) {
			return { canceled: true };
		}

		return { canceled: false, filePath: result.filePaths[0] };
	});

	ipcMain.handle('load-pdf', async (_, filePath) => {
		if (!filePath) {
			throw new Error('A file path is required to load a PDF.');
		}

		const input = await fs.readFile(filePath);
		currentDoc = await PDFDocument.load(input);
		currentSourcePath = filePath;
		currentPageMeta = createPageMeta(filePath, getPageCount());

		return {
			filePath,
			pageCount: getPageCount(),
			pages: getPageLabels(),
			pdfBytes: (await getCurrentBytes()).toString('base64'),
		};
	});

	ipcMain.handle('append-pdf', async (_, filePath) => {
		ensureLoaded();
		if (!filePath) {
			throw new Error('A file path is required to append a PDF.');
		}

		const input = await fs.readFile(filePath);
		const incomingDoc = await PDFDocument.load(input);
		const pageIndices = incomingDoc.getPages().map((_, index) => index);
		const copiedPages = await currentDoc.copyPages(incomingDoc, pageIndices);

		for (const copiedPage of copiedPages) {
			currentDoc.addPage(copiedPage);
		}

		currentPageMeta.push(...createPageMeta(filePath, incomingDoc.getPageCount()));

		return {
			pageCount: getPageCount(),
			pages: getPageLabels(),
			pdfBytes: (await getCurrentBytes()).toString('base64'),
		};
	});

	ipcMain.handle('remove-page', async (_, pageIndex) => {
		ensureLoaded();

		const count = getPageCount();
		if (count <= 1) {
			throw new Error('At least one page must remain in the document.');
		}

		if (pageIndex < 0 || pageIndex >= count) {
			throw new Error('Invalid page index.');
		}

		currentDoc.removePage(pageIndex);
		currentPageMeta.splice(pageIndex, 1);

		return {
			pageCount: getPageCount(),
			pages: getPageLabels(),
			pdfBytes: (await getCurrentBytes()).toString('base64'),
		};
	});

	ipcMain.handle('move-page', async (_, fromIndex, toIndex) => {
		ensureLoaded();

		const count = getPageCount();
		if (
			fromIndex < 0 ||
			fromIndex >= count ||
			toIndex < 0 ||
			toIndex >= count ||
			fromIndex === toIndex
		) {
			return {
				pageCount: getPageCount(),
				pages: getPageLabels(),
				pdfBytes: (await getCurrentBytes()).toString('base64'),
			};
		}

		const order = Array.from({ length: count }, (_, i) => i);
		const [moved] = order.splice(fromIndex, 1);
		order.splice(toIndex, 0, moved);

		const nextDoc = await PDFDocument.create();
		const pages = await nextDoc.copyPages(currentDoc, order);
		pages.forEach((page) => nextDoc.addPage(page));

		currentDoc = nextDoc;
		currentPageMeta = order.map((originalIndex) => currentPageMeta[originalIndex]);

		return {
			pageCount: getPageCount(),
			pages: getPageLabels(),
			pdfBytes: (await getCurrentBytes()).toString('base64'),
		};
	});

	ipcMain.handle('clear-doc', async () => {
		currentDoc = null;
		currentSourcePath = null;
		currentPageMeta = [];

		return { cleared: true };
	});

	ipcMain.handle('save-pdf-as', async () => {
		ensureLoaded();

		const result = await dialog.showSaveDialog(mainWindow, {
			title: 'Save new PDF',
			defaultPath: defaultOutputPath(),
			filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
		});

		if (result.canceled || !result.filePath) {
			return { canceled: true };
		}

		const outputPath = result.filePath.toLowerCase().endsWith('.pdf')
			? result.filePath
			: `${result.filePath}.pdf`;

		const bytes = await getCurrentBytes();
		await fs.writeFile(outputPath, bytes);

		return {
			canceled: false,
			filePath: outputPath,
		};
	});

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
