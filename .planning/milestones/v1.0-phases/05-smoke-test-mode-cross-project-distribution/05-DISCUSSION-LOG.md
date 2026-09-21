# Phase 5: Smoke-Test Mode & Cross-Project Distribution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-18
**Phase:** 5-Smoke-Test Mode & Cross-Project Distribution
**Areas discussed:** Qué cuenta como smoke, Cómo se invoca el modo smoke, Validación cross-proyecto (PKG-02), Empaquetado y distribución (PKG-03)

---

## Qué cuenta como smoke

| Option | Description | Selected |
|--------|-------------|----------|
| El usuario marca casos en test-cases.md | Marca manual al generar casos | |
| El agente infiere automaticamente | Regla determinística (1 positivo por surface) | ✓ |
| El usuario nombra los flujos en la instrucción | Sin persistencia, a pedido | |

**User's choice:** El agente infiere automaticamente
**Notes:** Llevó a definir la regla exacta de selección en las preguntas siguientes.

| Option | Description | Selected |
|--------|-------------|----------|
| El primer caso positivo listado por surface | Determinístico sobre test-cases.md existente | ✓ |
| Regenera casos mínimos ad-hoc (sin test-cases.md previo) | Discovery liviano en el momento | |

**User's choice:** El primer caso positivo listado por surface

| Option | Description | Selected |
|--------|-------------|----------|
| Corre discovery completo primero, después filtra a smoke | Reusa Phase 3 sin cambios | ✓ |
| Avisa que hace falta generar casos primero | No genera nada por su cuenta | |

**User's choice:** Corre discovery completo primero, después filtra a smoke

| Option | Description | Selected |
|--------|-------------|----------|
| No se marca nada — se recalcula cada vez | Consistente con Phase 3 D-06 (documento vivo) | ✓ |
| Se agrega un campo "smoke: sí" al escribir el documento | 6to campo persistido | |

**User's choice:** No se marca nada — se recalcula cada vez

---

## Cómo se invoca el modo smoke

| Option | Description | Selected |
|--------|-------------|----------|
| Instrucción en lenguaje natural ("corré un smoke test") | Sin flag nuevo | ✓ |
| Argumento explícito al slash command (--smoke) | Modo de invocación estructurado nuevo | |

**User's choice:** Instrucción en lenguaje natural

| Option | Description | Selected |
|--------|-------------|----------|
| Mismo Run protocol existente, sin cambios | Reusa formato/gate de confirmación tal cual | ✓ |
| Reporte separado con sección "smoke" | Encabezado/etiqueta distintiva en el reporte | |

**User's choice:** Mismo Run protocol existente, sin cambios

| Option | Description | Selected |
|--------|-------------|----------|
| Ambos, según el campo ejecución:API\|UI de cada caso | Cobertura end-to-end | ✓ |
| Solo API por defecto (más rápido) | Prioriza velocidad | |

**User's choice:** Ambos, según el campo ejecución:API|UI de cada caso

---

## Validación cross-proyecto (PKG-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Corrida real de smoke test contra los 3 repos (Recommended) | Prueba real de generalización | ✓ |
| Revisión de código, sin corridas reales | Más rápido pero no prueba de verdad | |

**User's choice:** Corrida real de smoke test contra los 3 repos

| Option | Description | Selected |
|--------|-------------|----------|
| Localhost/staging de cada proyecto, nunca producción de cliente | Usa SBDAMODE en DATAX; nunca base de cliente real | ✓ |
| Lo que esté disponible en cada caso, a criterio del que corre el UAT | Sin regla única | |

**User's choice:** Localhost/staging de cada proyecto, nunca producción de cliente

| Option | Description | Selected |
|--------|-------------|----------|
| El smoke test corre sin errores de configuración en los 3 | Casos individuales fallando no cuenta como fallo de fase | ✓ |
| Los 3 corren y además todos los casos generados pasan | Criterio más estricto | |

**User's choice:** El smoke test corre sin errores de configuración en los 3

---

## Empaquetado y distribución (PKG-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Pulir la doc existente, sin nuevo tooling | Revisión y corrección de lo ya documentado | ✓ |
| Checklist de verificación post-instalación | Nuevo paso/tooling agregado | |

**User's choice:** Pulir la doc existente, sin nuevo tooling

| Option | Description | Selected |
|--------|-------------|----------|
| Un compañero del equipo la sigue de cero como parte del UAT | Prueba real con un tercero | ✓ |
| Auto-revisión: releer la doc con ojo crítico | Sin prueba con un tercero | |

**User's choice:** Un compañero del equipo la sigue de cero como parte del UAT

| Option | Description | Selected |
|--------|-------------|----------|
| Se mantiene npm install manual (estado actual) | Sin cambios al mecanismo de dependencias | ✓ |
| Evaluar empaquetar node_modules o vendorizar | Explorar distribución con dependencias incluidas | |

**User's choice:** Se mantiene npm install manual (estado actual)

---

## Claude's Discretion

- Exact wording/formatting of the tightened installation instructions.
- Whether the "first positive case per surface" selection is implemented as a function inside `test-case-doc.mjs` or a new sibling script.

## Deferred Ideas

- Install script or post-install verification checklist (rejected for this phase).
- Vendoring/pre-bundling `node_modules` for distribution (rejected).
- A `--smoke` CLI flag or explicit slash-command argument (rejected in favor of NL invocation).
