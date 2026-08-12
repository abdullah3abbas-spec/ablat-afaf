#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  تشغيل منصّة أبلة عفاف بنقرة واحدة — انقري عليه مرّتين من مجلد المنصّة.
#  يعمل بلا إنترنت. لا تحتاجين كتابة أي أوامر.
# ─────────────────────────────────────────────────────────────

cd "$(dirname "$0")" || exit 1

# مواضع node المعتادة (كي يعمل عند النقر المزدوج)
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/*/bin:$PATH"

clear
echo "  جارٍ تشغيل منصّة أبلة عفاف…"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  ⚠️  لم أجد Node على الجهاز. اطلبي من ابنك تثبيته مرّة واحدة من: nodejs.org"
  echo ""
  read -r -p "  اضغطي Enter للإغلاق…" _
  exit 1
fi

# أول مرّة فقط: تجهيز نسخة العمل إن لم تكن جاهزة
if [ ! -f dist/index.html ]; then
  echo "  التجهيز لأول مرّة (دقيقة واحدة)…"
  if [ ! -d node_modules ]; then npm install >/dev/null 2>&1; fi
  npm run build >/dev/null 2>&1
fi

PORT=4785
# افتحي المتصفح بعد ثانية من تشغيل الخادم
( sleep 1; open "http://localhost:${PORT}" ) &

PORT=$PORT node scripts/serve.mjs
