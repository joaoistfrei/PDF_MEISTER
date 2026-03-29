import { imageResizeState } from './state.js';

export function createImageResizeModule(dom, ui) {
	let currentPreviewImage = null;
	let cropDragging = false;
	let cropDragStartX = 0;
	let cropDragStartY = 0;
	let cropDragType = null;
	let dragEventsBound = false;

	function updateResizeUi() {
		dom.resizeEmptyState.style.display = imageResizeState.inputPaths.length > 0 ? 'none' : 'block';
		dom.resizeProcessBtn.disabled = !imageResizeState.outputDirectory || imageResizeState.inputPaths.length === 0;
		dom.resizeOutputPath.textContent = imageResizeState.outputDirectory
			? `Output folder: ${imageResizeState.outputDirectory}`
			: 'No output folder selected.';
	}

	function renderResizeFileList() {
		dom.resizeFileList.innerHTML = '';
		imageResizeState.inputPaths.forEach((filePath) => {
			const item = document.createElement('li');
			item.className = 'image-file-item';
			item.textContent = filePath;
			dom.resizeFileList.appendChild(item);
		});
		updateResizeUi();
	}

	function updatePreviewInfo() {
		const info = [];
		if (currentPreviewImage) {
			info.push(`<div><span>Original</span><strong>${currentPreviewImage.width}x${currentPreviewImage.height}</strong></div>`);
		}
		if (imageResizeState.mode === 'resize') {
			info.push(`<div><span>Target</span><strong>${imageResizeState.width}x${imageResizeState.height}</strong></div>`);
			info.push(`<div><span>Fit</span><strong>${imageResizeState.fit}</strong></div>`);
		} else {
			info.push(`<div><span>Crop Area</span><strong>${imageResizeState.cropWidth}x${imageResizeState.cropHeight}</strong></div>`);
			info.push(`<div><span>Position</span><strong>X:${imageResizeState.cropX}, Y:${imageResizeState.cropY}</strong></div>`);
		}
		dom.previewInfo.innerHTML = info.join('');
	}

	function updateCropOverlay() {
		if (imageResizeState.mode !== 'crop' || !dom.cropArea || !dom.resizePreviewCanvas) {
			updatePreviewInfo();
			return;
		}

		const scaleX = parseFloat(dom.resizePreviewCanvas.dataset.scaleX || 1);
		const scaleY = parseFloat(dom.resizePreviewCanvas.dataset.scaleY || 1);
		const offsetX = parseFloat(dom.resizePreviewCanvas.dataset.offsetX || 0);
		const offsetY = parseFloat(dom.resizePreviewCanvas.dataset.offsetY || 0);

		const left = offsetX + imageResizeState.cropX * scaleX;
		const top = offsetY + imageResizeState.cropY * scaleY;
		const width = Math.max(1, imageResizeState.cropWidth * scaleX);
		const height = Math.max(1, imageResizeState.cropHeight * scaleY);

		dom.cropArea.style.left = `${left}px`;
		dom.cropArea.style.top = `${top}px`;
		dom.cropArea.style.width = `${width}px`;
		dom.cropArea.style.height = `${height}px`;

		updatePreviewInfo();
	}

	function drawCanvasPreview() {
		if (!currentPreviewImage || !dom.resizePreviewCanvas) {
			return;
		}

		const ctx = dom.resizePreviewCanvas.getContext('2d');
		const container = dom.resizePreviewCanvas.parentElement;
		const containerWidth = container.offsetWidth;
		const containerHeight = container.offsetHeight;

		dom.resizePreviewCanvas.width = containerWidth;
		dom.resizePreviewCanvas.height = containerHeight;

		const imgAspect = currentPreviewImage.width / currentPreviewImage.height;
		const containerAspect = containerWidth / containerHeight;
		let drawWidth;
		let drawHeight;
		let offsetX;
		let offsetY;

		if (imgAspect > containerAspect) {
			drawWidth = containerWidth;
			drawHeight = containerWidth / imgAspect;
			offsetX = 0;
			offsetY = (containerHeight - drawHeight) / 2;
		} else {
			drawHeight = containerHeight;
			drawWidth = containerHeight * imgAspect;
			offsetX = (containerWidth - drawWidth) / 2;
			offsetY = 0;
		}

		ctx.fillStyle = '#f5f5f5';
		ctx.fillRect(0, 0, containerWidth, containerHeight);
		ctx.drawImage(currentPreviewImage, offsetX, offsetY, drawWidth, drawHeight);

		dom.resizePreviewCanvas.dataset.scaleX = String(drawWidth / currentPreviewImage.width);
		dom.resizePreviewCanvas.dataset.scaleY = String(drawHeight / currentPreviewImage.height);
		dom.resizePreviewCanvas.dataset.offsetX = String(offsetX);
		dom.resizePreviewCanvas.dataset.offsetY = String(offsetY);

		updateCropOverlay();
	}

	function clampCropToImage() {
		const maxImageWidth = currentPreviewImage ? currentPreviewImage.width : 1000;
		const maxImageHeight = currentPreviewImage ? currentPreviewImage.height : 1000;

		imageResizeState.cropX = Math.max(0, imageResizeState.cropX);
		imageResizeState.cropY = Math.max(0, imageResizeState.cropY);
		imageResizeState.cropWidth = Math.max(1, imageResizeState.cropWidth);
		imageResizeState.cropHeight = Math.max(1, imageResizeState.cropHeight);

		if (imageResizeState.cropX + imageResizeState.cropWidth > maxImageWidth) {
			imageResizeState.cropWidth = Math.max(1, maxImageWidth - imageResizeState.cropX);
		}
		if (imageResizeState.cropY + imageResizeState.cropHeight > maxImageHeight) {
			imageResizeState.cropHeight = Math.max(1, maxImageHeight - imageResizeState.cropY);
		}
	}

	function syncCropInputsFromState() {
		dom.cropXInput.value = String(imageResizeState.cropX);
		dom.cropYInput.value = String(imageResizeState.cropY);
		dom.cropWidthInput.value = String(imageResizeState.cropWidth);
		dom.cropHeightInput.value = String(imageResizeState.cropHeight);
	}

	function bindCropDragEvents() {
		if (dragEventsBound || !dom.cropArea) {
			return;
		}
		dragEventsBound = true;

		const handles = dom.cropArea.querySelectorAll('.crop-handle, .crop-edge');
		handles.forEach((handle) => {
			handle.addEventListener('mousedown', (event) => {
				cropDragging = true;
				cropDragStartX = event.clientX;
				cropDragStartY = event.clientY;

				if (handle.classList.contains('crop-handle-nw')) cropDragType = 'nw';
				else if (handle.classList.contains('crop-handle-ne')) cropDragType = 'ne';
				else if (handle.classList.contains('crop-handle-sw')) cropDragType = 'sw';
				else if (handle.classList.contains('crop-handle-se')) cropDragType = 'se';
				else if (handle.classList.contains('crop-edge-n')) cropDragType = 'n';
				else if (handle.classList.contains('crop-edge-s')) cropDragType = 's';
				else if (handle.classList.contains('crop-edge-w')) cropDragType = 'w';
				else if (handle.classList.contains('crop-edge-e')) cropDragType = 'e';

				event.preventDefault();
			});
		});

		document.addEventListener('mousemove', (event) => {
			if (!cropDragging || !cropDragType || !dom.resizePreviewCanvas) {
				return;
			}

			const scaleX = parseFloat(dom.resizePreviewCanvas.dataset.scaleX || 1);
			const scaleY = parseFloat(dom.resizePreviewCanvas.dataset.scaleY || 1);
			const deltaX = Math.round((event.clientX - cropDragStartX) / scaleX);
			const deltaY = Math.round((event.clientY - cropDragStartY) / scaleY);

			if (cropDragType === 'nw') {
				imageResizeState.cropX += deltaX;
				imageResizeState.cropY += deltaY;
				imageResizeState.cropWidth -= deltaX;
				imageResizeState.cropHeight -= deltaY;
			} else if (cropDragType === 'ne') {
				imageResizeState.cropY += deltaY;
				imageResizeState.cropWidth += deltaX;
				imageResizeState.cropHeight -= deltaY;
			} else if (cropDragType === 'sw') {
				imageResizeState.cropX += deltaX;
				imageResizeState.cropWidth -= deltaX;
				imageResizeState.cropHeight += deltaY;
			} else if (cropDragType === 'se') {
				imageResizeState.cropWidth += deltaX;
				imageResizeState.cropHeight += deltaY;
			} else if (cropDragType === 'n') {
				imageResizeState.cropY += deltaY;
				imageResizeState.cropHeight -= deltaY;
			} else if (cropDragType === 's') {
				imageResizeState.cropHeight += deltaY;
			} else if (cropDragType === 'w') {
				imageResizeState.cropX += deltaX;
				imageResizeState.cropWidth -= deltaX;
			} else if (cropDragType === 'e') {
				imageResizeState.cropWidth += deltaX;
			}

			clampCropToImage();
			syncCropInputsFromState();
			cropDragStartX = event.clientX;
			cropDragStartY = event.clientY;
			updateCropOverlay();
		});

		document.addEventListener('mouseup', () => {
			cropDragging = false;
			cropDragType = null;
		});
	}

	function loadPreviewImage() {
		if (imageResizeState.inputPaths.length === 0) {
			currentPreviewImage = null;
			dom.previewInfo.innerHTML = '';
			return;
		}

		const image = new Image();
		image.onload = () => {
			currentPreviewImage = image;
			imageResizeState.cropX = 0;
			imageResizeState.cropY = 0;
			imageResizeState.cropWidth = Math.max(1, Math.floor(image.width * 0.5));
			imageResizeState.cropHeight = Math.max(1, Math.floor(image.height * 0.5));
			syncCropInputsFromState();
			drawCanvasPreview();
		};
		image.onerror = () => {
			currentPreviewImage = null;
			dom.previewInfo.innerHTML = '<p style="color:#999;">Could not load preview</p>';
		};
		image.src = `file:///${imageResizeState.inputPaths[0].replace(/\\/g, '/')}`;
	}

	async function selectImagesForResize() {
		try {
			const result = await window.pdfApi.openImageDialog();
			if (result.canceled || result.filePaths.length === 0) {
				return;
			}
			imageResizeState.inputPaths = result.filePaths;
			renderResizeFileList();
			loadPreviewImage();
			ui.setStatus(`Selected ${imageResizeState.inputPaths.length} image(s).`, false);
		} catch (error) {
			ui.setStatus(error.message || 'Could not select images.', true);
		}
	}

	async function selectOutputFolderForResize() {
		try {
			const result = await window.pdfApi.selectOutputFolder();
			if (result.canceled) {
				return;
			}
			imageResizeState.outputDirectory = result.folderPath;
			updateResizeUi();
			ui.setStatus('Output folder selected.', false);
		} catch (error) {
			ui.setStatus(error.message || 'Could not select output folder.', true);
		}
	}

	function toggleResizeMode() {
		imageResizeState.mode = dom.resizeModeSelect.value;
		const isResize = imageResizeState.mode === 'resize';
		dom.resizeFields.classList.toggle('hidden', !isResize);
		dom.cropFields.classList.toggle('hidden', isResize);
		dom.cropOverlay.classList.toggle('hidden', isResize);
		updateCropOverlay();
	}

	async function runImageResize() {
		try {
			const payload =
				imageResizeState.mode === 'resize'
					? {
							inputPaths: imageResizeState.inputPaths,
							outputDirectory: imageResizeState.outputDirectory,
							width: Number(dom.resizeWidthInput.value),
							height: Number(dom.resizeHeightInput.value),
							fit: dom.resizeFitSelect.value,
							outputFormat: dom.resizeFormatSelect.value,
							quality: Number(dom.resizeQualityRange.value),
						}
					: {
							inputPaths: imageResizeState.inputPaths,
							outputDirectory: imageResizeState.outputDirectory,
							x: Number(dom.cropXInput.value),
							y: Number(dom.cropYInput.value),
							width: Number(dom.cropWidthInput.value),
							height: Number(dom.cropHeightInput.value),
							outputFormat: dom.resizeFormatSelect.value,
							quality: Number(dom.resizeQualityRange.value),
						};

			const result =
				imageResizeState.mode === 'resize'
					? await window.pdfApi.resizeImages(payload)
					: await window.pdfApi.cropImages(payload);

			if (result.failed.length === 0) {
				const action = imageResizeState.mode === 'resize' ? 'Resized' : 'Cropped';
				ui.setStatus(`${action} ${result.processed.length} image(s) to ${result.outputFormat.toUpperCase()}.`, false);
				return;
			}

			const action = imageResizeState.mode === 'resize' ? 'Resized' : 'Cropped';
			ui.setStatus(
				`${action} ${result.processed.length} image(s). ${result.failed.length} failed. Check input files and try again.`,
				true
			);
		} catch (error) {
			ui.setStatus(error.message || 'Could not process images.', true);
		}
	}

	function openWorkspace() {
		ui.showScreen('image-resize-workspace');
		ui.setStatus('Resize/Crop mode selected. Select images and set parameters.', false);
		toggleResizeMode();
		if (currentPreviewImage) {
			drawCanvasPreview();
		}
	}

	function bindEvents() {
		dom.resizeSelectBtn.addEventListener('click', selectImagesForResize);
		dom.resizeFolderBtn.addEventListener('click', selectOutputFolderForResize);
		dom.resizeProcessBtn.addEventListener('click', runImageResize);
		dom.resizeModeSelect.addEventListener('change', toggleResizeMode);
		dom.resizeQualityRange.addEventListener('input', () => {
			dom.resizeQualityValue.textContent = dom.resizeQualityRange.value;
		});

		dom.cropXInput.addEventListener('input', () => {
			imageResizeState.cropX = Math.max(0, Number(dom.cropXInput.value));
			clampCropToImage();
			updateCropOverlay();
		});
		dom.cropYInput.addEventListener('input', () => {
			imageResizeState.cropY = Math.max(0, Number(dom.cropYInput.value));
			clampCropToImage();
			updateCropOverlay();
		});
		dom.cropWidthInput.addEventListener('input', () => {
			imageResizeState.cropWidth = Math.max(1, Number(dom.cropWidthInput.value));
			clampCropToImage();
			updateCropOverlay();
		});
		dom.cropHeightInput.addEventListener('input', () => {
			imageResizeState.cropHeight = Math.max(1, Number(dom.cropHeightInput.value));
			clampCropToImage();
			updateCropOverlay();
		});

		dom.resizeWidthInput.addEventListener('input', () => {
			imageResizeState.width = Math.max(1, Number(dom.resizeWidthInput.value));
			updatePreviewInfo();
		});
		dom.resizeHeightInput.addEventListener('input', () => {
			imageResizeState.height = Math.max(1, Number(dom.resizeHeightInput.value));
			updatePreviewInfo();
		});
		dom.resizeFitSelect.addEventListener('change', () => {
			imageResizeState.fit = dom.resizeFitSelect.value;
			updatePreviewInfo();
		});

		window.addEventListener('resize', () => {
			if (currentPreviewImage && !dom.imageResizeWorkspaceScreen.classList.contains('hidden')) {
				drawCanvasPreview();
			}
		});

		bindCropDragEvents();
	}

	function init() {
		renderResizeFileList();
		toggleResizeMode();
		bindEvents();
	}

	return {
		init,
		openWorkspace,
	};
}
