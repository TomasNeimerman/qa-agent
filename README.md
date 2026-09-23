# qa-agent

Skill de Claude Code para QA con evidencia real. Dispara requests HTTP y
acciones de browser mediante scripts determinísticos (nunca "a ojo" leyendo
un `curl`), y deja como resultado un reporte Markdown — con el token
redactado — en el `qa-reports/` del proyecto que estás probando.

No es un proyecto que se corre suelto: es una skill que se instala una vez
en `~/.claude/skills/qa-agent/` y después se invoca desde cualquier consola
de Claude Code abierta sobre el proyecto que querés testear.

## Qué hace

Tres modos, todos disparados por instrucción en lenguaje natural (no hay
flags separados por modo):

1. **Test dirigido** — vos nombrás el endpoint o el flujo ("probá GET
   /api/clients y POST /api/clients", "testeá el alta de cliente"). Genera
   un caso por endpoint/resultado nombrado y lo corre.
2. **Discovery** — le pedís que explore el código del proyecto ("generá
   casos de prueba", "qué se puede testear acá") y arma un documento
   `qa-reports/<run-id>-test-cases.md` leyendo las rutas (`app/**/route.ts`,
   `pages/api/**/*.ts`), las validaciones de cada handler y las políticas
   RLS/constraints de las migraciones. No corre nada todavía — eso queda
   para una invocación posterior donde le decís qué casos correr.
3. **Smoke test** — post-deploy rápido ("corré un smoke test"). Si ya existe
   un documento de discovery lo reutiliza y toma un caso positivo por
   superficie; si no existe, primero genera el documento (modo 2) y te
   ofrece correrlo.

## Instalación (una vez por máquina)

1. Copiar o symlinkear esta carpeta a `~/.claude/skills/qa-agent/` (en
   Windows, `mklink /J` para el symlink).
2. `npm install` **adentro de la copia de la skill** — nunca en el proyecto
   que vas a testear. Requiere Node ≥22.
3. Configurar las variables de entorno de `## Configuración` abajo.
4. Solo para correr flujos de browser: registrar el MCP server de
   Playwright una vez por máquina (ver `references/mcp-setup.md`).
5. Invocar la skill: `/qa-agent <base-url> <instrucción>`.

No instala ni escribe nada en el proyecto bajo prueba salvo los artefactos
de `qa-reports/` que genera cada corrida.

## Configuración

- `QA_AGENT_TOKEN` (obligatoria para correr contra API) — bearer token del
  usuario de prueba. Va como `Authorization: Bearer <token>` en cada
  request.
- `QA_AGENT_TOKEN_SECONDARY` (opcional) — token de un segundo usuario, de
  menor privilegio, para correr los casos de permisos/roles. Cuenta de
  prueba dedicada, nunca un login real.
- `QA_AGENT_BASE_URL` (opcional) — base URL por default, si no la pasás
  como primer argumento.
- `QA_AGENT_UI_USER` / `QA_AGENT_UI_PASSWORD` (juntas, solo para flujos de
  browser) — credenciales de login de un usuario de prueba dedicado, nunca
  un login real.

Todas se leen del shell donde corre Claude Code, o del `.env.local` del
proyecto bajo prueba.

## Cómo se usa desde el proyecto

Abrís Claude Code sobre el repo que querés testear y tipeás:

```
/qa-agent https://localhost:3000 probá GET /api/clientes y POST /api/clientes
/qa-agent https://localhost:3000 generá casos de prueba
/qa-agent https://localhost:3000 corré un smoke test
```

El resultado siempre llega de dos formas: un resumen en el chat (cantidad
de pasos passed/failed/blocked) y un archivo Markdown en
`<proyecto>/qa-reports/`.

## Salvaguardas, en criollo

- **Nunca falsea un veredicto.** El pass/fail sale del JSON de
  `api-client.mjs` o del recorder de UI, nunca de que el agente "lea" la
  salida y decida a ojo.
- **Nada destructivo sin confirmar.** DELETE siempre, y todo POST/PUT/PATCH
  que no sea claramente de solo lectura, para antes de disparar y te
  muestra el preview (método, URL, body) para que digas sí o no — una
  llamada a la vez, nunca en lote.
- **Frena en hosts que parecen producción**, salvo que confirmes
  explícitamente con `--allow-non-local`.
- **No inyecta payloads de seguridad** (SQLi, XSS, path traversal): eso es
  scope de la skill `security-audit`, no de esta.
- **La sesión de browser (storage-state) se trata como una credencial
  viva** — nunca se imprime en el chat ni en el reporte.

## Estructura

- `scripts/` — los ejecutores determinísticos (`api-client.mjs`,
  `ui-login.mjs`, `discover-schema.mjs`, `format-report.mjs`,
  `test-case-doc.mjs`, etc.) y sus tests.
- `references/` — reglas de detalle que la skill consulta en vez de
  reinventar: clasificación de qué es destructivo, cómo detecta rutas
  Next.js, formato del documento de casos, setup de Playwright MCP.
- `qa-reports/` — no es de este repo: es la carpeta que la skill crea
  **dentro del proyecto bajo prueba**, con los reportes y documentos de
  casos de cada corrida (gitignoreada automáticamente).

Para el detalle completo del protocolo (qué hace paso a paso en cada modo,
los criterios de clasificación destructivo/no-destructivo, el formato del
documento de casos), la referencia autoritativa es `SKILL.md` — este
README es el resumen para orientarse rápido, no lo reemplaza.
