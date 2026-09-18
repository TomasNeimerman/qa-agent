# QA Agent

## What This Is

Un skill/subagente de Claude Code reutilizable e instalable en cualquier proyecto, que automatiza testing de QA (UI web, API/backend, y generación de casos de prueba) bajo demanda. Se usa internamente por Tomás y su equipo de trabajo, y opera de forma agnóstica sobre cualquiera de sus proyectos (DATAX, dotax, franquix, etc.) sin necesitar adaptación previa por proyecto.

## Core Value

Eliminar la repetición manual de pruebas de regresión y validación de formularios: el agente debe poder ejecutar (o generar) esas pruebas de forma confiable, sin que un humano tenga que reproducirlas a mano cada vez.

## Requirements

### Validated

- [x] Validación de formularios: cobertura sistemática de campos requeridos, formatos inválidos y límites — Validado en Fase 4 (DISC-04)
- [x] Casos edge/negativos: generación y ejecución de casos límite (permisos/auth vía credencial secundaria opcional; datos fuera de rango, tipos incorrectos) — Validado en Fase 4 (DISC-05)

### Active

- [ ] Testing de UI web: navegar la app, interactuar con formularios/flujos y verificar comportamiento esperado
- [ ] Testing de API/backend: probar endpoints, validar contratos, respuestas y códigos de error
- [ ] Generación de casos de prueba: a partir de un flujo o requisito, producir casos de prueba documentados (incluyendo edge cases y casos negativos)
- [ ] Descubrimiento dual: el agente puede explorar el código del proyecto para inferir qué probar, y también aceptar instrucciones puntuales en lenguaje natural ("probá el alta de cliente")
- [ ] Smoke test post-deploy: chequeo rápido de flujos esenciales tras un deploy
- [ ] Reporte de resultados: resumen legible de qué se probó, qué pasó, qué falló y por qué
- [ ] Soporte de acceso dual: puede correr contra la app en local (localhost) o contra un ambiente de staging/test vía URL
- [ ] Empaquetado como skill instalable (`~/.claude/skills/`), invocable vía slash command, distribuible al equipo

### Out of Scope

- Ejecución automática disparada por CI/CD o pre-release obligatorio — v1 es 100% bajo demanda, manual
- Multi-tenancy o control de acceso entre usuarios del equipo — el acceso se comparte informalmente por ahora
- Generación de código de test reutilizable en el repo (Playwright/pytest files) — v1 se enfoca en reportes y casos documentados, no en dejar suites de test versionadas

## Context

- Tomás tiene experiencia previa con testing manual y identifica como mayor frustración la repetición de pruebas de formularios y flujos similares entre releases.
- El agente debe funcionar igual de bien en cualquiera de los proyectos existentes de Tomás (apps Next.js/Supabase como DATAX, dotax) sin requerir configuración específica por proyecto desde el día 1.
- Se va a distribuir al equipo de trabajo dándoles acceso directamente (no hay un plan de distribución pública o comercial).

## Constraints

- **Plataforma**: Debe correr como skill/subagente dentro de Claude Code — no es una app standalone ni un servicio separado
- **Alcance de ejecución**: Manual bajo demanda (no integrado a CI todavía) — mantiene la superficie inicial simple
- **Acceso a la app objetivo**: Debe soportar tanto localhost como URLs de staging, sin asumir un único modo de acceso

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Implementarlo como skill de Claude Code (no CLI standalone ni servidor MCP) | Se integra directamente al flujo de trabajo diario del equipo en Claude Code, sin infraestructura adicional | — Pending |
| Descubrimiento híbrido (explora código + acepta instrucciones en lenguaje natural) | Cubre tanto testing exploratorio automático como casos puntuales que el usuario ya tiene en mente | — Pending |
| v1 entrega reportes y casos documentados, no código de test versionado | Reduce alcance inicial; generar suites reutilizables de test queda para una iteración futura | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-18 — Phase 4 (Edge-Case & Input Validation Quality) complete*
