# DataKeeper ☁️

![DataKeeper Hero](https://datakeeper-dev.vercel.app/og-image.png)

**DataKeeper** is a scalable, enterprise-grade cloud storage engine and file management system. Built with performance and massive scale in mind, it provides a seamless Google Drive-like experience for users to upload, organize, and securely share their data.

---

## 🚀 Key Features

*   📁 **Relational Virtual File System** — Supports infinitely nested folder hierarchies using advanced SQL CTEs (Common Table Expressions).
*   ⚡ **Direct-to-Cloud Uploads** — Bypasses server bottlenecks using **Presigned URLs**, allowing massive files to upload directly from the user's browser to the storage bucket via edge networks.
*   🔒 **Enterprise Security & Isolation** — Implements strict user isolation at the storage bucket level. Features robust authentication via **Google OAuth** and 24-hour self-destructing **Secret Codes** for temporary secure access.
*   🤖 **Automated Maintenance** — Built-in CRON jobs automatically sweep the database for expired links and execute multi-part chunk abortions on Cloudflare R2 to prevent storage leaks from interrupted network uploads.
*   📱 **Responsive Drill-down UI** — A highly polished, mobile-first interface featuring glassmorphism design, instant hover animations, and an intuitive breadcrumb-based drill-down navigation system.
*   👁️ **Inline Media Engine** — Real-time previews and playback for Videos, Audio, PDFs, and Images without needing to download them locally.

## 🛠️ Technical Architecture

This project was engineered to solve complex cloud storage challenges (handling large files, preventing server payload limits, minimizing egress costs) by leveraging a distributed serverless architecture:

*   **Frontend & API:** [Next.js 15](https://nextjs.org/) (App Router, Server Actions, React Server Components)
*   **Database:** [Neon Serverless Postgres](https://neon.tech/) (Handling complex node trees, user relationships, and metadata)
*   **Blob Storage:** [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) (S3-compatible, Zero-egress bandwidth costs, highly distributed CDN)
*   **Authentication:** [NextAuth.js](https://next-auth.js.org/) (OAuth 2.0)
*   **Deployment:** [Vercel](https://vercel.com/) (Serverless edge functions and CRON automation)

## 🧠 Engineering Highlights for Recruiters

*   **Bypassing Vercel Payload Limits:** Standard serverless functions crash when handling files over 4MB. DataKeeper solves this by generating secure cryptographic signatures (Presigned URLs) on the backend, allowing the frontend to establish a direct PUT request to Cloudflare R2's servers.
*   **Cost Optimization (Zero Egress):** By architecting the storage engine around Cloudflare R2 instead of AWS S3, the application achieves $0 bandwidth egress costs, allowing infinite scalability for downloads.
*   **Robust Orphan Cleanup:** Implemented custom Node.js background scripts utilizing the `@aws-sdk/client-s3` library to scan for incomplete multi-part uploads and orphaned blobs, guaranteeing perfect parity between the Postgres Database and the physical R2 storage.
*   **Recursive SQL Queries:** The file movement and folder deletion engine utilizes complex `WITH RECURSIVE` Common Table Expressions in PostgreSQL to rapidly resolve nested parent-child paths without overwhelming the database with N+1 queries.

## 💻 Running Locally

### 1. Clone the repository
```bash
git clone https://github.com/AdityaPandey-DEV/datakeeper.git
cd datakeeper
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file and provide your credentials for Neon Postgres, Cloudflare R2, and Google OAuth:
```env
# Database
POSTGRES_URL="postgresql://user:password@ep-your-db.region.aws.neon.tech/neondb?sslmode=require"

# Cloudflare R2
R2_ACCESS_KEY_ID="your_access_key"
R2_SECRET_ACCESS_KEY="your_secret_key"
R2_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
R2_BUCKET_NAME="datakeeper"
R2_PUBLIC_URL="https://pub-your-custom-domain.r2.dev"

# Authentication
NEXTAUTH_SECRET="your_random_secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
```

### 3. Start the Development Server
```bash
npm run dev
```

## 📜 License
MIT
