# Requirements: QA Agent

**Defined:** 2026-08-10
**Core Value:** Eliminar la repetición manual de pruebas de regresión y validación de formularios: el agente debe poder ejecutar (o generar) esas pruebas de forma confiable, sin que un humano tenga que reproducirlas a mano cada vez.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Safety & Guardrails

- [x] **SAFE-01**: El agente nunca ejecuta una acción destructiva (delete, pago, cambio de rol/permiso, envío de email real) sin confirmación explícita del usuario en ese momento
- [x] **SAFE-02**: El agente distingue y marca claramente en el reporte qué acciones fueron ejecutadas vs. bloqueadas por requerir confirmación
- [x] **SAFE-03**: Cada veredicto de pass/fail queda respaldado por evidencia capturada en el momento (screenshot, respuesta HTTP, snapshot del DOM) — no hay veredictos sin evidencia adjunta

### Execution Engine (UI)

- [x] **EXEC-01**: El agente puede navegar autónomamente una app web (single Chromium context vía Playwright) y ejecutar acciones (click, fill, submit) sobre flujos y formularios
- [x] **EXEC-02**: El agente puede recibir instrucciones en lenguaje natural ("probá el alta de cliente") y traducirlas en pasos de navegación concretos
- [x] **EXEC-03**: El agente puede autenticarse en la app objetivo usando credenciales de test provistas por variable de entorno (nunca hardcodeadas en el skill)
- [x] **EXEC-04**: El agente puede apuntar tanto a localhost como a una URL de staging, recibiendo la URL base como parámetro

### API Testing

- [x] **API-01**: El agente puede ejecutar requests HTTP directos (GET/POST/PUT/DELETE) contra endpoints de la app objetivo, sin necesitar el navegador
- [x] **API-02**: El agente valida códigos de estado, forma de la respuesta (contrato/schema) y manejo de errores esperado
- [x] **API-03**: El agente puede reusar la sesión/autenticación obtenida en la ejecución UI para llamadas API relacionadas

### Discovery & Test Generation

- [x] **DISC-01**: El agente puede explorar el código del proyecto objetivo (rutas, formularios, schemas de validación, constraints de base de datos) para inferir qué probar
- [x] **DISC-02**: El agente puede generar casos de prueba documentados (título, precondiciones, pasos, resultado esperado, tipo: positivo/negativo/edge) a partir de lo descubierto en el código
- [x] **DISC-03**: El agente puede generar casos de prueba documentados a partir de una instrucción puntual en lenguaje natural, sin necesidad de explorar todo el código
- [x] **DISC-04**: El agente cubre sistemáticamente validación de formularios: campos requeridos, formatos inválidos, valores límite (boundary values)
- [x] **DISC-05**: El agente genera y ejecuta casos edge/negativos (no solo happy path): datos fuera de rango, tipos incorrectos, casos de permisos/auth

### Reporting

- [x] **REP-01**: El agente produce un reporte legible que indica qué se probó, qué pasó/falló y por qué, con evidencia adjunta por caso
- [x] **REP-02**: El reporte incluye pasos de reproducción para cada caso fallido
- [ ] **REP-03**: El agente soporta un modo "smoke test" que corre solo los flujos esenciales de forma rápida, en vez de una regresión completa

### Packaging

- [x] **PKG-01**: El agente está empaquetado como skill de Claude Code instalable (`~/.claude/skills/`), invocable vía slash command
- [ ] **PKG-02**: El skill funciona de forma agnóstica sobre cualquier proyecto (sin configuración específica previa), asumiendo stacks tipo Next.js/Supabase
- [ ] **PKG-03**: El skill es distribuible al equipo de trabajo (copiar/instalar en la carpeta de skills de cada persona)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Diagnóstico avanzado

- **DIAG-01**: Diagnóstico de causa raíz correlacionando errores de consola/red con el código fuente relevante, no solo screenshot + pass/fail
- **DIAG-02**: Self-healing-lite vía matching semántico/accessibility-tree para no fallar por cambios menores de markup dentro de una misma corrida
- **DIAG-03**: Control explícito de profundidad de corrida (quick / standard / deep) como flag de primera clase

### Dominio específico

- **DOM-01**: Librerías de edge cases específicas del dominio del equipo (validación CUIT/CUIL, scoping multi-tenant por rol, formatos de fecha/moneda argentinos)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Generación de código de test persistido y versionado (archivos Playwright/pytest committeados al repo) | v1 entrega reportes y casos documentados, no una suite de test mantenida — evita la carga de mantenimiento de una suite que "debe quedar verde" |
| Ejecución disparada automáticamente por CI/CD en cada PR/deploy | v1 es 100% bajo demanda/manual — evita infraestructura de queueing, scheduling y políticas de flakiness |
| Self-healing persistido/aprendido entre corridas (locators con confianza histórica) | Requiere infraestructura de estado persistente desproporcionada para un uso on-demand e irregular |
| Matriz de ejecución cross-browser/cross-device | Un único contexto Chromium cubre la gran mayoría de bugs reales para una app interna probada por developers antes de release |
| Regresión visual completa (pixel-diffing contra baseline) | Alto costo de mantenimiento de baselines sin una suite persistida que los ancle |
| Multi-tenancy o control de acceso entre usuarios del equipo, dashboards compartidos | Acceso se comparte informalmente distribuyendo el skill; no hay backend compartido en v1 |
| Modelo de "equipo QA humano en el loop" (tipo QA Wolf) | Es una herramienta interna para el propio equipo, no un servicio tercerizado |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SAFE-01 | Phase 1 | Complete |
| SAFE-02 | Phase 1 | Complete |
| SAFE-03 | Phase 1 | Complete |
| EXEC-01 | Phase 2 | Complete |
| EXEC-02 | Phase 2 | Complete |
| EXEC-03 | Phase 2 | Complete |
| EXEC-04 | Phase 1 | Complete |
| API-01 | Phase 1 | Complete |
| API-02 | Phase 1 | Complete |
| API-03 | Phase 2 | Complete |
| DISC-01 | Phase 3 | Complete |
| DISC-02 | Phase 3 | Complete |
| DISC-03 | Phase 3 | Complete |
| DISC-04 | Phase 4 | Complete |
| DISC-05 | Phase 4 | Complete |
| REP-01 | Phase 1 | Complete |
| REP-02 | Phase 1 | Complete |
| REP-03 | Phase 5 | Pending |
| PKG-01 | Phase 1 | Complete |
| PKG-02 | Phase 5 | Pending |
| PKG-03 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 21 total
- Mapped to phases: 21 ✓
- Unmapped: 0

---
*Requirements defined: 2026-08-10*
*Last updated: 2026-08-10 after roadmap creation (5 phases, full coverage)*
