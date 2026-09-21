# Retrospective

## Milestone: v1.0 — MVP

**Shipped:** 2026-09-21
**Phases:** 5 | **Plans:** 21

### What Was Built
Skill `/qa-agent` instalable: testing de API con gate de acciones destructivas, motor de browser (Playwright MCP) con login por script, descubrimiento dual y generación de casos, edge cases/permisos, y modo `--smoke`. Ver MILESTONES.md.

### What Worked
- Slices verticales (tracer primero) en cada fase; gate de confirmación en dos capas (script + hook).
- Validar contra proyectos reales (franquix) destapó bugs reales (off-by-one de citas).

### What Was Inefficient
- Se cerró sin audit de milestone; la verificación de Fase 5 quedó `stale` por commits de UAT posteriores.
- Tests de configuración dependen de un `.env.local` local (deuda diferida desde Fase 3).

### Patterns Established
- Escaneo de flags prohibidos sobre todo el documento antes de despachar (también en `--smoke`).
- Casos `pendiente` refusados por nombre antes de llegar al dispatch.

### Key Lessons
- Aislar los tests de configuración del entorno local (`.env.local`) desde el principio.
- Correr `/gsd-audit-milestone` antes de cerrar.

## Cross-Milestone Trends

| Milestone | Phases | Plans | Closeout |
|-----------|--------|-------|----------|
| v1.0 | 5 | 21 | override_closeout |
