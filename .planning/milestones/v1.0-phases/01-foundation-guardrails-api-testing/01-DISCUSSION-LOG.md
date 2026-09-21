# Phase 1: Foundation, Guardrails & API Testing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 1-Foundation, Guardrails & API Testing
**Areas discussed:** Detección de acciones destructivas, Mecánica de confirmación, Origen de los casos de API a testear, Formato y ubicación del reporte

---

## Detección de acciones destructivas

| Option | Description | Selected |
|--------|-------------|----------|
| Por método HTTP | DELETE siempre requiere confirmación; POST/PUT/PATCH mutantes también | ✓ |
| Por palabras clave en la ruta/acción | Detecta patrones como /delete, /remove, /cancel, /pay en la URL | |
| Combinación de ambas | Método HTTP como señal principal + keywords para casos disfrazados | |

**User's choice:** Por método HTTP (Recomendado)

| Option | Description | Selected |
|--------|-------------|----------|
| Todo pasa por confirmación | Nada 100% prohibido; toda acción destructiva puede ejecutarse si el usuario confirma | ✓ |
| Lista negra absoluta | Ciertas acciones bloqueadas siempre, ni la confirmación las habilita | |

**User's choice:** Todo pasa por confirmación (Recomendado)
**Notes:** Sin excepciones — no hay bloqueo permanente a nivel código/config en v1.

---

## Mecánica de confirmación

| Option | Description | Selected |
|--------|-------------|----------|
| Se detiene y pregunta ahí mismo | Pausa la corrida en el momento exacto, espera sí/no | ✓ |
| Lista previa al arrancar | Muestra todas las acciones destructivas posibles antes de empezar | |
| Ambas según el modo | Por defecto se detiene; opción de lista pre-aprobada para modo rápido | |

**User's choice:** Se detiene y pregunta ahí mismo (Recomendado)

| Option | Description | Selected |
|--------|-------------|----------|
| Continúa con lo demás | Salta esa acción, la marca como "bloqueada por el usuario", sigue con el resto | ✓ |
| Aborta toda la corrida | Detiene todo el testing inmediatamente | |

**User's choice:** Continúa con lo demás (Recomendado)

---

## Origen de los casos de API a testear (Fase 1)

| Option | Description | Selected |
|--------|-------------|----------|
| Lenguaje natural, uno o varios por pedido | El usuario describe qué endpoints probar en texto libre | ✓ |
| Spec/lista formal (OpenAPI, colección Postman) | Se pasa un archivo con la definición de la API | |
| Ambas según disponibilidad | Usa spec si existe, si no funciona con instrucciones sueltas | |

**User's choice:** Lenguaje natural, uno o varios por pedido (Recomendado)

| Option | Description | Selected |
|--------|-------------|----------|
| Token/API key por variable de entorno | Header Authorization con token de usuario de test vía env var | ✓ |
| Sin auth por ahora | Fase 1 solo prueba endpoints públicos | |

**User's choice:** Token/API key por variable de entorno (Recomendado)

---

## Formato y ubicación del reporte

| Option | Description | Selected |
|--------|-------------|----------|
| Chat + archivo local | Resumen en el chat + Markdown completo en carpeta del proyecto testeado (ej. qa-reports/) | ✓ |
| Solo en el chat | Sin persistir archivo | |
| Archivo fuera del repo testeado | Carpeta separada, para no ensuciar el repo probado | |

**User's choice:** Chat + archivo local (Recomendado)

| Option | Description | Selected |
|--------|-------------|----------|
| Request + response completos | Incluye request y respuesta completos por caso, pass o fail | ✓ |
| Solo resumen (status + mensaje) | Reportes más livianos, sin payload completo | |

**User's choice:** Request + response completos (Recomendado)

---

## Claude's Discretion

- Convención de nombre de archivo/timestamp dentro de `qa-reports/`
- Si `qa-reports/` debe tener entrada `.gitignore` por defecto (recomendado: sí, son artefactos efímeros)

## Deferred Ideas

None — discussion stayed within phase scope.
