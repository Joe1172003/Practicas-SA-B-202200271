# Comandos - Práctica 6 (GKE)

Referencia para conectarme al clúster, ver el estado de todo, y reiniciar lo
que se caiga. Ojo: `gcloud` no queda en el PATH de una terminal nueva hasta
reiniciarla, así que si abrís una terminal fresca corré primero esto:

```powershell
$env:PATH = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH
```

(o simplemente cerrá y volvé a abrir la terminal después de instalar el SDK,
ahí sí queda permanente).

---

## 1. Conectarme al clúster desde una terminal nueva

Si `kubectl` te dice que no encuentra el clúster o apunta a otro (por ejemplo
minikube), reconectate así:

```powershell
gcloud config set project sa-p6-202200271
gcloud container clusters get-credentials sa-p6 --zone=us-central1-a
```

Verificá que apunta a donde debe:

```powershell
kubectl config current-context
```

Tiene que decir `gke_sa-p6-202200271_us-central1-a_sa-p6`. Si dice
`minikube`, corré:

```powershell
kubectl config use-context gke_sa-p6-202200271_us-central1-a_sa-p6
```

---

## 2. Ver el estado de todo

### Los nodos (las 3 VMs que forman el clúster)

```powershell
kubectl get nodes
```
Tienen que decir `Ready`. Si alguno dice `NotReady` o `Unknown`, andá a la
sección 4.

### Los pods de la plataforma

```powershell
kubectl get pods -n sa-p5
```

### Deployments, StatefulSet y Services juntos

```powershell
kubectl get deploy,statefulset,svc -n sa-p5
```

### Todo lo del clúster, incluidos los componentes internos de GKE

```powershell
kubectl get pods -A
```
Los namespaces `kube-system`, `gmp-system` y `gke-managed-cim` son cosas que
administra Google, no las tocás nunca.

### El release de Helm

```powershell
helm list -A
helm history sa-p6
```

### Desde la consola web, sin terminal

```
https://console.cloud.google.com/kubernetes/workload/overview?project=sa-p6-202200271
```

---

## 3. Reiniciar cosas que se cayeron

### Un Pod puntual que quedó colgado o en `CrashLoopBackOff`

Borrarlo alcanza: el Deployment (o StatefulSet) le crea uno nuevo solo.

```powershell
kubectl delete pod <nombre-del-pod> -n sa-p5
```

### Todos los Pods de un Deployment a la vez (reinicio limpio)

```powershell
kubectl rollout restart deployment/sa-p6-auth -n sa-p5
kubectl rollout status deployment/sa-p6-auth -n sa-p5
```
Cambiá `sa-p6-auth` por `sa-p6-gateway`, `sa-p6-productos`, `sa-p6-ordenes` o
`sa-p6-notificaciones` según cuál necesites.

### El StatefulSet de Postgres o RabbitMQ

Igual que un Deployment, mismo comando:

```powershell
kubectl rollout restart statefulset/sa-p6-postgres -n sa-p5
kubectl rollout restart statefulset/sa-p6-rabbitmq -n sa-p5
```

### Un Service

Los Services casi nunca "se caen" solos — son solo una dirección de red, no
un proceso. Si algo no responde, el problema está en el Pod detrás, no en el
Service. Para confirmar a quién apunta:

```powershell
kubectl get endpoints <nombre-del-service> -n sa-p5
```
Si sale vacío, es que ningún Pod sano tiene las etiquetas correctas — ahí el
arreglo es sobre el Pod/Deployment, no sobre el Service.

### Un nodo entero (la VM) que se apagó — esto ya nos pasó una vez

Primero confirmá si de verdad está apagada, del lado de Compute Engine:

```powershell
gcloud compute instances list
```

Si dice `TERMINATED`, arrancala:

```powershell
gcloud compute instances start <nombre-de-la-vm> --zone=us-central1-a
```

Los nombres de las 3 VMs de este clúster:
```
gke-sa-p6-default-pool-887832fc-273f
gke-sa-p6-default-pool-887832fc-c266
gke-sa-p6-default-pool-887832fc-jqvx
```

Esperá un minuto y confirmá que Kubernetes ya la ve:

```powershell
kubectl get nodes
```

**Si las 3 se apagaron solas otra vez:** revisá primero que la cuenta de
facturación siga en modo "Cuenta pagada" y no haya vuelto a "prueba
gratuita" — fue la causa la primera vez.
```
https://console.cloud.google.com/billing/012B89-17A5FE-AF3C4B?project=sa-p6-202200271
```

### El clúster entero no responde (`kubectl` tira timeout)

Primero confirmá si el clúster en sí está sano, sin pasar por `kubectl`:

```powershell
gcloud container clusters describe sa-p6 --zone=us-central1-a --format="value(status)"
```

Si dice `RUNNING`, el problema es de conectividad puntual (a veces pasajero,
reintentá en un minuto). Si dice otra cosa, revisá la consola:
```
https://console.cloud.google.com/kubernetes/list/overview?project=sa-p6-202200271
```

---

## 4. Diagnóstico rápido cuando algo no anda

```powershell
# Por qué un pod no arranca
kubectl describe pod <nombre-del-pod> -n sa-p5

# Logs del pod actual de un Deployment
kubectl logs -n sa-p5 deploy/sa-p6-auth --tail=30

# Logs de un pod puntual (StatefulSet)
kubectl logs -n sa-p5 sa-p6-postgres-0 --tail=30

# Eventos recientes del namespace, ordenados por tiempo
kubectl get events -n sa-p5 --sort-by=.lastTimestamp
```

---

## 5. Apagar el clúster sin borrar nada (después de la calificación)

Escala el node pool a 0. Apaga las 3 VMs, que son las que cobran por hora,
y deja intacto el clúster, el release de Helm y los datos de los PVC.

```powershell
gcloud container clusters resize sa-p6 --node-pool=default-pool --num-nodes=0 --zone=us-central1-a
```

Para levantarlo de nuevo, mismo comando con `--num-nodes=2`. No hace falta
reinstalar nada con Helm — todo vuelve exactamente como estaba.

```powershell
gcloud container clusters resize sa-p6 --node-pool=default-pool --num-nodes=2 --zone=us-central1-a
```

---

## 6. Probar que el sistema responde desde afuera

```powershell
Invoke-RestMethod -Uri "http://<IP-PUBLICA>.nip.io/health"
```
