# Informe de incidente: versión 2.3.0 del gateway

Simulacro del 15/09/2026 en el namespace `sa-p8` de GKE. Horas en UTC. La evidencia completa está en [fallo-inducido-2.3.0.txt](../evidencias/rollouts/fallo-inducido-2.3.0.txt).

## Qué falló

Metí a propósito una espera de 1 segundo en cada consulta al catálogo del gateway (`POST /graphql/productos`). Es una regresión de rendimiento: el gateway seguía respondiendo 200 con los datos correctos, pero lento. El cambio vive solo en la rama `fallo-inducido` y en el tag `v2.3.0` (commit `3e7a2d2`), nunca en `main`. Pasó todos los controles previos (12 de 12 tests unitarios, Trivy sin CVE críticas, la firma de Cosign y las 4 políticas de Kyverno) porque ninguno mide tiempos.

## Cómo se detectó

La frenó la prueba de carga del paso 2 del canary, el `AnalysisTemplate` `gateway-carga`: k6 con 5 usuarios durante 30 segundos contra `gateway-canary`, que apunta solo a la versión nueva. El p95 dio 1041 ms contra un umbral de 300 ms (`http_req_duration p(95)<300`, unas 6 veces los 52 ms que medí en la 2.0.0). Errores 0% y checks 100%: falló solo el umbral de tiempo. k6 salió con código 99, el Job falló y el AnalysisRun `gateway-576476b548-3-3` quedó en Failed. Humo e integración, en el paso anterior, habían pasado porque `/health` no toca el catálogo.

## Cómo se contuvo

Argo Rollouts abortó solo a las 16:57:53: bajó el peso del Ingress canary de 30% a 0%, devolvió el Service `gateway-canary` a la versión estable y apagó el Pod de la 2.3.0. Nadie intervino en la reversión, y eso que el PR con el defecto lo aprobé yo. El tráfico afectado fue el 10% durante 26 segundos y el 30% durante 48.

## Tiempo de recuperación

3 minutos y 20 segundos (3,3 minutos) entre la publicación en producción, el merge del PR GitOps #7 a las 16:54:33, y el retorno al 100% en la 2.2.0 a las 16:57:53. De ese total, los usuarios estuvieron expuestos 1 minuto y 14 segundos; el resto fue la espera de ArgoCD, más larga porque apreté Restart por error en el dashboard. Desde el push del tag (16:47:31) son 10 minutos y 22 segundos. Después hice Revert del PR #7 para que Git volviera a pedir la 2.2.0: a las 17:13:10 las 10 apps de ArgoCD estaban otra vez Synced y Healthy.

## Cómo prevenirlo

Con una puerta de rendimiento en el pipeline. Hoy `p8-gitops.yml` construye, prueba, analiza y firma la imagen, pero no mide cuánto tarda en responder. Le agregaría un job que levante con Docker Compose el gateway, productos y postgres recién construidos, y les corra el mismo `carga.js` con el umbral de p95 < 300 ms dentro de la Puerta de calidad. La 2.3.0 se habría quedado en el PR, como Trivy frenó el PR #3, sin llegar al canary. El canary seguiría como segunda red, para lo que solo aparece con tráfico real.
