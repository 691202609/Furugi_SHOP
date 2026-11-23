# Furugi SHOP v4.1 — Production Go-Live

Full-stack e-commerce สำหรับร้านเสื้อผ้ามือสองสไตล์ญี่ปุ่น ใช้ Vercel Functions + Supabase Auth/PostgreSQL/Storage.

## ระบบหลัก
- Customer Register/Login ผ่านหน้าเว็บ ไม่ต้องยืนยัน Gmail
- Customer/Admin session แยก storage key และใช้ได้หลายแท็บ
- Profile + ที่อยู่จัดส่ง + เปลี่ยนรหัสผ่าน + Order history
- Product/Stock/Cart/Checkout/Order/Tracking
- COD / PromptPay / Bank transfer + Private payment slip storage
- Admin Products/Orders/Payments/Customers/Messages/Settings/Backup
- Atomic stock transaction, automatic reservation expiry/restock
- Signup/Order/Contact/Payment-proof rate limits
- RLS, role authorization, CSP/security headers, private transaction pages no-store/noindex
- Health endpoint: `/api/health`
- Static system tests + GitHub Actions CI

## เปิดใช้งาน
อ่าน `START_HERE.txt` และรัน `RUN_THIS_IN_SUPABASE.sql` สำหรับฐานข้อมูลเดิมก่อน Deploy.

## Environment Variables
ตั้งใน Vercel เท่านั้น ห้าม commit ค่าจริง:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `FURUGI_SETUP_TOKEN` (ชั่วคราวสำหรับ Admin คนแรก)

## ตรวจโค้ด
```bash
npm run verify
```

## หมายเหตุเรื่องอีเมล
ขั้นตอน Register/Login ไม่ส่งอีเมลยืนยัน แต่ Forgot Password ยังต้องใช้ระบบอีเมลของ Supabase. ร้าน Production ควรตั้ง Custom SMTP.
