# Stage 02 — Admin Auth Sessions + CSRF Protection

هذه المرحلة تقوّي لوحة الإدارة بحيث لا يتم إرسال كلمة مرور الإدارة مع كل عملية حفظ أو فحص.

## ما الجديد؟

- إضافة تسجيل دخول آمن للوحة الإدارة.
- إنشاء جلسة إدارة موقّعة داخل `HttpOnly Cookie`.
- إضافة `CSRF Token` لكل عملية حساسة.
- حماية `/api/cms-save` و `/api/diagnostics` بجلسة إدارة + CSRF.
- إضافة تسجيل خروج يمسح Cookie الجلسة.
- إضافة Rate Limit على تسجيل الدخول.
- دعم اختياري لـ `ADMIN_PASSWORD_HASH` بدل تخزين كلمة المرور نصياً.
- دعم `ADMIN_SESSION_SECRET` لتوقيع جلسات الإدارة بسر مستقل.

## Endpoints الجديدة

```txt
POST /api/auth-login
GET  /api/auth-session
POST /api/auth-logout
```

## Endpoints أصبحت محمية بجلسة + CSRF

```txt
POST /api/cms-save
POST /api/diagnostics
```

## متغيرات Vercel المطلوبة

القيم الأساسية:

```env
ADMIN_PASSWORD=your_strong_admin_password
ADMIN_SESSION_SECRET=generate_a_random_secret
GITHUB_TOKEN=github_pat_...
GITHUB_OWNER=khaledyo1
GITHUB_REPO=khaled-portfolio
GITHUB_BRANCH=main
```

القيمة الاختيارية الأقوى بدلاً من `ADMIN_PASSWORD`:

```env
ADMIN_PASSWORD_HASH=scrypt$...
```

## توليد ADMIN_SESSION_SECRET

من CMD داخل مجلد المشروع:

```cmd
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

انسخ الناتج وضعه في Vercel كالتالي:

```env
ADMIN_SESSION_SECRET=الناتج_هنا
```

## توليد ADMIN_PASSWORD_HASH اختياري

من CMD داخل مجلد المشروع:

```cmd
node -e "const {makePasswordHash}=require('./lib/admin-auth'); console.log(makePasswordHash('YOUR_STRONG_PASSWORD'))"
```

ضع الناتج في Vercel:

```env
ADMIN_PASSWORD_HASH=scrypt$...
```

إذا وضعت `ADMIN_PASSWORD_HASH` سيتم اعتماده بدل `ADMIN_PASSWORD`.

## طريقة الاستخدام من لوحة الإدارة

1. افتح `/admin.html`.
2. اذهب إلى قسم **الحفظ والنشر**.
3. اكتب كلمة مرور الإدارة.
4. اضغط **تسجيل دخول آمن**.
5. بعد نجاح الجلسة، اضغط **فحص الإعدادات** أو **حفظ ونشر**.
6. عند الانتهاء اضغط **تسجيل خروج**.

## ملاحظات أمنية

- لا تضع `GITHUB_TOKEN` داخل الكود.
- لا ترفع `.env` إلى GitHub.
- بعد تعديل أي Environment Variable في Vercel، اعمل Redeploy جديد.
- كلمة المرور لا تُرسل مع الحفظ بعد هذه المرحلة؛ تُستخدم فقط لإنشاء جلسة مؤقتة.
