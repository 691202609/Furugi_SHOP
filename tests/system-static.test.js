'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('customer/admin auth persist across tabs but use isolated storage keys', () => {
  const app = read('app.js');
  const admin = read('admin.js');
  assert.match(app, /storage:\s*window\.localStorage/);
  assert.match(app, /storageKey:\s*["']furugi-customer-auth-v1["']/);
  assert.match(admin, /storage:window\.localStorage/);
  assert.match(admin, /storageKey:'furugi-admin-auth-v1'/);
  assert.doesNotMatch(app, /storage:\s*window\.sessionStorage/);
});

test('Supabase browser SDK is pinned to exact version', () => {
  const htmlFiles = fs.readdirSync(root).filter(x => x.endsWith('.html'));
  for (const file of htmlFiles) {
    const html = read(file);
    if (html.includes('@supabase/supabase-js')) {
      assert.match(html, /@supabase\/supabase-js@2\.118\.0/,
        `${file} must pin Supabase SDK`);
      assert.doesNotMatch(html, /@supabase\/supabase-js@2["<]/,
        `${file} must not use floating @2`);
    }
  }
});

test('expired stock is released before catalog reads', () => {
  const api = read('api/index.js');
  assert.match(api, /p === '\/api\/products'[\s\S]{0,180}await expireOrders\(\)/);
  assert.match(api, /\/api\\\/products\\\/\\d\+\$[\s\S]{0,220}await expireOrders\(\)/);
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
  for (const rule of ['supabase/','tests/','scripts/','*.md','*.txt']) {
    assert.ok(ignore.includes(rule), `.vercelignore missing ${rule}`);
  }
});
