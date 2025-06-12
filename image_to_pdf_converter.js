let selectedImages = [];
let cropper, activeEditFile;
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("imageFiles");
const preview = document.getElementById("preview");
const fileInfo = document.getElementById("fileInfo");
const convertBtn = document.getElementById("convertBtn");
const spinner = document.getElementById("spinner");
const downloadDiv = document.getElementById("downloadDiv");
const cropperModal = new bootstrap.Modal(
	document.getElementById("cropperModal")
);
const cropperImage = document.getElementById("cropperImage");

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => {
	e.preventDefault();
	dropZone.classList.add("bg-light");
});
dropZone.addEventListener("dragleave", () =>
	dropZone.classList.remove("bg-light")
);
dropZone.addEventListener("drop", (e) => {
	e.preventDefault();
	dropZone.classList.remove("bg-light");
	handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => handleFiles(fileInput.files));

function handleFiles(files) {
	for (const file of files) {
		if (!file.type.startsWith("image/")) continue;
		selectedImages.push(file);
		showThumbnail(file);
	}
	updateFileInfo();
}

function showThumbnail(file) {
	const reader = new FileReader();
	reader.onload = (e) => {
		const thumb = document.createElement("div");
		thumb.className = "thumb";
		thumb.innerHTML = `
				<img src="${e.target.result}" alt="${file.name}">
				<button class="remove-btn">&times;</button>
				<button class="edit-btn">✎</button>`;
		preview.appendChild(thumb);

		thumb.querySelector(".remove-btn").onclick = () => {
			const index = selectedImages.indexOf(file);
			if (index !== -1) {
				selectedImages.splice(index, 1);
				preview.removeChild(thumb);
				updateFileInfo();
			}
		};

		thumb.querySelector(".edit-btn").onclick = () => {
			activeEditFile = file;
			cropperImage.src = e.target.result;
			setTimeout(() => {
				cropper = new Cropper(cropperImage, { viewMode: 1, autoCropArea: 1 });
				cropperModal.show();
			}, 50);
		};
	};
	reader.readAsDataURL(file);
}

document.getElementById("rotateLeft").onclick = () =>
	cropper && cropper.rotate(-90);
document.getElementById("rotateRight").onclick = () =>
	cropper && cropper.rotate(90);
document.getElementById("cropApply").onclick = () => {
	if (!cropper || !activeEditFile) return;
	cropper.getCroppedCanvas().toBlob(
		(blob) => {
			const newFile = new File([blob], activeEditFile.name, {
				type: "image/jpeg",
			});
			const index = selectedImages.findIndex(
				(f) => f.name === activeEditFile.name
			);
			if (index !== -1) {
				selectedImages[index] = newFile;
				preview.innerHTML = "";
				const all = [...selectedImages];
				selectedImages = [];
				all.forEach(showThumbnail);
			}
			cropper.destroy();
			cropper = null;
			cropperModal.hide();
		},
		"image/jpeg",
		0.9
	);
};

function updateFileInfo() {
	fileInfo.textContent = selectedImages.length
		? `${selectedImages.length} image(s) selected`
		: "No files selected";
}

document.getElementById("pageSizeSelect").addEventListener("change", (e) => {
	const isCustom = e.target.value === "custom";
	document
		.getElementById("customSizeInputs")
		.classList.toggle("d-none", !isCustom);
});

new Sortable(preview, {
	animation: 150,
	onEnd: () => {
		const reordered = [];
		preview.querySelectorAll(".thumb img").forEach((img) => {
			const file = selectedImages.find((f) => f.name === img.alt);
			if (file) reordered.push(file);
		});
		selectedImages = reordered;
	},
});

convertBtn.addEventListener("click", async () => {
	if (selectedImages.length === 0)
		return alert("Please select at least one image.");

	convertBtn.disabled = true;
	spinner.style.display = "block";
	downloadDiv.innerHTML = "";

	const maxWidth = parseInt(document.getElementById("maxWidth").value) || null;
	const maxHeight =
		parseInt(document.getElementById("maxHeight").value) || null;
	const compression = parseFloat(
		document.getElementById("compressionSelect").value
	);
	const layout = document.getElementById("layoutSelect").value;
	const orientation = document.getElementById("orientationSelect").value;
	const pageSizeValue = document.getElementById("pageSizeSelect").value;

	let pdfWidth, pdfHeight;

	if (pageSizeValue === "custom") {
		const customWidth = parseInt(
			document.getElementById("customWidthInput").value
		);
		const customHeight = parseInt(
			document.getElementById("customHeightInput").value
		);

		if (
			isNaN(customWidth) ||
			isNaN(customHeight) ||
			customWidth <= 0 ||
			customHeight <= 0
		) {
			alert("Please enter valid custom page dimensions.");
			convertBtn.disabled = false;
			spinner.style.display = "none";
			return;
		}

		pdfWidth = customWidth;
		pdfHeight = customHeight;
	} else {
		[pdfWidth, pdfHeight] = pageSizeValue.split(",").map(Number);
	}

	if (orientation === "landscape")
		[pdfWidth, pdfHeight] = [pdfHeight, pdfWidth];

	const { jsPDF } = window.jspdf;
	const pdf = new jsPDF({ unit: "pt", format: [pdfWidth, pdfHeight] });

	const grid = layout === "grid-2" ? 2 : layout === "grid-4" ? 4 : 1;
	const columns = grid === 4 || grid === 2 ? 2 : 1;
	const rows = grid === 4 ? 2 : grid === 2 ? 1 : 1;
	const margin = 10;
	const cellWidth = (pdfWidth - margin * (columns + 1)) / columns;
	const cellHeight = (pdfHeight - margin * (rows + 1)) / rows;

	let cellIndex = 0;
	for (let i = 0; i < selectedImages.length; i++) {
		let file = selectedImages[i];
		if (file.type === "image/heic" || file.type === "image/heif") {
			file = await heic2any({ blob: file, toType: "image/jpeg" });
		}
		const dataUrl = await new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const img = new Image();
				img.onload = () => {
					let [newW, newH] = [img.width, img.height];
					if (maxWidth && newW > maxWidth) {
						newH = (maxWidth / newW) * newH;
						newW = maxWidth;
					}
					if (maxHeight && newH > maxHeight) {
						newW = (maxHeight / newH) * newW;
						newH = maxHeight;
					}
					const canvas = document.createElement("canvas");
					canvas.width = newW;
					canvas.height = newH;
					canvas.getContext("2d").drawImage(img, 0, 0, newW, newH);
					resolve(canvas.toDataURL("image/jpeg", compression));
				};
				img.src = e.target.result;
			};
			reader.readAsDataURL(file);
		});

		const x = margin + (cellIndex % columns) * (cellWidth + margin);
		const y = margin + Math.floor(cellIndex / columns) * (cellHeight + margin);
		pdf.addImage(dataUrl, "JPEG", x, y, cellWidth, cellHeight);
		cellIndex++;
		if (cellIndex === grid && i < selectedImages.length - 1) {
			pdf.addPage();
			cellIndex = 0;
		}
	}

	const blob = pdf.output("blob");
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = "converted_images.pdf";
	link.textContent = "Download PDF";
	link.className = "btn btn-success";
	downloadDiv.appendChild(link);

	spinner.style.display = "none";
	convertBtn.disabled = false;
});
