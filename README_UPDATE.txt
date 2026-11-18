Furugi SHOP - Login First Complete Update

ไฟล์ที่ต้องแทนในโปรเจกต์เดิม:
1) app.js
2) api/index.js
3) vercel.json
4) package.json

สิ่งที่เพิ่ม/แก้:
- เปิดโดเมน / จะไป Member Login ก่อน
- หน้า Login/Register/Forgot/Reset ยังเข้าได้โดยไม่ต้องมี session
- ทุกหน้าร้านจะส่งกลับ Login ถ้ายังไม่มี Supabase customer session
- หลัง Login สำเร็จจะกลับไปหน้าที่ตั้งใจเข้า หรือ index.html
- Logout กลับ Member Login
- Products / Settings / Contact / Orders / Track / Payment Proof ถูกบังคับ Authorization ที่ API
- Order lookup และ payment proof จำกัดเฉพาะออเดอร์ของ customer account ที่ Login อยู่
- Admin API/Setup ไม่ได้รับผลกระทบ
- Node engine ล็อกเป็น 26.x เพื่อลด Vercel major-upgrade warning

Vercel Environment Variables ที่ต้องมี:
SUPABASE_URL                Config
SUPABASE_PUBLISHABLE_KEY    Config
SUPABASE_SECRET_KEY         Secret
FURUGI_SETUP_TOKEN          Secret (ใช้เฉพาะตอนสร้าง Admin คนแรก)

หลังแทนไฟล์:
git add app.js api/index.js vercel.json package.json
git commit -m "complete customer login gate"
git pull --rebase origin main
git push origin main

ทดสอบหลัง Deploy:
1. เปิด https://furugishop.vercel.app -> ต้องเข้า customer-login.html
2. เปิด /shop.html แบบ Incognito -> ต้องเด้ง Login
3. เปิด /cart.html แบบ Incognito -> ต้องเด้ง Login
4. Login ลูกค้า -> ต้องเข้า index.html และใช้งานร้านได้
5. Logout -> ต้องกลับ customer-login.html
6. Login Admin ที่ /admin-login.html -> ต้องยังใช้งานได้
7. /api/health -> ต้องยังตอบ ok:true เมื่อ Supabase พร้อม

หมายเหตุ:
หน้า HTML เป็น static file จึงยังสามารถถูกดาวน์โหลดเป็น source ได้ แต่ข้อมูลร้านและ customer operations ใน API ชุดนี้ถูกบังคับ Bearer session แล้ว หากต้องการปิดการเข้าถึง HTML ที่ระดับเซิร์ฟเวอร์ 100% ต้องเปลี่ยนสถาปัตยกรรมไปใช้ server-side cookie/session middleware.
