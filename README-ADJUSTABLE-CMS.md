# Adjustable Portfolio CMS

This version adds a lightweight admin panel at:

```text
/admin.html
```

You can edit:

- Homepage profile image and hero text
- Email and WhatsApp number
- Social media links
- Projects: add, delete, edit, change image, category, tags, links

## How it works

Public content is stored in:

```text
public/content/site-content.json
```

The website reads this file using:

```text
public/js/cms.js
```

The admin panel can save permanently through:

```text
api/cms-save.js
```

That API commits the new JSON and uploaded images to your GitHub repository using a GitHub token stored securely in Vercel Environment Variables.

## Required Vercel Environment Variables for permanent saving

```env
ADMIN_PASSWORD=your-strong-admin-password
GITHUB_TOKEN=github_pat_with_contents_write_permission
GITHUB_OWNER=khaledyo1
GITHUB_REPO=khaled-portfolio
GITHUB_BRANCH=main
```

Also keep your chatbot variables:

```env
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
```

## GitHub token permissions

Create a Fine-grained Personal Access Token for the specific repository only.
Give it:

```text
Contents: Read and write
Metadata: Read
```

Do not put this token in front-end JavaScript. Put it only in Vercel Environment Variables.

## Vercel settings

```text
Framework Preset: Other
Root Directory: ./
Build Command: echo "No build required"
Output Directory: public
Install Command: npm install
```

## Local preview mode

The admin panel also supports local preview using localStorage. This does not publish to visitors; it only shows changes in your own browser.

Use it for testing before pressing Save & Publish.
