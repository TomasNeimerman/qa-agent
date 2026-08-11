# Phase 2: Browser Execution Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-11
**Phase:** 2-Browser Execution Engine
**Areas discussed:** Herramienta de navegador, Flujo de login/autenticación, Acciones destructivas en la UI, Reuso de sesión UI→API

---

## Herramienta de navegador

| Option | Description | Selected |
|--------|-------------|----------|
| Playwright MCP | Server oficial de Microsoft, accessibility-tree snapshots | ✓ |
| Playwright directo por script | Script Node invocado por Bash, sin MCP server | |

**User's choice:** Playwright MCP (Recomendado)

| Option | Description | Selected |
|--------|-------------|----------|
| Chromium | Un único contexto Chromium para v1 | ✓ |
| Dejar elegir por flag | Flag para Chromium/Firefox/WebKit desde el inicio | |

**User's choice:** Chromium (Recomendado)

---

## Flujo de login/autenticación

| Option | Description | Selected |
|--------|-------------|----------|
| Navegación autónoma + accessibility tree | Identifica campos por rol/label semántico | ✓ |
| URL de login explícita requerida | Usuario siempre indica la URL exacta | |

**User's choice:** Navegación autónoma + accessibility tree (Recomendado)

| Option | Description | Selected |
|--------|-------------|----------|
| QA_AGENT_UI_USER / QA_AGENT_UI_PASSWORD | Variables nuevas, separadas del token de API | ✓ |
| Reusar QA_AGENT_TOKEN | Un solo mecanismo de credencial | |

**User's choice:** Variables nuevas (Recomendado)

---

## Acciones destructivas en la UI

| Option | Description | Selected |
|--------|-------------|----------|
| Sí, misma lógica que Fase 1 | Pausa y pide confirmación antes de clicks destructivos | ✓ |
| No por ahora | Solo se aplica a la API | |

**User's choice:** Sí, misma lógica que Fase 1 (Recomendado)

| Option | Description | Selected |
|--------|-------------|----------|
| Por texto/label del elemento | Palabras clave: eliminar, borrar, cancelar, etc. | ✓ |
| Todo click de acción se trata como destructivo | Más conservador | |

**User's choice:** Por texto/label del elemento (Recomendado)

---

## Reuso de sesión UI→API

| Option | Description | Selected |
|--------|-------------|----------|
| storageState de Playwright | Se exporta tras login UI, se reusa en APIRequestContext | ✓ |
| Cada uno maneja su propia auth por separado | Sin compartir sesión | |

**User's choice:** storageState de Playwright (Recomendado)

---

## Claude's Discretion

- Exacta secuencia de tool-calls de Playwright MCP
- Nombre/ubicación del archivo de storageState

## Deferred Ideas

None — discussion stayed within phase scope.
