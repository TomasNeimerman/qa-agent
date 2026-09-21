---
status: complete
phase: 05-smoke-test-mode-cross-project-distribution
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md
started: 2026-09-21T16:56:18Z
updated: 2026-09-21T17:41:54.510Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. --smoke rechaza flags prohibidos (CR-01, plan 05-04)
expected: Con "--confirmed" o "--allow-non-local" en los Pasos de un caso seleccionado, node scripts/test-case-doc.mjs --file <copia> --smoke sale con exit 9, stdout vacío, stderr nombra caso y flag. El fixture original sigue dando exit 0.
result: pass

### 2. Smoke test de punta a punta por lenguaje natural (REP-03 / SC1)
expected: En una sesión de Claude Code sobre un proyecto con qa-reports/*-test-cases.md, decir "corré un smoke test" contra un target local. El skill se activa, invoca test-case-doc.mjs --smoke, resume en el chat superficies/omitidos/pendientes y aclara que es un subconjunto (no salud total) ANTES de despachar; cada caso destructivo pausa pidiendo confirmación; se genera un reporte normal en qa-reports.
result: pass

### 3. Smoke sin documento de test cases
expected: En un proyecto sin qa-reports/*-test-cases.md, decir "corré un smoke test". Corre discovery + generación, escribe el documento y el turno termina con una oferta que nombra por separado la cantidad smoke y la de pendientes; no se despacha nada en ese turno.
result: pass

### 4. Corrida live de smoke en franquix sin configuración específica (PKG-02 / D3)
expected: Contra franquix en localhost:3000 el skill sin modificar corre sin config ni cambio de código propios del proyecto. Evidencia: C:/franquix/qa-reports/2026-09-21-1238-2026-09-21-1245-api-v1-fixed.md (3 pasaron, 2 fallaron por cuerpo vacío = artefacto de construcción del caso). ¿Te parece que eso alcanza como evidencia?
result: pass

### 5. Corrida live en DATAX-web y dotax (PKG-02 / D4)
expected: Smoke live contra DATAX-web y dotax.
result: skipped
reason: "Override aceptado por el usuario (2026-09-21): DATAX-web no se re-corrió, dotax descartado (sin entorno fijo). Discovery, generación y selección smoke sí corrieron en los tres."

### 6. Dry run de un compañero siguiendo SKILL.md ## Installation (PKG-03 / D-12)
expected: Alguien que no trabajó en este repo copia la carpeta, corre npm install adentro, configura las variables de entorno y invoca /qa-agent sobre uno de sus proyectos: el skill se invoca y corre un caso API sin ningún paso que haya tenido que adivinar. (Registrado como abierto en .planning/WINDOWS.md #1.)
result: pass

### 7. selectSmokeCases: un positivo por superficie, en orden de documento
expected: Automatizado (unit + integración) - pasa.
result: pass
source: automated
coverage_id: 05-01/D1

### 8. Superficie sin positivo se lista en skipped; primer positivo pendiente no se reemplaza
expected: Automatizado (unit) - pasa.
result: pass
source: automated
coverage_id: 05-01/D2

### 9. --smoke no escribe al documento y usa exit 0/2/9
expected: Automatizado (unit + git diff limpio) - pasa.
result: pass
source: automated
coverage_id: 05-01/D3

### 10. SKILL.md tiene ## Smoke-test protocol con disparo por lenguaje natural
expected: Automatizado (grep) - pasa.
result: pass
source: automated
coverage_id: 05-01/D4

### 11. discover-schema.mjs exit 0 en los tres repos, App Router detectado
expected: Automatizado (integración) - pasa.
result: pass
source: automated
coverage_id: 05-02/D1

### 12. Documentos generados validan y --smoke selecciona en los tres repos
expected: Automatizado (integración) - pasa.
result: pass
source: automated
coverage_id: 05-02/D2

### 13. SKILL.md ## Installation en cinco pasos, sin variables nuevas
expected: Automatizado (grep) - pasa.
result: pass
source: automated
coverage_id: 05-03/D1

### 14. references/mcp-setup.md reescrito sin cambiar headings
expected: Automatizado (git diff) - pasa.
result: pass
source: automated
coverage_id: 05-03/D2

### 15. Ensayo en directorio limpio: npm install + validate + --smoke exit 0
expected: Automatizado (manual_procedural del executor) - pasa.
result: pass
source: automated
coverage_id: 05-03/D3

## Summary

total: 15
passed: 14
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

[none yet]
