#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import db from '../api/db.js';

function toCsv(rows) {
  const header = 'product_id,sku,product_name,count,total_amount\n';
  const body = rows.map(r => `${r.product_id || ''},"${(r.sku||'').replace(/"/g,'""')}","${(r.product_name||'').replace(/"/g,'""')}",${r.count||0},${r.total_amount||0}`).join('\n');
  return header + body;
}

(function main() {
  try {
    const rows = db.prepare(`
      SELECT p.id AS product_id, p.sku AS sku, p.name AS product_name, COUNT(*) AS count, SUM(pmt.amount) AS total_amount
      FROM payments pmt
      LEFT JOIN products p ON pmt.product_id = p.id
      GROUP BY p.id, p.sku, p.name
      ORDER BY count DESC
    `).all();

    const csv = toCsv(rows);
    const outDir = path.resolve('./reports');
    try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}
    const outPath = path.join(outDir, `product-usage-${Date.now()}.csv`);
    fs.writeFileSync(outPath, csv);
    console.log('Wrote', outPath);
  } catch (e) {
    console.error('Export failed', e && e.message);
    process.exit(2);
  }
})();
