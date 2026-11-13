require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
function hash(password, salt = 'rangyar-demo-salt') { return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`; }
async function main() {
  const db = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf8'));
  const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rangyar' });
  await client.connect(); await client.query('BEGIN');
  await client.query("INSERT INTO branches(id,code,name,city) VALUES ('b-main','MAIN','دفتر و شعبه مرکزی','تهران') ON CONFLICT (id) DO NOTHING");
  await client.query("INSERT INTO organization_settings(id,legal_name,default_currency) VALUES (1,'رنگ‌یار','IRR') ON CONFLICT (id) DO NOTHING");
  await client.query("INSERT INTO fiscal_periods(id,name,starts_on,ends_on) VALUES ('fp-1405','سال مالی ۱۴۰۵','2026-03-21','2027-03-20') ON CONFLICT (id) DO NOTHING");
  for (const a of [['acc-110','110','بانک و صندوق','دارایی'],['acc-120','120','حساب‌های دریافتنی','دارایی'],['acc-210','210','حساب‌های پرداختنی','بدهی'],['acc-310','310','سرمایه','سرمایه'],['acc-410','410','فروش','درآمد'],['acc-510','510','بهای تمام‌شده کالای فروش‌رفته','هزینه']]) await client.query('INSERT INTO chart_of_accounts(id,code,name,type) VALUES($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING', a);
  for (const p of db.products) await client.query('INSERT INTO products(id,sku,barcode,name,category,unit,price,reorder_point,safety_stock) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING', [p.id,p.sku,p.barcode,p.name,p.category,p.unit,p.price,p.reorderPoint,p.safetyStock]);
  for (const w of db.warehouses) await client.query('INSERT INTO warehouses(id,name,city,capacity,branch_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING', [w.id,w.name,w.city,w.capacity,'b-main']);
  for (const l of db.locations) await client.query('INSERT INTO locations(id,warehouse_id,code,hall,aisle,rack,bin,capacity,occupied,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING', [l.id,l.warehouseId,l.code,l.hall,l.aisle,l.rack,l.bin,l.capacity,l.occupied,l.status]);
  for (const i of db.inventory) await client.query('INSERT INTO inventory(id,product_id,warehouse_id,location_id,quantity,reserved,batch,expiry) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING', [i.id,i.productId,i.warehouseId,i.locationId,i.quantity,i.reserved,i.batch,i.expiry||null]);
  await client.query("INSERT INTO users(id,username,display_name,password_hash,role,branch_id) VALUES('u-admin','admin','مدیر سیستم',$1,'admin','b-main') ON CONFLICT (username) DO NOTHING", [hash(process.env.DEMO_ADMIN_PASSWORD || 'ChangeMe123!')]);
  await client.query('COMMIT'); await client.end(); console.log('Seed data imported. Demo user: admin / ChangeMe123! (change it before production).');
}
main().catch(error => { console.error('Seed failed:', error.message); process.exit(1); });
