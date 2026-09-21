# Phase 3: Dual Discovery & Test-Case Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-20
**Phase:** 3-Dual Discovery & Test-Case Generation
**Areas discussed:** Formato del caso de prueba documentado, Alcance del escaneo de código, Handoff: generación vs. ejecución, Generación por instrucción puntual (DISC-03)

---

## Formato del caso de prueba documentado

| Option | Description | Selected |
|--------|-------------|----------|
| Nuevo archivo test-cases.md en qa-reports/ | Un archivo Markdown por corrida de discovery, mismo directorio/convención que reportes existentes | ✓ |
| JSON estructurado (como results.json) | Pensado para lectura programática, no humana | |
| Ambos: JSON como fuente + Markdown renderizado | Patrón results.json → format-report.mjs replicado | |

**User's choice:** Nuevo archivo test-cases.md en qa-reports/ → D-01

| Option | Description | Selected |
|--------|-------------|----------|
| Los 5 de REQUIREMENTS.md | título, precondiciones, pasos, resultado esperado, tipo | ✓ |
| Los 5 + origen del descubrimiento | Agrega campo 'source' de trazabilidad | |

**User's choice:** Los 5 de REQUIREMENTS.md → D-02

| Option | Description | Selected |
|--------|-------------|----------|
| ID corto secuencial | case-1, case-2... | ✓ |
| Slug descriptivo | ej. 'alta-cliente-campo-email-invalido' | |

**User's choice:** ID corto secuencial → D-04

| Option | Description | Selected |
|--------|-------------|----------|
| Agrupados por superficie descubierta | Una sección por ruta/formulario/endpoint | ✓ |
| Lista plana con tipo como columna | Sin agrupar | |

**User's choice:** Agrupados por superficie descubierta → D-05

| Option | Description | Selected |
|--------|-------------|----------|
| Campo explícito 'ejecución: API \| UI' | Marcado en el momento de generación | ✓ |
| Inferido en el momento de ejecutar | No se marca en el documento | |

**User's choice:** Campo explícito 'ejecución: API \| UI' → D-03

| Option | Description | Selected |
|--------|-------------|----------|
| Sí, es un documento editable | El agente relee al ejecutar | ✓ |
| No, se regenera cada vez | Solo-lectura | |

**User's choice:** Sí, es un documento editable → D-06

**Notes:** User asked to keep exploring this area three times before moving on — landed on a fully-specified test-case document contract (location, fields, IDs, grouping, execution-type tag, editability).

---

## Alcance del escaneo de código

| Option | Description | Selected |
|--------|-------------|----------|
| Todo el proyecto por defecto | Escanea rutas/formularios/schemas en todo el repo | ✓ |
| Requiere que el usuario indique una carpeta | Siempre pide un punto de partida | |

**User's choice:** Todo el proyecto por defecto → D-07

| Option | Description | Selected |
|--------|-------------|----------|
| Detectar el patrón automáticamente | App Router vs Pages Router por estructura de carpetas | ✓ |
| Asumir siempre App Router | Documentar la limitación | |

**User's choice:** Detectar el patrón automáticamente → D-08 (rated costly — see CONTEXT.md)

| Option | Description | Selected |
|--------|-------------|----------|
| Schemas Zod/validación + migraciones SQL de Supabase | Cubre validación de app y de DB | ✓ |
| Solo código de la app | Sin parsear SQL | |

**User's choice:** Schemas Zod/validación + migraciones SQL de Supabase → D-09

---

## Handoff: generación vs. ejecución

| Option | Description | Selected |
|--------|-------------|----------|
| Solo genera, no ejecuta | Correr es un paso separado | ✓ |
| Genera y pregunta si ejecutar ya | Pregunta en la misma sesión | |

**User's choice:** Solo genera, no ejecuta → D-10

| Option | Description | Selected |
|--------|-------------|----------|
| Referencia al archivo + selección de casos | ej. 'corré los casos 1, 3 y 5 de ...' | ✓ |
| Correr todos los casos del archivo siempre | Sin selección parcial | |

**User's choice:** Referencia al archivo + selección de casos → D-11

---

## Generación por instrucción puntual (DISC-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Lee el código relevante a esa única instrucción | Sin escanear todo el proyecto, pero sí lo que la instrucción menciona | ✓ |
| Solo lo que el usuario dijo, sin tocar código | Puramente desde la instrucción NL | |

**User's choice:** Lee el código relevante a esa única instrucción → D-12

**Notes:** Output convention (D-05 grouping) confirmed to apply uniformly to DISC-03-generated cases — no separate file/flow, stated directly rather than re-asked as a single-option question.

---

## Claude's Discretion

- Exact Markdown table/heading styling inside test-cases.md — left to implementer, constrained by D-02/D-04/D-05.

## Deferred Ideas

None — discussion stayed within phase scope. Systematic boundary/negative/permission edge-case coverage (DISC-04, DISC-05) was correctly not raised — that belongs to Phase 4.
