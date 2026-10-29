# Furugi SHOP LIVE v4.0 — Supabase + Vercel

เวอร์ชัน Cloud สำหรับเปิดร้านจริง 24/7 โดย **ไม่มี SQLite และไม่เก็บรูปในเครื่อง Server**

## สถาปัตยกรรม

- **Vercel** — หน้าเว็บ Static + Node.js Serverless API (`/api/*`)
- **Supabase Auth** — Login / Register / Email confirmation / Password reset
- **Supabase PostgreSQL** — Products, Stock, Customers, Orders, Settings, Messages
- **Supabase Storage** — รูปสินค้า (Public) + สลิป (Private / Signed URL)
- **Atomic Order RPC** — ตรวจราคา + Lock stock + ตัด stock + สร้าง Order ใน Transaction เดียว ป้องกันขายเกิน Stock

## ระบบที่มีใน v4.0

- Home / Shop / Product / Mix & Match / Cart / Checkout
- Customer Register / Login / Logout / My Account
- Email confirmation รองรับผ่าน Supabase Auth
- Forgot password / Reset password
- Guest Checkout หรือ Checkout ด้วยบัญชีสมาชิก
- Profile / ที่อยู่จัดส่ง / ประวัติออเดอร์
- Product stock 0–9,999 และ SOLD OUT อัตโนมัติ
- ตะกร้าหลายจำนวน + ตรวจ stock ฝั่ง Server
- COD / PromptPay / Bank Transfer
- Upload payment slip ไป **Private Storage**
- Admin ดูสลิปผ่าน Signed URL อายุสั้น
- Order status / Payment status / Tracking number
- ยกเลิก Order แล้วคืน stock แบบ Transaction
- Admin Dashboard / Products / Orders / Customers / Payments / Messages / Settings / Backup
- Admin Upload รูปสูงสุด 8 รูปต่อสินค้าไป Supabase Storage
- Product image public CDN URL
- One-time First Admin Setup (`setup.html`)
- RLS เปิดบนตารางหลัก และ Browser ไม่ได้รับ Supabase Secret Key
- Security headers / CSP สำหรับ Vercel

---

# ติดตั้งจริงตั้งแต่ 0

## 1) สร้าง Supabase Project

สร้าง Project ใหม่ใน Supabase แล้วเก็บค่า 3 ตัวนี้จาก Project Connect / API settings:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
SUPABASE_SECRET_KEY=sb_secret_xxxxx
```

> `SUPABASE_SECRET_KEY` ห้ามใส่ใน HTML, JavaScript ฝั่ง Browser หรือ GitHub เด็ดขาด

## 2) สร้างฐานข้อมูล

เปิด Supabase → **SQL Editor → New query**

เปิดไฟล์:

```text
supabase/migrations/001_furugi_v4.sql
```

Copy ทั้งไฟล์ไปวาง แล้วกด **Run**

Migration จะสร้าง:

- `profiles`
- `store_settings`
- `products`
- `orders`
- `order_items`
- `contact_messages`
- RPC `create_store_order`
- RPC `cancel_store_order`
- RPC `expire_unpaid_orders`
- Storage bucket `product-images` (Public)
- Storage bucket `payment-slips` (Private)
- RLS policies

## 3) ตั้ง Supabase Auth

Supabase → Authentication

เปิด Email/Password provider และสำหรับร้านจริงแนะนำให้เปิด **Confirm Email**

หลัง Deploy Vercel แล้ว ตั้ง URL Configuration:

```text
Site URL:
https://YOUR-SITE.vercel.app

Redirect URLs:
https://YOUR-SITE.vercel.app/**
```

ถ้ามี Domain จริง เช่น `https://furugishop.com` ให้เพิ่ม Domain จริงด้วย

### สำคัญสำหรับร้านจริง: SMTP

ระบบ Register confirmation และ Forgot password ต้องส่ง Email จริง ดังนั้น Production ควรตั้ง **Custom SMTP** ใน Supabase Authentication settings เช่น Resend / AWS SES / Postmark / SendGrid / Brevo

อย่าใช้ Default SMTP เป็นระบบส่ง Email หลักของร้านจริง

## 4) Push โปรเจกต์ขึ้น GitHub

ไม่ต้อง Push `.env` หรือ `.env.local`

`.gitignore` เตรียมไว้แล้ว

## 5) Import GitHub เข้า Vercel

Vercel → Add New → Project → Import Repository

Framework เลือก **Other** / Auto detect

ไม่ต้องตั้ง Output Directory

## 6) ตั้ง Environment Variables ใน Vercel

Vercel Project → Settings → Environment Variables

เพิ่ม:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
SUPABASE_SECRET_KEY=sb_secret_xxxxx
FURUGI_SETUP_TOKEN=ใส่ข้อความสุ่มยาวอย่างน้อย32ตัว
PUBLIC_URL=https://YOUR-SITE.vercel.app
```

ใส่ให้ Production (และ Preview ถ้าต้องการทดสอบ)

จากนั้น **Redeploy**

## 7) สร้าง Admin คนแรก

เปิด:

```text
https://YOUR-SITE.vercel.app/setup.html
```

กรอก:

- Setup Token = ค่า `FURUGI_SETUP_TOKEN`
- ชื่อ Admin
- Admin Email
- Password อย่างน้อย 12 ตัว มีตัวอักษร + ตัวเลข + อักขระพิเศษ

เมื่อสร้างสำเร็จ ระบบจะปิด First Admin Setup อัตโนมัติ เพราะมี Admin อยู่แล้ว

จากนั้น **ลบ `FURUGI_SETUP_TOKEN` ออกจาก Vercel Environment Variables แล้ว Redeploy**

เข้า Admin:

```text
https://YOUR-SITE.vercel.app/admin-login.html
```

## 8) ตั้งร้านจาก Admin

Admin → Store Settings

กรอกข้อมูลจริง:

- เบอร์โทร / Email / LINE / Instagram
- ที่อยู่ร้าน
- ค่าส่ง
- ยอดส่งฟรี
- PromptPay จริง
- บัญชีธนาคารจริง
- Shipping / Return / Privacy / Terms

เปิดเฉพาะ Payment Method ที่พร้อมใช้งานจริง

## 9) เพิ่มสินค้าจริง

Admin → Add Product

- ชื่อ
- SKU ห้ามซ้ำ
- ราคา
- Stock
- Size
- Condition
- ขนาดวัดจริง
- ตำหนิ
- รูปสูงสุด 8 รูป

รูปจะไปที่ Supabase Storage ไม่ได้อยู่ใน Vercel filesystem

## 10) ทดสอบก่อนประกาศ URL

ทดสอบจาก Browser/มือถืออีกเครื่อง:

1. สมัครสมาชิกด้วย Email จริง
2. กดยืนยัน Email
3. Login
4. เพิ่มสินค้าใน Cart
5. Checkout
6. ตรวจว่า Stock ลด
7. Admin เห็น Order
8. ทดลอง PromptPay/Bank ด้วย Order ทดสอบ (ถ้าเปิด)
9. Upload slip
10. Admin เปิดสลิปได้
11. Mark Paid
12. Packing → Shipped + Tracking
13. Customer เห็นสถานะใน My Account / Track Order
14. ทดลอง Cancel Order แล้วตรวจ Stock คืน
15. Forgot password และ Reset password

---

# Local Development

สร้าง `.env.local` จาก `.env.example` แล้วใส่ Supabase Project ของคุณ

```bash
npm install
npm run dev
```

Vercel CLI จะแสดง Local URL (โดยทั่วไป `http://localhost:3000`)

ใน Supabase Auth Redirect URLs ให้เพิ่ม Local URL ถ้าต้องการทดสอบ Email confirm/reset

---

# ความปลอดภัยที่สำคัญ

- Publishable Key ถูกส่งให้ Browser ได้ตามการออกแบบของ Supabase
- Secret Key ใช้เฉพาะ Vercel Function เท่านั้น
- RLS เปิดบนตารางหลัก
- Browser ไม่สามารถเพิ่ม/แก้สินค้า หรือ Order status โดยตรง
- Stock ไม่เชื่อค่าราคาหรือจำนวนจาก Browser — Database ตรวจและตัด Stock ใน Transaction
- Payment slips อยู่ Private Bucket
- Admin slip URL เป็น Signed URL ชั่วคราว
- Password เป็นหน้าที่ของ Supabase Auth; Furugi SHOP ไม่เก็บ Password plaintext
- Admin role ตรวจจาก `profiles.role = admin` ฝั่ง Server
- `setup.html` สร้าง Admin ได้เฉพาะเมื่อยังไม่มี Admin เท่านั้น

---

# หมายเหตุเรื่อง Payment

v4.0 รองรับ **COD / PromptPay manual / Bank transfer manual + upload slip** พร้อมขายจริงตาม workflow นี้

ถ้าต้องการ **ยืนยัน PromptPay อัตโนมัติ / ตัดบัตร / Payment Gateway** ต้องเชื่อม Merchant Account ของผู้ให้บริการชำระเงินจริงและ Webhook ของผู้ให้บริการ ซึ่งต้องใช้บัญชี Merchant/API Key ของเจ้าของร้าน

---

# ไฟล์สำคัญ

```text
api/index.js                         Vercel Serverless API
app.js                               หน้าร้าน + Supabase customer auth
admin.js                             หลังบ้าน + Supabase admin auth
setup.html / setup.js                สร้าง Admin คนแรก
supabase/migrations/001_furugi_v4.sql  Database + RLS + Storage + RPC
vercel.json                          Routing + Security headers
.env.example                         ตัวอย่าง Environment Variables
GO_LIVE_CHECKLIST.md                 เช็กลิสต์ก่อนเปิดร้าน
```
