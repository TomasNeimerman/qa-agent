# Casos de Prueba — 2026-08-24-1105-login

**Generado:** 2026-08-24 11:05
**Origen:** Instrucción puntual — scripts/__fixtures__/mock-target-repo
**Instrucción:** probá el login de usuarios
**Router:** App Router (app/)
**Alcance:** app/login/actions.ts, app/login/page.tsx — resueltos desde la instrucción, no un glob del proyecto

## UI /login (Server Action)

**Origen del surface:** app/login/actions.ts:1-22, app/login/page.tsx:1-22

### case-1 — Login con credenciales válidas
- **Precondiciones:** Usuario de prueba existente con email y contraseña válidos.
- **Pasos:** Navegar a /login, completar email y contraseña válidos, enviar el formulario.
- **Resultado esperado:** Redirección a `/` (app/login/actions.ts:21, `redirect('/')` tras un `signIn` exitoso).
- **Tipo:** positivo
- **Ejecución:** UI

### case-2 — Campos vacíos
- **Precondiciones:** Ninguna.
- **Pasos:** Navegar a /login, dejar email y contraseña vacíos, enviar el formulario.
- **Resultado esperado:** "Email y contrasena son obligatorios." (app/login/actions.ts:15, mensaje literal), sin redirección.
- **Tipo:** negativo
- **Ejecución:** UI

### case-3 — Credenciales incorrectas
- **Precondiciones:** Email y contraseña completados, pero no corresponden a un usuario real.
- **Pasos:** Navegar a /login, completar email y contraseña de un usuario inexistente, enviar el formulario.
- **Resultado esperado:** "Email o contrasena incorrectos." (app/login/actions.ts:19, mensaje literal), sin redirección.
- **Tipo:** negativo
- **Ejecución:** UI
