'use strict';

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const PUBLISHABLE_KEY = String(process.env.SUPABASE_PUBLISHABLE_KEY || '');
const SECRET_KEY = String(process.env.SUPABASE_SECRET_KEY || '');
const SETUP_TOKEN = String(process.env.FURUGI_SETUP_TOKEN || '');

if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SECRET_KEY) {
  console.warn('Furugi v4: Supabase environment variables are not fully configured.');
}

const admin = createClient(SUPABASE_URL || 'https://invalid.local', SECRET_KEY || 'invalid', {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});
const publicAuth = createClient(SUPABASE_URL || 'https://invalid.local', PUBLISHABLE_KEY || 'invalid', {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

const safeText = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const digits = v => String(v ?? '').replace(/\D/g, '');
const validPhone = v => { const d = digits(v); return d.length >= 9 && d.length <= 12; };
const validEmail = v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v));
const toBool = v => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
const clampInt = (v, min = 0, max = 9999) => Math.max(min, Math.min(max, Math.floor(Number(v) || 0)));

function send(res, status, data, extra = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

function requestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function apiPath(req) {
  const raw = Array.isArray(req.query?.path) ? req.query.path.join('/') : String(req.query?.path || '');
  return '/api/' + raw.replace(/^\/+/, '').replace(/\/+$/, '');
}

function bearer(req) {
  const h = String(req.headers.authorization || '');
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : '';
}

async function currentUser(req, required = false) {
  const token = bearer(req);
  if (!token) {
    if (required) throw Object.assign(new Error('กรุณาเข้าสู่ระบบ'), { status: 401 });
    return null;
  }
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    if (required) throw Object.assign(new Error('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่'), { status: 401 });
    return null;
  }
  return data.user;
}

async function profileFor(userId) {
  const { data, error } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function requireAdmin(req) {
  const user = await currentUser(req, true);
  const profile = await profileFor(user.id);
  if (!profile || profile.role !== 'admin' || profile.status !== 'active') {
    throw Object.assign(new Error('ไม่มีสิทธิ์เข้าใช้งานหลังบ้าน'), { status: 403 });
  }
  return { user, profile };
}

function publicCustomer(profile, user) {
  return {
    id: user?.id || profile?.id,
    email: user?.email || profile?.email || '',
    name: profile?.full_name || '',
    phone: profile?.phone || '',
    address: profile?.address_line || '',
    subdistrict: profile?.subdistrict || '',
    district: profile?.district || '',
    province: profile?.province || '',
    postcode: profile?.postcode || ''
  };
}

function settingsToJSON(r) {
  if (!r) return {};
  return {
    shopName: r.shop_name,
    shopSubtitle: r.shop_subtitle,
    announcement: r.announcement,
    shippingFee: Number(r.shipping_fee || 0),
    freeShippingAt: Number(r.free_shipping_at || 0),
    reserveMinutes: Number(r.reserve_minutes || 1440),
    enableCOD: !!r.enable_cod,
    enablePromptPay: !!r.enable_promptpay,
    enableBank: !!r.enable_bank,
    promptPayId: r.promptpay_id || '',
    bankName: r.bank_name || '',
    bankAccountName: r.bank_account_name || '',
    bankAccountNumber: r.bank_account_number || '',
    contactPhone: r.contact_phone || '',
    contactEmail: r.contact_email || '',
    lineId: r.line_id || '',
    instagram: r.instagram || '',
    shopAddress: r.shop_address || '',
    shippingText: r.shipping_text || '',
    returnText: r.return_text || '',
    privacyText: r.privacy_text || '',
    termsText: r.terms_text || '',
    orderWebhookUrl: r.order_webhook_url || ''
  };
}

async function getSettings() {
  const { data, error } = await admin.from('store_settings').select('*').eq('id', 1).single();
  if (error) throw error;
  return data;
}

function productToJSON(r, includeGallery = false) {
  const out = {
    id: Number(r.id), sku: r.sku, name: r.name, category: r.category,
    price: Number(r.price || 0), image: r.image || '', tag: r.tag || '', size: r.size || '',
    condition: r.condition_text || '', brand: r.brand || '', gender: r.gender || '', measure: r.measure || '',
    note: r.note || '', details: r.details || '', stock: Number(r.stock || 0), sold: !!r.sold,
    featured: !!r.featured, hidden: !!r.hidden, createdAt: r.created_at, updatedAt: r.updated_at
  };
  if (includeGallery) out.gallery = Array.isArray(r.gallery) ? r.gallery.filter(Boolean) : [];
  return out;
}

function orderToJSON(o, signedProof = '') {
  const items = (o.order_items || []).map(x => ({
    id: x.product_id == null ? null : Number(x.product_id), sku: x.sku, name: x.name,
    price: Number(x.price || 0), quantity: Number(x.quantity || 1), size: x.size || '', image: x.image || ''
  }));
  return {
    id: o.id, createdAt: o.created_at, updatedAt: o.updated_at, status: o.status,
    paymentMethod: o.payment_method, paymentStatus: o.payment_status,
    customer: { name:o.customer_name, phone:o.customer_phone, email:o.customer_email, address:o.address_line, subdistrict:o.subdistrict, district:o.district, province:o.province, postcode:o.postcode },
    note:o.customer_note || '', adminNote:o.admin_note || '', subtotal:Number(o.subtotal || 0), shipping:Number(o.shipping || 0), total:Number(o.total || 0),
    paymentProof: signedProof || '', paymentProofAt:o.payment_proof_at || '', trackingNumber:o.tracking_number || '', shippingProvider:o.shipping_provider || '', restocked:!!o.restocked, items
  };
}

function publicOrder(o) {
  const x = orderToJSON(o);
  return {
    id:x.id, createdAt:x.createdAt, status:x.status, paymentMethod:x.paymentMethod, paymentStatus:x.paymentStatus,
    customer:{ name:x.customer.name, phone:String(x.customer.phone || '').replace(/.(?=.{4})/g,'•'), province:x.customer.province, postcode:x.customer.postcode },
    subtotal:x.subtotal, shipping:x.shipping, total:x.total, trackingNumber:x.trackingNumber, shippingProvider:x.shippingProvider,
    paymentProofAt:x.paymentProofAt, items:x.items
  };
}

async function fetchOrder(id) {
  const { data, error } = await admin.from('orders').select('*,order_items(*)').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

function parseDataImage(value, maxBytes = 2 * 1024 * 1024) {
  const raw = String(value || '');
  const m = raw.match(/^data:image\/(webp|png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/i);
  if (!m) throw Object.assign(new Error('รูปภาพไม่ถูกต้อง'), { status: 400 });
  const type0 = m[1].toLowerCase();
  const type = type0 === 'jpg' ? 'jpeg' : type0;
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > maxBytes) throw Object.assign(new Error('รูปภาพแต่ละไฟล์ต้องไม่เกิน 2MB หลังย่อ'), { status: 413 });
  const ok = type === 'png' ? buf.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
    : type === 'jpeg' ? buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    : buf.subarray(0,4).toString('ascii') === 'RIFF' && buf.subarray(8,12).toString('ascii') === 'WEBP';
  if (!ok) throw Object.assign(new Error('ไฟล์รูปภาพไม่ผ่านการตรวจสอบ'), { status: 400 });
  return { buf, ext: type === 'jpeg' ? 'jpg' : type, contentType: `image/${type}` };
}

function pathFromPublicUrl(url, bucket = 'product-images') {
  try {
    const u = new URL(String(url || ''));
    const marker = `/storage/v1/object/public/${bucket}/`;
    const i = u.pathname.indexOf(marker);
    return i >= 0 ? decodeURIComponent(u.pathname.slice(i + marker.length)) : '';
  } catch { return ''; }
}

async function deleteProductFiles(paths) {
  const list = [...new Set((paths || []).filter(Boolean))];
  if (!list.length) return;
  const { error } = await admin.storage.from('product-images').remove(list);
  if (error) console.warn('storage remove failed:', error.message);
}

function validateProduct(b, old = {}) {
  const gallery = Array.isArray(b.gallery) ? b.gallery.map(x=>safeText(x,3000)).filter(Boolean).slice(0,7) : (Array.isArray(old.gallery) ? old.gallery : []);
  const image = safeText(b.image ?? old.image, 3000);
  const stock = toBool(b.sold) ? 0 : clampInt(b.stock ?? old.stock ?? 1, 0, 9999);
  return {
    sku: safeText(b.sku ?? old.sku ?? `FG-${Date.now()}`, 80).toUpperCase(),
    name: safeText(b.name ?? old.name, 160), category: safeText(b.category ?? old.category ?? 'tees',50),
    price: clampInt(b.price ?? old.price,0,10000000), image,
    image_path: pathFromPublicUrl(image), gallery, gallery_paths: gallery.map(x=>pathFromPublicUrl(x)).filter(Boolean),
    tag: safeText(b.tag ?? old.tag ?? 'ONE OF ONE',80), size: safeText(b.size ?? old.size ?? 'Free',80),
    condition_text: safeText(b.condition ?? old.condition_text ?? '9/10',80), brand:safeText(b.brand ?? old.brand ?? 'No Brand',120),
    gender:safeText(b.gender ?? old.gender ?? 'Unisex',50), measure:safeText(b.measure ?? old.measure,500), note:safeText(b.note ?? old.note,1200),
    details:safeText(b.details ?? old.details,3000), stock, sold: toBool(b.sold) || stock < 1, featured:toBool(b.featured), hidden:toBool(b.hidden ?? old.hidden)
  };
}

async function postWebhook(event, order) {
  try {
    const s = await getSettings();
    const url = safeText(s.order_webhook_url,2000);
    if (!/^https:\/\//i.test(url)) return;
    await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,order}),signal:AbortSignal.timeout(5000)});
  } catch (e) { console.warn('webhook failed:', e.message); }
}

async function expireOrders() {
  try { await admin.rpc('expire_unpaid_orders'); } catch (e) { console.warn('expire orders:', e.message); }
}

function secureEqual(a,b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa,bb);
}

async function route(req, res) {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SECRET_KEY) return send(res,503,{error:'ยังไม่ได้ตั้งค่า Supabase Environment Variables'});
  const p = apiPath(req), m = String(req.method || 'GET').toUpperCase(), b = requestBody(req);

  if (p === '/api/config' && m === 'GET') return send(res,200,{supabaseUrl:SUPABASE_URL,publishableKey:PUBLISHABLE_KEY});
  if (p === '/api/health' && m === 'GET') {
    const { error } = await admin.from('store_settings').select('id').eq('id',1).single();
    return send(res,error?503:200,{ok:!error,cloud:'supabase',runtime:'vercel',time:new Date().toISOString(),error:error?.message});
  }

  // One-time admin bootstrap. Disabled forever once an admin exists.
  if (p === '/api/setup/status' && m === 'GET') {
    const { count, error } = await admin.from('profiles').select('id',{count:'exact',head:true}).eq('role','admin');
    if (error) throw error;
    return send(res,200,{configured:Number(count || 0)>0,setupTokenConfigured:SETUP_TOKEN.length>=24});
  }
  if (p === '/api/setup/admin' && m === 'POST') {
    const { count, error:countErr } = await admin.from('profiles').select('id',{count:'exact',head:true}).eq('role','admin');
    if (countErr) throw countErr;
    if (Number(count || 0) > 0) return send(res,409,{error:'ระบบมี Admin แล้ว หน้า Setup ถูกปิดใช้งาน'});
    if (SETUP_TOKEN.length < 24 || !secureEqual(b.setupToken,SETUP_TOKEN)) return send(res,403,{error:'Setup Token ไม่ถูกต้อง'});
    const email=safeText(b.email,180).toLowerCase(), password=String(b.password||''), name=safeText(b.name,120)||'Furugi Admin';
    if(!validEmail(email)||!email) return send(res,400,{error:'อีเมลไม่ถูกต้อง'});
    if(password.length<12||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password)||!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) return send(res,400,{error:'รหัสผ่าน Admin ต้องอย่างน้อย 12 ตัว และมีตัวอักษร ตัวเลข และอักขระพิเศษ'});
    const { data, error } = await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});
    if (error) return send(res,400,{error:error.message});
    const { error:upErr } = await admin.from('profiles').upsert({id:data.user.id,email,full_name:name,role:'admin',status:'active',updated_at:new Date().toISOString()},{onConflict:'id'});
    if (upErr) throw upErr;
    return send(res,201,{ok:true,email});
  }

  if (p === '/api/settings/public' && m === 'GET') {
    const j=settingsToJSON(await getSettings()); delete j.orderWebhookUrl; return send(res,200,j);
  }

  if (p === '/api/customer/me' && m === 'GET') {
    const user=await currentUser(req,false); if(!user)return send(res,200,{authenticated:false});
    const profile=await profileFor(user.id); if(!profile||profile.status!=='active')return send(res,200,{authenticated:false});
    return send(res,200,{authenticated:true,customer:publicCustomer(profile,user)});
  }
  if (p === '/api/customer/profile' && m === 'PUT') {
    const user=await currentUser(req,true), profile=await profileFor(user.id); if(!profile||profile.status!=='active')return send(res,403,{error:'บัญชีถูกปิดใช้งาน'});
    const name=safeText(b.name,120),phone=safeText(b.phone,40),postcode=safeText(b.postcode,10);
    if(!name)return send(res,400,{error:'กรุณากรอกชื่อ'}); if(phone&&!validPhone(phone))return send(res,400,{error:'เบอร์โทรไม่ถูกต้อง'}); if(postcode&&!/^\d{5}$/.test(postcode))return send(res,400,{error:'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก'});
    const patch={full_name:name,phone,address_line:safeText(b.address,500),subdistrict:safeText(b.subdistrict,120),district:safeText(b.district,120),province:safeText(b.province,120),postcode,updated_at:new Date().toISOString()};
    const {data,error}=await admin.from('profiles').update(patch).eq('id',user.id).select('*').single(); if(error)throw error;
    return send(res,200,{ok:true,customer:publicCustomer(data,user)});
  }
  if (p === '/api/customer/change-password' && m === 'POST') {
    const user=await currentUser(req,true), next=String(b.newPassword||'');
    if(next.length<10||!/[A-Za-z]/.test(next)||!/[0-9]/.test(next))return send(res,400,{error:'รหัสผ่านใหม่ต้องอย่างน้อย 10 ตัว และมีตัวอักษรกับตัวเลข'});
    const {error:verifyErr}=await publicAuth.auth.signInWithPassword({email:user.email,password:String(b.currentPassword||'')});
    if(verifyErr)return send(res,400,{error:'รหัสผ่านปัจจุบันไม่ถูกต้อง'});
    const {error}=await admin.auth.admin.updateUserById(user.id,{password:next}); if(error)throw error;
    return send(res,200,{ok:true});
  }
  if (p === '/api/customer/orders' && m === 'GET') {
    const user=await currentUser(req,true); await expireOrders();
    const {data,error}=await admin.from('orders').select('*,order_items(*)').eq('customer_id',user.id).order('created_at',{ascending:false}).limit(100); if(error)throw error;
    return send(res,200,(data||[]).map(publicOrder));
  }
  if (/^\/api\/customer\/orders\/[^/]+$/.test(p) && m==='GET') {
    const user=await currentUser(req,true), id=decodeURIComponent(p.split('/').pop()).toUpperCase();
    const {data,error}=await admin.from('orders').select('*,order_items(*)').eq('id',id).eq('customer_id',user.id).maybeSingle(); if(error)throw error;
    return data?send(res,200,publicOrder(data)):send(res,404,{error:'ไม่พบออเดอร์ในบัญชีนี้'});
  }

  if (p === '/api/products' && m === 'GET') {
    let q=admin.from('products').select('*').eq('hidden',false).order('sold',{ascending:true}).order('featured',{ascending:false}).order('id',{ascending:false});
    const category=safeText(req.query?.category,50); if(category&&category!=='all')q=q.eq('category',category);
    const {data,error}=await q; if(error)throw error;
    const term=safeText(req.query?.q,100).toLowerCase();
    const rows=term?(data||[]).filter(r=>`${r.name} ${r.brand} ${r.tag} ${r.size} ${r.sku}`.toLowerCase().includes(term)):(data||[]);
    return send(res,200,rows.map(r=>productToJSON(r,false)));
  }
  if (/^\/api\/products\/\d+$/.test(p) && m==='GET') {
    const id=Number(p.split('/').pop()); const {data,error}=await admin.from('products').select('*').eq('id',id).eq('hidden',false).maybeSingle(); if(error)throw error;
    return data?send(res,200,productToJSON(data,true)):send(res,404,{error:'ไม่พบสินค้า'});
  }
  if (p === '/api/contact' && m === 'POST') {
    const name=safeText(b.name,120),message=safeText(b.message,3000),email=safeText(b.email,180),phone=safeText(b.phone,40); if(!name||!message)return send(res,400,{error:'กรุณากรอกชื่อและข้อความ'}); if(!validEmail(email))return send(res,400,{error:'อีเมลไม่ถูกต้อง'});
    const user=await currentUser(req,false); const {data,error}=await admin.from('contact_messages').insert({customer_id:user?.id||null,status:'new',name,email,phone,message}).select('id').single(); if(error)throw error;
    return send(res,201,{id:Number(data.id),ok:true});
  }
  if (p === '/api/orders' && m === 'POST') {
    await expireOrders();
    const raw=Array.isArray(b.items)?b.items:[], map=new Map(); for(const e of raw){const id=Number(e?.id??e),qty=clampInt(e?.quantity??e?.qty??1,1,9999);if(Number.isInteger(id)&&id>0)map.set(id,Math.min(9999,(map.get(id)||0)+qty));}
    const items=[...map].map(([id,quantity])=>({id,quantity})); if(!items.length)return send(res,400,{error:'ตะกร้าว่าง'});
    const c=b.customer||{}; if(!safeText(c.name,120)||!validPhone(c.phone)||!safeText(c.address,500)||!safeText(c.district,120)||!safeText(c.province,120)||!/^\d{5}$/.test(safeText(c.postcode,10))) return send(res,400,{error:'กรุณากรอกชื่อ เบอร์โทร ที่อยู่ เขต/อำเภอ จังหวัด และรหัสไปรษณีย์ให้ครบ'});
    if(!validEmail(safeText(c.email,180)))return send(res,400,{error:'อีเมลไม่ถูกต้อง'});
    const user=await currentUser(req,false), payment=['cod','promptpay','bank'].includes(b.payment)?b.payment:'cod';
    const {data,error}=await admin.rpc('create_store_order',{p_customer_id:user?.id||null,p_customer:{name:safeText(c.name,120),phone:safeText(c.phone,40),email:safeText(c.email,180),address:safeText(c.address,500),subdistrict:safeText(c.subdistrict,120),district:safeText(c.district,120),province:safeText(c.province,120),postcode:safeText(c.postcode,10)},p_items:items,p_payment_method:payment,p_note:safeText(b.note,2000)});
    if(error){const msg=String(error.message||''); if(msg.includes('OUT_OF_STOCK'))return send(res,409,{error:'มีสินค้าบางรายการหมดหรือจำนวนไม่พอ กรุณารีเฟรชตะกร้า'}); if(msg.includes('PAYMENT_DISABLED'))return send(res,400,{error:'ช่องทางชำระเงินนี้ปิดใช้งาน'}); return send(res,400,{error:'สร้างคำสั่งซื้อไม่สำเร็จ: '+msg});}
    const order=await fetchOrder(data.id); void postWebhook('order_created',publicOrder(order)); return send(res,201,publicOrder(order));
  }
  if (p === '/api/order-lookup' && m === 'POST') {
    await expireOrders(); const id=safeText(b.id,80).toUpperCase(), phone=digits(b.phone); if(!id||phone.length<9)return send(res,400,{error:'กรุณากรอกเลขออเดอร์และเบอร์โทร'});
    const order=await fetchOrder(id); if(!order||digits(order.customer_phone)!==phone)return send(res,404,{error:'ไม่พบออเดอร์ หรือเบอร์โทรไม่ตรง'}); return send(res,200,publicOrder(order));
  }
  if (/^\/api\/orders\/[^/]+\/payment-proof$/.test(p) && m==='POST') {
    const parts=p.split('/'),id=decodeURIComponent(parts[3]).toUpperCase(),phone=digits(b.phone),order=await fetchOrder(id); if(!order||digits(order.customer_phone)!==phone)return send(res,404,{error:'ไม่พบออเดอร์ หรือเบอร์โทรไม่ตรง'});
    if(order.payment_method==='cod')return send(res,400,{error:'ออเดอร์ COD ไม่ต้องอัปโหลดสลิป'}); if(order.payment_status==='paid')return send(res,409,{error:'ออเดอร์นี้ยืนยันการชำระแล้ว'}); if(order.status==='cancelled')return send(res,409,{error:'ออเดอร์นี้ถูกยกเลิกแล้ว'});
    const img=parseDataImage(b.proofImage,2*1024*1024),path=`orders/${id}/${Date.now()}-${crypto.randomUUID()}.${img.ext}`;
    const {error:upErr}=await admin.storage.from('payment-slips').upload(path,img.buf,{contentType:img.contentType,upsert:false}); if(upErr)throw upErr;
    if(order.payment_proof_path)await admin.storage.from('payment-slips').remove([order.payment_proof_path]).catch(()=>{});
    const {error}=await admin.from('orders').update({payment_proof_path:path,payment_proof_at:new Date().toISOString(),payment_status:'reviewing',updated_at:new Date().toISOString()}).eq('id',id); if(error)throw error;
    return send(res,200,{ok:true});
  }

  // ---------- Admin ----------
  if (p.startsWith('/api/admin/')) {
    const {user,profile}=await requireAdmin(req);
    if (p === '/api/admin/me' && m==='GET') return send(res,200,{authenticated:true,id:user.id,email:user.email,name:profile.full_name||'Admin',mustChangePassword:false});
    if (p === '/api/admin/dashboard' && m==='GET') {
      await expireOrders();
      const [pc,ac,oc,cc,pending,reviewing,products,orders,settings] = await Promise.all([
        admin.from('products').select('id',{count:'exact',head:true}), admin.from('products').select('id',{count:'exact',head:true}).eq('sold',false).gt('stock',0).eq('hidden',false),
        admin.from('orders').select('id',{count:'exact',head:true}), admin.from('profiles').select('id',{count:'exact',head:true}).eq('role','customer'),
        admin.from('orders').select('id',{count:'exact',head:true}).eq('status','pending'), admin.from('orders').select('id',{count:'exact',head:true}).eq('payment_status','reviewing'),
        admin.from('products').select('id').eq('hidden',false).eq('sold',false).gt('stock',0).limit(1), admin.from('orders').select('id,created_at,status,payment_method,payment_status,customer_name,customer_phone,total,tracking_number,shipping_provider').order('created_at',{ascending:false}).limit(8), getSettings()
      ]);
      for(const x of [pc,ac,oc,cc,pending,reviewing,products,orders])if(x.error)throw x.error;
      const {data:revRows,error:revErr}=await admin.from('orders').select('total,status,payment_method,payment_status').neq('status','cancelled'); if(revErr)throw revErr;
      const revenue=(revRows||[]).reduce((s,o)=>s+((o.payment_status==='paid'||(o.payment_method==='cod'&&o.status==='completed'))?Number(o.total||0):0),0);
      const sj=settingsToJSON(settings); const readyChecks={realProducts:(products.data||[]).length>0,contact:!!(sj.contactPhone||sj.contactEmail||sj.lineId||sj.instagram),payment:!!(sj.enableCOD||(sj.enablePromptPay&&sj.promptPayId)||(sj.enableBank&&sj.bankAccountNumber)),policies:!!(sj.shippingText&&sj.returnText&&sj.privacyText&&sj.termsText)};
      return send(res,200,{products:pc.count||0,available:ac.count||0,orders:oc.count||0,customers:cc.count||0,pending:pending.count||0,reviewing:reviewing.count||0,revenue,latest:orders.data||[],readyChecks,ready:Object.values(readyChecks).every(Boolean)});
    }
    if (p === '/api/admin/uploads' && m==='POST') {
      const images=Array.isArray(b.images)?b.images.slice(0,8):[]; if(!images.length)return send(res,400,{error:'ไม่พบรูปภาพ'}); const urls=[],uploads=[];
      for(const raw of images){const img=parseDataImage(raw),path=`products/${new Date().toISOString().slice(0,7).replace('-','/')}/${Date.now()}-${crypto.randomUUID()}.${img.ext}`;const {error}=await admin.storage.from('product-images').upload(path,img.buf,{contentType:img.contentType,cacheControl:'31536000',upsert:false});if(error)throw error;const {data:u}=admin.storage.from('product-images').getPublicUrl(path);urls.push(u.publicUrl);uploads.push({url:u.publicUrl,path});}
      return send(res,201,{urls,uploads});
    }
    if (p === '/api/admin/products' && m==='GET') {const {data,error}=await admin.from('products').select('*').order('id',{ascending:false});if(error)throw error;return send(res,200,(data||[]).map(x=>productToJSON(x,true)));}
    if (p === '/api/admin/products' && m==='POST') {
      const item=validateProduct(b); if(!item.name||item.price<=0)return send(res,400,{error:'กรุณากรอกชื่อและราคา'}); if(!item.image)return send(res,400,{error:'กรุณาอัปโหลดรูปสินค้าจริงอย่างน้อย 1 รูป'});
      const {data,error}=await admin.from('products').insert(item).select('*').single(); if(error)return send(res,error.code==='23505'?409:400,{error:error.code==='23505'?'SKU ซ้ำกับสินค้าเดิม':error.message}); return send(res,201,productToJSON(data,true));
    }
    if (/^\/api\/admin\/products\/\d+$/.test(p) && m==='GET') {const id=Number(p.split('/').pop());const {data,error}=await admin.from('products').select('*').eq('id',id).maybeSingle();if(error)throw error;return data?send(res,200,productToJSON(data,true)):send(res,404,{error:'ไม่พบสินค้า'});}
    if (/^\/api\/admin\/products\/\d+$/.test(p) && m==='PUT') {
      const id=Number(p.split('/').pop()),{data:old,error:oldErr}=await admin.from('products').select('*').eq('id',id).maybeSingle();if(oldErr)throw oldErr;if(!old)return send(res,404,{error:'ไม่พบสินค้า'});
      const item=validateProduct(b,old);if(!item.name||item.price<=0)return send(res,400,{error:'กรุณากรอกชื่อและราคา'});if(!item.image)return send(res,400,{error:'กรุณาอัปโหลดรูปสินค้าจริงอย่างน้อย 1 รูป'});
      const {data,error}=await admin.from('products').update({...item,updated_at:new Date().toISOString()}).eq('id',id).select('*').single();if(error)return send(res,error.code==='23505'?409:400,{error:error.code==='23505'?'SKU ซ้ำกับสินค้าเดิม':error.message});
      const oldPaths=[old.image_path,...(Array.isArray(old.gallery_paths)?old.gallery_paths:[])],newPaths=new Set([data.image_path,...(Array.isArray(data.gallery_paths)?data.gallery_paths:[])]);void deleteProductFiles(oldPaths.filter(x=>x&&!newPaths.has(x)));return send(res,200,productToJSON(data,true));
    }
    if (/^\/api\/admin\/products\/\d+$/.test(p) && m==='DELETE') {
      const id=Number(p.split('/').pop()),{data:row,error}=await admin.from('products').select('*').eq('id',id).maybeSingle();if(error)throw error;if(!row)return send(res,404,{error:'ไม่พบสินค้า'});
      const {data:refs,error:ae}=await admin.from('order_items').select('order_id,orders(status)').eq('product_id',id);if(ae)throw ae;const active=(refs||[]).some(x=>{const o=Array.isArray(x.orders)?x.orders[0]:x.orders;return o&& !['completed','cancelled'].includes(o.status)});if(active)return send(res,409,{error:'สินค้านี้มีออเดอร์ที่ยังดำเนินการอยู่ จึงยังลบไม่ได้ กรุณาจบหรือยกเลิกออเดอร์ก่อน'});
      const {count}=await admin.from('order_items').select('id',{count:'exact',head:true}).eq('product_id',id);const {error:de}=await admin.from('products').delete().eq('id',id);if(de)throw de;void deleteProductFiles([row.image_path,...(Array.isArray(row.gallery_paths)?row.gallery_paths:[])]);return send(res,200,{ok:true,deletedId:id,hadOrderHistory:Number(count||0)>0});
    }
    if (p === '/api/admin/orders' && m==='GET') {
      await expireOrders();let q=admin.from('orders').select('id,created_at,updated_at,status,payment_method,payment_status,customer_name,customer_phone,total,tracking_number,shipping_provider').order('created_at',{ascending:false});if(req.query?.status)q=q.eq('status',safeText(req.query.status,40));if(req.query?.payment)q=q.eq('payment_status',safeText(req.query.payment,40));const {data,error}=await q;if(error)throw error;return send(res,200,data||[]);
    }
    if (/^\/api\/admin\/orders\/[^/]+$/.test(p) && m==='GET') {
      const id=decodeURIComponent(p.split('/').pop()).toUpperCase(),o=await fetchOrder(id);if(!o)return send(res,404,{error:'ไม่พบออเดอร์'});let signed='';if(o.payment_proof_path){const {data}=await admin.storage.from('payment-slips').createSignedUrl(o.payment_proof_path,600);signed=data?.signedUrl||'';}return send(res,200,orderToJSON(o,signed));
    }
    if (/^\/api\/admin\/orders\/[^/]+$/.test(p) && m==='PUT') {
      const id=decodeURIComponent(p.split('/').pop()).toUpperCase(),old=await fetchOrder(id);if(!old)return send(res,404,{error:'ไม่พบออเดอร์'});const statuses=['pending','confirmed','packing','shipped','completed','cancelled'],pays=['unpaid','reviewing','paid','rejected','cod'];const status=statuses.includes(b.status)?b.status:old.status,paymentStatus=pays.includes(b.paymentStatus)?b.paymentStatus:old.payment_status;
      if(old.status==='cancelled'&&status!=='cancelled')return send(res,409,{error:'ออเดอร์ที่ยกเลิกและคืนสต็อกแล้วไม่สามารถเปิดกลับได้ กรุณาให้ลูกค้าสั่งใหม่'});
      if(status==='cancelled'){const {error}=await admin.rpc('cancel_store_order',{p_order_id:id,p_admin_note:safeText(b.adminNote??old.admin_note,2000)});if(error)throw error;await admin.from('orders').update({payment_status:paymentStatus,tracking_number:safeText(b.trackingNumber,120),shipping_provider:safeText(b.shippingProvider,120),updated_at:new Date().toISOString()}).eq('id',id);} else {const {error}=await admin.from('orders').update({status,payment_status:paymentStatus,tracking_number:safeText(b.trackingNumber??old.tracking_number,120),shipping_provider:safeText(b.shippingProvider??old.shipping_provider,120),admin_note:safeText(b.adminNote??old.admin_note,2000),updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;}
      const next=await fetchOrder(id);void postWebhook('order_updated',publicOrder(next));return send(res,200,orderToJSON(next));
    }
    if (p === '/api/admin/customers' && m==='GET') {
      const {data:profiles,error}=await admin.from('profiles').select('id,email,full_name,phone,province,created_at,updated_at').eq('role','customer').order('created_at',{ascending:false});if(error)throw error;const {data:orders,error:oe}=await admin.from('orders').select('customer_id,total,status');if(oe)throw oe;const agg=new Map();for(const o of orders||[]){if(!o.customer_id)continue;const a=agg.get(o.customer_id)||{count:0,total:0};a.count++;if(o.status!=='cancelled')a.total+=Number(o.total||0);agg.set(o.customer_id,a);}return send(res,200,(profiles||[]).map(x=>({id:x.id,email:x.email,name:x.full_name,phone:x.phone,province:x.province,created_at:x.created_at,updated_at:x.updated_at,order_count:agg.get(x.id)?.count||0,total_spent:agg.get(x.id)?.total||0})));
    }
    if (p === '/api/admin/messages' && m==='GET') {const {data,error}=await admin.from('contact_messages').select('*').order('created_at',{ascending:false});if(error)throw error;return send(res,200,data||[]);}
    if (/^\/api\/admin\/messages\/\d+$/.test(p) && m==='PUT') {const id=Number(p.split('/').pop()),status=['new','read','closed'].includes(b.status)?b.status:'read';const {error}=await admin.from('contact_messages').update({status}).eq('id',id);if(error)throw error;return send(res,200,{ok:true});}
    if (/^\/api\/admin\/messages\/\d+$/.test(p) && m==='DELETE') {const id=Number(p.split('/').pop());const {error}=await admin.from('contact_messages').delete().eq('id',id);if(error)throw error;return send(res,200,{ok:true});}
    if (p === '/api/admin/settings' && m==='GET') return send(res,200,settingsToJSON(await getSettings()));
    if (p === '/api/admin/settings' && m==='PUT') {
      const patch={updated_at:new Date().toISOString()}, map={shopName:'shop_name',shopSubtitle:'shop_subtitle',announcement:'announcement',promptPayId:'promptpay_id',bankName:'bank_name',bankAccountName:'bank_account_name',bankAccountNumber:'bank_account_number',contactPhone:'contact_phone',contactEmail:'contact_email',lineId:'line_id',instagram:'instagram',shopAddress:'shop_address',shippingText:'shipping_text',returnText:'return_text',privacyText:'privacy_text',termsText:'terms_text',orderWebhookUrl:'order_webhook_url'};for(const[k,col]of Object.entries(map))if(k in b)patch[col]=safeText(b[k],k.endsWith('Text')?6000:2000);if('shippingFee'in b)patch.shipping_fee=clampInt(b.shippingFee,0,1000000);if('freeShippingAt'in b)patch.free_shipping_at=clampInt(b.freeShippingAt,0,10000000);if('reserveMinutes'in b)patch.reserve_minutes=Math.max(30,clampInt(b.reserveMinutes,30,100000));if('enableCOD'in b)patch.enable_cod=toBool(b.enableCOD);if('enablePromptPay'in b)patch.enable_promptpay=toBool(b.enablePromptPay);if('enableBank'in b)patch.enable_bank=toBool(b.enableBank);const {data,error}=await admin.from('store_settings').update(patch).eq('id',1).select('*').single();if(error)throw error;return send(res,200,settingsToJSON(data));
    }
    if (p === '/api/admin/change-password' && m==='POST') {
      const next=String(b.newPassword||'');if(next.length<12||!/[A-Za-z]/.test(next)||!/[0-9]/.test(next))return send(res,400,{error:'รหัสผ่านใหม่ต้องอย่างน้อย 12 ตัว และมีตัวอักษรกับตัวเลข'});const {error:verifyErr}=await publicAuth.auth.signInWithPassword({email:user.email,password:String(b.currentPassword||'')});if(verifyErr)return send(res,400,{error:'รหัสผ่านปัจจุบันไม่ถูกต้อง'});const {error}=await admin.auth.admin.updateUserById(user.id,{password:next});if(error)throw error;return send(res,200,{ok:true});
    }
    if (p === '/api/admin/backup' && m==='GET') {
      const [settings,products,orders,items,profiles,messages]=await Promise.all([getSettings(),admin.from('products').select('*'),admin.from('orders').select('*'),admin.from('order_items').select('*'),admin.from('profiles').select('id,email,full_name,phone,address_line,subdistrict,district,province,postcode,role,status,created_at,updated_at'),admin.from('contact_messages').select('*')]);for(const x of [products,orders,items,profiles,messages])if(x.error)throw x.error;return send(res,200,{exportedAt:new Date().toISOString(),settings,products:products.data||[],orders:orders.data||[],orderItems:items.data||[],profiles:profiles.data||[],contacts:messages.data||[]});
    }
    return send(res,404,{error:'Admin API not found'});
  }

  return send(res,404,{error:'API not found'});
}

module.exports = async function handler(req,res){
  try { await route(req,res); }
  catch (e) { console.error('Furugi API error:', e); send(res,e.status||500,{error:e.status?e.message:'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์'}); }
};
