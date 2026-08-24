// Fixture: client component binding a form to a colocated Server Action —
// no client-side data fetch, by design (see actions.ts). Static text
// only; nothing in this repo imports or executes this file.
'use client';

import { useActionState } from 'react';
import { loginAction } from './actions';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction}>
      <input name="email" type="email" />
      <input name="password" type="password" />
      {state?.error && <p>{state.error}</p>}
      <button type="submit" disabled={pending}>
        Entrar
      </button>
    </form>
  );
}
