# Khaled Portfolio — Final Vercel + Web3Forms Version

This package is the final static-deploy version of the portfolio.

## What changed

- The contact form no longer uses Render, SMTP, Nodemailer, Gmail App Passwords, or `.env`.
- The contact form sends messages through Web3Forms from the frontend using AJAX.
- The visitor stays on the website after pressing the submit button.
- The required CSP rules were updated to allow `https://api.web3forms.com`.

## Required step before deployment

Open:

```txt
public/js/main.js
```

Find:

```js
web3FormsAccessKey: "PUT_YOUR_WEB3FORMS_ACCESS_KEY_HERE"
```

Replace `PUT_YOUR_WEB3FORMS_ACCESS_KEY_HERE` with your real Web3Forms Access Key.

Create the key from:

```txt
https://web3forms.com
```

Use this recipient email when creating the key:

```txt
khaled.yous3f19@gmail.com
```

## Vercel deployment settings

Use these settings in Vercel:

```txt
Framework Preset: Other
Root Directory: ./
Install Command: echo "skip install"
Build Command: echo "static deploy"
Output Directory: public
Environment Variables: none
```

## Files that should NOT be uploaded as secrets

This final version does not need `.env` for the contact form. Do not upload local `.env` files.

## After deployment

Open:

```txt
https://your-project.vercel.app/contact.html
```

Send a test message. Check Inbox/Spam/Promotions if the first email does not appear immediately.
