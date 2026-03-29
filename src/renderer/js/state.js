export const pdfState = {
	loaded: false,
	filePath: null,
	pages: [],
	selectedIndex: null,
	pdfBytesBase64: null,
};

export const imageConvertState = {
	inputPaths: [],
	outputDirectory: null,
};

export const imageResizeState = {
	inputPaths: [],
	outputDirectory: null,
	mode: 'resize',
	width: 800,
	height: 600,
	fit: 'cover',
	cropX: 0,
	cropY: 0,
	cropWidth: 100,
	cropHeight: 100,
};
