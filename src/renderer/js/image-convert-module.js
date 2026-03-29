import { imageConvertState } from './state.js';

export function createImageConvertModule(dom, ui) {
	function updateImageUi() {
		dom.imageEmptyState.style.display = imageConvertState.inputPaths.length > 0 ? 'none' : 'block';
		dom.imageConvertRunBtn.disabled = !imageConvertState.outputDirectory || imageConvertState.inputPaths.length === 0;
		dom.imageOutputPath.textContent = imageConvertState.outputDirectory
			? `Output folder: ${imageConvertState.outputDirectory}`
			: 'No output folder selected.';
	}

	function renderImageFileList() {
		dom.imageFileList.innerHTML = '';
		imageConvertState.inputPaths.forEach((filePath) => {
			const item = document.createElement('li');
			item.className = 'image-file-item';
			item.textContent = filePath;
			dom.imageFileList.appendChild(item);
		});
		updateImageUi();
	}

	async function selectImagesForConversion() {
		try {
			const selection = await window.pdfApi.openImageDialog();
			if (selection.canceled) {
				return;
			}
			imageConvertState.inputPaths = selection.filePaths;
			renderImageFileList();
			ui.setStatus(`Selected ${imageConvertState.inputPaths.length} image(s).`, false);
		} catch (error) {
			ui.setStatus(error.message || 'Could not select images.', true);
		}
	}

	async function selectOutputFolder() {
		try {
			const result = await window.pdfApi.selectOutputFolder();
			if (result.canceled) {
				return;
			}
			imageConvertState.outputDirectory = result.folderPath;
			updateImageUi();
			ui.setStatus('Output folder selected.', false);
		} catch (error) {
			ui.setStatus(error.message || 'Could not select output folder.', true);
		}
	}

	async function runImageConversion() {
		try {
			const result = await window.pdfApi.convertImages({
				inputPaths: imageConvertState.inputPaths,
				outputDirectory: imageConvertState.outputDirectory,
				outputFormat: dom.imageFormatSelect.value,
				quality: Number(dom.imageQualityRange.value),
			});

			if (result.failed.length === 0) {
				ui.setStatus(`Converted ${result.converted.length} image(s) to ${result.outputFormat.toUpperCase()}.`, false);
				return;
			}

			ui.setStatus(
				`Converted ${result.converted.length} image(s). ${result.failed.length} failed. Check input files and try again.`,
				true
			);
		} catch (error) {
			ui.setStatus(error.message || 'Could not convert images.', true);
		}
	}

	function openWorkspace() {
		ui.showScreen('image-workspace');
		ui.setStatus('Image Convert mode selected. Choose images and output format.', false);
	}

	function bindEvents() {
		dom.imageSelectBtn.addEventListener('click', selectImagesForConversion);
		dom.imageFolderBtn.addEventListener('click', selectOutputFolder);
		dom.imageConvertRunBtn.addEventListener('click', runImageConversion);
		dom.imageQualityRange.addEventListener('input', () => {
			dom.imageQualityValue.textContent = dom.imageQualityRange.value;
		});
	}

	function init() {
		renderImageFileList();
		bindEvents();
	}

	return {
		init,
		openWorkspace,
	};
}
