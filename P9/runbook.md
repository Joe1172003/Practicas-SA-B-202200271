# Runbook de recuperación

Si el clúster desaparece, esto es lo que hago para traerlo de vuelta. Lo escribí
pensando en alguien que nunca vio este sistema y que tiene que levantarlo solo.

La parte importante cabe en una línea: un solo comando reconstruye todo. Lo demás
es llegar hasta ese comando y después comprobar que el sistema quedó bien.

Calculo unos 30 minutos. De esos, 25 son esperar a Google.

## Antes de empezar

Te hacen falta dos cosas.

Acceso al proyecto de Google Cloud `sa-p6-202200271`, con permiso de editor.

Y cinco programas: `gcloud`, `terraform`, `kubectl`, `helm` y `velero`. Si no
quieres instalar nada, abre Cloud Shell desde la consola de Google. Ya trae los
primeros cuatro y solo le falta velero:

```bash
curl -sSL -o velero.tar.gz https://github.com/vmware-tanzu/velero/releases/download/v1.18.2/velero-v1.18.2-linux-amd64.tar.gz
tar -xzf velero.tar.gz && sudo mv velero-v1.18.2-linux-amd64/velero /usr/local/bin/
```

Yo recomiendo Cloud Shell. En el simulacro se me cayó el internet a mitad de la
reconstrucción y tuve que destrabar el estado de Terraform a mano. Con Cloud Shell
el trabajo corre en la nube de Google y no depende de tu conexión.

## Paso 1: bajar el código

```bash
git clone https://github.com/Joe1172003/Practicas-SA-B-202200271.git
cd Practicas-SA-B-202200271/P9
```

## Paso 2: entrar a Google Cloud

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project sa-p6-202200271
```

Terraform usa el segundo comando. Si te lo saltas, truena en cuanto arranca con
un error de credenciales.

Para comprobarlo:
```bash
gcloud auth application-default print-access-token
```
Si imprime un texto largo, ya puedes seguir.

## Paso 3: reconstruir

```bash
bash bootstrap/reconstruir.sh
```

Ese es el comando. El script hace nueve cosas en orden y anota la hora de cada
una:

1. Revisa que tengas las herramientas y la sesión abierta.
2. Crea el bucket donde Terraform guarda su registro, si todavía no existe.
3. Levanta lo que sobrevive a un desastre: el bucket de respaldos, la IP pública y
   la copia de la llave de los secretos.
4. Crea el clúster, los 3 nodos y ArgoCD. Es el paso largo, unos 14 minutos.
5. Conecta `kubectl` al clúster nuevo.
6. Espera a que ArgoCD despliegue las 15 aplicaciones, otros 9 minutos más o menos.
7. Busca el último respaldo de Velero y devuelve los datos a la base.
8. Prueba que el sistema responda.
9. Imprime los tiempos.

Mientras corre no tienes que tocar nada. Si parece colgado, fíjate en el contador
de `Still creating...`. GKE se toma entre 10 y 12 minutos para entregar los nodos
y no hay forma de apurarlo.

Si prefieres arrancar con la base vacía, sin restaurar datos:
```bash
bash bootstrap/reconstruir.sh --sin-datos
```

## Paso 4: comprobar que quedó bien

Son tres revisiones. Si pasan las tres, la restauración salió bien.

Los comandos son para Linux, Cloud Shell o Git Bash. La versión para PowerShell
está al final de este paso.

### Las aplicaciones

```bash
kubectl -n argocd get app
```
Tienen que salir 15, todas en `Synced` y `Healthy`.

### El sistema desde afuera

`136.113.9.71.nip.io` apunta sola a la IP del sistema, así que no hay que
configurar ningún DNS.
```bash
curl http://136.113.9.71.nip.io/health
```
Tiene que responder `{"estado":"ok","servicio":"api-gateway","version":"2.2.1"}`.

### Los datos

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"query":"{ productos { nombre precio } }"}' \
  http://136.113.9.71.nip.io/graphql/productos
```
Devuelve el catálogo con sus productos y precios. Si llega una lista vacía, los
datos no volvieron: revisa lo que imprimió el paso 7 del script.

### Desde PowerShell

En PowerShell, `curl` es otro programa y no entiende esas opciones. Usa estos dos:
```powershell
curl.exe http://136.113.9.71.nip.io/health

Invoke-RestMethod -Uri "http://136.113.9.71.nip.io/graphql/productos" -Method Post -ContentType "application/json" -Body '{"query":"{ productos { nombre precio } }"}' | ConvertTo-Json -Depth 5
```

## Si algo sale mal

Estos cuatro problemas me pasaron de verdad en el simulacro. Los dejo con la
solución que me funcionó, para que no tengas que averiguarla otra vez.

### El clúster no se deja destruir: `context deadline exceeded`

Las aplicaciones de ArgoCD esperan a que ArgoCD las limpie antes de borrarse.
Para ese momento ArgoCD ya no existe, y Terraform se queda esperando hasta que se
le acaba el tiempo. Quítales esa condición:
```bash
kubectl -n argocd get applications -o name | while read a; do
  kubectl -n argocd patch "$a" --type merge -p '{"metadata":{"finalizers":null}}'
done
```

### Terraform dice `Error acquiring the state lock`

Un proceso anterior quedó a medias, casi siempre por una caída de red, y dejó el
candado puesto. El número para quitarlo viene en la línea `ID:` del mismo
mensaje:
```bash
cd terraform/cluster
terraform force-unlock EL_NUMERO_DEL_MENSAJE
```
Úsalo solo si estás seguro de que nadie más está aplicando cambios.

### Terraform dice `Error 409: Already exists`

Google alcanzó a crear recursos que Terraform no llegó a anotar en su registro.
Lo más rápido es borrarlos y empezar de nuevo:
```bash
gcloud container clusters delete sa-p9 --zone us-central1-a --quiet
gcloud iam service-accounts delete nodos-sa-p9@sa-p6-202200271.iam.gserviceaccount.com --quiet
```
Después repite el paso 3.

### La restauración queda en `PartiallyFailed`

Casi siempre es porque la copia del disco todavía se está subiendo a Google. El
script reintenta una vez. Si vuelve a fallar, espera un par de minutos, confirma
que todas las copias digan `READY` y córrelo otra vez:
```bash
gcloud compute snapshots list
```

## Para mirar por dentro

La consola de ArgoCD se abre con:
```bash
kubectl -n argocd port-forward svc/argocd-server 8080:80
```
Entras a `http://localhost:8080` con el usuario `admin`. La contraseña cambia en
cada reconstrucción y la sacas con esto, desde Git Bash o Cloud Shell:
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

Y para ver qué respaldos hay:
```bash
velero backup get
```
