# Phase 4: Edge-Case & Input Validation Quality - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-17
**Phase:** 4-Edge-Case & Input Validation Quality
**Areas discussed:** Casos de permisos/rol (DISC-05), Generación vs. ejecución de edge cases, Exhaustividad de boundary values, Alcance de "tipos incorrectos / fuera de rango"

---

## Casos de permisos/rol (DISC-05)

**Q: Hoy solo existe un usuario de test — ¿cómo resolvemos casos "fuera de rol"?**

| Option | Description | Selected |
|--------|-------------|----------|
| Agregar 2do usuario de test | Nueva env var opcional `QA_AGENT_TOKEN_SECONDARY`; ejecuta de verdad el caso si está presente | ✓ |
| Solo documentar, nunca ejecutar | Detecta chequeos de permiso en código y genera el caso sin ejecutarlo | |
| Híbrido según disponibilidad | Ejecuta si el segundo usuario existe, si no lo deja pendiente | |

**Q: Si no está configurado el segundo usuario, ¿qué pasa con esos casos?**

| Option | Description | Selected |
|--------|-------------|----------|
| Los deja documentados y sin ejecutar | `ejecución: pendiente — falta 2do usuario`, no rompe la corrida | ✓ |
| Falla la corrida con mensaje claro | Igual que Phase 1 D-09 | |
| Omite esos casos en silencio | No los genera ni los menciona | |

**Q: ¿Cómo detecta el agente los chequeos de permiso/rol en el código?**

| Option | Description | Selected |
|--------|-------------|----------|
| RLS policies + middleware/guards | Extiende discover-schema.mjs para `CREATE POLICY`, más lectura orchestrator de guards en código | ✓ |
| Solo RLS policies (Supabase) | Solo migraciones SQL | |
| Orchestrator-judgment, sin script nuevo | Todo vía Glob/Grep/Read, sin extractor dedicado | |

**Q: ¿Los casos de permisos cubren API, UI, o ambas?**

| Option | Description | Selected |
|--------|-------------|----------|
| Ambas | Reusa el campo `ejecución: API \| UI` de Phase 3 D-03 | ✓ |
| Solo API | Más simple, enforcement real casi siempre vive en backend | |

**Q: ¿Cómo se le informa al agente el rol del segundo usuario?**

| Option | Description | Selected |
|--------|-------------|----------|
| Solo credenciales, el agente infiere el rol | Sin variable adicional de nombre de rol | ✓ |
| Env var adicional con el nombre del rol | `QA_AGENT_SECONDARY_ROLE=cliente` | |

**Notes:** El agente hoy solo tiene un único usuario configurado (Phase 1 D-06/D-09); esta era la decisión más crítica de la fase porque DISC-05 no era ejecutable sin resolverla primero.

---

## Generación vs. ejecución de edge cases

**Q: DISC-05 dice "genera y ejecuta" — ¿rompemos la regla terminal de Phase 3 (D-10)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Mismo flujo manual | "Ejecuta" se satisface con el Run protocol existente (D-11) | ✓ |
| Auto-ejecución inmediata | Corre los casos en la misma invocación | |
| Auto-ejecución solo para no-destructivos | Híbrido entre las dos anteriores | |

**Q: ¿El agente ofrece proactivamente correr los casos recién generados?**

| Option | Description | Selected |
|--------|-------------|----------|
| Ofrecer al terminar | Sugiere "¿Corro estos N casos ahora?" sin auto-ejecutar | ✓ |
| Silencioso, como Phase 3 | No sugiere nada | |

**Q: ¿Los subtipos de DISC-04 necesitan distinguirse en el documento?**

| Option | Description | Selected |
|--------|-------------|----------|
| Sí, subtipo explícito | Título/nota indica la subcategoría, sin nuevo campo | ✓ |
| No, alcanza con tipo:edge/negativo | Esquema de 5 campos sin cambios | |

**Notes:** Ninguna de las respuestas rompe D-10 de Phase 3 — la separación generación/ejecución se mantiene intacta.

---

## Exhaustividad de boundary values

**Q: ¿Cuántos casos límite por campo con constraint conocido?**

| Option | Description | Selected |
|--------|-------------|----------|
| 4 por campo: min-1, min, max, max+1 | Cobertura clásica de boundary testing | ✓ |
| 2 por campo: solo los que violan | Solo min-1 y max+1 | |
| 1 por campo, el más representativo | Minimiza volumen | |

**Q: ¿Y para campos sin constraint explícito?**

| Option | Description | Selected |
|--------|-------------|----------|
| Solo "required-field omission" | Sin límite conocido no se inventa boundary | ✓ |
| Boundary genérico igual | Ej. string de 1000 caracteres | |

**Q: ¿Formatos inválidos — solo detectados en código, o librería propia de formatos AR?**

| Option | Description | Selected |
|--------|-------------|----------|
| Solo lo detectado en código | CUIT/CUIL queda para DOM-01 (v2) | ✓ |
| Agregar librería básica de formatos AR | Adelanta parte de DOM-01 a v1 | |

**Q: ¿Boundary numérico incluye valores "raros" (0, negativos, decimales) sin CHECK explícito?**

| Option | Description | Selected |
|--------|-------------|----------|
| Sí, por tipo de dato | Inferencia de tipo, no invención de límite arbitrario | ✓ |
| No, solo lo que hay CHECK explícito | Más conservador | |

**Notes:** La disciplina "shape observed, not invented" (Phase 1 D-10 / Phase 3 D-12) se mantiene como límite general — la única excepción aceptada es la inferencia por tipo de dato (D-12 de esta fase).

---

## Alcance de "tipos incorrectos / fuera de rango"

**Q: ¿Incluye payloads de inyección (SQLi/XSS)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Solo contrato de datos, no inyección | Violaciones estrictas de tipo/forma | ✓ |
| Incluir inyección básica | Mezcla QA funcional con security testing | |

**Q: ¿El "resultado esperado" asume un código específico, o documenta lo observado?**

| Option | Description | Selected |
|--------|-------------|----------|
| Documenta lo observado | Expectativa genérica, evidencia real del run | ✓ |
| Asume código específico según convención REST | Más estricto, riesgo de falsos "fail" | |

**Notes:** Deslinde explícito con el skill `security-audit` — este agente no hace testing de seguridad.

---

## Claude's Discretion

- Formato/fraseo exacto de los títulos de boundary cases con subcategoría (D-08).
- Si el parser de `CREATE POLICY` (D-03) va dentro de `discover-schema.mjs` o como script hermano nuevo — decisión de arquitectura para la etapa de planning.

## Deferred Ideas

- Payloads de inyección SQL/XSS como parte de casos "tipo incorrecto" — pertenece a un tool/skill de seguridad, no a este QA agent (D-13).
- Librería incorporada de formatos de dominio argentino (CUIT/CUIL, teléfono) — ya trackeado como `DOM-01` en REQUIREMENTS.md v2; confirmado fuera de alcance de Fase 4 (D-11).
