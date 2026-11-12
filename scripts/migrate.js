require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
async function main() { const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rangyar' }); await client.connect(); await client.query(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8')); await client.end(); console.log('Database schema is ready.'); }
main().catch(error => { console.error('Migration failed:', error.message); process.exit(1); });
