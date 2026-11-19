# Furugi SHOP — Production Ready

ชุดนี้ใช้การสมัครผ่าน Backend ของ Furugi SHOP (`/api/customer/register`) โดย Backend ใช้ Supabase Admin API สร้างบัญชีแบบ confirmed ทันที จึงไม่ส่งอีเมลยืนยันตอนสมัคร และหน้าเว็บจะ Login ให้อัตโนมัติหลังสมัครสำเร็จ

## ต้องทำก่อนเปิดเว็บจริง

1. Supabase > SQL Editor: รัน `supabase/READY_TO_OPEN.sql` ทั้งไฟล์
2. Vercel Environment Variables: ตั้ง `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `FURUGI_SETUP_TOKEN`
3. Deploy แล้วเปิด `/api/health` ต้องได้ `ok: true`
4. เปิด `/setup.html` สร้าง Admin คนแรก แล้วลบ `FURUGI_SETUP_TOKEN` ออกจาก Vercel และ Redeploy
5. Supabase > Authentication > Sign In / Providers > Email: เปิด Email provider ไว้
6. แนะนำสำหรับ Production: ปิด `Allow new users to sign up` ใน Supabase เพื่อกันการสมัครตรงผ่าน public Auth endpoint; เว็บ Furugi SHOP สมัครผ่าน Server Admin API อยู่แล้ว
7. `Confirm email` ไม่จำเป็นต่อ flow สมัครของเว็บชุดนี้ เพราะ Backend สร้าง user ด้วย `email_confirm: true`
8. ทดสอบจริงด้วยบัญชี Customer ใหม่: Register > เข้า Home > Logout > Login > Cart > Checkout > Order > Track Order

## Session

Customer session ใช้ `sessionStorage`: อยู่ต่อระหว่างใช้งานในแท็บเดิม แต่เมื่อปิดแท็บ/เปิด session ใหม่จะต้อง Login ใหม่ เหมาะกับ requirement ที่ไม่ต้องการให้เปิดเว็บแล้วทะลุ Login จาก session เก่า

## Forgot Password

การสมัครและ Login ไม่ใช้ Gmail verification แต่เมนู Forgot Password ยังเป็น Supabase Recovery Email หากจะเปิดใช้จริงจำนวนมากควรตั้ง Custom SMTP

## ห้ามทำ

- ห้ามใส่ `SUPABASE_SECRET_KEY` ใน `app.js`, HTML หรือ GitHub
- ห้าม commit `.env.local`
- ห้ามเปิด Storage bucket `payment-slips` เป็น public
