const viewer = document.getElementById("cv-viewer");
const canvas = document.getElementById("cv-canvas");
const text = document.getElementById("cv-page-text");
const status = document.getElementById("cv-status");
const pageStatus = document.getElementById("cv-page-status");
const prev = document.getElementById("cv-prev");
const next = document.getElementById("cv-next");
const zoomOut = document.getElementById("cv-zoom-out");
const zoomIn = document.getElementById("cv-zoom-in");
const fit = document.getElementById("cv-fit");
let pdf;
let pageNumber = 1;
let zoom = 1;
let rendering = false;
let queued = false;
let failed = false;

function updateControls() {
  const unavailable = !pdf || rendering || failed;
  prev.disabled = unavailable || pageNumber === 1;
  next.disabled = unavailable || pageNumber === pdf?.numPages;
  zoomOut.disabled = unavailable || zoom <= 0.75;
  zoomIn.disabled = unavailable || zoom >= 2;
  fit.disabled = unavailable;
}

function showError() {
  failed = true;
  status.textContent = "The preview could not load. You can download the CV above or open the PDF below.";
  updateControls();
}

async function renderPage() {
  if (!pdf || failed) return;
  if (rendering) {
    queued = true;
    return;
  }
  rendering = true;
  updateControls();
  try {
    const page = await pdf.getPage(pageNumber);
    const natural = page.getViewport({ scale: 1 });
    const available = Math.max(160, viewer.clientWidth - 34);
    const viewport = page.getViewport({ scale: available / natural.width * zoom });
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(viewport.width * density);
    canvas.height = Math.floor(viewport.height * density);
    canvas.style.width = Math.floor(viewport.width) + "px";
    canvas.style.height = Math.floor(viewport.height) + "px";
    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport,
      transform: density === 1 ? null : [density, 0, 0, density, 0, 0]
    }).promise;
    const content = await page.getTextContent();
    text.textContent = content.items.map(item => item.str || "").join(" ");
    pageStatus.textContent = "Page " + pageNumber + " of " + pdf.numPages;
    viewer.setAttribute("aria-label", "CV, page " + pageNumber + " of " + pdf.numPages);
    status.textContent = "";
  } catch (error) {
    showError();
  } finally {
    rendering = false;
    updateControls();
    if (queued) {
      queued = false;
      renderPage();
    }
  }
}

function changePage(change) {
  if (!pdf || rendering) return;
  const target = pageNumber + change;
  if (target < 1 || target > pdf.numPages) return;
  pageNumber = target;
  viewer.scrollTop = 0;
  renderPage();
}

prev.addEventListener("click", () => changePage(-1));
next.addEventListener("click", () => changePage(1));
zoomOut.addEventListener("click", () => { zoom = Math.max(0.75, zoom - 0.25); renderPage(); });
zoomIn.addEventListener("click", () => { zoom = Math.min(2, zoom + 0.25); renderPage(); });
fit.addEventListener("click", () => { zoom = 1; renderPage(); });
let resizeTimer;
new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderPage(), 150);
}).observe(viewer);

try {
  const pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  pdf = await pdfjs.getDocument({
    url: new URL("./CV.pdf", import.meta.url).href,
    cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/standard_fonts/"
  }).promise;
  await renderPage();
} catch (error) {
  showError();
}
