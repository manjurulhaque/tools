let selectedImages = [];

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("imageFiles");
const preview = document.getElementById("preview");
const fileInfo = document.getElementById("fileInfo");
const convertBtn = document.getElementById("convertBtn");
const spinner = document.getElementById("spinner");
const downloadDiv = document.getElementById("downloadDiv");

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
		thumb.innerHTML = `<img src="${e.target.result}" alt="${file.name}">
                       <button class="remove-btn">&times;</button>`;
		const removeBtn = thumb.querySelector(".remove-btn");
		removeBtn.addEventListener("click", () => {
			const index = selectedImages.indexOf(file);
			if (index !== -1) {
				selectedImages.splice(index, 1);
				preview.removeChild(thumb);
				updateFileInfo();
			}
		});
		preview.appendChild(thumb);
	};
	reader.readAsDataURL(file);
}

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

convertBtn.addEventListener("click", async () => {
	if (selectedImages.length === 0) {
		alert("Please select at least one image.");
		return;
	}

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
		pdfWidth =
			parseInt(document.getElementById("customWidthInput").value) || 595;
		pdfHeight =
			parseInt(document.getElementById("customHeightInput").value) || 842;
	} else {
		[pdfWidth, pdfHeight] = pageSizeValue.split(",").map(Number);
	}

	if (orientation === "landscape") {
		[pdfWidth, pdfHeight] = [pdfHeight, pdfWidth];
	}

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
		const file = selectedImages[i];
		let imageDataUrl = await convertImageToJpeg(
			file,
			compression,
			maxWidth,
			maxHeight
		);

		const x = margin + (cellIndex % columns) * (cellWidth + margin);
		const y = margin + Math.floor(cellIndex / columns) * (cellHeight + margin);

		pdf.addImage(imageDataUrl, "JPEG", x, y, cellWidth, cellHeight);

		cellIndex++;

		if (cellIndex === grid && i < selectedImages.length - 1) {
			pdf.addPage();
			cellIndex = 0;
		}
	}

	const pdfBlob = pdf.output("blob");
	const url = URL.createObjectURL(pdfBlob);
	const link = document.createElement("a");
	link.href = url;
	link.download = "converted_images.pdf";
	link.textContent = "Download PDF";
	link.className = "btn btn-success";
	downloadDiv.appendChild(link);

	spinner.style.display = "none";
	convertBtn.disabled = false;
});

async function convertImageToJpeg(
	file,
	quality = 0.8,
	maxWidth = null,
	maxHeight = null
) {
	if (file.type === "image/heic" || file.type === "image/heif") {
		file = await heic2any({ blob: file, toType: "image/jpeg" });
	}

	return new Promise((resolve) => {
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
				const ctx = canvas.getContext("2d");
				ctx.drawImage(img, 0, 0, newW, newH);
				resolve(canvas.toDataURL("image/jpeg", quality));
			};
			img.src = e.target.result;
		};
		reader.readAsDataURL(file);
	});
}
