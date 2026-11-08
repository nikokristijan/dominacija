// Lokalna imitacija Supabase REST-a (samo tablica dominacija_state) — za testiranje SupabaseStore-a bez računa.
// node scripts/fake-supabase.mjs [port]  → NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 SUPABASE_SERVICE_ROLE_KEY=x
import http from 'node:http';
let row = null;
const port = Number(process.argv[2] ?? 54321);
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    const send = (code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(b === undefined ? '' : JSON.stringify(b)); };
    if (!u.pathname.endsWith('/rest/v1/dominacija_state')) return send(404, { message: 'nema' });
    if (req.method === 'GET') return send(200, row ? [u.searchParams.get('select') === 'version' ? { version: row.version } : { version: row.version, data: row.data }] : []);
    if (req.method === 'POST') { if (!row) row = body; return send(201); }
    if (req.method === 'PATCH') {
      const want = Number(u.searchParams.get('version').replace('eq.', ''));
      if (!row || row.version !== want) return send(200, []);
      row = { ...row, ...body }; return send(200, [row]);
    }
    send(400, {});
  });
}).listen(port, () => console.log('fake supabase na', port));
