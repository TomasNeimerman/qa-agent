// Fixture route handler for scripts/discover-schema.mjs and
// scripts/discovery.e2e.test.mjs. Shape mirrors what RESEARCH.md observed
// across DATAX-web/dotax/franquix: no Zod, imperative early-return checks.
// Static text only — nothing in this repo imports or executes this file.
import { NextResponse } from 'next/server';
import { perfilDeSesion } from '@/lib/session';

export async function GET() {
  return NextResponse.json({ ok: true, categorias: [] });
}

export async function POST(req: Request) {
  const perfil = await perfilDeSesion();
  if (!perfil) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (perfil.rol !== 'admin') {
    return NextResponse.json(
      { error: 'Solo el administrador puede crear categorias' },
      { status: 403 }
    );
  }
  const cuerpo = (await req.json().catch(() => null)) as {
    nombre?: string;
    tipo?: 'ingreso' | 'egreso';
  } | null;
  const nombre = cuerpo?.nombre?.trim();
  if (!nombre) {
    return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 });
  }
  if (cuerpo?.tipo !== 'ingreso' && cuerpo?.tipo !== 'egreso') {
    return NextResponse.json(
      { error: 'Tipo invalido (ingreso o egreso)' },
      { status: 400 }
    );
  }
  return NextResponse.json(
    { ok: true, categoria: { nombre, tipo: cuerpo.tipo } },
    { status: 200 }
  );
}
