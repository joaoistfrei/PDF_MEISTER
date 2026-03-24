const dropZone = document.getElementById('drop-zone');
const openBtn = document.getElementById('btn-open');
const addBtn = document.getElementById('btn-add');
const saveBtn = document.getElementById('btn-save');
const clearBtn = document.getElementById('btn-clear');
const pageList = document.getElementById('page-list');
const status = document.getElementById('status');
const emptyState = document.getElementById('empty-state');
const pdfjsLib = window.pdfjsLib || null;

if (pdfjsLib) {
	pdfjsLib.GlobalWorkerOptions.workerSrc =
		'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const state = {
	loaded: false,
	filePath: null,
	pages: [],
	selectedIndex: null,
	pdfBytesBase64: null,
};

let thumbnailDoc = null;
let renderToken = 0;

function setStatus(message, isError = false) {
	status.textContent = message;
	status.classList.toggle('error', isError);
}

function toggleLoadedUi(isLoaded) {
	addBtn.disabled = !isLoaded;
	saveBtn.disabled = !isLoaded;
	clearBtn.disabled = !isLoaded;
	emptyState.style.display = isLoaded ? 'none' : 'block';
}

async function updateDoc(result) {
	state.loaded = true;
	state.filePath = result.filePath || state.filePath;
	state.pages = result.pages || [];
	state.selectedIndex = state.pages.length > 0 ? 0 : null;
	state.pdfBytesBase64 = result.pdfBytes || null;

	await loadThumbnailDocument();

	await renderPageList();
	toggleLoadedUi(true);

	const sourceName = state.filePath ? state.filePath.split(/[\\/]/).pop() : 'document';
	setStatus(`Loaded ${sourceName} with ${state.pages.length} page(s).`);
}

function base64ToUint8Array(base64) {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes;
}

async function loadThumbnailDocument() {
	thumbnailDoc = null;

	if (!pdfjsLib || !state.pdfBytesBase64) {
		return;
	}

	try {
		const bytes = base64ToUint8Array(state.pdfBytesBase64);
		const task = pdfjsLib.getDocument({ data: bytes });
		thumbnailDoc = await task.promise;
	} catch (error) {
		thumbnailDoc = null;
		setStatus('Loaded PDF, but thumbnails could not be generated.', true);
	}
}

async function renderThumbnail(index, canvas, token) {
	if (!thumbnailDoc) {
		return;
	}

	const page = await thumbnailDoc.getPage(index + 1);
	if (token !== renderToken) {
		return;
	}

	const initialViewport = page.getViewport({ scale: 1 });
	const targetWidth = 96;
	const scale = targetWidth / initialViewport.width;
	const viewport = page.getViewport({ scale });
	const ctx = canvas.getContext('2d');

	canvas.width = Math.max(1, Math.floor(viewport.width));
	canvas.height = Math.max(1, Math.floor(viewport.height));

	await page.render({
		canvasContext: ctx,
		viewport,
	}).promise;
}

async function renderPageList() {
	const token = ++renderToken;
	pageList.innerHTML = '';

	const thumbnailTasks = [];

	state.pages.forEach((page, index) => {
		const item = document.createElement('li');
		item.className = 'page-item';
		if (state.selectedIndex === index) {
			item.classList.add('selected');
		}

		const position = document.createElement('div');
		position.className = 'page-position';
		position.textContent = `#${index + 1}`;

		const thumbWrap = document.createElement('div');
		thumbWrap.className = 'page-thumb-wrap';
		const thumbCanvas = document.createElement('canvas');
		thumbCanvas.className = 'page-thumb';
		thumbWrap.appendChild(thumbCanvas);

		const labelBtn = document.createElement('button');
		labelBtn.type = 'button';
		labelBtn.className = 'page-label';
		labelBtn.textContent = page.label;
		labelBtn.addEventListener('click', () => {
			state.selectedIndex = index;
			renderPageList();
		});

		const controls = document.createElement('div');
		controls.className = 'page-controls';

		const upBtn = document.createElement('button');
		upBtn.type = 'button';
		upBtn.textContent = 'Up';
		upBtn.disabled = index === 0;
		upBtn.addEventListener('click', async () => {
			await movePage(index, index - 1);
		});

		const downBtn = document.createElement('button');
		downBtn.type = 'button';
		downBtn.textContent = 'Down';
		downBtn.disabled = index === state.pages.length - 1;
		downBtn.addEventListener('click', async () => {
			await movePage(index, index + 1);
		});

		const removeBtn = document.createElement('button');
		removeBtn.type = 'button';
		removeBtn.textContent = 'Remove';
		removeBtn.disabled = state.pages.length <= 1;
		removeBtn.className = 'danger';
		removeBtn.addEventListener('click', async () => {
			await removePage(index);
		});

		controls.append(upBtn, downBtn, removeBtn);
		item.append(position, thumbWrap, labelBtn, controls);
		pageList.appendChild(item);

		thumbnailTasks.push(
			renderThumbnail(index, thumbCanvas, token).catch(() => {
				thumbWrap.classList.add('thumb-error');
			})
		);
	});

	await Promise.all(thumbnailTasks);
}

async function loadPdfByPath(filePath) {
	try {
		const result = await window.pdfApi.loadPdf(filePath);
		await updateDoc(result);
	} catch (error) {
		setStatus(error.message || 'Could not load the PDF.', true);
	}
}

async function appendPdfByPath(filePath) {
	try {
		const result = await window.pdfApi.appendPdf(filePath);
		state.selectedIndex = state.pages.length;
		await updateDoc(result);
		setStatus(`Added pages from ${filePath.split(/[\\/]/).pop()}.`);
	} catch (error) {
		setStatus(error.message || 'Could not add pages.', true);
	}
}

async function removePage(index) {
	try {
		const result = await window.pdfApi.removePage(index);
		await updateDoc(result);
		if (state.pages.length > 0) {
			state.selectedIndex = Math.min(index, state.pages.length - 1);
		}
		await renderPageList();
		setStatus(`Removed page ${index + 1}.`);
	} catch (error) {
		setStatus(error.message || 'Could not remove page.', true);
	}
}

async function movePage(fromIndex, toIndex) {
	try {
		const result = await window.pdfApi.movePage(fromIndex, toIndex);
		await updateDoc(result);
		state.selectedIndex = toIndex;
		await renderPageList();
		setStatus(`Moved page ${fromIndex + 1} to position ${toIndex + 1}.`);
	} catch (error) {
		setStatus(error.message || 'Could not move page.', true);
	}
}

function resetUiToEmpty() {
	state.loaded = false;
	state.filePath = null;
	state.pages = [];
	state.selectedIndex = null;
	state.pdfBytesBase64 = null;
	thumbnailDoc = null;
	pageList.innerHTML = '';
	toggleLoadedUi(false);
}

async function clearDocument() {
	try {
		await window.pdfApi.clearDoc();
		resetUiToEmpty();
		setStatus('Cleared all pages from the working document.');
	} catch (error) {
		setStatus(error.message || 'Could not clear pages.', true);
	}
}

async function openAndLoadSinglePdf() {
	const selection = await window.pdfApi.openPdfDialog();
	if (!selection.canceled) {
		await loadPdfByPath(selection.filePath);
	}
}

async function openAndAppendPdf() {
	const selection = await window.pdfApi.openPdfDialog();
	if (!selection.canceled) {
		await appendPdfByPath(selection.filePath);
	}
}

async function saveAs() {
	try {
		const result = await window.pdfApi.savePdfAs();
		if (!result.canceled) {
			setStatus(`Saved new PDF: ${result.filePath}`);
		}
	} catch (error) {
		setStatus(error.message || 'Could not save PDF.', true);
	}
}

openBtn.addEventListener('click', openAndLoadSinglePdf);
addBtn.addEventListener('click', openAndAppendPdf);
saveBtn.addEventListener('click', saveAs);
clearBtn.addEventListener('click', clearDocument);

['dragenter', 'dragover'].forEach((eventName) => {
	dropZone.addEventListener(eventName, (event) => {
		event.preventDefault();
		event.stopPropagation();
		dropZone.classList.add('drag-over');
	});
});

['dragleave', 'drop'].forEach((eventName) => {
	dropZone.addEventListener(eventName, (event) => {
		event.preventDefault();
		event.stopPropagation();
		dropZone.classList.remove('drag-over');
	});
});

dropZone.addEventListener('drop', async (event) => {
	const files = Array.from(event.dataTransfer.files || []);
	const pdfs = files.filter((file) => file.name.toLowerCase().endsWith('.pdf') && file.path);

	if (pdfs.length === 0) {
		setStatus('Please drop one or more PDF files.', true);
		return;
	}

	await loadPdfByPath(pdfs[0].path);

	for (let i = 1; i < pdfs.length; i += 1) {
		await appendPdfByPath(pdfs[i].path);
	}

	if (pdfs.length > 1) {
		setStatus(`Merged ${pdfs.length} PDFs into one working document.`);
	}
});

toggleLoadedUi(false);
