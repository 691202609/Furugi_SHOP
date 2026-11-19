# Furugi SHOP — Final Production Fixes

ชุดนี้แก้ประเด็นจาก Maximum System Test ครบตามรายการที่ตรวจพบ

## แก้แล้ว

- Customer Login ใช้ได้ข้ามหน้าและหลายแท็บผ่าน `localStorage`
- Customer/Admin Auth แยก storage key ไม่ชนกัน
- Order creation มี rate limit ต่อ Customer และ IP
- COD จำกัดออเดอร์ `pending` สูงสุด 2 รายการต่อ Customer
- COD ที่ค้างนานเกินเวลาที่ตั้งไว้จะยกเลิกและคืน Stock อัตโนมัติ
- PromptPay/Bank ที่หมดเวลา Reserve จะคืน Stock ก่อนแสดง Product list/detail
- Admin Customers: Total Spent นับเฉพาะยอดชำระจริง (`paid`) หรือ COD ที่ `completed`
- `/api/health` ตรวจ Tables, RPCs, Rate limits และ Storage buckets หลัก
- Supabase Browser SDK pin เป็น `2.118.0`
- Hero image เปลี่ยนเป็น WebP จากประมาณ 1.9 MB เหลือประมาณ 203 KB
- เพิ่ม Canonical/Open Graph metadata
- เพิ่ม `sitemap.xml` และ harden `robots.txt`
- เพิ่ม X-Robots-Tag noindex สำหรับหน้าธุรกรรม
- เพิ่ม `.vercelignore` กัน SQL/tests/docs/scripts ภายในถูก deploy เป็น static files
- เพิ่ม automated static/system tests
- เพิ่ม GitHub Actions CI

## สำคัญ: Supabase เดิมต้องรัน Migration

เปิดไฟล์:

`RUN_THIS_IN_SUPABASE.sql`

Copy ทั้งหมด แล้วไป:

Supabase → SQL Editor → New query → Paste → Run

จากนั้น `/api/health` ควรตอบ `ok: true`

## Deploy

```bash
git add .
git commit -m "production hardening and system fixes"
git pull --rebase origin main
git push origin main
```

## ทดสอบหลัง Deploy

1. เปิดเว็บ → Login
2. เปิด Shop/Profile ในหลายแท็บ → ไม่ควร Login ซ้ำ
3. Admin Login แยกจาก Customer
4. เปิด `/api/health` → `ok: true`
5. ทดสอบ Register → Login → Profile → Cart → Checkout → Track
6. ทดสอบ Admin → Order → Complete/Cancel

