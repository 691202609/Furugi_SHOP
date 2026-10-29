# Furugi SHOP v4.0 — GO LIVE CHECKLIST

ก่อนประกาศเว็บให้ลูกค้า ใช้รายการนี้ตรวจทีละข้อ

- [ ] Supabase migration `001_furugi_v4.sql` Run สำเร็จ
- [ ] Vercel มี `SUPABASE_URL`
- [ ] Vercel มี `SUPABASE_PUBLISHABLE_KEY`
- [ ] Vercel มี `SUPABASE_SECRET_KEY` และไม่ได้อยู่ใน GitHub/Frontend
- [ ] First Admin สร้างสำเร็จ
- [ ] ลบ `FURUGI_SETUP_TOKEN` จาก Vercel หลัง Setup และ Redeploy
- [ ] Supabase Auth Site URL เป็น Production URL
- [ ] Redirect URLs มี Production Domain
- [ ] เปิด Email Confirmation ตามนโยบายร้าน
- [ ] ตั้ง Custom SMTP สำหรับ Production
- [ ] ทดสอบ Register / Confirm Email / Login / Logout
- [ ] ทดสอบ Forgot password / Reset password
- [ ] กรอกข้อมูลร้านจริงใน Admin Settings
- [ ] กรอก PromptPay/Bank จริงก่อนเปิดวิธีชำระนั้น
- [ ] Shipping / Return / Privacy / Terms เป็นข้อมูลร้านจริง
- [ ] เพิ่มสินค้าจริงอย่างน้อย 1 รายการ
- [ ] ทดสอบ Upload รูป Product
- [ ] ทดสอบ Cart หลายจำนวน
- [ ] ทดสอบ Checkout
- [ ] ทดสอบ Stock ลดหลัง Order
- [ ] ทดสอบไม่สามารถสั่งเกิน Stock
- [ ] ทดสอบ Cancel แล้ว Stock คืน
- [ ] ทดสอบ Upload slip
- [ ] Admin เปิด Private slip ผ่าน Signed URL ได้
- [ ] ทดสอบ Payment status
- [ ] ทดสอบ Order status + Tracking
- [ ] Customer เห็น Order History ใน My Account
- [ ] Track Order ด้วยเลข Order + เบอร์โทรทำงาน
- [ ] ตรวจเว็บบนมือถือจริง
- [ ] ตั้ง Custom Domain (ถ้าต้องการ)
- [ ] เปิด HTTPS (Vercel ทำให้เมื่อ Domain ถูกต้อง)
- [ ] ดาวน์โหลด Admin Backup หลังตั้งร้านเสร็จ
