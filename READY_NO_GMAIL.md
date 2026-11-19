# Furugi SHOP — Ready to Open / Signup without Gmail verification

เวอร์ชันนี้สมัครสมาชิกจากหน้าเว็บไซต์ได้ทันที โดย **ไม่ส่งอีเมลยืนยัน** และไม่ต้องกดลิงก์จาก Gmail

## วิธีทำครั้งเดียวก่อนเปิดร้าน

### 1) Supabase Database
เปิด Supabase > SQL Editor > New query แล้วนำไฟล์นี้ไปรันทั้งหมด:

`supabase/READY_TO_OPEN.sql`

ไฟล์นี้จะสร้าง/ซ่อม `profiles`, ตารางสินค้า/ออเดอร์, Storage bucket, Trigger และตัวจำกัดการสมัครซ้ำ

### 2) Vercel Environment Variables
ตั้งค่า Production ให้ครบ:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `FURUGI_SETUP_TOKEN` (ใช้ตอนสร้าง Admin ครั้งแรก)

ห้ามนำ `SUPABASE_SECRET_KEY` ไปใส่ใน HTML/JavaScript ฝั่ง Browser และห้าม Commit `.env.local`

### 3) Deploy
Push โปรเจกต์เข้า GitHub แล้วให้ Vercel Deploy ใหม่

```bash
git add .
git commit -m "ready no-email customer signup"
git pull --rebase origin main
git push origin main
```

## Customer flow

`REGISTER -> Backend creates confirmed customer -> automatic LOGIN -> HOME`

- ไม่เรียก `supabase.auth.signUp()` จาก Browser
- ไม่ส่ง Confirmation Email
- ไม่ต้องเปิด Gmail
- Backend บังคับ role เป็น `customer` เท่านั้น
- Backend สร้าง/อัปเดต `profiles` ให้เอง
- Login ใช้ email + password บนหน้าเว็บ
- เปิดโดเมนหลักใหม่จะเริ่มที่หน้า Login

## หมายเหตุเรื่อง Forgot Password

การสมัครและ Login **ไม่ใช้ Gmail** แต่เมนู `ลืมรหัสผ่าน` ยังใช้ระบบ Recovery Email ของ Supabase ตามปกติ หากต้องการใช้ Forgot Password จริงใน Production ควรตั้ง Custom SMTP เพื่อป้องกันข้อจำกัดของ Supabase built-in email service
