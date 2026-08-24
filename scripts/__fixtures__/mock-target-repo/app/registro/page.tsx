// Fixture: client-fetch form, no colocated actions.ts. Mirrors the dotax
// shape RESEARCH.md quoted — client-side validation for immediate
// feedback, duplicated server-side in the API route it posts to. Static
// text only; nothing in this repo imports or executes this file.
'use client';

import { useState } from 'react';

export default function RegistroPage() {
  const [error, setError] = useState('');

  async function registrar(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    if (!email || !password) {
      setError('Completa email y contrasena.');
      return;
    }
    if (password.length < 6) {
      setError('La contrasena necesita al menos 6 caracteres.');
      return;
    }
    const res = await fetch('/api/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error);
    }
  }

  return (
    <form onSubmit={registrar}>
      <input name="email" type="email" />
      <input name="password" type="password" />
      {error && <p>{error}</p>}
      <button type="submit">Registrarme</button>
    </form>
  );
}
