import { pdfState } from './state.js';

export function createPdfModule(dom, ui, pdfjsLib) {
	let thumbnailDoc = null;
	let renderToken = 0;

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
		if (!pdfjsLib || !pdfState.pdfBytesBase64) {
			return;
		}
		try {
			const bytes = base64ToUint8Array(pdfState.pdfBytesBase64);
			const task = pdfjsLib.getDocument({ data: bytes });
			thumbnailDoc = await task.promise;
		} catch {
			thumbnailDoc = null;
			ui.setStatus('Loaded PDF, but thumbnails could not be generated.', true);
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
		dom.pageList.innerHTML = '';
		const thumbnailTasks = [];

		pdfState.pages.forEach((page, index) => {
			const item = document.createElement('li');
			item.className = 'page-item';
			if (pdfState.selectedIndex === index) {
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
				pdfState.selectedIndex = index;
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
			downBtn.disabled = index === pdfState.pages.length - 1;
			downBtn.addEventListener('click', async () => {
				await movePage(index, index + 1);
			});

			const removeBtn = document.createElement('button');
			removeBtn.type = 'button';
			removeBtn.textContent = 'Remove';
			removeBtn.disabled = pdfState.pages.length <= 1;
			removeBtn.className = 'danger';
			removeBtn.addEventListener('click', async () => {
				await removePage(index);
			});

			controls.append(upBtn, downBtn, removeBtn);
			item.append(position, thumbWrap, labelBtn, controls);
			dom.pageList.appendChild(item);

			thumbnailTasks.push(
				renderThumbnail(index, thumbCanvas, token).catch(() => {
					thumbWrap.classList.add('thumb-error');
				})
			);
		});

		await Promise.all(thumbnailTasks);
	}

	async function updateDoc(result) {
		pdfState.loaded = true;
		pdfState.filePath = result.filePath || pdfState.filePath;
		pdfState.pages = result.pages || [];
		pdfState.selectedIndex = pdfState.pages.length > 0 ? 0 : null;
		pdfState.pdfBytesBase64 = result.pdfBytes || null;

		await loadThumbnailDocument();
		await renderPageList();
		ui.togglePdfLoadedUi(true);

		const sourceName = pdfState.filePath ? pdfState.filePath.split(/[\\/]/).pop() : 'document';
		ui.setStatus(`Loaded ${sourceName} with ${pdfState.pages.length} page(s).`);
	}

	async function loadPdfByPath(filePath) {
		try {
			const result = await window.pdfApi.loadPdf(filePath);
			await updateDoc(result);
		} catch (error) {
			ui.setStatus(error.message || 'Could not load the PDF.', true);
		}
	}

	async function appendPdfByPath(filePath) {
		try {
			const result = await window.pdfApi.appendPdf(filePath);
			pdfState.selectedIndex = pdfState.pages.length;
			await updateDoc(result);
			ui.setStatus(`Added pages from ${filePath.split(/[\\/]/).pop()}.`);
		} catch (error) {
			ui.setStatus(error.message || 'Could not add pages.', true);
		}
	}

	async function removePage(index) {
		try {
			const result = await window.pdfApi.removePage(index);
			await updateDoc(result);
			if (pdfState.pages.length > 0) {
				pdfState.selectedIndex = Math.min(index, pdfState.pages.length - 1);
			}
			await renderPageList();
			ui.setStatus(`Removed page ${index + 1}.`);
		} catch (error) {
			ui.setStatus(error.message || 'Could not remove page.', true);
		}
	}

	async function movePage(fromIndex, toIndex) {
		try {
			const result = await window.pdfApi.movePage(fromIndex, toIndex);
			await updateDoc(result);
			pdfState.selectedIndex = toIndex;
			await renderPageList();
			ui.setStatus(`Moved page ${fromIndex + 1} to position ${toIndex + 1}.`);
		} catch (error) {
			ui.setStatus(error.message || 'Could not move page.', true);
		}
	}

	function resetUiToEmpty() {
		pdfState.loaded = false;
		pdfState.filePath = null;
		pdfState.pages = [];
		pdfState.selectedIndex = null;
		pdfState.pdfBytesBase64 = null;
		thumbnailDoc = null;
		dom.pageList.innerHTML = '';
		ui.togglePdfLoadedUi(false);
	}

	async function clearDocument() {
		try {
			await window.pdfApi.clearDoc();
			resetUiToEmpty();
			ui.setStatus('Cleared all pages from the working document.');
		} catch (error) {
			ui.setStatus(error.message || 'Could not clear pages.', true);
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
				ui.setStatus(`Saved new PDF: ${result.filePath}`);
			}
		} catch (error) {
			ui.setStatus(error.message || 'Could not save PDF.', true);
		}
	}

	async function handlePdfDrop(event) {
		const files = Array.from(event.dataTransfer.files || []);
		const pdfs = files.filter((file) => file.name.toLowerCase().endsWith('.pdf') && file.path);

		if (pdfs.length === 0) {
			ui.setStatus('Please drop one or more PDF files.', true);
			return;
		}

		await loadPdfByPath(pdfs[0].path);
		for (let i = 1; i < pdfs.length; i += 1) {
			await appendPdfByPath(pdfs[i].path);
		}

		if (pdfs.length > 1) {
			ui.setStatus(`Merged ${pdfs.length} PDFs into one working document.`);
		}
	}

	function bindEvents() {
		dom.openBtn.addEventListener('click', openAndLoadSinglePdf);
		dom.addBtn.addEventListener('click', openAndAppendPdf);
		dom.saveBtn.addEventListener('click', saveAs);
		dom.clearBtn.addEventListener('click', clearDocument);

		['dragenter', 'dragover'].forEach((eventName) => {
			dom.dropZone.addEventListener(eventName, (event) => {
				event.preventDefault();
				event.stopPropagation();
				dom.dropZone.classList.add('drag-over');
			});
		});

		['dragleave', 'drop'].forEach((eventName) => {
			dom.dropZone.addEventListener(eventName, (event) => {
				event.preventDefault();
				event.stopPropagation();
				dom.dropZone.classList.remove('drag-over');
			});
		});

		dom.dropZone.addEventListener('drop', handlePdfDrop);
	}

	function openWorkspace() {
		ui.showScreen('pdf-workspace');
		ui.setStatus('PDF Reorder mode selected. Open a PDF and arrange page order.', false);
	}

	function init() {
		ui.togglePdfLoadedUi(false);
		bindEvents();
	}

	return {
		init,
		openWorkspace,
	};
}
