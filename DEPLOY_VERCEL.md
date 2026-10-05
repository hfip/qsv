# رفع المشروع إلى GitHub وVercel

## 1. GitHub

1. فك ضغط الملف.
2. أنشئ مستودعًا جديدًا باسم `qeseh-stremio-addon` من https://github.com/new .
3. افتح المستودع واختر **Add file → Upload files**.
4. ارفع **محتويات** مجلد `qeseh-addon` بحيث تظهر `package.json` و`vercel.json` ومجلدا `api` و`lib` في جذر المستودع، ثم اختر **Commit changes**.
5. ارفع كذلك `package-lock.json` وملفات `test` و`data` إن أردت تشغيل اختبارات GitHub. لا ترفع `node_modules` أو `.env`.

عند استخدام Git من جهازك بدل رفع الملفات عبر المتصفح:

```bash
git init
git add .
git commit -m "Prepare Qeseh Stremio addon for Vercel"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/qeseh-stremio-addon.git
git push -u origin main
```

استبدل `YOUR-USERNAME` باسم حسابك. لا تُرفع ملفات zip نفسها إلى المستودع.

## 2. Vercel

1. افتح https://vercel.com/new واربط حساب GitHub.
2. اختر مستودع `qeseh-stremio-addon` ثم **Import**.
3. **Framework Preset:** اختر **Other**.
4. **Root Directory:** اتركه جذر المستودع `./`.
5. **Build Command:** فعّل Override واتركه فارغًا؛ لا توجد واجهة تحتاج build.
6. **Output Directory:** اتركه دون Override.
7. **Install Command:** `npm ci`.
8. **Node.js Version:** `22.x` (محدد كذلك في package.json).
9. المتغيرات اختيارية: `QESEH_BASE=https://wwv.qeseh.com`. لا تحتاج TMDB أو مفاتيح API، ولا تحتاج `PORT` على Vercel.
10. اضغط **Deploy**.

`vercel.json` يوجّه مسارات manifest/catalog/meta/stream إلى `api/index.js`، ويضبط مدة الدالة إلى 300 ثانية. تأكد من تشغيل Fluid Compute في إعدادات المشروع إن احتجت الحد المحدد. الخطط أو إعدادات الحساب قد تفرض حدودًا مختلفة؛ لا تنقص المدة إذا ظهرت مهلات أثناء جلب كل صفحات المصدر.

## 3. تركيب الإضافة

بعد ظهور عنوان النشر مثل `https://qeseh-stremio-addon.vercel.app`:

- افتح `https://qeseh-stremio-addon.vercel.app/health`؛ يجب أن يظهر `{"ok":true}`.
- افتح `https://qeseh-stremio-addon.vercel.app/manifest.json`؛ يجب أن تظهر معلومات الإضافة والأقسام الأربعة.
- في Stremio → الإضافات، الصق رابط **manifest.json** ثم اختر Install.
- جرّب `https://qeseh-stremio-addon.vercel.app/catalog/series/series.json` للتحقق من جلب البوسترات فعليًا؛ نجاح health وحده لا يختبر اتصال قصة عشق.

إذا طلب الرابط تسجيل الدخول إلى Vercel، اجعل نشر Production متاحًا للعامة من إعدادات **Deployment Protection**؛ Stremio يحتاج رابطًا عامًا.

الرفع إلى فرع `main` بعد ذلك يحدث نسخة الإنتاج تلقائيًا عبر ربط GitHub مع Vercel. ملف GitHub Actions المرفق يفحص الكود والاختبارات فقط؛ النشر يتم عبر ربط Vercel ولا يحتاج VERCEL_TOKEN. فشل فحص GitHub لا يمنع النشر تلقائيًا ما لم تضبط Deployment Checks في Vercel.

## حالة التشغيل

هذه النسخة مجهزة للنشر واختُبرت محليًا؛ لم تُنشر في حساب GitHub أو Vercel بالنيابة عنك. قد يحجب الموقع أو مضيف الفيديو عناوين خوادم Vercel أو منطقة النشر. إعداد الاستضافة لا يزيل حجب express/ok المسجل في تقرير النسخة السابقة. روابط الفيديو تُستخرج وقت الطلب؛ لا تُخزن في CDN. كاش البيانات داخل ذاكرة الدالة مؤقت، وقد تعيد الدالة جمع القوائم عند بدء نسخة جديدة.
