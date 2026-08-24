// Fixture: Server-Action-backed form. Mirrors franquix's login shape
// RESEARCH.md quoted — the form's real validation lives here, invoked
// through useActionState/formAction, not behind a fetch() call the
// discovery step could otherwise find by grepping for fetch(. Static text
// only; nothing in this repo imports or executes this file.
'use server';

import { redirect } from 'next/navigation';
import { signIn } from '@/lib/session';

export async function loginAction(prevState, formData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  if (!email || !password) {
    return { error: 'Email y contrasena son obligatorios.' };
  }
  const ok = await signIn(email, password);
  if (!ok) {
    return { error: 'Email o contrasena incorrectos.' };
  }
  redirect('/');
}
