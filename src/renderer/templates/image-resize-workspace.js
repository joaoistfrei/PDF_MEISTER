export const imageResizeWorkspaceTemplate = `
<section id="screen-image-resize-workspace" class="screen screen-workspace hidden">
	<header class="hero">
		<div class="hero-row">
			<div>
				<h1>Image Crop</h1>
				<p>Select images, adjust the crop box, and process in batch.</p>
			</div>
			<button id="btn-resize-back-tools" type="button" class="ghost">Back to Image Tools</button>
		</div>
	</header>

	<div class="resize-layout">
		<section class="resize-preview-pane">
			<h3>Preview</h3>
			<div class="canvas-container">
				<canvas id="resize-preview-canvas"></canvas>
				<div id="crop-overlay" class="crop-overlay hidden">
					<div class="crop-area">
						<div class="crop-handle crop-handle-nw"></div>
						<div class="crop-handle crop-handle-ne"></div>
						<div class="crop-handle crop-handle-sw"></div>
						<div class="crop-handle crop-handle-se"></div>
						<div class="crop-edge crop-edge-n"></div>
						<div class="crop-edge crop-edge-s"></div>
						<div class="crop-edge crop-edge-w"></div>
						<div class="crop-edge crop-edge-e"></div>
					</div>
				</div>
			</div>
			<p class="canvas-hint">Select an image to preview</p>
			<div id="preview-info" class="preview-info"></div>
		</section>

		<section class="panel image-panel resize-controls-pane">
			<div class="image-actions">
				<button id="btn-resize-select" type="button">Select Images</button>
				<button id="btn-resize-folder" type="button">Choose Output Folder</button>
				<button id="btn-resize-process" type="button" disabled>Process Images</button>
			</div>

			<div id="crop-fields">
				<div class="image-form-row">
					<label for="crop-x">X Position (px)</label>
					<input id="crop-x" type="number" min="0" value="0" />
				</div>

				<div class="image-form-row">
					<label for="crop-y">Y Position (px)</label>
					<input id="crop-y" type="number" min="0" value="0" />
				</div>

				<div class="image-form-row">
					<label for="crop-width">Width (px)</label>
					<input id="crop-width" type="number" min="1" value="100" />
				</div>

				<div class="image-form-row">
					<label for="crop-height">Height (px)</label>
					<input id="crop-height" type="number" min="1" value="100" />
				</div>
			</div>

			<div class="image-form-row">
				<label for="resize-format">Output format</label>
				<select id="resize-format">
					<option value="jpeg">JPEG</option>
					<option value="png">PNG</option>
					<option value="webp">WebP</option>
					<option value="avif">AVIF</option>
					<option value="tiff">TIFF</option>
				</select>
			</div>

			<div class="image-form-row">
				<label for="resize-quality">Quality: <span id="resize-quality-value">90</span></label>
				<input id="resize-quality" type="range" min="1" max="100" step="1" value="90" />
			</div>

			<p id="resize-output-path" class="image-output-path">No output folder selected.</p>
			<h3>Selected Files</h3>
			<div id="resize-empty-state" class="empty-state">No images selected yet.</div>
			<ul id="resize-file-list" class="image-file-list"></ul>
		</section>
	</div>
</section>
`;
