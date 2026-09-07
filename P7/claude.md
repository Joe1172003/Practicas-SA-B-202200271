# Práctica 7 – Integración y Despliegue Continuo (CI/CD)

**Curso:** Software Avanzado — USAC, Facultad de Ingeniería, Ing. en Ciencias y Sistemas
**Vigencia:** Segundo Semestre 2026
**Ponderación:** 3.75 pts
**Tiempo estimado:** 10 horas

## Cronograma
| Actividad | Inicio | Fin |
|---|---|---|
| Asignación de práctica | 03/09/26 | 03/09/26 |
| Elaboración | 03/09/26 | 10/09/26 |
| Calificación | 12/09/26 | 12/09/26 |

## Contexto del problema

Ya se cuenta con una arquitectura basada en microservicios (desarrollada en las
Prácticas 5 y 6). Ahora se debe automatizar el proceso de integración, pruebas y
despliegue de ese sistema, simulando un flujo empresarial real:

- Validar cambios automáticamente.
- Construir imágenes Docker.
- Ejecutar pruebas.
- Desplegar servicios sin intervención manual intensiva.

## Alcance / actividades a implementar

1. Pipeline CI configurado en **GitHub Actions**.
2. Automatización del **build** del proyecto.
3. Ejecución automática de **pruebas**.
4. Construcción automática de **imágenes Docker**.
5. **Push** de imágenes a GitHub Container Registry (GHCR).
6. **Despliegue automático** usando Kubernetes (k8s).
7. Reutilizar el sistema de microservicios de la práctica anterior (P5/P6).

## Requerimientos técnicos / herramientas

- Repositorio GitHub
- GitHub Actions
- YAML pipelines
- Docker (Docker Desktop, DockerHub)
- Kubernetes (K8s) para orquestación
- Código base del sistema de microservicios de las Prácticas 5 y 6

## Entregables

| Tipo | Descripción |
|---|---|
| Repositorio en GitHub | Carpeta `/P7` con todos los archivos necesarios |
| Archivo workflow | Archivo(s) YAML funcional(es) del pipeline CI/CD (en `.github/workflows`) |
| Evidencia de ejecución | Capturas del pipeline exitoso en la interfaz de Actions |
| Imágenes Docker | Publicadas correctamente en un registry público (DockerHub/GHCR) |
| Documentación técnica | Explicación detallada del flujo CI/CD configurado |
| Diagrama del pipeline | Arquitectura visual del flujo automatizado con todas sus fases |

## Requisitos previos para optar a calificación

- Prácticas 5 y 6 previamente desarrolladas y calificadas.
- El pipeline realiza correctamente el build y push de imágenes.
- La ejecución principal en GitHub Actions finaliza sin errores.
- Documentación entregada de forma clara y completa.

## Rúbrica de calificación (base 100, escalable a 3.75 pts)

### 1. Habilidades (40 pts)
| # | Criterio | Pts | Satisfactorio (100-61%) | Necesita mejorar (60-0%) |
|---|---|---|---|---|
| 1.1 | Documentación técnica | 10 | Explica detalladamente y con claridad el flujo implementado | Explicación vaga, genérica o incompleta sobre el CI/CD |
| 1.2 | Diagrama pipeline | 10 | Diagrama visual claro que muestra las 4 fases solicitadas y sus interacciones | Diagrama confuso o ausente |
| 1.3 | Organización de repositorio | 5 | Uso correcto de la carpeta `/P7` y workflows en `.github/workflows` | Directorios desordenados |
| 1.4 | Preguntas teóricas | 15 | Analiza e interioriza conceptos clave sobre CI/CD y DevOps de forma concisa | Respuestas copiadas o sin análisis |

### 2. Conocimiento (60 pts)
| # | Criterio | Pts | Satisfactorio (100-61%) | Necesita mejorar (60-0%) |
|---|---|---|---|---|
| 2.1 | Pipeline CI/CD | 20 | El pipeline realiza build y test exitosamente ante nuevos commits/PR | El workflow falla en ejecución o faltan etapas |
| 2.2 | Automatización Docker | 15 | Logra empaquetar y hacer push automático al registry configurado | Falla la construcción de la imagen o el taggeo/push |
| 2.3 | Deploy automático | 15 | Aplica correctamente los cambios en el clúster (K8s) vía automatización | Requiere despliegue manual o la acción de deploy falla |
| 2.4 | Versionamiento | 10 | Uso adecuado de tags, branches o releases que disparan correctamente las acciones | Disparadores mal configurados o descontrol de versiones |

## Notas para el desarrollo (guía de trabajo)

- Estructurar el repo con carpeta `/P7` conteniendo el código y `.github/workflows/*.yml`.
- El pipeline debe tener al menos 4 etapas: **build → test → dockerización → despliegue**.
- Usar secretos de GitHub (`Settings > Secrets`) para credenciales de DockerHub/GHCR y del clúster k8s — nunca hardcodear credenciales en el YAML.
- Documentar el flujo (qué hace cada job/step) y adjuntar capturas de ejecuciones exitosas en Actions.
- Incluir un diagrama (puede ser Mermaid, draw.io, etc.) que muestre las fases del pipeline y cómo se conectan.
- Verificar que el disparador (`on: push`, `on: pull_request`, tags, etc.) esté bien configurado para que el pipeline se ejecute automáticamente.