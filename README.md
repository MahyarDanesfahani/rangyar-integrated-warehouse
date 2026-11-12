# RangYar — Integrated Warehouse & Operations Platform

RangYar is a Persian-first, RTL web application for managing multi-warehouse inventory, barcode operations, sales orders, delivery workflows, accounting indicators, and audit history for a large paint manufacturer.

> Current status: **working MVP**. The current release is designed to validate the operational workflow and user interface. Production deployment still requires a real database, authentication, integrations, and hardening.

## Repository name

Recommended repository name:

```text
rangyar-integrated-warehouse
```

Other good alternatives:

- `paint-warehouse-management`
- `rangyar-erp`
- `multi-warehouse-operations`

## Current MVP capabilities

- Persian RTL dashboard for management and operations
- Product catalog with SKU, barcode, category, unit, price, and reorder point
- Multiple warehouses and hierarchical storage locations
- Live inventory view with reserved and sellable quantities
- Warehouse documents for purchase receipts, sales issues, and transfers
- Validation that prevents issuing more sellable stock than available
- Barcode lookup API supporting barcode and SKU scans
- Sales order registration with customer, destination, driver, and delivery ETA fields
- Basic accounting dashboard for revenue, gross profit, receivables, and payables
- Operational reports for warehouse status, reorder warnings, and delivery indicators
- Append-oriented audit log for important operations
- JSON persistence for local development and demo purposes

## Technology

- Node.js 18+
- Native Node.js HTTP server
- Vanilla JavaScript frontend
- HTML and CSS with responsive RTL layout
- JSON file persistence in `data.json`
- No external runtime dependencies in the current MVP

## Database foundation

The project now includes a PostgreSQL schema and migration/seed scripts for the next implementation stage. The current UI server still uses `data.json` until the database connection credentials are configured and the API repository layer is switched on.

```powershell
Copy-Item .env.example .env
# Edit DATABASE_URL with the PostgreSQL username and password configured on your machine.
npm run db:migrate
npm run db:seed
```

The database migration creates tables for products, warehouses, locations, inventory, movement documents, orders, and audit events. The seed command imports the current demo data idempotently.

## Run locally

```powershell
git clone https://github.com/<your-username>/rangyar-integrated-warehouse.git
cd rangyar-integrated-warehouse
npm start
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

For development with automatic server restart:

```powershell
npm run dev
```

## Project structure

```text
.
├── public/
│   ├── app.js          # Frontend views, forms, API calls, and dashboard UI
│   ├── index.html      # RTL application shell
│   └── styles.css      # Responsive visual design
├── data.json           # Local demo data store, generated on first run
├── package.json        # Run scripts and project metadata
├── server.js           # HTTP server, API routes, and persistence layer
└── README.md
```

## API endpoints currently available

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/bootstrap` | Load products, warehouses, locations, inventory, orders, accounting, and audit data |
| `POST` | `/api/products` | Create a product |
| `POST` | `/api/movements` | Create an inventory movement |
| `POST` | `/api/orders` | Create a sales order |
| `POST` | `/api/scan` | Find a product by barcode or SKU |

Example barcode request:

```powershell
Invoke-RestMethod http://localhost:3000/api/scan `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"barcode":"6260001000012"}'
```

## Product and warehouse model

The current data model already separates the main operational concepts:

- Product and barcode
- Warehouse
- Storage location: hall, aisle, rack, and bin
- Inventory balance: quantity, reserved quantity, batch, and expiry
- Warehouse movement document
- Sales order and delivery information
- Accounting summary
- Audit event

All stock mutations should continue to happen through movement documents. Direct inventory editing should not be introduced in future versions.

## Product roadmap

### Phase 1 — Operational warehouse core

Goal: make inventory trustworthy and traceable across every warehouse.

- Replace JSON persistence with PostgreSQL
- Add database transactions and row-level stock locking
- Add user authentication and role-based permissions
- Add warehouse-level access restrictions
- Add product batches, expiry rules, FEFO/FIFO selection, quarantine, and returns
- Add stock reservations and cycle-count approval workflows
- Add barcode label printing and USB/Bluetooth/mobile scanner support
- Add offline mobile capture with conflict-safe synchronization
- Add database migrations, seed data, backups, and restore procedures

### Phase 2 — Sales, purchasing, and logistics

Goal: connect commercial documents to physical movement and delivery.

- Add purchase orders, sales orders, quotations, invoices, returns, and credit notes
- Add customers, suppliers, drivers, vehicles, routes, and delivery addresses
- Add picking, packing, loading, dispatch, delivery, and proof-of-delivery states
- Add shipment documents with full source, destination, customer, driver, vehicle, and timestamps
- Calculate ETA from route, loading time, and optional map-service integration
- Add document approvals between sales, warehouse, and finance
- Add PDF/Excel export for invoices, shipping documents, and warehouse reports

### Phase 3 — Integrated accounting

Goal: make every approved commercial and warehouse document financially consistent.

- Add chart of accounts and fiscal periods
- Add journal entries, general ledger, receivables, payables, receipts, and payments
- Calculate inventory valuation and product cost using the selected costing method
- Calculate gross profit by product, customer, city, warehouse, and period
- Add tax configuration and local accounting requirements
- Add reconciliation between warehouse stock, inventory valuation, and accounting ledger
- Add an integration adapter for the company’s accounting system or expose a stable API

### Phase 4 — Analytics and optimization

Goal: turn operational history into purchasing, stocking, and commercial decisions.

- Add sales and demand trends by product, month, city, and customer
- Detect fast-moving, slow-moving, dormant, and near-expiry products
- Calculate reorder point, safety stock, and purchase recommendations
- Add demand forecasting with confidence indicators
- Optimize storage placement based on capacity, movement frequency, and product constraints
- Track warehouse productivity, picking time, delivery performance, and driver KPIs
- Add scheduled reports and management alerts

### Phase 5 — Production readiness

Goal: operate securely and reliably across the company.

- Containerized deployment with separate web, API, database, and worker services
- HTTPS, secret management, rate limits, structured logging, and monitoring
- Automated tests and CI/CD pipeline
- Database backup verification and disaster-recovery drills
- Audit-log retention and tamper-evident storage
- Load testing for concurrent warehouses, scanners, and reporting users
- User training, operational runbooks, and staged rollout per warehouse

## Security and audit requirements

The production version must include:

- Role-based access for administrators, warehouse staff, sales, purchasing, finance, drivers, auditors, and managers
- Multi-step approval for stock adjustments, document cancellation, pricing, and payments
- Immutable business-document history using reversal or correction documents instead of deletion
- User, device, timestamp, before-value, and after-value audit details
- Two-factor authentication for sensitive roles
- Encryption in transit and secure handling of personal, financial, and driver information
- Warehouse and branch data isolation
- Backup, restore, and retention policies

## Testing strategy

The implementation should progressively cover:

- Unit tests for stock calculations, reservations, costing, reorder points, and ETA logic
- Integration tests for movement transactions and concurrent stock updates
- API tests for products, scans, orders, movements, and approvals
- End-to-end tests for receive, put-away, pick, transfer, dispatch, delivery, return, and reconciliation flows
- Permission tests for every role and warehouse boundary
- Regression tests for barcode duplicates, expired items, quarantined items, negative stock, and failed synchronization
- Performance tests for large inventories and concurrent scanner activity

## Contribution workflow

1. Create a feature branch from `main`.
2. Keep business operations in API/service code and UI concerns in `public/`.
3. Do not edit inventory balances directly; add a movement or correction document.
4. Add or update tests for every business-rule change.
5. Use clear conventional commit messages.
6. Open a pull request with screenshots for UI changes and a short verification checklist.

## Initial commit and push

After creating the GitHub repository, use:

```powershell
git init
git add README.md package.json server.js public data.json
git commit -m "feat: bootstrap integrated warehouse operations MVP"
git branch -M main
git remote add origin https://github.com/<your-username>/rangyar-integrated-warehouse.git
git push -u origin main
```

If this folder already has the correct Git history, do not run `git init`; use only `git add`, `git commit`, `git branch`, `git remote`, and `git push` as needed.

## License

Choose a license before making the repository public. For a private company product, keep the repository private unless the company explicitly approves an open-source license.

---

# رنگ‌یار — سامانه یکپارچه انبار و عملیات

رنگ‌یار یک سامانه وب فارسی و راست‌به‌چپ برای مدیریت موجودی چند انبار، عملیات بارکد، فروش، حمل، شاخص‌های حسابداری و تاریخچه حسابرسی یک شرکت بزرگ تولیدکننده رنگ است.

> وضعیت فعلی: **MVP قابل اجرا**. نسخه فعلی برای اعتبارسنجی فرآیندهای عملیاتی و رابط کاربری ساخته شده است. برای استفاده عملیاتی باید پایگاه‌داده واقعی، احراز هویت، اتصال‌های بیرونی و سخت‌سازی امنیتی اضافه شود.

## نام پیشنهادی ریپازیتوری

نام پیشنهادی:

```text
rangyar-integrated-warehouse
```

گزینه‌های جایگزین:

- `paint-warehouse-management`
- `rangyar-erp`
- `multi-warehouse-operations`

## قابلیت‌های فعلی MVP

- داشبورد مدیریتی فارسی و راست‌به‌چپ
- کاتالوگ محصول با کد کالا، بارکد، گروه، واحد، قیمت و نقطه سفارش
- چند انبار و مکان سلسله‌مراتبی برای نگهداری کالا
- مشاهده موجودی لحظه‌ای، موجودی رزروشده و موجودی قابل فروش
- ثبت اسناد ورود خرید، خروج فروش و انتقال بین انبارها
- جلوگیری از خروج بیشتر از موجودی قابل فروش
- API جست‌وجوی بارکد با پشتیبانی از بارکد و SKU
- ثبت سفارش فروش با مشتری، مقصد، راننده و زمان تقریبی تحویل
- داشبورد پایه حسابداری شامل درآمد، سود ناخالص، دریافتنی و پرداختنی
- گزارش وضعیت انبار، هشدار نقطه سفارش و شاخص‌های تحویل
- دفتر رویدادهای حسابرسی برای عملیات مهم
- ذخیره‌سازی JSON برای توسعه محلی و نمایش نمونه

## فناوری‌های استفاده‌شده

- Node.js نسخه ۱۸ یا بالاتر
- سرور HTTP داخلی Node.js
- رابط کاربری JavaScript خام
- HTML و CSS با طراحی واکنش‌گرا و راست‌به‌چپ
- ذخیره‌سازی محلی در فایل `data.json`
- بدون وابستگی runtime خارجی در MVP فعلی

## زیرساخت دیتابیس

اسکیما و اسکریپت‌های آماده‌سازی PostgreSQL به پروژه اضافه شده‌اند. سرور رابط فعلاً تا زمان تنظیم credential اتصال و تکمیل repository layer از `data.json` استفاده می‌کند.

```powershell
Copy-Item .env.example .env
# مقدار DATABASE_URL را با نام کاربری و رمز PostgreSQL سیستم خودتان تنظیم کنید.
npm run db:migrate
npm run db:seed
```

migration جدول‌های محصولات، انبارها، مکان‌ها، موجودی، اسناد گردش، سفارش‌ها و رویدادهای حسابرسی را می‌سازد. seed داده‌های نمونه فعلی را به‌صورت قابل تکرار وارد می‌کند.

## اجرای محلی

```powershell
git clone https://github.com/<your-username>/rangyar-integrated-warehouse.git
cd rangyar-integrated-warehouse
npm start
```

بعد از اجرا آدرس [http://localhost:3000](http://localhost:3000) را باز کنید.

برای توسعه با راه‌اندازی خودکار مجدد سرور:

```powershell
npm run dev
```

## ساختار پروژه

```text
.
├── public/
│   ├── app.js          # نماها، فرم‌ها، فراخوانی API و داشبورد
│   ├── index.html      # پوسته اصلی راست‌به‌چپ
│   └── styles.css      # طراحی واکنش‌گرا
├── data.json           # داده نمونه که در اولین اجرا ساخته می‌شود
├── package.json        # اسکریپت‌ها و مشخصات پروژه
├── server.js           # سرور، مسیرهای API و لایه ذخیره‌سازی
└── README.md
```

## APIهای فعلی

| متد | مسیر | کاربرد |
|---|---|---|
| `GET` | `/api/bootstrap` | دریافت محصولات، انبارها، مکان‌ها، موجودی، سفارش‌ها، حسابداری و حسابرسی |
| `POST` | `/api/products` | ایجاد محصول |
| `POST` | `/api/movements` | ایجاد سند گردش انبار |
| `POST` | `/api/orders` | ایجاد سفارش فروش |
| `POST` | `/api/scan` | جست‌وجوی محصول با بارکد یا SKU |

نمونه درخواست اسکن بارکد:

```powershell
Invoke-RestMethod http://localhost:3000/api/scan `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"barcode":"6260001000012"}'
```

## مدل محصول و انبار

مدل داده فعلی مفاهیم اصلی عملیاتی را جدا کرده است:

- محصول و بارکد
- انبار
- مکان نگهداری شامل سالن، راهرو، قفسه و خانه
- موجودی شامل تعداد، رزرو، بچ و تاریخ انقضا
- سند گردش انبار
- سفارش فروش و اطلاعات تحویل
- خلاصه حسابداری
- رویداد حسابرسی

تمام تغییرات موجودی باید از طریق اسناد گردش انجام شود. در نسخه‌های بعدی نیز نباید امکان ویرایش مستقیم موجودی اضافه شود.

## نقشه راه رشد پروژه

### فاز اول — هسته عملیاتی انبار

هدف: موجودی در تمام انبارها قابل اعتماد و قابل رهگیری باشد.

- جایگزینی JSON با PostgreSQL
- تراکنش‌های پایگاه‌داده و قفل‌گذاری ردیف‌های موجودی
- احراز هویت و نقش‌های دسترسی
- محدودسازی دسترسی کاربران به انبارهای مربوطه
- پشتیبانی از بچ، تاریخ انقضا، FIFO/FEFO، قرنطینه و مرجوعی
- رزرو موجودی و شمارش دوره‌ای با گردش تأیید
- چاپ لیبل و پشتیبانی از بارکدخوان USB، بلوتوث و موبایل
- ثبت آفلاین موبایل و همگام‌سازی ایمن
- migration، seed، پشتیبان‌گیری و بازیابی

### فاز دوم — فروش، خرید و لجستیک

هدف: اتصال اسناد تجاری به گردش فیزیکی کالا و تحویل.

- سفارش خرید و فروش، پیش‌فاکتور، فاکتور، مرجوعی و اصلاحیه
- مشتری، تأمین‌کننده، راننده، خودرو، مسیر و نشانی تحویل
- وضعیت‌های برداشت، بسته‌بندی، بارگیری، ارسال، تحویل و رسید تحویل
- بارنامه با اطلاعات کامل مبدأ، مقصد، مشتری، راننده، خودرو و زمان‌ها
- محاسبه ETA با زمان بارگیری و سرویس نقشه اختیاری
- تأیید جداگانه فروش، انبار و مالی
- خروجی PDF و Excel برای فاکتور، بارنامه و گزارش‌ها

### فاز سوم — حسابداری یکپارچه

هدف: هر سند تجاری و انبار تأییدشده با حسابداری سازگار باشد.

- کدینگ حساب‌ها و دوره مالی
- اسناد روزنامه، دفتر کل، دریافتنی، پرداختنی، دریافت و پرداخت
- ارزش‌گذاری موجودی و بهای تمام‌شده بر اساس روش انتخابی
- محاسبه سود هر محصول، مشتری، شهر، انبار و دوره
- تنظیمات مالیات و الزامات حسابداری محلی
- تطبیق موجودی انبار، ارزش موجودی و دفتر مالی
- اتصال به نرم‌افزار حسابداری شرکت یا ارائه API پایدار

### فاز چهارم — تحلیل و بهینه‌سازی

هدف: تبدیل داده‌های عملیاتی به تصمیم خرید، جانمایی و فروش.

- تحلیل فروش و تقاضا بر اساس محصول، ماه، شهر و مشتری
- تشخیص کالاهای پرفروش، کم‌گردش، بدون گردش و نزدیک به انقضا
- محاسبه نقطه سفارش، موجودی اطمینان و پیشنهاد خرید
- پیش‌بینی تقاضا با نمایش میزان اطمینان
- پیشنهاد جانمایی بر اساس ظرفیت، گردش و محدودیت محصول
- سنجش بهره‌وری انبار، زمان برداشت، عملکرد تحویل و رانندگان
- گزارش‌های زمان‌بندی‌شده و هشدارهای مدیریتی

### فاز پنجم — آماده‌سازی برای تولید

هدف: بهره‌برداری امن و پایدار در همه شعب و انبارها.

- استقرار کانتینری با سرویس‌های جداگانه وب، API، پایگاه‌داده و worker
- HTTPS، مدیریت secret، محدودیت نرخ، لاگ ساختاریافته و مانیتورینگ
- تست خودکار و CI/CD
- بررسی دوره‌ای صحت backup و تمرین بازیابی بحران
- نگهداری ضد‌دستکاری لاگ حسابرسی
- تست بار برای کاربران، بارکدخوان‌ها و گزارش‌های هم‌زمان
- آموزش کاربران، مستند عملیات و راه‌اندازی مرحله‌ای هر انبار

## الزامات امنیت و حسابرسی

نسخه production باید شامل این موارد باشد:

- نقش‌های جدا برای مدیر، انباردار، فروش، خرید، مالی، راننده، حسابرس و مدیر سیستم
- تأیید چندمرحله‌ای برای اصلاح موجودی، ابطال سند، قیمت‌گذاری و پرداخت
- عدم حذف تاریخچه اسناد و استفاده از سند برگشت یا اصلاحیه
- ثبت کاربر، دستگاه، زمان، مقدار قبل و بعد
- احراز هویت دومرحله‌ای برای نقش‌های حساس
- رمزنگاری ارتباطات و محافظت از اطلاعات شخصی، مالی و رانندگان
- جداسازی داده‌های شعب و انبارها
- سیاست پشتیبان‌گیری، بازیابی و نگهداری اطلاعات

## استراتژی تست

تست‌های پروژه باید به‌تدریج این موارد را پوشش دهند:

- تست منطق موجودی، رزرو، بهای تمام‌شده، نقطه سفارش و ETA
- تست تراکنش اسناد و به‌روزرسانی هم‌زمان موجودی
- تست API محصول، اسکن، سفارش، گردش و تأییدها
- تست کامل دریافت، جانمایی، برداشت، انتقال، ارسال، تحویل، برگشت و تطبیق
- تست سطح دسترسی نقش‌ها و مرز انبارها
- تست بارکد تکراری، کالای منقضی، قرنطینه، موجودی منفی و همگام‌سازی ناموفق
- تست کارایی در موجودی بزرگ و فعالیت هم‌زمان چند بارکدخوان

## روند مشارکت در پروژه

1. از شاخه `main` یک feature branch بسازید.
2. منطق عملیات را در API و مسائل ظاهری را در `public/` نگه دارید.
3. موجودی را مستقیم ویرایش نکنید؛ سند گردش یا اصلاحیه ثبت کنید.
4. برای هر تغییر قانون کسب‌وکار تست اضافه یا اصلاح کنید.
5. از پیام‌های commit واضح و ترجیحاً Conventional Commit استفاده کنید.
6. برای تغییرات UI تصویر و برای تغییرات عملیاتی چک‌لیست تست در Pull Request قرار دهید.

## commit و push مرحله اول

بعد از ساخت ریپازیتوری در GitHub این دستورات را اجرا کنید:

```powershell
git init
git add README.md package.json server.js public data.json
git commit -m "feat: bootstrap integrated warehouse operations MVP"
git branch -M main
git remote add origin https://github.com/<your-username>/rangyar-integrated-warehouse.git
git push -u origin main
```

اگر این پوشه از قبل تاریخچه Git درست دارد، `git init` را دوباره اجرا نکنید و فقط دستورات add، commit، branch، remote و push موردنیاز را اجرا کنید.

## مجوز استفاده

قبل از عمومی کردن ریپازیتوری، مجوز استفاده را مشخص کنید. برای یک محصول داخلی شرکتی، بهتر است ریپازیتوری خصوصی بماند مگر اینکه شرکت رسماً با انتشار متن‌باز موافقت کرده باشد.
