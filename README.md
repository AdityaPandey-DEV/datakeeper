# DataKeeper

A sleek, **macOS Finder-inspired** personal file manager web app. Upload, organize, and access your files from any device, anywhere.

Built with **Next.js 15** + **Vercel Blob Storage**.

## Features

- 📁 **Folder Management** — Create, delete, and navigate nested folders
- ⬆️ **File Upload** — Drag & drop or click to upload, with progress indicators
- 📦 **Move & Rename** — Move files/folders between locations, inline rename
- 🗑️ **Delete** — Delete files and folders with confirmation dialogs
- 👁️ **File Preview** — Inline preview for images, videos, audio, and PDFs
- 🌙 **Dark Mode** — System-aware theme toggle
- 📱 **Responsive** — Works on phone, tablet, and desktop
- 🎨 **Finder-style UI** — Clean, minimal design inspired by macOS Finder

## Tech Stack

- [Next.js 15](https://nextjs.org) — App Router, React Server Components
- [Vercel Blob](https://vercel.com/docs/vercel-blob) — File storage (1GB free)
- Vanilla CSS — Custom macOS-inspired design system
- TypeScript — Full type safety

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/adityapandeydev/datakeeper.git
cd datakeeper
npm install
```

### 2. Set up Vercel Blob Storage

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Create a new project or select your existing one
3. Go to **Storage** → **Create** → **Blob**
4. Copy the `BLOB_READ_WRITE_TOKEN` from the `.env.local` tab

### 3. Configure environment

Create a `.env.local` file:

```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_YOUR_TOKEN_HERE
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/adityapandeydev/datakeeper)

The `BLOB_READ_WRITE_TOKEN` will be auto-populated when you add a Blob Store to your Vercel project.

## Free Tier Limits (Hobby Plan)

| Resource | Included |
|----------|----------|
| Storage | 1 GB/month |
| Simple Operations | 10,000 |
| Advanced Operations | 2,000 |
| Data Transfer | 10 GB |
| Max File Size | 5 TB |

## License

MIT
