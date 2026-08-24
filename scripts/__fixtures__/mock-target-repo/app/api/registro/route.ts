// Fixture route handler the registro form posts to. Re-validates
// server-side with the same imperative early-return shape as the
// categorias fixture — the server-side check is the real guarantee (a
// negative case dispatched at the API directly bypasses client JS
// entirely). Static text only; nothing in this repo imports or executes
// this file.
import { NextResponse } from 'next/server';
import { emailYaRegistrado } from '@/lib/usuarios';

export async function POST(req: Request) {
  const cuerpo = ((await req.json().catch(() => null)) ?? {}) as {
    email?: string;
    password?: string;
  };
  const email = cuerpo.email?.trim();
  const password = cuerpo.password;
  if (!email || !password) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'La contrasena necesita al menos 6 caracteres' },
      { status: 400 }
    );
  }
  if (await emailYaRegistrado(email)) {
    return NextResponse.json({ error: 'Ese email ya esta registrado' }, { status: 409 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
