// Fixture: Pages Router API handler, same shape as
// mock-target-repo-pages/pages/api/legacy.ts — paired with app/page.tsx in
// this repo to exercise the D-08 both-present branch of router-layout
// detection. Static text only; nothing in this repo imports or executes
// this file.
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
