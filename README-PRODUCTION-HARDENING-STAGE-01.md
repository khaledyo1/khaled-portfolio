# Production Hardening — Stage 01

هذه النسخة تضيف أول طبقة حقيقية لتقوية الموقع والـ APIs قبل أي تحسينات شكلية.

## ما الذي أُضيف؟

### 1. Content Schema Validation
تمت إضافة ملف:

```text
lib/cms-schema.js
```

وظيفته فحص وتنظيف بيانات لوحة الإدارة قبل حفظها داخل GitHub:

- منع روابط `javascript:` والروابط غير الصالحة.
- منع مسارات صور خطيرة مثل `../` أو روابط خارجية غير مرغوبة.
- إجبار وجود اسم وصورة/محتوى أساسي ومشروع واحد على الأقل.
- منع تكرار IDs للمشاريع والسوشيال.
- تقليم النصوص الطويلة وتنظيف محارف التحكم.

### 2. Hardened CMS Save API
تم تقوية:

```text
api/cms-save.js
```

التحسينات:

- CORS مضبوط عبر `ALLOWED_ORIGINS` أو نفس دومين Vercel.
- Rate limiting مبدئي لكل IP.
- Body size limit.
- Upload limits للصور.
- رسائل أخطاء آمنة لا تكشف أسرار التوكن أو تفاصيل GitHub الحساسة.
- Validation errors واضحة عند فساد البيانات.

### 3. Diagnostics API
تمت إضافة:

```text
api/diagnostics.js
```

الاستخدام:

```http
POST /api/diagnostics
Content-Type: application/json

{
  "password": "ADMIN_PASSWORD"
}
```

يعطي فحصاً آمناً لـ:

- وجود `ADMIN_PASSWORD`.
- وجود `GITHUB_TOKEN`.
- صحة وصول التوكن إلى GitHub.
- قدرة التوكن على قراءة ملف المحتوى.
- وجود `GEMINI_API_KEY`.

لا يعرض أي قيمة سرية.

### 4. Improved Health API
تم تحسين:

```text
api/health.js
```

يعرض مؤشرات Boolean فقط:

```json
{
  "ok": true,
  "configured": {
    "gemini": true,
    "cmsAdmin": true,
    "githubCms": true
  }
}
```

## متغيرات Vercel المطلوبة

```env
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash

ADMIN_PASSWORD=strong_admin_password
GITHUB_TOKEN=github_pat_xxx
GITHUB_OWNER=khaledyo1
GITHUB_REPO=khaled-portfolio
GITHUB_BRANCH=main
ALLOWED_ORIGINS=https://khaled-portfolio-ochre.vercel.app
```

## اختبار محلي سريع

```cmd
npm install
npm run check
```

## اختبار بعد النشر

افتح:

```text
https://your-domain.vercel.app/api/health
```

ثم من DevTools أو Postman افحص:

```text
POST https://your-domain.vercel.app/api/diagnostics
```

مع body:

```json
{"password":"كلمة_مرور_الإدارة"}
```

## ملاحظات مهمة

- هذا الـ Rate Limit داخل الذاكرة مبدئي. عند traffic عالي جداً، الأفضل إضافة Upstash Redis/Vercel KV أو WAF rate limiting.
- لا تضع `GITHUB_TOKEN` أو `ADMIN_PASSWORD` داخل الكود.
- بعد تعديل Environment Variables في Vercel، اعمل Redeploy.
