require('dotenv').config();
const assert = require('node:assert/strict');
const base = `http://localhost:${process.env.TEST_PORT || process.env.PORT || 3000}`;
async function request(path, options) { const r=await fetch(base+path, options); const data=await r.json().catch(()=>({})); return {status:r.status,data}; }
async function main(){
  const health=await request('/api/health'); assert.equal(health.status,200); assert.equal(health.data.status,'ok');
  const login=await request('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:process.env.DEMO_ADMIN_PASSWORD||'ChangeMe123!'})}); assert.equal(login.status,200); assert.ok(login.data.token);
  const headers={authorization:`Bearer ${login.data.token}`}; const boot=await request('/api/bootstrap',{headers}); assert.equal(boot.status,200); assert.ok(boot.data.products.length>0);
  const unknown=await request('/api/scan',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({barcode:'not-a-real-barcode'})}); assert.equal(unknown.status,404);
  console.log('API smoke tests passed:', {health:health.status, login:login.status, bootstrapProducts:boot.data.products.length, unknownBarcode:unknown.status});
}
main().catch(e=>{console.error('API smoke tests failed:',e.message);process.exit(1)});
