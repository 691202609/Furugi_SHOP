Furugi SHOP - FORCE LOGIN FIX

ไฟล์ที่ต้องแทนของเดิม:
1. app.js
2. vercel.json

พฤติกรรมหลังแก้:
- เปิดโดเมนหลัก / -> customer-login.html?next=index.html&force=1
- ระบบล้างเฉพาะ Supabase session ของ browser ปัจจุบันก่อน
- หน้า Login จะไม่เด้งเข้า Home จาก session เก่า
- หลัง Login สำเร็จ -> index.html
- ระหว่างใช้งาน HOME/SHOP/CART/CHECKOUT ยังใช้ session เดิม ไม่ต้อง Login ซ้ำทุกหน้า
- Direct URL ไปหน้าร้านโดยไม่มี session -> กลับหน้า Login
