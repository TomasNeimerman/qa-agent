# QA Agent

## What This Is

Un skill/subagente de Claude Code reutilizable e instalable en cualquier proyecto, que automatiza testing de QA (UI web, API/backend, y generación de casos de prueba) bajo demanda. Se usa internamente por Tomás y su equipo de trabajo, y opera de forma agnóstica sobre cualquiera de sus proyectos (DATAX, dotax, franquix, etc.) sin necesitar adaptación previa por proyecto.

## Core Value

Eliminar la repetición manual de pruebas de regresión y validación de formularios: el agente debe poder ejecutar (o generar) esas pruebas de forma confiable, sin que un humano tenga que reproducirlas a mano cada vez.

## Requirements

### Validated

- ✓ Testing de UI web: navegar la app, interactuar con formularios/flujos y verificar comportamiento esperado — v1.0 (Fase 2)
- ✓ Testing de API/backend: endpoints, contratos, respuestas y códigos de error — v1.0 (Fase 1)
- ✓ Generación de casos de prueba documentados (incluyendo edge y negativos) — v1.0 (Fases 3-4)
- ✓ Descubrimiento dual: exploración de código + instrucciones en lenguaje natural — v1.0 (Fase 3)
- ✓ Validación de formularios: campos requeridos, formatos inválidos y límites — v1.0 (DISC-04)
- ✓ Casos edge/negativos, incluidos permisos/auth vía credencial secundaria opcional — v1.0 (DISC-05)
- ✓ Smoke test post-deploy (`--smoke`, un caso positivo por superficie) — v1.0 (Fase 5)
- ✓ Reporte legible con evidencia y pasos de reproducción — v1.0 (Fase 1)
- ✓ Acceso dual localhost / staging — v1.0 (Fase 1)
- ✓ Empaquetado como skill instalable y agnóstico al proyecto — v1.0 (Fases 1, 5)

### Active

(Ninguno — definir con `/gsd-new-milestone`)

### Out of Scope

- Ejecución automática disparada por CI/CD o pre-release obligatorio — v1 es 100% bajo demanda, manual
- Multi-tenancy o control de acceso entre usuarios del equipo — el acceso se comparte informalmente por ahora
- Generación de código de test reutilizable en el repo (Playwright/pytest files) — v1 se enfoca en reportes y casos documentados, no en dejar suites de test versionadas

## Current State

v1.0 MVP publicado el 2026-09-21: 5 fases, 21 planes, ~30k líneas (scripts .mjs, SKILL.md y docs). Validado en vivo contra franquix; DATAX-web no se re-ejecutó y dotax quedó fuera de la corrida en vivo. Deuda conocida: 2 tests de configuración (`api-client`, `ui-login`) fallan cuando existe un `.env.local` local; UAT de Fase 02 quedó `partial` (0 escenarios pendientes); Fase 5 quedó marcada `stale` en la verificación (VERIFICATION.md `passed 17/17`, commits de UAT posteriores).

## Next Milestone Goals

A definir con `/gsd-new-milestone`. Candidatos surgidos del Out of Scope: código de test persistido, ejecución en CI, self-healing entre corridas.

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
| Implementarlo como skill de Claude Code (no CLI standalone ni servidor MCP) | Se integra directamente al flujo de trabajo diario del equipo en Claude Code, sin infraestructura adicional | ✓ Good (v1.0 entregó los tres) |
| Descubrimiento híbrido (explora código + acepta instrucciones en lenguaje natural) | Cubre tanto testing exploratorio automático como casos puntuales que el usuario ya tiene en mente | ✓ Good (v1.0 entregó los tres) |
| v1 entrega reportes y casos documentados, no código de test versionado | Reduce alcance inicial; generar suites reutilizables de test queda para una iteración futura | ✓ Good (v1.0 entregó los tres) |

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
*Last updated: 2026-09-21 after v1.0 milestone*
