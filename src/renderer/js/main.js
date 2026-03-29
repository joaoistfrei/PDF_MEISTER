import { imageResizeWorkspaceTemplate } from '../templates/image-resize-workspace.js';
import { getDom } from './dom.js';
import { createUi } from './ui.js';
import { createPdfModule } from './pdf-module.js';
import { createImageConvertModule } from './image-convert-module.js';
import { createImageResizeModule } from './image-resize-module.js';

function injectTemplates() {
	const resizeRoot = document.getElementById('image-resize-workspace-root');
	if (resizeRoot) {
		resizeRoot.outerHTML = imageResizeWorkspaceTemplate;
	}
}

function initNavigation(dom, ui, modules) {
	dom.categoryPdfBtn.addEventListener('click', () => {
		ui.showScreen('pdf-options');
		ui.setStatus('Choose one PDF functionality.', false);
	});

	dom.categoryImageBtn.addEventListener('click', () => {
		ui.showScreen('image-options');
		ui.setStatus('Choose one image functionality.', false);
	});

	dom.pdfReorderBtn.addEventListener('click', () => {
		modules.pdf.openWorkspace();
	});

	dom.backHomeBtn.addEventListener('click', () => {
		ui.showScreen('home');
		ui.setStatus('Choose a category to begin.', false);
	});

	dom.backToolsBtn.addEventListener('click', () => {
		ui.showScreen('pdf-options');
		ui.setStatus('Choose one PDF functionality.', false);
	});

	dom.imageBackHomeBtn.addEventListener('click', () => {
		ui.showScreen('home');
		ui.setStatus('Choose a category to begin.', false);
	});

	dom.imageBackToolsBtn.addEventListener('click', () => {
		ui.showScreen('image-options');
		ui.setStatus('Choose one image functionality.', false);
	});

	dom.imageConvertBtn.addEventListener('click', modules.imageConvert.openWorkspace);
	dom.imageResizeBtn.addEventListener('click', modules.imageResize.openWorkspace);
	dom.resizeBackToolsBtn.addEventListener('click', () => {
		ui.showScreen('image-options');
		ui.setStatus('Choose one image functionality.', false);
	});
}

function bootstrap() {
	injectTemplates();
	const { dom, pdfjsLib } = getDom();
	const ui = createUi(dom);

	const modules = {
		pdf: createPdfModule(dom, ui, pdfjsLib),
		imageConvert: createImageConvertModule(dom, ui),
		imageResize: createImageResizeModule(dom, ui),
	};

	modules.pdf.init();
	modules.imageConvert.init();
	modules.imageResize.init();
	initNavigation(dom, ui, modules);

	ui.showScreen('home');
	ui.setStatus('Choose a category to begin.', false);
}

bootstrap();
