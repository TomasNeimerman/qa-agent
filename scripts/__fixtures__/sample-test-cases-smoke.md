# Casos de Prueba — 2026-09-21-1200-insumos

**Generado:** 2026-09-21 12:00
**Origen:** Escaneo completo de proyecto — scripts/__fixtures__/mock-target-repo
**Instrucción:** (vacío — escaneo completo, no instrucción puntual)
**Router:** App Router (app/)
**Alcance:** app/**/route.ts, supabase/migrations/*.sql — excluye node_modules, .next, dist, build, coverage, .git

## POST /api/insumos

**Origen del surface:** app/api/insumos/route.ts:10-40

### case-1 — Sin autenticar
- **Precondiciones:** Ninguna sesión activa.
- **Pasos:** POST /api/insumos sin cookie de sesión, body válido.
- **Resultado esperado:** 401, `{ error: "No autenticado" }` (app/api/insumos/route.ts:14, mensaje literal).
- **Tipo:** negativo
- **Ejecución:** API

### case-2 — Alta de insumo con datos válidos
- **Precondiciones:** Usuario autenticado con rol `admin`.
- **Pasos:** POST /api/insumos con body `{ "nombre": "Cemento", "unidad": "kg" }`.
- **Resultado esperado:** 200, `{ ok: true, insumo: { nombre: "Cemento", unidad: "kg" } }`.
- **Tipo:** positivo
- **Ejecución:** API

## DELETE /api/insumos/:id

**Origen del surface:** app/api/insumos/[id]/route.ts:5-30

### case-3 — Sin autenticar
- **Precondiciones:** Ninguna sesión activa.
- **Pasos:** DELETE /api/insumos/1 sin cookie de sesión.
- **Resultado esperado:** 401, `{ error: "No autenticado" }` (app/api/insumos/[id]/route.ts:8, mensaje literal).
- **Tipo:** negativo
- **Ejecución:** API

### case-4 — id fuera del rango permitido
- **Precondiciones:** Usuario autenticado con rol `admin`.
- **Pasos:** DELETE /api/insumos/-1.
- **Resultado esperado:** Fallo esperado — origen: CHECK constraint en supabase/migrations/0003_insumos.sql:5 (`id > 0`), comportamiento HTTP no verificado en el código de la ruta.
- **Tipo:** edge
- **Ejecución:** API

## Insumos — eliminación solo admin (rol_usuario)

**Origen del surface:** app/api/insumos/[id]/route.ts:12-20

### case-5 — Eliminación como segundo usuario con rol admin
- **Precondiciones:** Dos usuarios (`admin`, `otro`) con insumos propios.
- **Pasos:** DELETE /api/insumos/1 autenticado como el segundo usuario con rol `admin`.
- **Resultado esperado:** 200, `{ ok: true }` (app/api/insumos/[id]/route.ts:14, guard de rol admin).
- **Tipo:** positivo
- **Ejecución:** API (pendiente — falta 2do usuario)

### case-6 — Eliminación con rol admin ya autenticado
- **Precondiciones:** Usuario autenticado con rol `admin`.
- **Pasos:** DELETE /api/insumos/2.
- **Resultado esperado:** 200, `{ ok: true }`.
- **Tipo:** positivo
- **Ejecución:** API
