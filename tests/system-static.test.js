'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('core production files exist', () => {
  for (const file of ['app.js','admin.js','setup.js','api/index.js','styles.css','admin.css','vercel.json','package.json','supabase/READY_TO_OPEN.sql']) {
    assert.ok(fs.existsSync(path.join(root,file)), `missing ${file}`);
  }
});

test('customer/admin auth persist across tabs but use isolated storage keys', () => {
  const app = read('app.js');
  const admin = read('admin.js');
  assert.match(app, /storage:\s*window\.localStorage/);
  assert.match(app, /storageKey:\s*["']furugi-customer-auth-v1["']/);
  assert.match(admin, /storage:window\.localStorage/);
  assert.match(admin, /storageKey:'furugi-admin-auth-v1'/);
  assert.doesNotMatch(app, /forceFreshCustomerLogin/);
});

test('registration is backend-confirmed and does not call browser signUp', () => {
  const app = read('app.js');
  const api = read('api/index.js');
  assert.match(app, /api\("\/api\/customer\/register"/);
  assert.doesNotMatch(app, /auth\.signUp\(/);
  assert.match(api, /auth\.admin\.createUser\([\s\S]{0,300}email_confirm:true/);
});

test('Supabase browser SDK is pinned to exact version', () => {
  const htmlFiles = fs.readdirSync(root).filter(x => x.endsWith('.html'));
  for (const file of htmlFiles) {
    const html = read(file);
    if (html.includes('@supabase/supabase-js')) {
      assert.match(html, /@supabase\/supabase-js@2\.118\.0/, `${file} must pin Supabase SDK`);
      assert.doesNotMatch(html, /@supabase\/supabase-js@2["<]/, `${file} must not use floating @2`);
    }
  }
});

test('expired stock is released before catalog reads', () => {
  const api = read('api/index.js');
  assert.match(api, /p === '\/api\/products'[\s\S]{0,220}await expireOrders\(\)/);
  assert.match(api, /\/api\\\/products\\\/\\d\+\$[\s\S]{0,260}await expireOrders\(\)/);
});

test('order abuse protection and COD pending cap are active', () => {
  const api = read('api/index.js');
  const sql = read('supabase/READY_TO_OPEN.sql');
  assert.match(api, /consumeActionLimit\(rateKey\('order-user'/);
  assert.match(api, /consumeActionLimit\(rateKey\('order-ip'/);
  assert.match(api, /ออเดอร์ COD ที่รอยืนยันครบ 2 รายการแล้ว/);
  assert.match(sql, /consume_customer_action_attempt/);
  assert.match(sql, /cod_reserve_minutes/);
});

test('customer total spent only counts settled money', () => {
  const api = read('api/index.js');
  assert.match(api, /o\.payment_status==='paid'\|\|\(o\.payment_method==='cod'&&o\.status==='completed'\)/);
});

test('health check validates full schema/RPC/storage contract', () => {
  const api = read('api/index.js');
  const sql = read('supabase/READY_TO_OPEN.sql');
  assert.match(api, /admin\.rpc\('furugi_system_health'\)/);
  assert.match(sql, /create or replace function public\.furugi_system_health\(\)/i);
  for (const item of ['profiles','storeSettings','products','orders','orderItems','contactMessages','signupRateLimit','orderRateLimit','productImagesBucket','paymentSlipsBucket']) {
    assert.ok(sql.includes(`'${item}'`), `health check missing ${item}`);
  }
});

test('hero is optimized and old PNG is not shipped', () => {
  const webp = path.join(root, 'assets', 'furugi-hero.webp');
  const png = path.join(root, 'assets', 'furugi-hero.png');
  assert.ok(fs.existsSync(webp));
  assert.ok(fs.statSync(webp).size < 400 * 1024, 'hero WebP should be < 400 KB');
  assert.equal(fs.existsSync(png), false);
  assert.match(read('styles.css'), /furugi-hero\.webp/);
});

test('no internal HTML link/src points to a missing local file', () => {
  const htmlFiles = fs.readdirSync(root).filter(x => x.endsWith('.html'));
  const missing = [];
  const re = /(?:href|src)="([^"]+)"/g;
  for (const file of htmlFiles) {
    const html = read(file);
    for (const m of html.matchAll(re)) {
      const ref = m[1];
      if (/^(?:https?:|data:|#|mailto:|tel:|javascript:)/i.test(ref)) continue;
      const clean = ref.split(/[?#]/)[0];
      if (!clean) continue;
      if (!fs.existsSync(path.join(root, clean))) missing.push(`${file} -> ${clean}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('sensitive deployment files are excluded from Vercel static output', () => {
  const ignore = read('.vercelignore');
  for (const rule of ['supabase/','tests/','scripts/','*.md','*.txt','*.sql']) {
    assert.ok(ignore.includes(rule), `.vercelignore missing ${rule}`);
  }
});


test('existing database go-live migration is self-contained', () => {
  const sql = read('RUN_THIS_IN_SUPABASE.sql');
  for (const required of [
    'create table if not exists public.profiles',
    'consume_customer_signup_attempt',
    'consume_customer_action_attempt',
    'cod_reserve_minutes',
    'furugi_system_health'
  ]) assert.ok(sql.toLowerCase().includes(required.toLowerCase()), `RUN_THIS missing ${required}`);
});

test('production headers protect private pages', () => {
  const v = JSON.parse(read('vercel.json'));
  const raw = JSON.stringify(v);
  for (const page of ['/account.html','/cart.html','/checkout.html','/payment.html','/track-order.html','/order-success.html']) {
    assert.ok(raw.includes(page), `missing header rule ${page}`);
  }
  assert.ok(raw.includes('Content-Security-Policy'));
  assert.ok(raw.includes('Strict-Transport-Security'));
});


test('contact and payment-proof abuse protection are active', () => {
  const api = read('api/index.js');
  assert.match(api, /rateKey\('contact-user'/);
  assert.match(api, /rateKey\('contact-ip'/);
  assert.match(api, /rateKey\('proof-user'/);
  assert.match(api, /rateKey\('proof-order'/);
});

test('customer and admin logout are local-device scoped', () => {
  const app = read('app.js');
  const admin = read('admin.js');
  assert.match(app, /signOut\(\{\s*scope:\s*["']local["']\s*\}\)/);
  assert.match(admin, /signOut\(\{scope:'local'\}\)/);
});
