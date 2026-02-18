# Auditoría rápida de código y vista/pantalla (2026-02-18)

## Alcance
- Revisión estática de calidad con los linters disponibles en el repositorio.
- Revisión de consistencia en scripts que afectan ejecución y mantenibilidad.
- Revisión puntual de señales de naming/texto potencialmente problemáticas.

## Comandos ejecutados
1. `./test/lint/lint-files.py`
2. `./test/lint/lint-qt-translation.py`
3. `./test/lint/lint-python.py`
4. `./test/lint/lint-shell.py`
5. `./test/lint/lint-python-dead-code.py`

## Hallazgos

### 1) Inconsistencias de ejecutabilidad en scripts Python (corregido)
`lint-files.py` detectó dos scripts con shebang pero sin permiso ejecutable (`644`), lo cual rompe expectativas de tooling y automatización:
- `contrib/retro_pastnet.py`
- `contrib/satoshi-vission/agents/ideas_processor.py`

**Impacto:** fallos en pipeline/lint y comportamiento inconsistente al ejecutar scripts directamente.

**Acción aplicada:** ambos archivos pasaron a `755`.

### 2) Shebang no estándar en script de arranque (corregido)
`lint-files.py` detectó shebang fuera de política en:
- `contrib/termux/youphrn_oes-init.prod.sh`

Antes: `#!/data/data/com.termux/files/usr/bin/bash`
Después: `#!/usr/bin/env bash`

**Impacto:** incompatibilidad con reglas de lint y menor portabilidad.

**Acción aplicada:** normalización al shebang aceptado por el proyecto.

### 3) Señales de naming/texto potencialmente problemáticas (observación)
Durante la revisión aparecieron nombres con posible typo semántico (por ejemplo, `satoshi-vission`, `retro_pastnet`, `youphrn_oes`), que no rompen compilación por sí solos pero sí aumentan deuda técnica, confusión de dominio y riesgo de mantenimiento.

**Recomendación:**
- Definir un criterio de naming (glosario de términos válidos) para `contrib/`.
- Validar coherencia de nombres con revisión manual antes de merge.

## Estado final de la auditoría
- Las incidencias bloqueantes detectadas por `lint-files.py` quedaron corregidas.
- El lint de traducciones Qt no reportó problemas.
- Algunos linters quedaron en modo "skip" por dependencias no instaladas (`lief`, `shellcheck`, `vulture`), por lo que se recomienda una segunda pasada en un entorno con dependencias completas.
