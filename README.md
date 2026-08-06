# SchSrch (Paper.sc)

![demo video](readme_video.gif)

SchSrch is a blazing-fast, robust search engine and document viewer for educational past papers, featuring full-text OCR indexing, multi-keyword fuzzy search, and an intuitive inline PDF viewer.

## Architecture

Paper.sc is built on a modern stack:
- **Frontend**: React + Redux + PDF.js, Server-Side Rendered (SSR) for instant first-paint.
- **Backend**: Node.js + Express.
- **Search Engine**: Elasticsearch, utilizing fuzzy string matching and multi-match metadata boosting.
- **Storage**: MongoDB for document metadata, Local Filesystem for raw PDF streaming.

For a deep dive into the system flows, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Installation

### Prerequisites
- Node.js (v14+)
- MongoDB (v4.0+)
- Elasticsearch (v7.0+)
- Build tools (for `node-gyp` to compile C++ PDF parsers)

### Setup
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Build frontend assets:
   ```bash
   npm run webpack
   ```

## Configuration & Deployment

Set the following environment variables:
- `MONGODB`: MongoDB connection URI (default: `mongodb://127.0.0.1/schsrch`)
- `ES`: Elasticsearch connection string (default: `127.0.0.1:9200`)
- `STORAGE_ROOT`: The absolute or relative path to the folder containing past paper PDFs.

Run the production server:
```bash
npm run start
```

## Indexing & Storage

The system utilizes a hybrid storage model: MongoDB stores metadata and structural layouts, while the local filesystem (`STORAGE_ROOT`) stores the actual PDF binaries. This separation drastically reduces database size and memory usage.

### Adding New Papers
To add new PDF past papers, move them into your configured `STORAGE_ROOT` and run the indexer. The indexer will recursively scan the folder, extract metadata from filenames, use C++ parsers to extract all text, build table-of-contents layouts, and index them seamlessly into Elasticsearch.

```bash
MONGODB=mongodb://127.0.0.1/schsrch ES=127.0.0.1:9200 STORAGE_ROOT=./papers_download node doIndex.bin.js papers_download/
```

## Troubleshooting & Verification

You can verify the integrity of the indexed data and ensure that MongoDB document references match the physical filesystem files by running the storage verification tool:

```bash
node verify-storage.js
```

If you are migrating from a legacy MongoDB schema (where PDFs were stored natively in GridFS blobs), you can use the standalone migration script:

```bash
node migrate-legacy-db.js
```
