require('dotenv').config();
const { Pool } = require('pg');

const enabled = Boolean(process.env.DATABASE_URL);
const pool = enabled ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }) : null;

async function query(text, params) {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  return pool.query(text, params);
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

async function createMaster(type, x) {
  const id = `${type[0]}${Date.now().toString(36)}`;
  if (type === 'customer') return (await query('INSERT INTO customers(id,name,phone,national_id,city,address,credit_limit) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,phone,national_id AS "nationalId",city,address,credit_limit::float AS "creditLimit"',[id,x.name,x.phone||'',x.nationalId||'',x.city||'',x.address||'',Number(x.creditLimit||0)])).rows[0];
  if (type === 'driver') return (await query('INSERT INTO drivers(id,name,phone,national_id,license_number) VALUES($1,$2,$3,$4,$5) RETURNING id,name,phone,national_id AS "nationalId",license_number AS "licenseNumber",active',[id,x.name,x.phone||'',x.nationalId||'',x.licenseNumber||''])).rows[0];
  return (await query('INSERT INTO vehicles(id,plate,type,capacity,driver_id) VALUES($1,$2,$3,$4,$5) RETURNING id,plate,type,capacity,driver_id AS "driverId",active',[id,x.plate,x.type||'کامیون',Number(x.capacity||0),x.driverId||null])).rows[0];
}

async function createProduct(x) {
  const id = `p${Date.now().toString(36)}`;
  const result = await query(`INSERT INTO products(id, sku, barcode, name, category, unit, price, reorder_point, safety_stock) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, sku, barcode, name, category, unit, price::float, reorder_point AS "reorderPoint", safety_stock AS "safetyStock"`, [id, x.sku, x.barcode, x.name, x.category || '', x.unit || 'عدد', Number(x.price || 0), Number(x.reorderPoint || 0), Number(x.safetyStock || 0)]);
  return result.rows[0];
}

async function createMovement(x) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const qty = Number(x.quantity);
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
    const movement = await client.query(`INSERT INTO movements(id, number, type, product_id, quantity, warehouse_id, location_id, batch, user_name, status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, number, type, product_id AS "productId", quantity, warehouse_id AS "warehouseId", location_id AS "locationId", batch, user_name AS "user", created_at AS "createdAt", status`, [`m${Date.now().toString(36)}`, number, x.type, x.productId, qty, x.warehouseId, x.locationId, x.batch || '', 'کاربر فعلی', 'پیش‌نویس']);
    await client.query('INSERT INTO audit_events(id, action, entity, user_name, detail) VALUES($1,$2,$3,$4,$5)', [`a${Date.now().toString(36)}`, `ثبت ${x.type}`, number, 'کاربر فعلی', `${qty} واحد`]);
    await client.query('COMMIT');
    return movement.rows[0];
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function createOrder(x) {
  const id = `o${Date.now().toString(36)}`;
  const number = `SO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const result = await query('INSERT INTO orders(id, number, customer, customer_id, destination, product, quantity, driver, driver_id, vehicle_id, source_warehouse_id, status, eta) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, number, customer, customer_id AS "customerId", destination, product, quantity, driver, driver_id AS "driverId", vehicle_id AS "vehicleId", status, eta', [id, number, x.customer, x.customerId || null, x.destination || '', x.product || '', Number(x.quantity || 0), x.driver || '—', x.driverId || null, x.vehicleId || null, x.sourceWarehouseId || null, 'ثبت‌شده', 'در حال محاسبه']);
  return result.rows[0];
}

async function updateOrderStatus(id, status) {
  const field = { 'بارگیری‌شده':'loaded_at', 'ارسال‌شده':'dispatched_at', 'تحویل‌شده':'delivered_at' }[status];
  const result = await query(`UPDATE orders SET status=$1${field ? `, ${field}=now()` : ''} WHERE id=$2 RETURNING id, number, status, loaded_at AS "loadedAt", dispatched_at AS "dispatchedAt", delivered_at AS "deliveredAt"`, [status, id]);
  return result.rows[0];
}

module.exports = { enabled, query, snapshot, createProduct, createMovement, createOrder, updateOrderStatus, createMaster };
