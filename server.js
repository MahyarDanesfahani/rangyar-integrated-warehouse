require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const postgres = require('./db');
const auth = require('./auth');

const PORT = process.env.PORT || 3000;
const dataFile = path.join(__dirname, 'data.json');
const publicDir = path.join(__dirname, 'public');

const initial = {
  products: [
    { id:'p1', sku:'CLR-001', barcode:'6260001000012', name:'رنگ اکریلیک سفید', category:'رنگ ساختمانی', unit:'سطل', price:1850000, reorderPoint:30, safetyStock:15 },
    { id:'p2', sku:'CLR-002', barcode:'6260001000029', name:'رنگ روغنی طوسی', category:'رنگ ساختمانی', unit:'سطل', price:2450000, reorderPoint:20, safetyStock:10 },
    { id:'p3', sku:'CLR-003', barcode:'6260001000036', name:'ضدزنگ قرمز', category:'پوشش صنعتی', unit:'قوطی', price:890000, reorderPoint:40, safetyStock:20 }
  ],
  warehouses: [
    { id:'w1', name:'انبار مرکزی تهران', city:'تهران', capacity:1200 },
    { id:'w2', name:'انبار شعبه اصفهان', city:'اصفهان', capacity:600 },
    { id:'w3', name:'انبار کارخانه', city:'قزوین', capacity:900 }
  ],
  locations: [
    { id:'l1', warehouseId:'w1', code:'A-01-01-01', hall:'سالن A', aisle:'01', rack:'01', bin:'01', capacity:100, occupied:76, status:'فعال' },
    { id:'l2', warehouseId:'w1', code:'A-01-01-02', hall:'سالن A', aisle:'01', rack:'01', bin:'02', capacity:100, occupied:42, status:'فعال' },
    { id:'l3', warehouseId:'w2', code:'B-02-03-01', hall:'سالن B', aisle:'02', rack:'03', bin:'01', capacity:80, occupied:18, status:'فعال' },
    { id:'l4', warehouseId:'w3', code:'Q-01-01-01', hall:'قرنطینه', aisle:'01', rack:'01', bin:'01', capacity:50, occupied:7, status:'قرنطینه' }
  ],
  inventory: [
    { id:'i1', productId:'p1', warehouseId:'w1', locationId:'l1', quantity:76, reserved:18, batch:'B-1405-08', expiry:'2027-08-22' },
    { id:'i2', productId:'p2', warehouseId:'w1', locationId:'l2', quantity:42, reserved:8, batch:'B-1405-07', expiry:'2027-07-13' },
    { id:'i3', productId:'p1', warehouseId:'w2', locationId:'l3', quantity:18, reserved:0, batch:'B-1405-08', expiry:'2027-08-22' },
    { id:'i4', productId:'p3', warehouseId:'w3', locationId:'l4', quantity:7, reserved:0, batch:'B-1405-06', expiry:'2027-06-10' }
  ],
  movements: [
    { id:'m1', number:'WH-1405-0001', type:'ورود خرید', productId:'p1', quantity:76, warehouseId:'w1', user:'علی رضایی', createdAt:'2026-11-09T08:35:00+03:30', status:'نهایی' },
    { id:'m2', number:'WH-1405-0002', type:'خروج فروش', productId:'p2', quantity:12, warehouseId:'w1', user:'سارا احمدی', createdAt:'2026-11-09T08:12:00+03:30', status:'تأییدشده' },
    { id:'m3', number:'WH-1405-0003', type:'انتقال بین انبار', productId:'p1', quantity:20, warehouseId:'w2', user:'محمد کریمی', createdAt:'2026-11-08T16:20:00+03:30', status:'در حال پردازش' }
  ],
  orders: [
    { id:'o1', number:'SO-1405-0148', customer:'شرکت سازه نوین', destination:'مشهد', product:'رنگ اکریلیک سفید', quantity:24, driver:'حسین مرادی', status:'در حال آماده‌سازی', eta:'۱ روز و ۶ ساعت' },
    { id:'o2', number:'SO-1405-0147', customer:'فروشگاه رنگ‌آرا', destination:'کرج', product:'رنگ روغنی طوسی', quantity:8, driver:'رضا اکبری', status:'ارسال‌شده', eta:'۲ ساعت' },
    { id:'o3', number:'SO-1405-0146', customer:'پروژه برج آفتاب', destination:'تهران', product:'ضدزنگ قرمز', quantity:15, driver:'—', status:'ثبت‌شده', eta:'—' }
  ],
  audit: [
    { id:'a1', action:'ثبت رسید خرید', entity:'WH-1405-0001', user:'علی رضایی', time:'امروز، ۰۸:۳۵', detail:'۷۶ سطل رنگ اکریلیک سفید' },
    { id:'a2', action:'تأیید خروج فروش', entity:'WH-1405-0002', user:'سارا احمدی', time:'امروز، ۰۸:۱۲', detail:'۱۲ سطل رنگ روغنی طوسی' },
    { id:'a3', action:'ورود کاربر', entity:'سیستم', user:'مدیر سیستم', time:'امروز، ۰۷:۵۸', detail:'ورود موفق با احراز هویت دومرحله‌ای' }
  ],
  accounting: { receivable: 485000000, payable: 172000000, revenue: 1280000000, grossProfit: 318000000 }
};

function load() { if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify(initial, null, 2)); return JSON.parse(fs.readFileSync(dataFile, 'utf8')); }
function save(db) { fs.writeFileSync(dataFile, JSON.stringify(db, null, 2)); }
function json(res, code, body) { res.writeHead(code, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'}); res.end(JSON.stringify(body)); }
function body(req) { return new Promise((resolve,reject)=>{ let s=''; req.on('data',c=>s+=c); req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}}) }); }
function id(prefix) { return prefix + crypto.randomBytes(4).toString('hex'); }
function productName(db,id) { return db.products.find(p=>p.id===id)?.name || 'نامشخص'; }

async function api(req,res) {
  const db=postgres.enabled ? null : load(), url=new URL(req.url, `http://${req.headers.host}`), p=url.pathname;
  if (req.method==='POST' && p==='/api/auth/login') { const x=await body(req); if(!postgres.enabled) return json(res,503,{error:'احراز هویت نیازمند PostgreSQL است'}); const user=await auth.login(x.username,x.password); return user ? json(res,200,user) : json(res,401,{error:'نام کاربری یا رمز عبور نادرست است'}); }
  if (req.method==='GET' && p==='/api/auth/me') return json(res,200,{authenticated:Boolean(auth.current(req)), user:auth.current(req)});
  if (postgres.enabled && req.method==='POST' && ['/api/customers','/api/drivers','/api/vehicles'].includes(p)) { const x=await body(req); const type=p.split('/').pop().slice(0,-1); return json(res,201,await postgres.createMaster(type,x)); }
  if (postgres.enabled && req.method==='PATCH' && p.startsWith('/api/orders/') && p.endsWith('/status')) { const x=await body(req); const orderId=p.split('/')[3]; if(!['ثبت‌شده','تأییدشده','در حال آماده‌سازی','بارگیری‌شده','ارسال‌شده','تحویل‌شده','برگشتی'].includes(x.status)) return json(res,400,{error:'وضعیت سفارش معتبر نیست'}); return json(res,200,await postgres.updateOrderStatus(orderId,x.status)); }
  const user=auth.current(req);
  if (auth.authRequired() && !user) return json(res,401,{error:'ورود به سامانه الزامی است'});
  if (auth.authRequired() && req.method==='POST' && p==='/api/products' && !auth.assertRole(user,['admin','warehouse_manager'])) return json(res,403,{error:'دسترسی ثبت محصول ندارید'});
  if (auth.authRequired() && req.method==='POST' && p==='/api/movements' && !auth.assertRole(user,['admin','warehouse_manager','warehouse_operator'])) return json(res,403,{error:'دسترسی ثبت سند انبار ندارید'});
  if (auth.authRequired() && req.method==='POST' && p==='/api/orders' && !auth.assertRole(user,['admin','sales'])) return json(res,403,{error:'دسترسی ثبت سفارش ندارید'});
  if (req.method==='GET' && p==='/api/bootstrap') return json(res,200,postgres.enabled ? await postgres.snapshot() : db);
  if (req.method==='POST' && p==='/api/products') { const x=await body(req); if (postgres.enabled) return json(res,201,await postgres.createProduct(x)); const item={id:id('p'),...x,price:Number(x.price||0),reorderPoint:Number(x.reorderPoint||0),safetyStock:Number(x.safetyStock||0)}; db.products.push(item); save(db); return json(res,201,item); }
  if (req.method==='POST' && p==='/api/movements') { const x=await body(req); if (postgres.enabled) return json(res,201,await postgres.createMovement(x)); const qty=Number(x.quantity); const inv=db.inventory.find(i=>i.productId===x.productId&&i.warehouseId===x.warehouseId&&i.locationId===x.locationId); if(!inv&&x.type!=='ورود خرید') return json(res,400,{error:'برای این مکان موجودی ثبت نشده است'}); if(inv && x.type==='خروج فروش' && inv.quantity-inv.reserved<qty) return json(res,400,{error:'موجودی قابل فروش کافی نیست'}); if(inv) inv.quantity += x.type==='خروج فروش' ? -qty : qty; else db.inventory.push({id:id('i'),productId:x.productId,warehouseId:x.warehouseId,locationId:x.locationId,quantity:qty,reserved:0,batch:x.batch||'بدون بچ',expiry:x.expiry||''}); const m={id:id('m'),number:`WH-1405-${String(db.movements.length+1).padStart(4,'0')}`,...x,quantity:qty,user:'کاربر فعلی',createdAt:new Date().toISOString(),status:'پیش‌نویس'}; db.movements.unshift(m); db.audit.unshift({id:id('a'),action:'ثبت '+x.type,entity:m.number,user:'کاربر فعلی',time:'همین الان',detail:`${qty} واحد ${productName(db,x.productId)}`}); save(db); return json(res,201,m); }
  if (req.method==='POST' && p==='/api/orders') { const x=await body(req); if (postgres.enabled) return json(res,201,await postgres.createOrder(x)); const item={id:id('o'),number:`SO-1405-${String(db.orders.length+149).padStart(4,'0')}`,...x,status:'ثبت‌شده',eta:'در حال محاسبه'}; db.orders.unshift(item); save(db); return json(res,201,item); }
  if (req.method==='POST' && p==='/api/scan') { const x=await body(req); const product = postgres.enabled ? (await postgres.snapshot()).products.find(item=>item.barcode===x.barcode||item.sku===x.barcode) : db.products.find(item=>item.barcode===x.barcode||item.sku===x.barcode); return product ? json(res,200,{found:true,product}) : json(res,404,{found:false,error:'بارکد در سیستم یافت نشد'}); }
  return json(res,404,{error:'مسیر یافت نشد'});
}

const server=http.createServer((req,res)=>{ if(req.url.startsWith('/api/')) return api(req,res).catch(e=>json(res,500,{error:e.message})); let file=req.url==='/'?'/index.html':req.url; file=path.join(publicDir,path.normalize(file)); if(!file.startsWith(publicDir)) return json(res,403,{error:'forbidden'}); const ext=path.extname(file), types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml'}; fs.readFile(file,(e,d)=>e?json(res,404,{error:'not found'}):(res.writeHead(200,{'Content-Type':types[ext]||'text/plain; charset=utf-8'}),res.end(d))); });
server.listen(PORT,()=>console.log(`Production Finder running at http://localhost:${PORT}`));
