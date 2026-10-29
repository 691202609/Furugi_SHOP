'use strict';
let adminMe=null, supabaseClient=null;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmt=n=>`฿${Number(n||0).toLocaleString('th-TH')}`;
const st={pending:'รอยืนยัน',confirmed:'ยืนยันแล้ว',packing:'กำลังแพ็ก',shipped:'จัดส่งแล้ว',completed:'สำเร็จ',cancelled:'ยกเลิก',unpaid:'ยังไม่ชำระ',reviewing:'กำลังตรวจสลิป',paid:'ชำระแล้ว',rejected:'สลิปไม่ผ่าน',cod:'COD'};
function toast(t){const e=$('#adminToast');if(!e)return;e.textContent=t;e.classList.add('show');clearTimeout(window.__at);window.__at=setTimeout(()=>e.classList.remove('show'),2200)}
async function apiRaw(url,opt={}){const headers={'Content-Type':'application/json',...(opt.headers||{})};let r;try{r=await fetch(url,{...opt,headers})}catch(e){throw new Error('เชื่อมต่อ Vercel API ไม่ได้ กรุณาตรวจอินเทอร์เน็ตหรือสถานะ Deploy')}let d={};try{d=await r.json()}catch{}if(!r.ok)throw Object.assign(new Error(d.error||`เกิดข้อผิดพลาด (${r.status})`),{status:r.status});return d}
async function initSupabase(){const cfg=await apiRaw('/api/config');if(!window.supabase?.createClient)throw new Error('โหลด Supabase SDK ไม่สำเร็จ');supabaseClient=window.supabase.createClient(cfg.supabaseUrl,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}
async function req(url,opt={}){const {data}=await supabaseClient.auth.getSession();const token=data?.session?.access_token||'';const headers={...(opt.headers||{})};if(token)headers.Authorization=`Bearer ${token}`;try{return await apiRaw(url,{...opt,headers})}catch(e){if(e.status===401&&document.body.dataset.adminPage!=='login'){await supabaseClient.auth.signOut().catch(()=>{});location.href='admin-login.html'}throw e}}
function badge(s){return `<span class="badge ${esc(s)}">${esc(st[s]||s)}</span>`}
function setActive(){const page=document.body.dataset.adminPage;$$('.admin-nav a').forEach(a=>a.classList.toggle('active',a.dataset.page===page))}
async function auth(){const page=document.body.dataset.adminPage;if(page==='login')return true;const {data}=await supabaseClient.auth.getSession();if(!data?.session){location.href='admin-login.html';return false}adminMe=await req('/api/admin/me');if(!adminMe.authenticated){location.href='admin-login.html';return false}$('#adminName')&&($('#adminName').textContent=adminMe.name||'Admin');return true}
function fileToData(file,max=1500,q=.8){return new Promise((resolve,reject)=>{if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))return reject(new Error('รองรับเฉพาะ JPG / PNG / WebP'));if(file.size>15*1024*1024)return reject(new Error('ไฟล์ต้นฉบับใหญ่เกิน 15MB'));const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{let w=img.naturalWidth,h=img.naturalHeight,s=Math.min(1,max/Math.max(w,h));w=Math.max(1,Math.round(w*s));h=Math.max(1,Math.round(h*s));const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,w,h);URL.revokeObjectURL(u);const data=c.toDataURL('image/webp',q);if(data.length>2_000_000)return reject(new Error('รูปยังมีขนาดใหญ่เกินไป กรุณาใช้รูปที่เล็กลง'));resolve(data)};img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('อ่านรูปไม่สำเร็จ'))};img.src=u})}
async function uploadDataImages(images,onProgress){const unique=[...new Set(images.filter(x=>String(x).startsWith('data:image/')))];const result=new Map();if(!unique.length)return result;for(let i=0;i<unique.length;i++){if(onProgress)onProgress(i+1,unique.length);const d=await req('/api/admin/uploads',{method:'POST',body:JSON.stringify({images:[unique[i]]})});const url=d&&Array.isArray(d.urls)?d.urls[0]:'';if(!url)throw new Error(`อัปโหลดรูปที่ ${i+1} ไม่สำเร็จ`);result.set(unique[i],url)}return result}

function initLogin(){const f=$('#adminLoginForm');if(!f)return;f.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(f),btn=$('button[type=submit]',f);btn.disabled=true;btn.textContent='SIGNING IN...';try{const {error}=await supabaseClient.auth.signInWithPassword({email:String(fd.get('email')||'').trim(),password:String(fd.get('password')||'')});if(error)throw new Error(error.message==='Invalid login credentials'?'อีเมลหรือรหัสผ่านไม่ถูกต้อง':error.message);await req('/api/admin/me');location.href='admin-dashboard.html'}catch(err){await supabaseClient.auth.signOut().catch(()=>{});toast(err.message);btn.disabled=false;btn.textContent='LOGIN →'}})}
async function initDashboard(){if(document.body.dataset.adminPage!=='dashboard')return;const d=await req('/api/admin/dashboard');const fields={statProducts:d.products,statAvailable:d.available,statOrders:d.orders,statCustomers:d.customers,statPending:d.pending,statReviewing:d.reviewing,statRevenue:fmt(d.revenue)};for(const[k,v]of Object.entries(fields))$('#'+k)&&($('#'+k).textContent=v);const rb=$('#readyBadge'),rt=$('#readyText'),rc=$('#readyChecks');if(rb){rb.className='badge '+(d.ready?'available':'pending');rb.textContent=d.ready?'READY':'ACTION NEEDED'}if(rt)rt.textContent=d.ready?'ระบบหลักพร้อมเปิดขาย — ตรวจข้อมูลจริงอีกครั้งก่อนประกาศ URL':'ทำรายการด้านล่างให้ครบก่อนเปิดรับออเดอร์จริง';if(rc){const labels={realProducts:'มีสินค้าอย่างน้อย 1 ชิ้นพร้อมขาย',contact:'ตั้งค่าเบอร์ติดต่อร้าน',payment:'มีช่องทางชำระเงินที่พร้อมใช้งาน',policies:'มีนโยบายจัดส่ง/คืน/Privacy/Terms'};rc.innerHTML=Object.entries(d.readyChecks||{}).map(([k,v])=>`<div class="notice" style="margin:0;border-color:${v?'#9de1b9':'#ffd58c'}">${v?'✓':'!'} ${labels[k]||k}</div>`).join('')}const tbody=$('#latestOrders');if(tbody)tbody.innerHTML=d.latest.length?d.latest.map(o=>`<tr><td><a href="admin-order-detail.html?id=${encodeURIComponent(o.id)}"><b>${esc(o.id)}</b></a></td><td>${new Date(o.created_at).toLocaleString('th-TH')}</td><td>${esc(o.customer_name)}</td><td>${badge(o.status)}</td><td>${badge(o.payment_status)}</td><td>${fmt(o.total)}</td></tr>`).join(''):'<tr><td colspan="6">ยังไม่มีออเดอร์</td></tr>'}
async function initProducts(){if(document.body.dataset.adminPage!=='products')return;const list=await req('/api/admin/products');const body=$('#productRows');body.innerHTML=list.length?list.map(p=>`<tr><td><img class="thumb" src="${esc(p.image)}"></td><td><b>${esc(p.name)}</b><br><span class="muted">${esc(p.sku)}</span></td><td>${esc(p.category)}</td><td>${esc(p.size)}</td><td>${fmt(p.price)}</td><td><b>${Number(p.stock||0).toLocaleString('th-TH')}</b></td><td>${p.sold||Number(p.stock)<1?'<span class="badge sold">SOLD</span>':'<span class="badge available">AVAILABLE</span>'}</td><td><div class="actions"><a class="btn btn-small" href="admin-product-edit.html?id=${p.id}">EDIT</a><button class="btn btn-small btn-danger" data-delete="${p.id}">DELETE</button></div></td></tr>`).join(''):'<tr><td colspan="8">ยังไม่มีสินค้า — กด ADD PRODUCT เพื่อเพิ่มสินค้าจริงชิ้นแรก</td></tr>';$$('[data-delete]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('ยืนยันลบสินค้านี้ออกจากหน้าร้าน?\n\nประวัติออเดอร์เก่าจะยังอยู่ แต่สินค้าจะถูกลบจาก Products ทันที'))return;const oldText=b.textContent;b.disabled=true;b.textContent='DELETING...';try{const d=await req(`/api/admin/products/${b.dataset.delete}`,{method:'DELETE'});toast(d.hadOrderHistory?'ลบสินค้าแล้ว (เก็บประวัติออเดอร์ไว้)':'ลบสินค้าแล้ว');await initProducts()}catch(e){toast(e.message);b.disabled=false;b.textContent=oldText}}))}
async function initProductForm(){
  const page=document.body.dataset.adminPage;if(!['product-new','product-edit'].includes(page))return;
  const form=$('#productForm'),id=new URLSearchParams(location.search).get('id'),placeholder='assets/upload-placeholder.svg';
  let old=null,dragIndex=null,media={main:placeholder,gallery:[]};
  const saveStatus=$('#saveStatus');
  const setSaveStatus=(kind,text)=>{if(!saveStatus)return;saveStatus.hidden=false;saveStatus.className=`save-status ${kind||''}`;saveStatus.textContent=text||'';saveStatus.scrollIntoView({behavior:'smooth',block:'nearest'})};
  const clearSaveStatus=()=>{if(saveStatus){saveStatus.hidden=true;saveStatus.textContent='';saveStatus.className='save-status'}};

  if(page==='product-edit'){
    try{old=await req(`/api/admin/products/${id}`)}catch(e){toast(e.message);return}
    for(const[name,val]of Object.entries({sku:old.sku,name:old.name,category:old.category,price:old.price,stock:old.stock,tag:old.tag,size:old.size,condition:old.condition,brand:old.brand,gender:old.gender,measure:old.measure,note:old.note,details:old.details})){
      const el=form.elements[name];if(el)el.value=val??'';
    }
    form.elements.featured.checked=!!old.featured;form.elements.sold.checked=!!old.sold;
    media.main=old.image||placeholder;media.gallery=(old.gallery||[]).filter(Boolean).slice(0,7);
  }

  const isPlaceholder=src=>!src||/^assets\/upload-placeholder\.svg$/i.test(String(src));
  const mediaTotal=()=> (isPlaceholder(media.main)?0:1)+media.gallery.length;
  const updateLive=()=>{
    const fd=new FormData(form),price=Number(fd.get('price')||0);
    $('#livePreviewImage').src=media.main||placeholder;
    $('#livePreviewName').textContent=fd.get('name')||'ชื่อสินค้า';
    $('#livePreviewTag').textContent=fd.get('sold')==='on'?'SOLD OUT':(fd.get('tag')||'ONE OF ONE');
    $('#livePreviewSize').textContent=`SIZE ${fd.get('size')||'FREE'}`;
    $('#livePreviewCondition').textContent=`CONDITION ${fd.get('condition')||'-'}`;
    $('#livePreviewPrice').textContent=fmt(price);
    const stock=Math.max(0,Number(fd.get('stock')||0));
    const stockEl=$('#livePreviewStock');if(stockEl)stockEl.textContent=stock>0?`STOCK ${stock}`:'SOLD OUT';
  };
  const bindGalleryActions=()=>{
    $$('.gallery-card').forEach(card=>{
      card.addEventListener('dragstart',()=>{dragIndex=Number(card.dataset.index);card.classList.add('dragging')});
      card.addEventListener('dragend',()=>{dragIndex=null;card.classList.remove('dragging')});
      card.addEventListener('dragover',e=>e.preventDefault());
      card.addEventListener('drop',e=>{e.preventDefault();const to=Number(card.dataset.index);if(dragIndex===null||dragIndex===to)return;const [moved]=media.gallery.splice(dragIndex,1);media.gallery.splice(to,0,moved);renderMedia()});
    });
    $$('[data-main-media]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.mainMedia),chosen=media.gallery[i];if(!chosen)return;media.gallery.splice(i,1);if(media.main&&!isPlaceholder(media.main)&&!media.gallery.includes(media.main))media.gallery.unshift(media.main);media.gallery=media.gallery.slice(0,7);media.main=chosen;renderMedia()}));
    $$('[data-remove-media]').forEach(b=>b.addEventListener('click',()=>{media.gallery.splice(Number(b.dataset.removeMedia),1);renderMedia()}));
  };
  const renderMedia=()=>{
    $('#imagePreview').src=media.main||placeholder;
    $('#mediaCount').textContent=`${mediaTotal()} / 8 IMAGES`;
    $('#galleryGrid').innerHTML=media.gallery.map((src,i)=>`<article class="gallery-card" draggable="true" data-index="${i}"><span class="gallery-order">#${i+2}</span><img src="${esc(src)}" alt="Gallery ${i+1}"><div class="gallery-card-footer"><button type="button" data-main-media="${i}">ตั้งเป็นปก</button><button type="button" class="remove-media" data-remove-media="${i}">ลบ</button></div></article>`).join('');
    bindGalleryActions();updateLive();
  };
  const addFiles=async(files,asMain=false)=>{
    const imgs=[...files].filter(f=>['image/jpeg','image/png','image/webp'].includes(f.type));
    if(!imgs.length)return toast('รองรับเฉพาะ JPG / PNG / WebP');
    try{
      let filesLeft=imgs;
      if(asMain&&filesLeft.length){
        const data=await fileToData(filesLeft[0],1600,.82);
        if(media.main&&!isPlaceholder(media.main)&&!media.gallery.includes(media.main)&&media.gallery.length<7)media.gallery.unshift(media.main);
        media.main=data;filesLeft=filesLeft.slice(1);
      }
      for(const file of filesLeft){
        if(mediaTotal()>=8){toast('เพิ่มรูปได้สูงสุด 8 รูปรวมรูปปก');break}
        media.gallery.push(await fileToData(file,1400,.78));
      }
      media.gallery=media.gallery.slice(0,7);renderMedia();
    }catch(err){toast(err.message)}
  };
  const setupDrop=(dropSel,inputSel,asMain)=>{
    const drop=$(dropSel),input=$(inputSel);if(!drop||!input)return;
    const choose=()=>input.click();drop.addEventListener('click',choose);drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}});
    input.addEventListener('change',async()=>{await addFiles(input.files,asMain);input.value='' });
    for(const ev of ['dragenter','dragover'])drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragover')});
    for(const ev of ['dragleave','drop'])drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragover')});
    drop.addEventListener('drop',async e=>{await addFiles(e.dataTransfer.files,asMain)});
  };
  setupDrop('#mainDropzone','#productImage',true);setupDrop('#galleryDropzone','#galleryImageInput',false);
  $('#addImageUrl')?.addEventListener('click',()=>{
    const input=$('#imageUrlInput'),url=String(input.value||'').trim();if(!/^https?:\/\//i.test(url))return toast('กรุณาใส่ URL รูปแบบ https://...');
    if(isPlaceholder(media.main))media.main=url;else if(mediaTotal()<8&&!media.gallery.includes(url)&&media.main!==url)media.gallery.push(url);else return toast('เพิ่มรูปได้สูงสุด 8 รูปหรือรูปนี้มีอยู่แล้ว');
    input.value='';renderMedia();
  });
  $('#clearGallery')?.addEventListener('click',()=>{if(media.gallery.length&&confirm('ล้างรูป Gallery ทั้งหมด?')){media.gallery=[];renderMedia()}});
  const stockInput=form.elements.stock,soldInput=form.elements.sold;
  if(stockInput&&soldInput){
    soldInput.addEventListener('change',()=>{if(soldInput.checked)stockInput.value='0';else if(Number(stockInput.value)<1)stockInput.value='1';updateLive()});
    stockInput.addEventListener('input',()=>{const qty=Math.max(0,Math.floor(Number(stockInput.value)||0));if(qty===0)soldInput.checked=true;else if(soldInput.checked)soldInput.checked=false});
  }
  form.addEventListener('input',updateLive);form.addEventListener('change',updateLive);renderMedia();

  form.addEventListener('submit',async e=>{
    e.preventDefault();clearSaveStatus();
    if(!form.checkValidity()){form.reportValidity();setSaveStatus('error','กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบก่อนบันทึก');return}
    if(isPlaceholder(media.main)){setSaveStatus('error','กรุณาอัปโหลดรูปสินค้าจริงอย่างน้อย 1 รูป');return toast('กรุณาอัปโหลดรูปสินค้าจริงอย่างน้อย 1 รูป')}
    const buttons=$$('button[type="submit"][form="productForm"], #productForm button[type="submit"]');buttons.forEach(b=>{b.disabled=true;b.dataset.label=b.textContent;b.textContent='SAVING...'});
    try{
      setSaveStatus('working','กำลังเตรียมรูปสินค้า...');
      const mapping=await uploadDataImages([media.main,...media.gallery],(i,total)=>setSaveStatus('working',`กำลังอัปโหลดรูป ${i}/${total} ...`));
      const image=mapping.get(media.main)||media.main,gallery=media.gallery.map(x=>mapping.get(x)||x);
      const fd=new FormData(form),stock=Math.max(0,Math.min(9999,Math.floor(Number(fd.get('stock'))||0))),payload={sku:String(fd.get('sku')||'').trim(),name:String(fd.get('name')||'').trim(),category:fd.get('category'),price:Number(fd.get('price')),tag:fd.get('tag'),size:fd.get('size'),condition:fd.get('condition'),brand:fd.get('brand'),gender:fd.get('gender'),measure:fd.get('measure'),note:fd.get('note'),details:fd.get('details'),image,gallery,featured:fd.get('featured')==='on',sold:fd.get('sold')==='on'||stock<1,stock};
      setSaveStatus('working','อัปโหลดรูปสำเร็จ กำลังบันทึกข้อมูลสินค้า...');
      await req(page==='product-edit'?`/api/admin/products/${id}`:'/api/admin/products',{method:page==='product-edit'?'PUT':'POST',body:JSON.stringify(payload)});
      setSaveStatus('success','✓ บันทึกสินค้าเรียบร้อย กำลังกลับไปหน้ารายการสินค้า...');toast('บันทึกสินค้าและรูปภาพแล้ว');setTimeout(()=>location.href='admin-products.html',900);
    }catch(err){setSaveStatus('error',`บันทึกไม่สำเร็จ: ${err.message}`);toast(err.message);buttons.forEach(b=>{b.disabled=false;b.textContent=b.dataset.label||'SAVE PRODUCT →'})}
  });
}
async function initOrders(){if(document.body.dataset.adminPage!=='orders')return;const list=await req('/api/admin/orders');const body=$('#orderRows');body.innerHTML=list.length?list.map(o=>`<tr><td><a href="admin-order-detail.html?id=${encodeURIComponent(o.id)}"><b>${esc(o.id)}</b></a></td><td>${new Date(o.created_at).toLocaleString('th-TH')}</td><td>${esc(o.customer_name)}<br><span class="muted">${esc(o.customer_phone)}</span></td><td>${fmt(o.total)}</td><td>${badge(o.status)}</td><td>${badge(o.payment_status)}</td><td>${esc(o.tracking_number||'-')}</td><td><a class="btn btn-small" href="admin-order-detail.html?id=${encodeURIComponent(o.id)}">OPEN</a></td></tr>`).join(''):'<tr><td colspan="8">ยังไม่มีออเดอร์</td></tr>'}
async function initCustomers(){if(document.body.dataset.adminPage!=='customers')return;const list=await req('/api/admin/customers');const body=$('#customerRows');body.innerHTML=list.length?list.map(c=>`<tr><td><b>${esc(c.name)}</b><br><span class="muted">${esc(c.email)}</span></td><td>${esc(c.phone||'-')}</td><td>${esc(c.province||'-')}</td><td>${Number(c.order_count||0).toLocaleString('th-TH')}</td><td>${fmt(c.total_spent)}</td><td>${new Date(c.created_at).toLocaleDateString('th-TH')}</td></tr>`).join(''):'<tr><td colspan="6">ยังไม่มีสมาชิก</td></tr>'}
async function initOrderDetail(){if(document.body.dataset.adminPage!=='order-detail')return;const id=new URLSearchParams(location.search).get('id');const o=await req(`/api/admin/orders/${encodeURIComponent(id)}`);$('#orderId').textContent=o.id;$('#orderDate').textContent=new Date(o.createdAt).toLocaleString('th-TH');$('#orderCustomer').innerHTML=`<b>${esc(o.customer.name)}</b><br>${esc(o.customer.phone)}<br>${esc(o.customer.email||'-')}<br><br>${esc(o.customer.address)}<br>${esc(o.customer.subdistrict)} ${esc(o.customer.district)} ${esc(o.customer.province)} ${esc(o.customer.postcode)}`;$('#orderItems').innerHTML=o.items.map(x=>`<div class="order-item"><img src="${esc(x.image)}"><div><b>${esc(x.name)}</b><br><span class="muted">${esc(x.sku)} · SIZE ${esc(x.size)} · ×${Number(x.quantity||1)}</span></div><b>${fmt(Number(x.price)*Number(x.quantity||1))}</b></div>`).join('')+`<div class="split-head" style="margin-top:14px"><b>TOTAL</b><b>${fmt(o.total)}</b></div>`;const form=$('#orderUpdateForm');form.elements.status.value=o.status;form.elements.paymentStatus.value=o.paymentStatus;form.elements.trackingNumber.value=o.trackingNumber||'';form.elements.shippingProvider.value=o.shippingProvider||'';form.elements.adminNote.value=o.adminNote||'';$('#customerNote').textContent=o.note||'-';const proof=$('#paymentProof');if(o.paymentProof){proof.src=o.paymentProof;proof.classList.remove('hidden')}else{$('#noProof').classList.remove('hidden')}form.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(form);try{await req(`/api/admin/orders/${encodeURIComponent(o.id)}`,{method:'PUT',body:JSON.stringify(Object.fromEntries(fd.entries()))});toast('อัปเดตออเดอร์แล้ว');setTimeout(()=>location.reload(),500)}catch(err){toast(err.message)}})}
async function initPayments(){if(document.body.dataset.adminPage!=='payments')return;const list=await req('/api/admin/orders?payment=reviewing');const host=$('#paymentQueue');host.innerHTML=list.length?list.map(o=>`<div class="panel"><div class="split-head"><div><b>${esc(o.id)}</b><div class="muted">${esc(o.customer_name)} · ${fmt(o.total)}</div></div>${badge(o.payment_status)}</div><a class="btn btn-pink" href="admin-order-detail.html?id=${encodeURIComponent(o.id)}">ตรวจสลิป →</a></div>`).join(''):'<div class="panel"><h3>ไม่มีสลิปรอตรวจ</h3></div>'}
async function initMessages(){if(document.body.dataset.adminPage!=='messages')return;const list=await req('/api/admin/messages');const host=$('#messageList');host.innerHTML=list.length?list.map(m=>`<div class="panel"><div class="split-head"><div><b>${esc(m.name)}</b> ${badge(m.status)}<div class="muted">${new Date(m.created_at).toLocaleString('th-TH')} · ${esc(m.phone||'-')} · ${esc(m.email||'-')}</div></div><div class="actions"><button class="btn btn-small" data-read="${m.id}">READ</button><button class="btn btn-small btn-danger" data-delmsg="${m.id}">DELETE</button></div></div><p>${esc(m.message).replace(/\n/g,'<br>')}</p></div>`).join(''):'<div class="panel">ยังไม่มีข้อความ</div>';$$('[data-read]').forEach(b=>b.addEventListener('click',async()=>{await req(`/api/admin/messages/${b.dataset.read}`,{method:'PUT',body:JSON.stringify({status:'read'})});initMessages()}));$$('[data-delmsg]').forEach(b=>b.addEventListener('click',async()=>{if(confirm('ลบข้อความนี้?')){await req(`/api/admin/messages/${b.dataset.delmsg}`,{method:'DELETE'});initMessages()}}))}
async function initSettings(){if(document.body.dataset.adminPage!=='settings')return;const s=await req('/api/admin/settings'),f=$('#settingsForm');for(const[k,v]of Object.entries(s)){const el=f.elements[k];if(!el)continue;if(el.type==='checkbox')el.checked=!!v;else el.value=v??''}f.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(f),payload={};for(const el of f.elements){if(!el.name)continue;payload[el.name]=el.type==='checkbox'?el.checked:el.value}try{await req('/api/admin/settings',{method:'PUT',body:JSON.stringify(payload)});toast('บันทึกการตั้งค่าร้านแล้ว')}catch(err){toast(err.message)}})}
function initSecurity(){if(document.body.dataset.adminPage!=='security')return;if(new URLSearchParams(location.search).get('first'))$('#firstLoginNotice')?.classList.remove('hidden');const f=$('#passwordForm');f.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(f);if(fd.get('newPassword')!==fd.get('confirmPassword'))return toast('ยืนยันรหัสผ่านไม่ตรงกัน');try{await req('/api/admin/change-password',{method:'POST',body:JSON.stringify({currentPassword:fd.get('currentPassword'),newPassword:fd.get('newPassword')})});toast('เปลี่ยนรหัสผ่านสำเร็จ');setTimeout(()=>location.href='admin-dashboard.html',700)}catch(err){toast(err.message)}})}
function initBackup(){if(document.body.dataset.adminPage!=='backup')return;$('#downloadBackup')?.addEventListener('click',async()=>{try{const d=await req('/api/admin/backup');const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`furugi-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast('ดาวน์โหลด Backup แล้ว')}catch(err){toast(err.message)}})}
function initChrome(){$('#adminMenu')?.addEventListener('click',()=>$('.admin-side')?.classList.toggle('open'));$('#logoutBtn')?.addEventListener('click',async()=>{try{await supabaseClient.auth.signOut()}catch{}location.href='admin-login.html'})}

document.addEventListener('DOMContentLoaded',async()=>{try{await initSupabase();initLogin();if(!(await auth()))return;setActive();initChrome();await initDashboard();await initProducts();await initProductForm();await initOrders();await initCustomers();await initOrderDetail();await initPayments();await initMessages();await initSettings();initSecurity();initBackup()}catch(err){console.error(err);toast(err.message||'โหลดหลังบ้านไม่สำเร็จ');const s=$('#saveStatus');if(s){s.hidden=false;s.className='save-status error';s.textContent=err.message||'โหลดหลังบ้านไม่สำเร็จ'}}});
