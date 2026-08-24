// Fixture: Pages Router API handler — deliberately a different shape from
// the App Router's (one default-exported handler that switches on the
// request method, versus one exported async function per method). No app/
// directory exists in this fixture repo — see references/discovery-nextjs.md's
// router-layout section for why layout detection has to come first rather
// than being a fallback tried after a scan returns empty. Static text
// only; nothing in this repo imports or executes this file.
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, items: [] });
  }
  if (req.method === 'POST') {
    const nombre = req.body?.nombre;
    if (!nombre) {
      return res.status(400).json({ error: 'Falta el nombre' });
    }
    return res.status(201).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
