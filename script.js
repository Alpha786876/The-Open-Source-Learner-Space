/*
AUTO-DISCOVERY SETUP

1) Replace REPO_OWNER and REPO_NAME below with your public GitHub username and repository name.
2) Keep PDFs inside the repository's /books folder.
   The catalogue checks GitHub's public repository API and lists every PDF it finds.
   */
   const REPO_OWNER = "Alpha786876";
   const REPO_NAME = "The-Open-Source-Learner-Space";
   const BOOKS_FOLDER = "books";
   const API_BASE = 'https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${BOOKS_FOLDER}';

const grid = document.getElementById("book-grid");
const statusEl = document.getElementById("status");
const countEl = document.getElementById("book-count");
document.getElementById("year").textContent = new Date().getFullYear();

const dialog = document.getElementById("reader-dialog");
const readerTitle = document.getElementById("reader-title");
const readerStatus = document.getElementById("reader-status");
const canvas = document.getElementById("pdf-canvas");
const ctx = canvas.getContext("2d");
const pageIndicator = document.getElementById("page-indicator");
const prevButton = document.getElementById("prev-page");
const nextButton = document.getElementById("next-page");
const openPdfLink = document.getElementById("open-pdf");

let currentPdf = null;
let currentPage = 1;
let renderTask = null;
let renderToken = 0;
let booksCache = [];

if (window.pdfjsLib) {
pdfjsLib.GlobalWorkerOptions.workerSrc =
"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

function prettyTitle(filename) {
return filename.replace(/.pdf$/i, "")
.replace(/[_-]+/g, " ")
.replace(/\s+/g, " ")
.trim()
.replace(/\b\w/g, char => char.toUpperCase());
}

function isConfigured() {
return REPO_OWNER !== "YOUR_GITHUB_USERNAME" &&
REPO_NAME !== "YOUR_REPOSITORY_NAME";
}

function createBookCard(book) {
const card = document.createElement("article");
card.className = "book-card";

const cover = document.createElement("div");
cover.className = "cover-wrap";
cover.setAttribute("aria-label", "Cover of ${book.title}");

const fallback = document.createElement("div");
fallback.className = "cover-fallback";
const label = document.createElement("span");
label.className = "fallback-label";
label.textContent = "THE OPEN LEARNING LIBRARY";
const title = document.createElement("strong");
title.textContent = book.title;
const author = document.createElement("span");
author.className = "fallback-author";
author.textContent = "Milan C. Soni";
fallback.append(label, title, author);
cover.appendChild(fallback);

const info = document.createElement("div");
info.className = "book-info";
const heading = document.createElement("h3");
heading.textContent = book.title;
const meta = document.createElement("p");
meta.className = "book-meta";
meta.textContent = "PDF book · Online reading";
const button = document.createElement("button");
button.type = "button";
button.className = "read-button";
button.innerHTML = '<span>Read book</span><span aria-hidden="true">↗</span>';
button.addEventListener("click", () => openReader(book));
info.append(heading, meta, button);
card.append(cover, info);

// Render page 1 of each PDF as its cover when PDF.js is available.
if (window.pdfjsLib) {
pdfjsLib.getDocument({ url: book.url }).promise.then(pdf => {
return pdf.getPage(1).then(page => {
const viewport = page.getViewport({ scale: 0.55 });
const coverCanvas = document.createElement("canvas");
coverCanvas.className = "cover-canvas";
coverCanvas.width = viewport.width;
coverCanvas.height = viewport.height;
const coverContext = coverCanvas.getContext("2d");
return page.render({ canvasContext: coverContext, viewport }).promise.then(() => {
cover.replaceChildren(coverCanvas);
pdf.destroy();
});
});
}).catch(() => {
// The typographic fallback remains visible if the PDF preview cannot load.
});
}
return card;
}

function showEmpty(message) {
const empty = document.createElement("div");
empty.className = "empty-state";
empty.textContent = message;
grid.replaceChildren(empty);
}

async function loadBooks() {
if (!isConfigured()) {
statusEl.textContent = "One-time setup needed: add your GitHub username and repository name in script.js. See README.md for the 2-minute setup.";
countEl.textContent = "Setup required";
showEmpty("Your library is ready. Connect it to your public GitHub repository to load the PDFs from the books/ folder.");
return;
}

try {
statusEl.textContent = "Finding books in the library…";
const response = await fetch(API_BASE, {
headers: { "Accept": "application/vnd.github+json" },
cache: "no-store"
});
if (!response.ok) {
if (response.status === 404) throw new Error("The repository or books/ folder could not be found. Check the GitHub settings in script.js and make sure the repository is public.");
if (response.status === 403) throw new Error("GitHub temporarily limited catalogue requests. Please refresh in a little while.");
throw new Error("GitHub returned an error (${response.status}). Please try again later.");
}
const files = await response.json();
booksCache = files
.filter(file => file.type === "file" && /.pdf$/i.test(file.name))
.map(file => ({ title: prettyTitle(file.name), filename: file.name, url: file.download_url }))
.sort((a, b) => a.title.localeCompare(b.title));

grid.replaceChildren();
if (!booksCache.length) {
  showEmpty("No PDF books found yet. Add a PDF file to the repository's books/ folder and it will appear here.");
} else {
  booksCache.forEach(book => grid.appendChild(createBookCard(book)));
}
countEl.textContent = `${booksCache.length} ${booksCache.length === 1 ? "book" : "books"}`;
statusEl.textContent = "";

} catch (error) {
countEl.textContent = "Library unavailable";
statusEl.textContent = error.message || "Could not load the library. Please try again.";
showEmpty("Your books have not been removed. Check the repository settings or try refreshing this page.");
}
}

async function openReader(book) {
readerTitle.textContent = book.title;
readerStatus.textContent = "Opening book…";
openPdfLink.href = book.url;
currentPage = 1;
currentPdf = null;
if (typeof dialog.showModal === "function") dialog.showModal();
else { window.open(book.url, "_blank", "noopener"); return; }

if (!window.pdfjsLib) {
readerStatus.textContent = "The built-in reader could not load. Use “Open PDF separately” to read this book.";
return;
}
try {
const pdf = await pdfjsLib.getDocument({ url: book.url }).promise;
currentPdf = pdf;
await renderPage(1);
} catch (error) {
readerStatus.textContent = "The PDF could not be opened in the built-in reader. Try opening it separately.";
}
}

async function renderPage(pageNumber) {
if (!currentPdf) return;
const token = ++renderToken;
if (renderTask) {
try { renderTask.cancel(); } catch (_) {}
renderTask = null;
}
currentPage = Math.max(1, Math.min(pageNumber, currentPdf.numPages));
readerStatus.textContent = "Rendering page…";
try {
const page = await currentPdf.getPage(currentPage);
const stageWidth = Math.max(280, document.querySelector(".pdf-stage").clientWidth - 30);
const baseViewport = page.getViewport({ scale: 1 });
const scale = Math.min(1.65, stageWidth / baseViewport.width);
const viewport = page.getViewport({ scale });
const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = Math.floor(viewport.width * pixelRatio);
canvas.height = Math.floor(viewport.height * pixelRatio);
canvas.style.width = "${Math.floor(viewport.width)}px";
canvas.style.height = "${Math.floor(viewport.height)}px";
const renderContext = {
canvasContext: ctx,
viewport,
transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : null
};
renderTask = page.render(renderContext);
await renderTask.promise;
if (token !== renderToken) return;
readerStatus.textContent = "";
pageIndicator.textContent = "Page ${currentPage} of ${currentPdf.numPages}";
prevButton.disabled = currentPage <= 1;
nextButton.disabled = currentPage >= currentPdf.numPages;
} catch (error) {
if (error && error.name !== "RenderingCancelledException") {
readerStatus.textContent = "This page could not be rendered. Use “Open PDF separately” instead.";
}
}
}

prevButton.addEventListener("click", () => renderPage(currentPage - 1));
nextButton.addEventListener("click", () => renderPage(currentPage + 1));
document.getElementById("close-reader").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
if (event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
renderToken++;
if (renderTask) {
try { renderTask.cancel(); } catch (_) {}
}
if (currentPdf) currentPdf.destroy();
currentPdf = null;
renderTask = null;
});

loadBooks();
