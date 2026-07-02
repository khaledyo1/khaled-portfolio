# Vercel + Gemini Deployment Guide

This portfolio is ready for Vercel deployment. The Gemini key must stay on the server only.

## Required Vercel environment variables

Add these in Vercel Dashboard → Project → Settings → Environment Variables:

```txt
GEMINI_API_KEY=your_real_gemini_key
GEMINI_MODEL=gemini-2.5-flash
SITE_ORIGIN=https://your-final-domain.vercel.app
ALLOWED_ORIGINS=https://your-final-domain.vercel.app
```

`SITE_ORIGIN` and `ALLOWED_ORIGINS` are optional during the first preview deployment, but recommended before production.

## Deploy from Vercel dashboard

1. Upload or push this project to GitHub.
2. Import the repository into Vercel.
3. Keep framework preset as Other / Static if asked.
4. Add the environment variables above.
5. Deploy.
6. Open `/api/health` on your deployed domain.

Expected health response:

```json
{
  "ok": true,
  "service": "khaled-portfolio-api",
  "status": "ready"
}
```

## Deploy from CLI

```bash
npm i -g vercel
vercel login
vercel
vercel env add GEMINI_API_KEY production
vercel env add GEMINI_MODEL production
vercel env add SITE_ORIGIN production
vercel env add ALLOWED_ORIGINS production
vercel --prod
```

## Chatbot test after deployment

1. Open the site.
2. Open the AI assistant.
3. Send Arabic: `أحتاج موقعاً لشركة صغيرة`.
4. Send English: `I need a landing page for my business`.
5. Confirm the assistant replies in the same language.
6. Confirm the browser console has no CSP, CORS, or API errors.

## Security notes

- Never put the Gemini key in HTML, CSS, or frontend JavaScript.
- Never commit `.env` or `.env.local`.
- The frontend calls only `/api/chat`.
- The backend validates method, request size, origin, message length, and rate limits.
- `/api/health` does not expose key status, model names, or secrets in production.
