# NameCard - Name Card & Customer Management

A modern, fast, and secure business card management web application for internal company use. 
Powered by React, Vite, and Cloudflare Pages/D1/R2, with Gemini AI for automated card OCR.

## Features Currently Implemented (Frontend)

- **Premium UI / UX**: A highly aesthetic, responsive design system.
- **Dashboard View**: View and filter synchronized customer lists.
- **Card Scanner UI**: Integration with **Google Gemini 1.5 Flash Model** to automatically extract business card text (Name, Role, Company, Email, Phone, etc.) from an uploaded image.
- **Customer Detail**: A detailed view to organize notes, memos, and assign "Business Segments".

## Quick Start (Local Development)

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Add Environment Variables**
   Create a `.env.local` file in the root directory and add your Gemini API key:
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

3. **Run the Development Server**
   ```bash
   npm run dev
   ```

## Cloudflare Setup (Phase 2 & 3 - Coming Next)

When you are ready to implement the backend database, we will use Cloudflare's full-stack framework `Wrangler`:
- Cloudflare Pages Functions (`/functions/api/`)
- Cloudflare D1 (SQL Database - `d1_databases` in `wrangler.toml`)
- Cloudflare R2 (Image Blob Storage)
- Cloudflare Zero Trust (Internal Access Security)
