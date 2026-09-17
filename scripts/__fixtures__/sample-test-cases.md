# Casos de Prueba — 2026-08-20-1530-categorias

**Generado:** 2026-08-20 15:30
**Origen:** Escaneo completo de proyecto — scripts/__fixtures__/mock-target-repo
**Instrucción:** (vacío — escaneo completo, no instrucción puntual)
**Router:** App Router (app/)
**Alcance:** app/**/route.ts, supabase/migrations/*.sql — excluye node_modules, .next, dist, build, coverage, .git

## POST /api/categorias

**Origen del surface:** app/api/categorias/route.ts:12-41

### case-1 — Alta de categoría con datos válidos
- **Precondiciones:** Usuario autenticado con rol `admin`.
- **Pasos:** POST /api/categorias con body `{ "nombre": "Alquiler", "tipo": "egreso" }`.
- **Resultado esperado:** 200, `{ ok: true, categoria: { nombre: "Alquiler", tipo: "egreso" } }`.
- **Tipo:** positivo
- **Ejecución:** API

### case-2 — Sin autenticar
- **Precondiciones:** Ninguna sesión activa.
- **Pasos:** POST /api/categorias sin cookie de sesión, body válido.
- **Resultado esperado:** 401, `{ error: "No autenticado" }` (app/api/categorias/route.ts:15, mensaje literal).
- **Tipo:** negativo
- **Ejecución:** API

### case-3 — Rol distinto de admin
- **Precondiciones:** Usuario autenticado con rol `franquiciado`.
- **Pasos:** POST /api/categorias con body válido.
- **Resultado esperado:** 403, `{ error: "Solo el administrador puede crear categorias" }` (app/api/categorias/route.ts:19, mensaje literal).
- **Tipo:** negativo
- **Ejecución:** API

### case-4 — Falta el campo nombre
- **Precondiciones:** Usuario autenticado con rol `admin`.
- **Pasos:** POST /api/categorias con body `{ "tipo": "egreso" }`.
- **Resultado esperado:** 400, `{ error: "Falta el nombre" }` (app/api/categorias/route.ts:29, mensaje literal).
- **Tipo:** negativo
- **Ejecución:** API

### case-5 — Tipo fuera del dominio permitido
- **Precondiciones:** Usuario autenticado con rol `admin`.
- **Pasos:** POST /api/categorias con body `{ "nombre": "Alquiler", "tipo": "otro" }`.
- **Resultado esperado:** 400, `{ error: "Tipo invalido (ingreso o egreso)" }` (app/api/categorias/route.ts:33, mensaje literal).
- **Tipo:** negativo
- **Ejecución:** API

## GET /api/categorias

**Origen del surface:** app/api/categorias/route.ts:8-10

### case-6 — Listado de categorías
- **Precondiciones:** Usuario autenticado, al menos una categoría cargada.
- **Pasos:** GET /api/categorias.
- **Resultado esperado:** 200, `{ ok: true, categorias: [...] }`.
- **Tipo:** positivo
- **Ejecución:** API

### case-7 — Listado vacío
- **Precondiciones:** Usuario autenticado, ninguna categoría cargada todavía.
- **Pasos:** GET /api/categorias.
- **Resultado esperado:** 200, `{ ok: true, categorias: [] }`.
- **Tipo:** positivo
- **Ejecución:** API

## Franquicias — día de cierre (dia_cierre)

**Origen del surface:** supabase/migrations/0002_franquicias_horario.sql:7

### case-8 — dia_cierre dentro del rango permitido
- **Precondiciones:** Franquicia existente.
- **Pasos:** Actualizar la franquicia con `dia_cierre: 3`.
- **Resultado esperado:** La escritura se acepta sin error de restricción.
- **Tipo:** positivo
- **Ejecución:** API

### case-9 — dia_cierre limite inferior menos 1
- **Precondiciones:** Franquicia existente.
- **Pasos:** Actualizar la franquicia con `dia_cierre: -1`.
- **Resultado esperado:** Fallo esperado — origen: CHECK constraint en supabase/migrations/0002_franquicias_horario.sql:7 (`dia_cierre BETWEEN 0 AND 6`), comportamiento HTTP no verificado en el código de la ruta.
- **Tipo:** edge
- **Ejecución:** API

### case-10 — dia_cierre limite inferior exacto
- **Precondiciones:** Franquicia existente.
- **Pasos:** Actualizar la franquicia con `dia_cierre: 0`.
- **Resultado esperado:** Fallo esperado — origen: CHECK constraint en supabase/migrations/0002_franquicias_horario.sql:7 (`dia_cierre BETWEEN 0 AND 6`), comportamiento HTTP no verificado en el código de la ruta.
- **Tipo:** edge
- **Ejecución:** API

### case-11 — dia_cierre limite superior exacto
- **Precondiciones:** Franquicia existente.
- **Pasos:** Actualizar la franquicia con `dia_cierre: 6`.
- **Resultado esperado:** Fallo esperado — origen: CHECK constraint en supabase/migrations/0002_franquicias_horario.sql:7 (`dia_cierre BETWEEN 0 AND 6`), comportamiento HTTP no verificado en el código de la ruta.
- **Tipo:** edge
- **Ejecución:** API

### case-12 — dia_cierre limite superior mas 1
- **Precondiciones:** Franquicia existente.
- **Pasos:** Actualizar la franquicia con `dia_cierre: 7`.
- **Resultado esperado:** Fallo esperado — origen: CHECK constraint en supabase/migrations/0002_franquicias_horario.sql:7 (`dia_cierre BETWEEN 0 AND 6`), comportamiento HTTP no verificado en el código de la ruta.
- **Tipo:** edge
- **Ejecución:** API

## Usuarios — rol enumerado (rol_usuario)

**Origen del surface:** supabase/migrations/0001_init.sql:8

### case-13 — Alta de usuario con rol válido
- **Precondiciones:** Ninguna.
- **Pasos:** Insertar un usuario con `rol: "admin"`.
- **Resultado esperado:** La escritura se acepta; `rol` queda registrado como `admin`.
- **Tipo:** positivo
- **Ejecución:** API

### case-14 — Rol fuera del dominio enumerado
- **Precondiciones:** Ninguna.
- **Pasos:** Insertar un usuario con `rol: "superadmin"`.
- **Resultado esperado:** Fallo esperado — origen: enum `rol_usuario` declarado en supabase/migrations/0001_init.sql:8 y aplicado a `usuarios.rol` en supabase/migrations/0001_init.sql:20, comportamiento HTTP no verificado en el código de la ruta.
- **Tipo:** edge
- **Ejecución:** API
