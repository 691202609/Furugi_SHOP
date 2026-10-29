'use strict';

let products=[];
let settings={shippingFee:60,freeShippingAt:999,enableCOD:true,enablePromptPay:false,enableBank:false};
let customerAccount={authenticated:false};
let supabaseClient=null;
let cart=[];
try{cart=JSON.parse(localStorage.getItem('furugi-cart-live-v4')||localStorage.getItem('furugi-cart-live-v3')||'[]')}catch{cart=[]}

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const escapeHTML=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmt=n=>`฿${Number(n||0).toLocaleString('th-TH')}`;
const statusText={pending:'รอยืนยัน',confirmed:'ยืนยันแล้ว',packing:'กำลังแพ็ก',shipped:'จัดส่งแล้ว',completed:'สำเร็จ',cancelled:'ยกเลิก',unpaid:'ยังไม่ชำระ',reviewing:'กำลังตรวจสลิป',paid:'ชำระแล้ว',rejected:'สลิปไม่ผ่าน',cod:'เก็บเงินปลายทาง'};
async function api(url,opt={}){const r=await fetch(url,{...opt,headers:{'Content-Type':'application/json',...(opt.headers||{})}});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||'เกิดข้อผิดพลาด');return d}
async function initSupabase(){const cfg=await api('/api/config');if(!window.supabase?.createClient)throw new Error('โหลด Supabase SDK ไม่สำเร็จ');supabaseClient=window.supabase.createClient(cfg.supabaseUrl,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return supabaseClient}
async function accessToken(){if(!supabaseClient)return '';const {data}=await supabaseClient.auth.getSession();return data?.session?.access_token||''}
async function authedApi(url,opt={}){const token=await accessToken();const headers={...(opt.headers||{})};if(token)headers.Authorization=`Bearer ${token}`;return api(url,{...opt,headers})}
function guardDirectFileOpen(){if(location.protocol!=='file:')return false;document.body.insertAdjacentHTML('afterbegin','<div class="server-required"><b>ต้องเปิดผ่านเซิร์ฟเวอร์</b> — กรุณาเปิดผ่าน Vercel URL หรือรัน <code>npm run dev</code> แล้วเปิด URL ที่ Vercel CLI แสดง การเปิดไฟล์ HTML โดยตรงจะเชื่อมสินค้า/หลังบ้านไม่ได้</div>');return true}
function toast(text){const el=$('#toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),2200)}
function saveCart(){localStorage.setItem('furugi-cart-live-v4',JSON.stringify(cart));updateCartUI()}
function updateCartUI(){const total=cart.reduce((sum,x)=>sum+Math.max(1,Number(x.quantity||1)),0);$$('.cart-badge').forEach(x=>x.textContent=total)}
function sanitizeCart(){
 const map=new Map(products.map(p=>[Number(p.id),p]));
 const next=[];
 for(const old of Array.isArray(cart)?cart:[]){
   const p=map.get(Number(old.id));if(!p||p.sold||Number(p.stock)<1)continue;
   const quantity=Math.max(1,Math.min(Number(p.stock),Math.floor(Number(old.quantity||1))));
   next.push({id:p.id,name:p.name,price:p.price,size:p.size,image:p.image,sku:p.sku,quantity,stock:Number(p.stock)});
 }
 cart=next;saveCart();
}
function addToCart(id,amount=1){
 const p=products.find(x=>Number(x.id)===Number(id));if(!p)return;
 if(p.sold||Number(p.stock)<1)return toast('สินค้านี้หมดแล้ว');
 const item=cart.find(x=>Number(x.id)===Number(id)),add=Math.max(1,Math.floor(Number(amount)||1));
 if(item){
   if(Number(item.quantity)>=Number(p.stock))return toast(`เพิ่มไม่ได้ สินค้าเหลือ ${p.stock} ชิ้น`);
   item.quantity=Math.min(Number(p.stock),Number(item.quantity)+add);item.stock=Number(p.stock);
 }else cart.push({id:p.id,name:p.name,price:p.price,size:p.size,image:p.image,sku:p.sku,quantity:Math.min(add,Number(p.stock)),stock:Number(p.stock)});
 saveCart();renderCart();toast('เพิ่มลงตะกร้าแล้ว');
}
window.addToCart=addToCart;
function setCartQuantity(id,quantity){
 const p=products.find(x=>Number(x.id)===Number(id)),item=cart.find(x=>Number(x.id)===Number(id));if(!p||!item)return;
 const qty=Math.floor(Number(quantity)||0);if(qty<=0)return removeCart(id);
 item.quantity=Math.min(Number(p.stock),Math.max(1,qty));item.stock=Number(p.stock);saveCart();renderCart();
}
window.setCartQuantity=setCartQuantity;
function removeCart(id){cart=cart.filter(x=>Number(x.id)!==Number(id));saveCart();renderCart()}
window.removeCart=removeCart;

function productCard(p){
 const unavailable=p.sold||p.stock<1;
 return `<article class="product-card"><a class="product-image" href="product.html?id=${p.id}"><img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}"><span class="tag ${p.sold?'sold':''}">${p.sold?'SOLD OUT':escapeHTML(p.tag||'ONE OF ONE')}</span>${p.sold?'<span class="sold-mask"><b>SOLD OUT</b></span>':''}</a><div class="product-info"><div class="product-kicker">${escapeHTML(p.category)} · 古着</div><h3><a href="product.html?id=${p.id}">${escapeHTML(p.name)}</a></h3><div class="product-meta"><span>SIZE ${escapeHTML(p.size)}</span><span>${escapeHTML(p.condition)}</span><span>${unavailable?'SOLD OUT':`STOCK ${Number(p.stock)}`}</span></div><div class="price-row"><span class="price">${fmt(p.price)}</span><button class="add-btn" ${unavailable?'disabled':''} aria-label="เพิ่มลงตะกร้า" data-add-cart="${p.id}">${unavailable?'×':'＋'}</button></div><div class="product-actions"><a class="btn btn-small btn-ghost" href="product.html?id=${p.id}">ดูสินค้า</a><button class="btn btn-small btn-pink" type="button" ${unavailable?'disabled':''} data-add-cart="${p.id}">${p.sold?'SOLD OUT':'เพิ่มตะกร้า'}</button></div></div></article>`
}
function renderGrid(id,list){const host=$(`#${id}`);if(!host)return;host.innerHTML=list.length?list.map(productCard).join(''):'<div class="empty-state" style="grid-column:1/-1"><h2>ยังไม่มีสินค้า</h2><p class="muted">สินค้าดรอปใหม่กำลังมาเร็ว ๆ นี้</p></div>';$$('[data-add-cart]',host).forEach(b=>b.addEventListener('click',()=>addToCart(Number(b.dataset.addCart))))}

async function loadBase(){
 try{[products,settings]=await Promise.all([api('/api/products'),api('/api/settings/public')])}catch(e){console.error(e);toast('เชื่อมต่อร้านค้าไม่สำเร็จ')}
 const ann=$('#announcement');if(ann)ann.textContent=settings.announcement||'';
 $$('.shop-name').forEach(x=>x.textContent=settings.shopName||'Furugi SHOP');
 $$('.shop-subtitle').forEach(x=>x.textContent=settings.shopSubtitle||'古着 • JAPANESE VINTAGE STORE');
 $$('.contact-phone').forEach(x=>x.textContent=settings.contactPhone||'-');
 $$('.contact-email').forEach(x=>x.textContent=settings.contactEmail||'-');
 $$('.line-id').forEach(x=>x.textContent=settings.lineId||'-');
 $$('.instagram').forEach(x=>x.textContent=settings.instagram||'-');
 sanitizeCart();
}

async function loadCustomerAccount(){
 try{const {data}=await supabaseClient.auth.getSession();if(!data?.session){customerAccount={authenticated:false};return}customerAccount=await authedApi('/api/customer/me')}catch{customerAccount={authenticated:false}}
}
function customerApi(url,opt={}){return authedApi(url,opt)}
function initCustomerChrome(){
 $$('.customer-account-link').forEach(a=>{a.href=customerAccount.authenticated?'account.html':'customer-login.html';a.title=customerAccount.authenticated?`บัญชี ${customerAccount.customer?.name||''}`:'เข้าสู่ระบบสมาชิก';a.setAttribute('aria-label',a.title)});
}
function fillCheckoutFromAccount(form){
 if(!customerAccount.authenticated||!customerAccount.customer)return;const c=customerAccount.customer;
 const vals={name:c.name,phone:c.phone,email:c.email,address:c.address,subdistrict:c.subdistrict,district:c.district,province:c.province,postcode:c.postcode};
 for(const[k,v]of Object.entries(vals)){const el=form.elements[k];if(el&&!el.value&&v)el.value=v}
}
function initCustomerLogin(){
 const form=$('#customerLoginForm');if(!form)return;if(customerAccount.authenticated){location.href='account.html';return}
 if(new URLSearchParams(location.search).get('verified'))setTimeout(()=>toast('ยืนยันอีเมลแล้ว กรุณาเข้าสู่ระบบ'),100);
 form.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(form),btn=$('button[type="submit"]',form);btn.disabled=true;btn.textContent='SIGNING IN...';try{const {error}=await supabaseClient.auth.signInWithPassword({email:String(fd.get('email')||'').trim(),password:String(fd.get('password')||'')});if(error)throw error;await loadCustomerAccount();const next=new URLSearchParams(location.search).get('next');location.href=next&&/^[a-z0-9_-]+\.html(?:\?.*)?$/i.test(next)?next:'account.html'}catch(err){toast(err.message==='Invalid login credentials'?'อีเมลหรือรหัสผ่านไม่ถูกต้อง':err.message);btn.disabled=false;btn.textContent='LOGIN →'}})
}
function initCustomerRegister(){
 const form=$('#customerRegisterForm');if(!form)return;if(customerAccount.authenticated){location.href='account.html';return}
 form.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(form);if(fd.get('password')!==fd.get('confirmPassword'))return toast('ยืนยันรหัสผ่านไม่ตรงกัน');const btn=$('button[type="submit"]',form);btn.disabled=true;btn.textContent='CREATING...';try{const redirect=new URL('customer-login.html?verified=1',location.href).href;const {data,error}=await supabaseClient.auth.signUp({email:String(fd.get('email')||'').trim(),password:String(fd.get('password')||''),options:{data:{full_name:String(fd.get('name')||'').trim(),phone:String(fd.get('phone')||'').trim()},emailRedirectTo:redirect}});if(error)throw error;if(data.session){await loadCustomerAccount();location.href='account.html'}else{form.reset();toast('สมัครสำเร็จ กรุณาเปิดอีเมลเพื่อยืนยันบัญชี');btn.textContent='CHECK YOUR EMAIL';setTimeout(()=>location.href='customer-login.html',2200)}}catch(err){toast(err.message);btn.disabled=false;btn.textContent='CREATE ACCOUNT →'}})
}
function initForgotPassword(){const f=$('#forgotPasswordForm');if(!f)return;f.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(f),btn=$('button[type="submit"]',f);btn.disabled=true;try{const redirect=new URL('reset-password.html',location.href).href;const {error}=await supabaseClient.auth.resetPasswordForEmail(String(fd.get('email')||'').trim(),{redirectTo:redirect});if(error)throw error;f.reset();toast('ส่งลิงก์ตั้งรหัสผ่านใหม่แล้ว กรุณาตรวจอีเมล');btn.textContent='EMAIL SENT'}catch(err){toast(err.message);btn.disabled=false}})}
function initResetPassword(){const f=$('#resetPasswordForm');if(!f)return;f.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(f);if(fd.get('password')!==fd.get('confirmPassword'))return toast('ยืนยันรหัสผ่านไม่ตรงกัน');const password=String(fd.get('password')||'');if(password.length<10)return toast('รหัสผ่านต้องอย่างน้อย 10 ตัว');const {error}=await supabaseClient.auth.updateUser({password});if(error)return toast(error.message);toast('ตั้งรหัสผ่านใหม่แล้ว');setTimeout(()=>location.href='account.html',900)})}
async function initCustomerAccount(){
 const host=$('#customerAccountPage');if(!host)return;if(!customerAccount.authenticated){location.href='customer-login.html?next=account.html';return}
 const c=customerAccount.customer||{};$('#accountGreeting').textContent=c.name||'MEMBER';$('#accountEmail').textContent=c.email||'';
 const pf=$('#profileForm');if(pf){for(const[k,v]of Object.entries({name:c.name,phone:c.phone,address:c.address,subdistrict:c.subdistrict,district:c.district,province:c.province,postcode:c.postcode})){if(pf.elements[k])pf.elements[k].value=v||''}pf.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(pf);try{const d=await customerApi('/api/customer/profile',{method:'PUT',body:JSON.stringify(Object.fromEntries(fd.entries()))});customerAccount.customer=d.customer;toast('บันทึกข้อมูลสมาชิกแล้ว')}catch(err){toast(err.message)}})}
 const pw=$('#customerPasswordForm');if(pw)pw.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(pw);if(fd.get('newPassword')!==fd.get('confirmPassword'))return toast('ยืนยันรหัสผ่านไม่ตรงกัน');try{await customerApi('/api/customer/change-password',{method:'POST',body:JSON.stringify({currentPassword:fd.get('currentPassword'),newPassword:fd.get('newPassword')})});pw.reset();toast('เปลี่ยนรหัสผ่านแล้ว')}catch(err){toast(err.message)}});
 $('#customerLogout')?.addEventListener('click',async()=>{try{await supabaseClient.auth.signOut()}catch{}location.href='index.html'});
 const ordersHost=$('#accountOrders');if(ordersHost){try{const orders=await customerApi('/api/customer/orders');ordersHost.innerHTML=orders.length?orders.map(o=>`<article class="account-order"><div class="split-row"><div><div class="kicker">${escapeHTML(o.id)}</div><b>${new Date(o.createdAt).toLocaleString('th-TH')}</b></div><div><span class="status-pill ${escapeHTML(o.status)}">${statusText[o.status]||escapeHTML(o.status)}</span> <span class="status-pill ${escapeHTML(o.paymentStatus)}">${statusText[o.paymentStatus]||escapeHTML(o.paymentStatus)}</span></div></div><div class="account-order-items">${o.items.map(x=>`<div class="summary-line"><span>${escapeHTML(x.name)} <small class="muted">SIZE ${escapeHTML(x.size)} · ×${Number(x.quantity||1)}</small></span><b>${fmt(Number(x.price)*Number(x.quantity||1))}</b></div>`).join('')}</div><div class="summary-line total"><span>TOTAL</span><span>${fmt(o.total)}</span></div>${o.trackingNumber?`<div class="notice"><b>เลขพัสดุ:</b> ${escapeHTML(o.trackingNumber)} · ${escapeHTML(o.shippingProvider||'')}</div>`:''}${o.paymentMethod!=='cod'&&o.paymentStatus==='unpaid'?`<div class="actions"><a class="btn btn-small btn-pink" href="payment.html?id=${encodeURIComponent(o.id)}">ชำระเงิน / อัปสลิป</a></div>`:''}</article>`).join(''):'<div class="empty-state"><h3>ยังไม่มีคำสั่งซื้อ</h3><p class="muted">เมื่อสั่งซื้อด้วยบัญชีนี้ ประวัติจะมาแสดงที่นี่</p><a class="btn btn-pink" href="shop.html">SHOP NOW →</a></div>'}catch(err){ordersHost.innerHTML=`<div class="notice">${escapeHTML(err.message)}</div>`}}
}

function initHome(){
 const featured=products.filter(p=>p.featured&&!p.sold).slice(0,4);renderGrid('featuredGrid',featured.length?featured:products.filter(p=>!p.sold).slice(0,4));
 const fresh=products.filter(p=>!p.sold).slice(0,8);renderGrid('newGrid',fresh);
}
function initShop(){
 const host=$('#productGrid');if(!host)return;let active=new URLSearchParams(location.search).get('category')||'all';const search=$('#shopSearch');
 $$('.filter-btn').forEach(x=>x.classList.toggle('active',(x.dataset.filter||'all')===active));
 const apply=()=>{const q=(search?.value||'').trim().toLowerCase();const list=products.filter(p=>(active==='all'||p.category===active)&&(!q||`${p.name} ${p.brand} ${p.tag} ${p.size} ${p.sku}`.toLowerCase().includes(q)));renderGrid('productGrid',list);const c=$('#productCount');if(c)c.textContent=`${list.length} ITEMS`};
 $$('.filter-btn').forEach(btn=>btn.addEventListener('click',()=>{$$('.filter-btn').forEach(x=>x.classList.remove('active'));btn.classList.add('active');active=btn.dataset.filter||'all';apply()}));search?.addEventListener('input',apply);apply();
}
async function initProduct(){
 const host=$('#productDetail');if(!host)return;const id=Number(new URLSearchParams(location.search).get('id'));let p=products.find(x=>Number(x.id)===id);try{if(id)p=await api(`/api/products/${id}`)}catch{}
 if(!p){host.innerHTML='<div class="empty-state"><h2>ไม่พบสินค้า</h2><a class="btn btn-pink" href="shop.html">กลับหน้าร้าน</a></div>';return}
 document.title=`${p.name} | Furugi SHOP`;
 const gallery=[p.image,...(p.gallery||[])].filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,8);const unavailable=p.sold||p.stock<1;
 host.innerHTML=`<div><div class="gallery-main"><img id="mainProductImage" src="${escapeHTML(gallery[0])}" alt="${escapeHTML(p.name)}"></div>${gallery.length>1?`<div class="gallery-thumbs">${gallery.map(src=>`<button type="button" data-src="${escapeHTML(src)}"><img src="${escapeHTML(src)}" alt=""></button>`).join('')}</div>`:''}</div><div class="detail-copy"><div class="kicker">古着 / ONE OF ONE / ${escapeHTML(p.tag)}</div><h1>${escapeHTML(p.name)}</h1><p class="muted">${escapeHTML(p.note)}</p><div class="detail-price">${fmt(p.price)}</div><div class="chips"><span class="chip">SKU ${escapeHTML(p.sku)}</span><span class="chip">SIZE ${escapeHTML(p.size)}</span><span class="chip">CONDITION ${escapeHTML(p.condition)}</span><span class="chip">${escapeHTML(p.gender)}</span></div><div class="detail-table"><div class="detail-row"><span>แบรนด์</span><b>${escapeHTML(p.brand)}</b></div><div class="detail-row"><span>ขนาดวัดจริง</span><b>${escapeHTML(p.measure||'-')}</b></div><div class="detail-row"><span>สภาพ</span><b>${escapeHTML(p.condition)}</b></div><div class="detail-row"><span>สต็อก</span><b>${p.sold||Number(p.stock)<1?'ขายแล้ว':`เหลือ ${Number(p.stock)} ชิ้น`}</b></div></div>${p.details?`<div class="notice">${escapeHTML(p.details).replace(/\n/g,'<br>')}</div>`:''}<div class="actions"><button class="btn btn-pink" id="addDetail" ${unavailable?'disabled':''}>${p.sold?'SOLD OUT':'ADD TO BAG →'}</button><a class="btn btn-ghost" href="shop.html">← SHOP</a></div><div class="notice">${Number(p.stock)===1?'สินค้าชิ้นนี้เหลือเพียง 1 ชิ้น':`สินค้าชิ้นนี้มีสต็อก ${Number(p.stock)} ชิ้น`} ระบบจะตัดจำนวนสต็อกตามยอดที่สั่งซื้อทันที</div></div>`;
 $('#addDetail')?.addEventListener('click',()=>addToCart(p.id));$$('.gallery-thumbs button').forEach(b=>b.addEventListener('click',()=>{$('#mainProductImage').src=b.dataset.src}));
}
function cartTotals(){const subtotal=cart.reduce((s,x)=>s+Number(x.price)*Math.max(1,Number(x.quantity||1)),0);const shipping=!subtotal||subtotal>=Number(settings.freeShippingAt||999)?0:Number(settings.shippingFee||60);return{subtotal,shipping,total:subtotal+shipping}}
function renderCart(){
 const host=$('#cartItems');if(!host)return;const t=cartTotals();
 host.innerHTML=cart.length?cart.map(x=>`<article class="cart-item"><img src="${escapeHTML(x.image)}" alt="${escapeHTML(x.name)}"><div><div class="kicker">${escapeHTML(x.sku)} · STOCK ${Number(x.stock||1)}</div><h3>${escapeHTML(x.name)}</h3><p class="muted">SIZE ${escapeHTML(x.size)}</p><div class="cart-qty"><button type="button" data-qty-minus="${x.id}" aria-label="ลดจำนวน">−</button><input type="number" min="1" max="${Number(x.stock||1)}" value="${Number(x.quantity||1)}" data-qty-input="${x.id}" aria-label="จำนวนสินค้า"><button type="button" data-qty-plus="${x.id}" aria-label="เพิ่มจำนวน">＋</button><span class="muted">เหลือ ${Number(x.stock||1)} ชิ้น</span></div><b>${fmt(Number(x.price)*Number(x.quantity||1))}</b></div><button class="btn btn-small btn-ghost remove" data-remove-cart="${x.id}">REMOVE</button></article>`).join(''):'<div class="empty-state"><h2>バッグは空です</h2><p class="muted">ตะกร้ายังว่าง ลองเลือก Furugi ชิ้นที่ใช่ก่อน</p><a class="btn btn-pink" href="shop.html">SHOP NOW →</a></div>';
 $$('[data-remove-cart]',host).forEach(b=>b.addEventListener('click',()=>removeCart(Number(b.dataset.removeCart))));
 $$('[data-qty-minus]',host).forEach(b=>b.addEventListener('click',()=>{const id=Number(b.dataset.qtyMinus),item=cart.find(x=>Number(x.id)===id);if(item)setCartQuantity(id,Number(item.quantity)-1)}));
 $$('[data-qty-plus]',host).forEach(b=>b.addEventListener('click',()=>{const id=Number(b.dataset.qtyPlus),item=cart.find(x=>Number(x.id)===id);if(item)setCartQuantity(id,Number(item.quantity)+1)}));
 $$('[data-qty-input]',host).forEach(i=>i.addEventListener('change',()=>setCartQuantity(Number(i.dataset.qtyInput),Number(i.value))));
 $$('[data-subtotal]').forEach(x=>x.textContent=fmt(t.subtotal));$$('[data-shipping]').forEach(x=>x.textContent=t.shipping?fmt(t.shipping):'FREE');$$('[data-total]').forEach(x=>x.textContent=fmt(t.total));const go=$('#goCheckout');if(go){go.classList.toggle('hidden',!cart.length)}
}
function initCheckout(){
 const form=$('#checkoutForm');if(!form)return;if(!cart.length){location.href='cart.html';return}fillCheckoutFromAccount(form);const host=$('#checkoutItems'),t=cartTotals();host.innerHTML=cart.map(x=>`<div class="summary-line"><span>${escapeHTML(x.name)} <small class="muted">SIZE ${escapeHTML(x.size)} · ×${Number(x.quantity||1)}</small></span><b>${fmt(Number(x.price)*Number(x.quantity||1))}</b></div>`).join('');$$('[data-subtotal]').forEach(x=>x.textContent=fmt(t.subtotal));$$('[data-shipping]').forEach(x=>x.textContent=t.shipping?fmt(t.shipping):'FREE');$$('[data-total]').forEach(x=>x.textContent=fmt(t.total));
 const pay=$('#paymentMethods');let options='';if(settings.enablePromptPay)options+=`<label class="radio-card"><input type="radio" name="payment" value="promptpay" required><span><b>PromptPay</b><br><small class="muted">สร้างออเดอร์ก่อน แล้วโอนและอัปโหลดสลิป</small></span></label>`;if(settings.enableBank)options+=`<label class="radio-card"><input type="radio" name="payment" value="bank" required><span><b>โอนธนาคาร</b><br><small class="muted">รับข้อมูลบัญชีหลังยืนยันออเดอร์</small></span></label>`;if(settings.enableCOD)options+=`<label class="radio-card"><input type="radio" name="payment" value="cod" required><span><b>เก็บเงินปลายทาง (COD)</b><br><small class="muted">ชำระเมื่อได้รับสินค้า</small></span></label>`;pay.innerHTML=options||'<p class="muted">ร้านยังไม่ได้เปิดช่องทางชำระเงิน กรุณาติดต่อร้าน</p>';const submitBtn=$('button[type="submit"]',form);if(!options&&submitBtn){submitBtn.disabled=true;submitBtn.textContent='PAYMENT UNAVAILABLE'};
 form.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(form);const btn=$('button[type="submit"]',form);btn.disabled=true;btn.textContent='PROCESSING...';try{const order=await authedApi('/api/orders',{method:'POST',body:JSON.stringify({items:cart.map(x=>({id:x.id,quantity:Number(x.quantity||1)})),payment:fd.get('payment'),customer:{name:fd.get('name'),phone:fd.get('phone'),email:fd.get('email'),address:fd.get('address'),subdistrict:fd.get('subdistrict'),district:fd.get('district'),province:fd.get('province'),postcode:fd.get('postcode')},note:fd.get('note')})});cart=[];saveCart();sessionStorage.setItem('furugi-last-order',JSON.stringify(order));sessionStorage.setItem(`order-phone-${order.id}`,String(fd.get('phone')||''));location.href=`order-success.html?id=${encodeURIComponent(order.id)}`}catch(err){toast(err.message);btn.disabled=false;btn.textContent='PLACE ORDER →'}})
}
function initSuccess(){const host=$('#successContent');if(!host)return;let order=null;try{order=JSON.parse(sessionStorage.getItem('furugi-last-order')||'null')}catch{}const id=new URLSearchParams(location.search).get('id');if(!order||order.id!==id){host.innerHTML=`<h2>บันทึกคำสั่งซื้อแล้ว</h2><p>เลขออเดอร์ <b>${escapeHTML(id||'-')}</b></p><a class="btn btn-pink" href="track-order.html">ติดตามออเดอร์</a>`;return}const transfer=order.paymentMethod!=='cod';host.innerHTML=`<div class="success-icon">✓</div><div class="kicker">ORDER RECEIVED</div><h1>ありがとうございます</h1><p>เราได้รับคำสั่งซื้อของคุณแล้ว</p><div class="order-number">${escapeHTML(order.id)}</div><p>ยอดรวม <b>${fmt(order.total)}</b></p>${transfer?`<div class="payment-box"><b>ขั้นตอนต่อไป</b><p>ชำระเงินผ่าน ${order.paymentMethod==='promptpay'?'PromptPay':'โอนธนาคาร'} แล้วอัปโหลดสลิปเพื่อให้ร้านตรวจสอบ</p><a class="btn btn-rose" href="payment.html?id=${encodeURIComponent(order.id)}">PAYMENT DETAILS →</a></div>`:`<div class="notice">เลือกเก็บเงินปลายทาง กรุณาเตรียมยอด ${fmt(order.total)} เมื่อได้รับพัสดุ</div>`}<div class="actions" style="justify-content:center"><a class="btn btn-ghost" href="track-order.html">TRACK ORDER</a><a class="btn btn-ghost" href="shop.html">CONTINUE SHOPPING</a></div>`}
function fileToCompressedDataURL(file,max=1400,quality=.82){return new Promise((resolve,reject)=>{if(!file||!file.type.startsWith('image/'))return reject(new Error('กรุณาเลือกรูปภาพ'));const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{let w=img.naturalWidth,h=img.naturalHeight;const scale=Math.min(1,max/Math.max(w,h));w=Math.round(w*scale);h=Math.round(h*scale);const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,w,h);URL.revokeObjectURL(url);resolve(c.toDataURL('image/webp',quality))};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'))};img.src=url})}
async function lookupOrder(id,phone){return api('/api/order-lookup',{method:'POST',body:JSON.stringify({id,phone})})}
function renderOrderCard(order,host){host.innerHTML=`<div class="panel"><div class="section-head" style="margin-bottom:18px"><div><div class="kicker">ORDER ${escapeHTML(order.id)}</div><h2 style="margin:6px 0">${statusText[order.status]||escapeHTML(order.status)}</h2></div><span class="status-pill ${escapeHTML(order.paymentStatus)}">${statusText[order.paymentStatus]||escapeHTML(order.paymentStatus)}</span></div>${order.items.map(x=>`<div class="summary-line"><span>${escapeHTML(x.name)} <small class="muted">SIZE ${escapeHTML(x.size)} · ×${Number(x.quantity||1)}</small></span><b>${fmt(Number(x.price)*Number(x.quantity||1))}</b></div>`).join('')}<div class="summary-line total"><span>TOTAL</span><span>${fmt(order.total)}</span></div>${order.trackingNumber?`<div class="notice"><b>เลขพัสดุ:</b> ${escapeHTML(order.trackingNumber)} · ${escapeHTML(order.shippingProvider||'')}</div>`:''}${order.paymentMethod!=='cod'&&order.paymentStatus==='unpaid'?`<div class="actions"><a class="btn btn-pink" href="payment.html?id=${encodeURIComponent(order.id)}">ชำระเงิน / อัปสลิป</a></div>`:''}</div>`}
function initTrack(){const form=$('#trackForm'),host=$('#trackResult');if(!form)return;form.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(form);try{const o=await lookupOrder(fd.get('id'),fd.get('phone'));renderOrderCard(o,host);sessionStorage.setItem(`order-phone-${o.id}`,String(fd.get('phone')))}catch(err){host.innerHTML=`<div class="notice">${escapeHTML(err.message)}</div>`}})}
function initPayment(){const form=$('#paymentForm'),info=$('#paymentInfo');if(!form)return;const id=new URLSearchParams(location.search).get('id')||'';$('#paymentOrderId').value=id;info.innerHTML=`<div class="payment-box"><h3>ช่องทางชำระเงิน</h3><p><b>PromptPay:</b> ${escapeHTML(settings.promptPayId||'-')}</p><p><b>ธนาคาร:</b> ${escapeHTML(settings.bankName||'-')}<br><b>ชื่อบัญชี:</b> ${escapeHTML(settings.bankAccountName||'-')}<br><b>เลขบัญชี:</b> ${escapeHTML(settings.bankAccountNumber||'-')}</p><small>กรุณาโอนยอดตามหน้าออเดอร์และอัปโหลดสลิป ร้านจะตรวจสอบจากหลังบ้าน</small></div>`;const saved=sessionStorage.getItem(`order-phone-${id}`);if(saved)$('#paymentPhone').value=saved;else if(customerAccount.authenticated&&customerAccount.customer?.phone)$('#paymentPhone').value=customerAccount.customer.phone;form.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(form),file=$('#proofFile').files[0],btn=$('button[type="submit"]',form);if(!file)return toast('กรุณาแนบสลิป');btn.disabled=true;btn.textContent='UPLOADING...';try{const proof=await fileToCompressedDataURL(file,1300,.78);await api(`/api/orders/${encodeURIComponent(fd.get('id'))}/payment-proof`,{method:'POST',body:JSON.stringify({phone:fd.get('phone'),proofImage:proof})});form.reset();toast('ส่งสลิปเรียบร้อยแล้ว');setTimeout(()=>location.href='track-order.html',900)}catch(err){toast(err.message);btn.disabled=false;btn.textContent='UPLOAD PAYMENT PROOF →'}})}
function initContact(){const form=$('#contactForm');if(!form)return;form.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(form);try{await api('/api/contact',{method:'POST',body:JSON.stringify(Object.fromEntries(fd.entries()))});form.reset();toast('ส่งข้อความถึงร้านเรียบร้อยแล้ว')}catch(err){toast(err.message)}})}

function initMix(){
 const top=$('#mixTop'),bottom=$('#mixBottom'),outer=$('#mixOuter'),preview=$('#mixPreview');if(!top||!bottom||!outer||!preview)return;
 const available=products.filter(p=>!p.sold&&p.stock>0);
 const fill=(el,list)=>{el.insertAdjacentHTML('beforeend',list.map(p=>`<option value="${p.id}">${escapeHTML(p.name)} — ${fmt(p.price)}</option>`).join(''))};
 fill(top,available.filter(p=>['tops','tees'].includes(p.category)));fill(bottom,available.filter(p=>p.category==='bottoms'));fill(outer,available.filter(p=>p.category==='outerwear'));
 const selected=()=>[top,bottom,outer].map(el=>products.find(p=>Number(p.id)===Number(el.value))).filter(Boolean);
 const draw=()=>{const list=selected();preview.innerHTML=list.length?`<div class="kicker">YOUR LOOK / コーデ</div>${list.map(p=>`<div class="cart-item" style="grid-template-columns:70px 1fr"><img src="${escapeHTML(p.image)}" style="width:70px;height:84px"><div><b>${escapeHTML(p.name)}</b><div class="muted">${escapeHTML(p.size)} · ${fmt(p.price)}</div></div></div>`).join('')}<div class="summary-line total"><span>TOTAL</span><span>${fmt(list.reduce((s,p)=>s+p.price,0))}</span></div>`:'<div class="empty-state"><h3>SELECT ITEMS</h3><p class="muted">เลือกไอเท็มจากฝั่งซ้ายเพื่อสร้างลุค</p></div>'};
 [top,bottom,outer].forEach(el=>el.addEventListener('change',draw));$('#mixAdd')?.addEventListener('click',()=>{const list=selected();if(!list.length)return toast('กรุณาเลือกสินค้า');list.forEach(p=>addToCart(p.id));draw()});draw();
}

function initPolicies(){const key=document.body.dataset.policy;if(!key)return;const map={shipping:'shippingText',returns:'returnText',privacy:'privacyText',terms:'termsText'};const host=$('#policyText');if(host)host.innerHTML=escapeHTML(settings[map[key]]||'').replace(/\n/g,'<br>')}
function initMobile(){const btn=$('#menuBtn'),links=$('.nav-links');btn?.addEventListener('click',()=>links?.classList.toggle('mobile-open'))}

document.addEventListener('DOMContentLoaded',async()=>{guardDirectFileOpen();try{await initSupabase()}catch(e){console.error(e);toast('เชื่อม Supabase ไม่สำเร็จ');return}await Promise.all([loadBase(),loadCustomerAccount()]);updateCartUI();initCustomerChrome();initMobile();initCustomerLogin();initCustomerRegister();initForgotPassword();initResetPassword();await initCustomerAccount();initHome();initShop();await initProduct();renderCart();initCheckout();initSuccess();initTrack();initPayment();initContact();initMix();initPolicies()});
