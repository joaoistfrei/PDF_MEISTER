export function createUi(dom) {
	function showScreen(screenName) {
		dom.homeScreen.classList.toggle('hidden', screenName !== 'home');
		dom.pdfOptionsScreen.classList.toggle('hidden', screenName !== 'pdf-options');
		dom.pdfWorkspaceScreen.classList.toggle('hidden', screenName !== 'pdf-workspace');
		dom.imageOptionsScreen.classList.toggle('hidden', screenName !== 'image-options');
		dom.imageWorkspaceScreen.classList.toggle('hidden', screenName !== 'image-workspace');
		dom.imageResizeWorkspaceScreen.classList.toggle('hidden', screenName !== 'image-resize-workspace');
	}

	function setStatus(message, isError = false) {
		dom.status.textContent = message;
		dom.status.classList.toggle('error', isError);
	}

	function togglePdfLoadedUi(isLoaded) {
		dom.addBtn.disabled = !isLoaded;
		dom.saveBtn.disabled = !isLoaded;
		dom.clearBtn.disabled = !isLoaded;
		dom.emptyState.style.display = isLoaded ? 'none' : 'block';
	}

	return {
		showScreen,
		setStatus,
		togglePdfLoadedUi,
	};
}
