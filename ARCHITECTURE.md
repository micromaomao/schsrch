# System Architecture

Paper.sc (PPDB) is a robust past paper search engine and PDF viewer, powered by a modern Node.js backend. This document outlines the component architecture, data flows, and subsystem interactions.

## Component Overview

1. **Frontend (React)**: Handles PDF inline viewing, split-pane UX, and reactive search queries.
2. **Backend (Express)**: Manages routing, query translation, and metadata retrieval.
3. **Storage (Filesystem)**: Stores PDFs statically, served via Express statically or streamed based on route.
4. **Search Engine (Elasticsearch)**: Provides blazing-fast fuzzy full-text search across thousands of indexed OCR pages.
5. **Metadata DB (MongoDB)**: Stores logical document collections, related paper lookups, and parsed TOC layouts (`dir`).

## Data Flows

### 1. Indexing Flow (`doIndex.bin.js`)
When a new batch of PDFs is processed, the system:
1. Traverses the `STORAGE_ROOT`.
2. Extracts logical metadata (Subject, Year, Paper, Variant, Type) via path heuristics (`extractMetadataFromPath`).
3. Uses `pdfjs-dist` to fully parse the raw text (`textContent`) and element coordinates of every page.
4. Passes the raw page elements to the `Recognizer`, which builds a structural layout (Questions -> Pages) for the frontend viewer to navigate.
5. Upserts the document metadata and pre-compiled layout directly into MongoDB (`PastPaperDoc`).
6. Ships the exact full-text OCR data for every page into Elasticsearch (`PastPaperIndex`), keyed by `docId`.

### 2. Search Request Flow (`doSearch.js`)
1. User submits a text query via the Express API.
2. If the query strictly matches a document signature (e.g. `0417 s18 qp 12`), it skips Elasticsearch and loads the document immediately from MongoDB.
3. If it is a natural text query (e.g. `concentration`), the request hits Elasticsearch using a specialized fuzzy boolean query.
4. ES leverages `fuzziness: 'AUTO:4,7'`, `match_phrase`, and metadata boosting to return the top `docId` matches.
5. The backend collapses the ES hits, extracts unique `docId` signatures, and performs a single bulk `$in` query to MongoDB.
6. The MongoDB lookup resolves related documents (e.g. identifying the matching Mark Scheme for a returned Question Paper) before yielding the JSON payload to the user.

### 3. Viewer Request Flow
1. The frontend hits `/doc/:id/?as=blob` or `/papers/`.
2. To bypass aggressive download managers (like IDM), the raw document is streamed directly over the `/doc/` route instead of HTTP 302 redirecting to a `.pdf` extension.
3. The React application instantiates a heavily customized `PDFJSViewer` (`TransformationStage`), rendering the text layer and allowing seamless zooming and panning.

## Subsystem Interactions

- **MongoDB <-> Elasticsearch**: MongoDB holds the canonical reference. Elasticsearch only holds the text index. Every ES hit intrinsically resolves to a MongoDB `PastPaperDoc` instance via `docId`.
- **Backend <-> Frontend**: The backend server-side renders (SSR) the initial state of the React application (`serverrender.js`), packing the `AppState` into the raw HTML to eliminate round-trip waterfalls for initial queries.
