const dropZone = document.getElementById('drop-zone');
const openBtn = document.getElementById('btn-open');
const addBtn = document.getElementById('btn-add');
const saveBtn = document.getElementById('btn-save');
const pageList = document.getElementById('page-list');
const preview = document.getElementById('preview');
const status = document.getElementById('status');
const emptyState = document.getElementById('empty-state');

const state = {
	loaded: false,
	filePath: null,
	pages: [],
	selectedIndex: null,
};

function setStatus(message, isError = false) {
	status.textContent = message;
	status.classList.toggle('error', isError);
}

function toggleLoadedUi(isLoaded) {
	addBtn.disabled = !isLoaded;
	saveBtn.disabled = !isLoaded;
	emptyState.style.display = isLoaded ? 'none' : 'block';
}

function renderPreview() {
	if (!state.loaded || state.selectedIndex === null) {
		preview.textContent = 'Select a page to manage it.';
		return;
	}

	const pageNumber = state.selectedIndex + 1;
	preview.innerHTML = `
		<div class="preview-card">
			<h4>Page ${pageNumber}</h4>
			<p>Use Move Up, Move Down, or Remove to organize your document.</p>
		</div>
	`;
}

async function updateDoc(result) {
	state.loaded = true;
	state.filePath = result.filePath || state.filePath;
	state.pages = result.pages || [];
	state.selectedIndex = state.pages.length > 0 ? 0 : null;

	renderPageList();
	renderPreview();
	toggleLoadedUi(true);

	const sourceName = state.filePath ? state.filePath.split(/[\\/]/).pop() : 'document';
	setStatus(`Loaded ${sourceName} with ${state.pages.length} page(s).`);
}

function renderPageList() {
	pageList.innerHTML = '';

	state.pages.forEach((page, index) => {
		const item = document.createElement('li');
		item.className = 'page-item';
		if (state.selectedIndex === index) {
			item.classList.add('selected');
		}

		const labelBtn = document.createElement('button');
		labelBtn.type = 'button';
		labelBtn.className = 'page-label';
		labelBtn.textContent = page.label;
		labelBtn.addEventListener('click', () => {
			state.selectedIndex = index;
			renderPageList();
			renderPreview();
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
		item.append(labelBtn, controls);
		pageList.appendChild(item);
	});
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
		renderPageList();
		renderPreview();
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
		renderPageList();
		renderPreview();
		setStatus(`Moved page ${fromIndex + 1} to position ${toIndex + 1}.`);
	} catch (error) {
		setStatus(error.message || 'Could not move page.', true);
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
renderPreview();
