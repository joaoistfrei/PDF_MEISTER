const path = require('path');
const fs = require('fs/promises');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const heicConvert = require('heic-convert');

let mainWindow;
let currentDoc = null;
let currentSourcePath = null;
let currentPageMeta = [];

const IMAGE_INPUT_EXTENSIONS = [
	'heic',
	'heif',
	'jpg',
	'jpeg',
	'png',
	'webp',
	'avif',
	'tiff',
	'bmp',
	'gif',
];
const IMAGE_OUTPUT_FORMATS = ['jpeg', 'png', 'webp', 'avif', 'tiff'];

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

	mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
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

function normalizeOutputFormat(format) {
	if (!format) {
		throw new Error('Output image format is required.');
	}

	const normalized = String(format).toLowerCase();
	if (normalized === 'jpg') {
		return 'jpeg';
	}

	if (!IMAGE_OUTPUT_FORMATS.includes(normalized)) {
		throw new Error(`Unsupported output format: ${format}`);
	}

	return normalized;
}

async function decodeInputImage(inputPath) {
	const ext = path.extname(inputPath).slice(1).toLowerCase();
	const inputBuffer = await fs.readFile(inputPath);

	if (ext === 'heic' || ext === 'heif') {
		const pngBuffer = await heicConvert({
			buffer: inputBuffer,
			format: 'PNG',
			quality: 1,
		});
		return sharp(pngBuffer);
	}

	return sharp(inputBuffer);
}

async function buildOutputPath(outputDirectory, inputPath, outputFormat) {
	const parsed = path.parse(inputPath);
	const baseName = `${parsed.name}_converted`;
	let candidate = path.join(outputDirectory, `${baseName}.${outputFormat}`);
	let counter = 1;

	while (true) {
		try {
			await fs.access(candidate);
			candidate = path.join(outputDirectory, `${baseName}_${counter}.${outputFormat}`);
			counter += 1;
		} catch {
			return candidate;
		}
	}
}

async function convertImageFile(inputPath, outputDirectory, outputFormat, quality) {
	const pipeline = await decodeInputImage(inputPath);

	if (outputFormat === 'jpeg') {
		pipeline.jpeg({ quality });
	} else if (outputFormat === 'png') {
		pipeline.png();
	} else if (outputFormat === 'webp') {
		pipeline.webp({ quality });
	} else if (outputFormat === 'avif') {
		pipeline.avif({ quality });
	} else if (outputFormat === 'tiff') {
		pipeline.tiff({ quality });
	}

	const outputPath = await buildOutputPath(outputDirectory, inputPath, outputFormat);
	await pipeline.toFile(outputPath);
	return outputPath;
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

	ipcMain.handle('open-image-dialog', async () => {
		const result = await dialog.showOpenDialog(mainWindow, {
			title: 'Select images',
			properties: ['openFile', 'multiSelections'],
			filters: [
				{
					name: 'Image Files',
					extensions: IMAGE_INPUT_EXTENSIONS,
				},
			],
		});

		if (result.canceled || result.filePaths.length === 0) {
			return { canceled: true, filePaths: [] };
		}

		return { canceled: false, filePaths: result.filePaths };
	});

	ipcMain.handle('select-output-folder', async () => {
		const result = await dialog.showOpenDialog(mainWindow, {
			title: 'Select output folder',
			properties: ['openDirectory', 'createDirectory'],
		});

		if (result.canceled || result.filePaths.length === 0) {
			return { canceled: true };
		}

		return { canceled: false, folderPath: result.filePaths[0] };
	});

	ipcMain.handle('convert-images', async (_, payload) => {
		const { inputPaths, outputFormat, outputDirectory, quality } = payload || {};

		if (!Array.isArray(inputPaths) || inputPaths.length === 0) {
			throw new Error('Select at least one image to convert.');
		}

		if (!outputDirectory) {
			throw new Error('Select an output folder before converting.');
		}

		const normalizedFormat = normalizeOutputFormat(outputFormat);
		const normalizedQuality = Number.isFinite(quality)
			? Math.min(100, Math.max(1, Math.round(quality)))
			: 90;

		const converted = [];
		const failed = [];

		for (const inputPath of inputPaths) {
			try {
				const outputPath = await convertImageFile(
					inputPath,
					outputDirectory,
					normalizedFormat,
					normalizedQuality
				);

				converted.push({ inputPath, outputPath });
			} catch (error) {
				failed.push({
					inputPath,
					error: error.message || 'Failed to convert image.',
				});
			}
		}

		return {
			converted,
			failed,
			outputFormat: normalizedFormat,
		};
	});

	ipcMain.handle('resize-images', async (_, payload) => {
		const { inputPaths, outputFormat, outputDirectory, quality, width, height, fit } = payload || {};

		if (!Array.isArray(inputPaths) || inputPaths.length === 0) {
			throw new Error('Select at least one image to resize.');
		}

		if (!outputDirectory) {
			throw new Error('Select an output folder before resizing.');
		}

		const normalizedFormat = normalizeOutputFormat(outputFormat);
		const normalizedQuality = Number.isFinite(quality)
			? Math.min(100, Math.max(1, Math.round(quality)))
			: 90;
		const normalizedWidth = Math.max(1, Math.round(width || 800));
		const normalizedHeight = Math.max(1, Math.round(height || 600));
		const normalizedFit = fit || 'cover';

		const processed = [];
		const failed = [];

		for (const inputPath of inputPaths) {
			try {
				const pipeline = await decodeInputImage(inputPath);
				pipeline.resize(normalizedWidth, normalizedHeight, { fit: normalizedFit });

				if (normalizedFormat === 'jpeg') {
					pipeline.jpeg({ quality: normalizedQuality });
				} else if (normalizedFormat === 'png') {
					pipeline.png();
				} else if (normalizedFormat === 'webp') {
					pipeline.webp({ quality: normalizedQuality });
				} else if (normalizedFormat === 'avif') {
					pipeline.avif({ quality: normalizedQuality });
				} else if (normalizedFormat === 'tiff') {
					pipeline.tiff({ quality: normalizedQuality });
				}

				const outputPath = await buildOutputPath(outputDirectory, inputPath, normalizedFormat);
				await pipeline.toFile(outputPath);
				processed.push({ inputPath, outputPath });
			} catch (error) {
				failed.push({
					inputPath,
					error: error.message || 'Failed to resize image.',
				});
			}
		}

		return {
			processed,
			failed,
			outputFormat: normalizedFormat,
		};
	});

	ipcMain.handle('crop-images', async (_, payload) => {
		const { inputPaths, outputFormat, outputDirectory, quality, x, y, width, height } = payload || {};

		if (!Array.isArray(inputPaths) || inputPaths.length === 0) {
			throw new Error('Select at least one image to crop.');
		}

		if (!outputDirectory) {
			throw new Error('Select an output folder before cropping.');
		}

		const normalizedFormat = normalizeOutputFormat(outputFormat);
		const normalizedQuality = Number.isFinite(quality)
			? Math.min(100, Math.max(1, Math.round(quality)))
			: 90;
		const normalizedX = Math.max(0, Math.round(x || 0));
		const normalizedY = Math.max(0, Math.round(y || 0));
		const normalizedWidth = Math.max(1, Math.round(width || 100));
		const normalizedHeight = Math.max(1, Math.round(height || 100));

		const processed = [];
		const failed = [];

		for (const inputPath of inputPaths) {
			try {
				const pipeline = await decodeInputImage(inputPath);
				pipeline.extract({
					left: normalizedX,
					top: normalizedY,
					width: normalizedWidth,
					height: normalizedHeight,
				});

				if (normalizedFormat === 'jpeg') {
					pipeline.jpeg({ quality: normalizedQuality });
				} else if (normalizedFormat === 'png') {
					pipeline.png();
				} else if (normalizedFormat === 'webp') {
					pipeline.webp({ quality: normalizedQuality });
				} else if (normalizedFormat === 'avif') {
					pipeline.avif({ quality: normalizedQuality });
				} else if (normalizedFormat === 'tiff') {
					pipeline.tiff({ quality: normalizedQuality });
				}

				const outputPath = await buildOutputPath(outputDirectory, inputPath, normalizedFormat);
				await pipeline.toFile(outputPath);
				processed.push({ inputPath, outputPath });
			} catch (error) {
				failed.push({
					inputPath,
					error: error.message || 'Failed to crop image.',
				});
			}
		}

		return {
			processed,
			failed,
			outputFormat: normalizedFormat,
		};
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
