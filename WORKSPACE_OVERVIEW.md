# Workspace Overview: SchSrch (PPDB)

## Project Purpose
SchSrch (Paper.sc) is a highly optimized past paper search engine and document viewer tailored for educational past papers (e.g., Cambridge International Examinations). It features rapid indexing, robust text extraction from PDFs, structural table-of-contents generation, and a fast, searchable interface using Elasticsearch and MongoDB.

## Tech Stack
- **Languages**: JavaScript (ES6+), JSX, C++ (Node native addons), Sass, Pug.
- **Backend Framework**: Node.js with Express.js.
- **Databases**: MongoDB (via Mongoose) and Elasticsearch.
- **Storage Backend**: Local Filesystem (streaming raw PDFs).
- **Frontend Framework**: React and Redux, built with Webpack.
- **Testing**: Mocha, Should.js.
- **Native Addons**: `node-gyp` and `nan` for compiling C++ extensions (`sspdf.cc`) for high-performance PDF manipulation.

## Directory Structure
- `/src/` - Native C++ source code (`sspdf.cc`) for PDF processing.
- `/lib/` - Core backend logic, including database models (`dbModel.js`), search algorithms (`doSearch.js`), and PDF layout recognition (`recognizer.js`).
- `/view/` - Frontend source code (React components, Redux state `appstate.js`, styles).
- `/test/` - Automated test suite.
- `/storage/` - Storage abstraction utilities bridging the local filesystem `STORAGE_ROOT`.
- `index.js` / `server.js` - Application entry points and API definitions.
- `doIndex.bin.js` - The high-performance bulk indexing script.

## Getting Started
### Prerequisites
- Node.js (with build tools for `node-gyp`).
- MongoDB and Elasticsearch servers.

### Setup and Running
1. **Installation**:
   - `npm install` (this will also trigger `node-gyp rebuild` for the C++ addon).
   - Build frontend assets: `npm run webpack`.
2. **Running**:
   - Set environment variables (`MONGODB`, `ES`, `STORAGE_ROOT`) and run `npm run start`.

## Coding Conventions & Patterns
- **Frontend**: Utilizes modern React patterns with Redux for state management. Uses Babel to transpile JSX. Component rendering is heavily optimized to prevent unnecessary repaints.
- **Backend**: Express route handling relies on complex MongoDB `$or` and `$in` queries to eliminate N+1 bottlenecks.
- **Native Integration**: Performance-critical operations on PDFs are offloaded to C++ using `nan`.

## Testing & Building Guidelines
- Run tests using `npm test`. The test suite uses Mocha and expects `schsrch-test` MongoDB and Elasticsearch indices.
- Run `node verify-storage.js` to assert storage integrity.
- Always ensure frontend assets are compiled via Webpack.

## CI/CD Pipeline
- **Workflows**: Defined in `.github/workflows/build.yaml`.
- Spins up Elasticsearch and MongoDB, runs the test suite, and ensures no regressions.

## Indexing & Verification Architecture
- **Indexing Pipeline**: Managed by `doIndex.bin.js`. It recursively scans `STORAGE_ROOT`, extracts metadata via heuristics, builds pre-compiled page navigation layouts (`Recognizer.dir`), and indexes full OCR text into Elasticsearch.
- **Validation & Verification**: Supported by `verify-storage.js` to ensure the MongoDB `PastPaperDoc` schema matches physical filesystem artifacts.
