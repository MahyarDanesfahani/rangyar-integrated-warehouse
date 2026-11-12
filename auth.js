const crypto = require('crypto');
const db = require('./db');

const secret = process.env.AUTH_SECRET || 'development-only-change-this-secret';
const roles = { admin: '*', warehouse_manager: 'warehouse', warehouse_operator: 'warehouse', sales: 'sales', accounting: 'accounting', auditor: 'read' };
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`; }
function verifyPassword(password, stored) { const [salt, hash] = stored.split(':'); const actual = crypto.scryptSync(password, salt, 64).toString('hex'); return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(hash)); }
function token(user) { const payload = Buffer.from(JSON.stringify({ sub:user.id, username:user.username, displayName:user.displayName, role:user.role, exp:Date.now()+8*60*60*1000 })).toString('base64url'); const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url'); return `${payload}.${sig}`; }
function readToken(value) { try { const [payload, sig] = value.split('.'); const expected=crypto.createHmac('sha256',secret).update(payload).digest('base64url'); if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return null; const user=JSON.parse(Buffer.from(payload,'base64url').toString()); return user.exp>Date.now()?user:null; } catch { return null; } }
function authRequired() { return process.env.REQUIRE_AUTH === 'true'; }
function current(req) { const h=req.headers.authorization||''; return h.startsWith('Bearer ')?readToken(h.slice(7)):null; }
function assertRole(user, allowed) { return user && (user.role==='admin' || allowed.includes(user.role)); }
async function login(username,password) { const r=await db.query('SELECT id, username, display_name AS "displayName", password_hash AS "passwordHash", role FROM users WHERE username=$1 AND active=true',[username]); const u=r.rows[0]; if(!u || !verifyPassword(password,u.passwordHash)) return null; delete u.passwordHash; return {...u, token:token(u)}; }
module.exports={hashPassword,login,current,authRequired,assertRole,roles};
