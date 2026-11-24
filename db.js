require('dotenv').config();
const { Pool } = require('pg');

const enabled = Boolean(process.env.DATABASE_URL);
const pool = enabled ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }) : null;

async function query(text, params) {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  return pool.query(text, params);
}

function required(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') throw new Error(`${label} الزامی است`);
  return String(value).trim();
}

function positiveInt(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${label} باید عدد صحیح مثبت باشد`);
  return n;
}

async function snapshot() {
  const [products, warehouses, locations, inventory, movements, orders, audit, customers, drivers, vehicles] = await Promise.all([
    query('SELECT id, sku, barcode, name, category, unit, price::float, reorder_point AS "reorderPoint", safety_stock AS "safetyStock" FROM products ORDER BY name'),
    query('SELECT id, name, city, capacity FROM warehouses ORDER BY name'),
    query('SELECT id, warehouse_id AS "warehouseId", code, hall, aisle, rack, bin, capacity, occupied, status FROM locations ORDER BY code'),
    query('SELECT id, product_id AS "productId", warehouse_id AS "warehouseId", location_id AS "locationId", quantity, reserved, batch, expiry FROM inventory ORDER BY id'),
    query(`SELECT id, number, type, product_id AS "productId", quantity, warehouse_id AS "warehouseId", location_id AS "locationId", batch, user_name AS "user", created_at AS "createdAt", status FROM movements ORDER BY created_at DESC`),
    query('SELECT id, number, customer, customer_id AS "customerId", destination, product, quantity, driver, driver_id AS "driverId", vehicle_id AS "vehicleId", source_warehouse_id AS "sourceWarehouseId", status, eta, loaded_at AS "loadedAt", dispatched_at AS "dispatchedAt", delivered_at AS "deliveredAt" FROM orders ORDER BY created_at DESC'),
    query(`SELECT id, action, entity, user_name AS "user", to_char(created_at, 'YYYY-MM-DD HH24:MI') AS time, detail FROM audit_events ORDER BY created_at DESC LIMIT 100`),
    query('SELECT id, name, phone, national_id AS "nationalId", city, address, credit_limit::float AS "creditLimit" FROM customers ORDER BY name'),
    query('SELECT id, name, phone, national_id AS "nationalId", license_number AS "licenseNumber", active FROM drivers ORDER BY name'),
    query('SELECT id, plate, type, capacity, driver_id AS "driverId", active FROM vehicles ORDER BY plate')
  ]);
  const accounting = { receivable: 485000000, payable: 172000000, revenue: 1280000000, grossProfit: 318000000 };
  return { products: products.rows, warehouses: warehouses.rows, locations: locations.rows, inventory: inventory.rows, movements: movements.rows, orders: orders.rows, audit: audit.rows, customers: customers.rows, drivers: drivers.rows, vehicles: vehicles.rows, accounting };
}

async function canAccessWarehouse(user, warehouseId) {
  if (!user || user.role === 'admin') return true;
  const result = await query('SELECT 1 FROM user_warehouses WHERE user_id=$1 AND warehouse_id=$2 LIMIT 1', [user.sub, warehouseId]);
  return result.rowCount > 0;
}

async function createJournalEntry(x, user) {
  const lines = Array.isArray(x.lines) ? x.lines : [];
  if (lines.length < 2) throw new Error('سند باید حداقل دو ردیف داشته باشد');
  const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  if (!Number.isFinite(debit) || Math.abs(debit - credit) > 0.005) throw new Error('جمع بدهکار و بستانکار باید برابر باشد');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = `je${Date.now().toString(36)}`;
    const number = `JE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    await client.query('INSERT INTO journal_entries(id,number,fiscal_period_id,description,source_type,source_id,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, number, x.fiscalPeriodId, x.description || '', x.sourceType || 'دستی', x.sourceId || null, 'قطعی', user?.username || 'system']);
    for (const line of lines) await client.query('INSERT INTO journal_lines(id,journal_entry_id,account_id,description,debit,credit) VALUES($1,$2,$3,$4,$5,$6)', [`jl${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`, id, line.accountId, line.description || '', Number(line.debit || 0), Number(line.credit || 0)]);
    await client.query('UPDATE journal_entries SET posted_at=now() WHERE id=$1', [id]);
    await client.query('COMMIT');
    return (await client.query('SELECT id,number,fiscal_period_id AS "fiscalPeriodId",description,source_type AS "sourceType",status,created_by AS "createdBy",posted_at AS "postedAt" FROM journal_entries WHERE id=$1', [id])).rows[0];
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function ledger(accountId, periodId) {
  return (await query(`SELECT je.number, je.created_at AS "createdAt", je.description, jl.description AS "lineDescription", jl.debit::float AS debit, jl.credit::float AS credit, ca.code, ca.name AS "accountName" FROM journal_lines jl JOIN journal_entries je ON je.id=jl.journal_entry_id JOIN chart_of_accounts ca ON ca.id=jl.account_id WHERE je.status='قطعی' AND jl.account_id=$1 AND ($2::text IS NULL OR je.fiscal_period_id=$2) ORDER BY je.created_at, je.number`, [accountId, periodId || null])).rows;
}

async function createMaster(type, x) {
  if (!['customer', 'driver', 'vehicle'].includes(type)) throw new Error('نوع اطلاعات پایه معتبر نیست');
  const id = `${type[0]}${Date.now().toString(36)}`;
  if (type === 'customer') return (await query('INSERT INTO customers(id,name,phone,national_id,city,address,credit_limit) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,phone,national_id AS "nationalId",city,address,credit_limit::float AS "creditLimit"',[id,required(x.name,'نام مشتری'),x.phone||'',x.nationalId||'',x.city||'',x.address||'',Number(x.creditLimit||0)])).rows[0];
  if (type === 'driver') return (await query('INSERT INTO drivers(id,name,phone,national_id,license_number) VALUES($1,$2,$3,$4,$5) RETURNING id,name,phone,national_id AS "nationalId",license_number AS "licenseNumber",active',[id,required(x.name,'نام راننده'),x.phone||'',x.nationalId||'',x.licenseNumber||''])).rows[0];
  return (await query('INSERT INTO vehicles(id,plate,type,capacity,driver_id) VALUES($1,$2,$3,$4,$5) RETURNING id,plate,type,capacity,driver_id AS "driverId",active',[id,required(x.plate,'پلاک خودرو'),x.type||'کامیون',Math.max(0,Number(x.capacity||0)),x.driverId||null])).rows[0];
}

async function createProduct(x) {
  const name=required(x.name,'نام محصول'), sku=required(x.sku,'کد کالا'), barcode=required(x.barcode,'بارکد');
  const price=Number(x.price||0), reorderPoint=Number(x.reorderPoint||0), safetyStock=Number(x.safetyStock||0);
  if (![price,reorderPoint,safetyStock].every(Number.isFinite) || price < 0 || reorderPoint < 0 || safetyStock < 0) throw new Error('مقادیر عددی محصول معتبر نیستند');
  const id = `p${Date.now().toString(36)}`;
  const result = await query(`INSERT INTO products(id, sku, barcode, name, category, unit, price, reorder_point, safety_stock) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, sku, barcode, name, category, unit, price::float, reorder_point AS "reorderPoint", safety_stock AS "safetyStock"`, [id, sku, barcode, name, x.category || '', x.unit || 'عدد', price, reorderPoint, safetyStock]);
  return result.rows[0];
}

async function createMovement(x, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const qty = positiveInt(x.quantity, 'تعداد');
    if (!['ورود خرید','خروج فروش','انتقال بین انبار'].includes(x.type)) throw new Error('نوع گردش انبار معتبر نیست');
    required(x.productId,'محصول'); required(x.warehouseId,'انبار'); required(x.locationId,'مکان');
    const inventory = await client.query('SELECT * FROM inventory WHERE product_id=$1 AND warehouse_id=$2 AND location_id=$3 AND batch=$4 FOR UPDATE', [x.productId, x.warehouseId, x.locationId, x.batch || '']);
    const current = inventory.rows[0];
    if (x.type === 'خروج فروش' && (!current || current.quantity - current.reserved < qty)) throw new Error('موجودی قابل فروش کافی نیست');
    if (current) {
      const delta = x.type === 'خروج فروش' ? -qty : qty;
      await client.query('UPDATE inventory SET quantity=quantity+$1 WHERE id=$2', [delta, current.id]);
    } else if (x.type !== 'خروج فروش') {
      await client.query('INSERT INTO inventory(id, product_id, warehouse_id, location_id, quantity, reserved, batch, expiry) VALUES($1,$2,$3,$4,$5,0,$6,$7)', [`i${Date.now().toString(36)}`, x.productId, x.warehouseId, x.locationId, qty, x.batch || '', x.expiry || null]);
    } else throw new Error('برای این مکان موجودی ثبت نشده است');
    const number = `WH-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const actor = user?.username || 'system';
    const movement = await client.query(`INSERT INTO movements(id, number, type, product_id, quantity, warehouse_id, location_id, batch, user_name, status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, number, type, product_id AS "productId", quantity, warehouse_id AS "warehouseId", location_id AS "locationId", batch, user_name AS "user", created_at AS "createdAt", status`, [`m${Date.now().toString(36)}`, number, x.type, x.productId, qty, x.warehouseId, x.locationId, x.batch || '', actor, 'پیش‌نویس']);
    await client.query('INSERT INTO audit_events(id, action, entity, user_name, detail) VALUES($1,$2,$3,$4,$5)', [`a${Date.now().toString(36)}`, `ثبت ${x.type}`, number, actor, `${qty} واحد`]);
    await client.query('COMMIT');
    return movement.rows[0];
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function createOrder(x) {
  const customer=required(x.customer,'مشتری'), destination=required(x.destination,'مقصد'), product=required(x.product,'محصول'), quantity=positiveInt(x.quantity,'تعداد');
  const id = `o${Date.now().toString(36)}`;
  const number = `SO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const result = await query('INSERT INTO orders(id, number, customer, customer_id, destination, product, quantity, driver, driver_id, vehicle_id, source_warehouse_id, status, eta) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, number, customer, customer_id AS "customerId", destination, product, quantity, driver, driver_id AS "driverId", vehicle_id AS "vehicleId", status, eta', [id, number, customer, x.customerId || null, destination, product, quantity, x.driver || '—', x.driverId || null, x.vehicleId || null, x.sourceWarehouseId || null, 'ثبت‌شده', 'در حال محاسبه']);
  return result.rows[0];
}

async function updateOrderStatus(id, status) {
  const current=(await query('SELECT status FROM orders WHERE id=$1',[id])).rows[0];
  if(!current) throw new Error('سفارش یافت نشد');
  const transitions={ 'ثبت‌شده':['تأییدشده'], 'تأییدشده':['در حال آماده‌سازی','برگشتی'], 'در حال آماده‌سازی':['بارگیری‌شده','برگشتی'], 'بارگیری‌شده':['ارسال‌شده','برگشتی'], 'ارسال‌شده':['تحویل‌شده','برگشتی'], 'تحویل‌شده':['برگشتی'], 'برگشتی':[] };
  if(!transitions[current.status]?.includes(status)) throw new Error(`انتقال سفارش از «${current.status}» به «${status}» مجاز نیست`);
  const field = { 'بارگیری‌شده':'loaded_at', 'ارسال‌شده':'dispatched_at', 'تحویل‌شده':'delivered_at' }[status];
  const result = await query(`UPDATE orders SET status=$1${field ? `, ${field}=now()` : ''} WHERE id=$2 RETURNING id, number, status, loaded_at AS "loadedAt", dispatched_at AS "dispatchedAt", delivered_at AS "deliveredAt"`, [status, id]);
  if (!result.rows[0]) throw new Error('سفارش یافت نشد');
  return result.rows[0];
}
async function reserveOrder(orderId, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order=(await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
    if(!order) throw new Error('سفارش یافت نشد');
    if(['تأییدشده','در حال آماده‌سازی','بارگیری‌شده','ارسال‌شده','تحویل‌شده'].includes(order.status)) throw new Error('این سفارش قبلاً تأیید یا رزرو شده است');
    const product=(await client.query('SELECT id FROM products WHERE name=$1',[order.product])).rows[0];
    if(!product) throw new Error('محصول سفارش یافت نشد');
    const warehouseId=order.source_warehouse_id;
    if(!warehouseId) throw new Error('انبار مبدأ سفارش مشخص نشده است');
    const rows=(await client.query('SELECT id,quantity,reserved FROM inventory WHERE product_id=$1 AND warehouse_id=$2 AND quantity>reserved ORDER BY expiry NULLS LAST, id FOR UPDATE',[product.id,warehouseId])).rows;
    let remaining=Number(order.quantity);
    for(const row of rows){ const available=row.quantity-row.reserved; const take=Math.min(available,remaining); if(take>0){ await client.query('UPDATE inventory SET reserved=reserved+$1 WHERE id=$2',[take,row.id]); await client.query('INSERT INTO order_reservations(order_id,inventory_id,quantity) VALUES($1,$2,$3)',[orderId,row.id,take]); remaining-=take; } if(!remaining) break; }
    if(remaining) throw new Error('موجودی قابل رزرو کافی نیست');
    const updated=(await client.query("UPDATE orders SET status='تأییدشده' WHERE id=$1 RETURNING id,number,status",[orderId])).rows[0];
    await client.query('INSERT INTO audit_events(id,action,entity,user_name,detail) VALUES($1,$2,$3,$4,$5)',[`a${Date.now().toString(36)}`,'رزرو موجودی',order.number,user?.username||'system',`${order.quantity} واحد ${order.product}`]);
    await client.query('COMMIT'); return updated;
  } catch(error){ await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
async function releaseOrder(orderId, user) {
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const order=(await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
    if(!order) throw new Error('سفارش یافت نشد');
    const product=(await client.query('SELECT id FROM products WHERE name=$1',[order.product])).rows[0];
    if(!product||!order.source_warehouse_id) throw new Error('اطلاعات محصول یا انبار سفارش ناقص است');
    const rows=(await client.query('SELECT r.inventory_id AS id,r.quantity FROM order_reservations r WHERE r.order_id=$1 FOR UPDATE',[orderId])).rows;
    if(!rows.length) throw new Error('برای این سفارش رزروی ثبت نشده است');
    for(const row of rows){ await client.query('UPDATE inventory SET reserved=reserved-$1 WHERE id=$2 AND reserved >= $1',[row.quantity,row.id]); }
    await client.query('DELETE FROM order_reservations WHERE order_id=$1',[orderId]);
    const updated=(await client.query("UPDATE orders SET status='ثبت‌شده' WHERE id=$1 RETURNING id,number,status",[orderId])).rows[0];
    await client.query('INSERT INTO audit_events(id,action,entity,user_name,detail) VALUES($1,$2,$3,$4,$5)',[`a${Date.now().toString(36)}`,'آزادسازی رزرو',order.number,user?.username||'system',`${order.quantity} واحد ${order.product}`]);
    await client.query('COMMIT'); return updated;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
async function createInvoice(orderId, x={}) { const order=(await query('SELECT * FROM orders WHERE id=$1',[orderId])).rows[0]; if(!order) throw new Error('سفارش یافت نشد'); const subtotal=Number(x.subtotal||0), discount=Number(x.discount||0), taxRate=Number(x.taxRate||0.1); if(![subtotal,discount,taxRate].every(Number.isFinite)||subtotal<0||discount<0||discount>subtotal||taxRate<0) throw new Error('مقادیر فاکتور معتبر نیستند'); const tax=Math.round((subtotal-discount)*taxRate), total=subtotal-discount+tax; const id=`inv${Date.now().toString(36)}`, number=`INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`; return (await query('INSERT INTO invoices(id,number,order_id,customer,subtotal,discount,tax,total,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,number,order_id AS "orderId",customer,subtotal::float,discount::float,tax::float,total::float,status,issued_at AS "issuedAt"',[id,number,orderId,order.customer,subtotal,discount,tax,total,'نهایی'])).rows[0]; }
async function invoice(orderId) { return (await query('SELECT id,number,order_id AS "orderId",customer,subtotal::float,discount::float,tax::float,total::float,status,issued_at AS "issuedAt" FROM invoices WHERE order_id=$1 ORDER BY issued_at DESC LIMIT 1',[orderId])).rows[0]; }

module.exports = { enabled, query, snapshot, canAccessWarehouse, createJournalEntry, ledger, createProduct, createMovement, createOrder, updateOrderStatus, reserveOrder, releaseOrder, createInvoice, invoice, createMaster };
