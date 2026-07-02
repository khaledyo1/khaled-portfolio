# Khaled ALimawi Portfolio

Production-ready personal portfolio with bilingual Arabic/English UI, dark/light theme, services, case-study projects, CV download, WhatsApp CTA, and a secure Gemini-powered chatbot through Vercel Functions.

## Run locally

Open `index.html` directly for static preview.

For chatbot/API testing, use Vercel local runtime:

```bash
npm i -g vercel
vercel dev
```

Create `.env.local` locally only when testing the chatbot:

```txt
GEMINI_API_KEY=your_real_gemini_key
GEMINI_MODEL=gemini-2.5-flash
```

## Deploy

Read `VERCEL-GEMINI-DEPLOYMENT.md` and `PRODUCTION-CHECKLIST.txt` before publishing.

## Important security rule

Do not commit `.env`, `.env.local`, or any real API key. The frontend never needs the Gemini key; it calls `/api/chat` only.
