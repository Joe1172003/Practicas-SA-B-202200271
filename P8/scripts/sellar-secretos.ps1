# Sella los 8 secretos de la plataforma y deja los SealedSecret en el repo GitOps.
# Las contrasenas se generan al azar aqui mismo y nunca se muestran en pantalla.
#
# Uso, desde la raiz del repo de codigo:
#   powershell -ExecutionPolicy Bypass -File P8\scripts\sellar-secretos.ps1
#
# La copia en texto plano queda FUERA de los dos repos, en mi carpeta de usuario.
# Si vuelvo a correr el script, reutiliza esa copia en vez de inventar
# contrasenas nuevas: Postgres y RabbitMQ guardan la primera en su disco, y con
# otra distinta dejarian de aceptar a los servicios.

param(
  [string]$RepoGitops = "$HOME\Desktop\sa-p8-gitops",
  [string]$Namespace  = "sa-p8",
  [string]$Contexto   = "gke_sa-p6-202200271_us-central1-a_sa-p6"
)

$ErrorActionPreference = "Stop"

# kubeseal baja la llave publica del cluster al que apunta kubectl. Sellar
# contra minikube por error dejaria secretos que GKE no puede abrir.
$actual = kubectl config current-context
if ($actual -ne $Contexto) { throw "kubectl apunta a '$actual' y no a '$Contexto'." }

$copiaLocal = Join-Path $HOME ".sa-p8\secretos.json"

function Nuevos-Bytes([int]$cantidad) {
  $buffer = New-Object byte[] $cantidad
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return , $buffer
}
function Nuevo-Hex([int]$cantidad) { -join ((Nuevos-Bytes $cantidad) | ForEach-Object { $_.ToString("x2") }) }
function Nuevo-Base64([int]$cantidad) { [Convert]::ToBase64String((Nuevos-Bytes $cantidad)) }

# 1. Las piezas sueltas se generan una sola vez.
if (Test-Path $copiaLocal) {
  Write-Host "Reutilizo las contrasenas guardadas en $copiaLocal"
  $p = Get-Content $copiaLocal -Raw | ConvertFrom-Json
} else {
  Write-Host "Genero contrasenas nuevas y guardo la copia en $copiaLocal"
  $p = [pscustomobject]@{
    # Hexadecimal: van dentro de URLs y asi no hay caracteres que escapar.
    postgresPassword = Nuevo-Hex 24
    rabbitmqPassword = Nuevo-Hex 24
    erlangCookie     = Nuevo-Hex 32
    # auth exige minimo 32 caracteres para firmar el JWT.
    jwtSecret        = Nuevo-Hex 32
    # auth exige exactamente 32 bytes en base64 para AES-256.
    aesKey           = Nuevo-Base64 32
    blindIndexKey    = Nuevo-Base64 32
  }
  New-Item -ItemType Directory -Force (Split-Path $copiaLocal) | Out-Null
  $p | ConvertTo-Json | Set-Content -Encoding ascii $copiaLocal
}

# 2. Las URLs se arman con esas piezas. Los hosts son los Services de sa-p8.
$usuarioPg = "postgres"
function Url-Postgres([string]$base) { "postgresql://${usuarioPg}:$($p.postgresPassword)@postgres:5432/$base" }
$urlRabbit = "amqp://sa_p8:$($p.rabbitmqPassword)@rabbitmq:5672"

# 3. Cada Secret con las claves que lee su chart. El nombre final es <clave>-secreto.
$secretos = [ordered]@{
  "postgres"       = @{ POSTGRES_USER = $usuarioPg; POSTGRES_PASSWORD = $p.postgresPassword }
  "rabbitmq"       = @{ "rabbitmq-password" = $p.rabbitmqPassword; "rabbitmq-erlang-cookie" = $p.erlangCookie }
  "auth"           = @{ DATABASE_URL = (Url-Postgres "db_auth"); RABBITMQ_URL = $urlRabbit; JWT_SECRET = $p.jwtSecret; AES_KEY = $p.aesKey; BLIND_INDEX_KEY = $p.blindIndexKey }
  "productos"      = @{ DATABASE_URL = (Url-Postgres "db_productos") }
  "ordenes"        = @{ DATABASE_URL = (Url-Postgres "db_ordenes"); RABBITMQ_URL = $urlRabbit }
  "notificaciones" = @{ DATABASE_URL = (Url-Postgres "db_notificaciones"); RABBITMQ_URL = $urlRabbit }
  # Los dos cronjobs comparten base: bitacora escribe y resumen lee y publica.
  "bitacora"       = @{ DATABASE_URL = (Url-Postgres "db_bitacora") }
  "resumen"        = @{ DATABASE_URL = (Url-Postgres "db_bitacora"); RABBITMQ_URL = $urlRabbit }
}

$carpeta = Join-Path $RepoGitops "secretos"
New-Item -ItemType Directory -Force $carpeta | Out-Null

# 4. El Secret se arma en memoria y entra a kubeseal por la tuberia: el texto
#    plano nunca se escribe en ningun repo. kubeseal guarda solo lo cifrado.
foreach ($componente in $secretos.Keys) {
  $secret = @{
    apiVersion = "v1"
    kind       = "Secret"
    type       = "Opaque"
    metadata   = @{ name = "$componente-secreto"; namespace = $Namespace }
    stringData = $secretos[$componente]
  }
  $salida = Join-Path $carpeta "$componente.yaml"
  $secret | ConvertTo-Json -Depth 5 |
    kubeseal --controller-namespace sealed-secrets --controller-name sealed-secrets-controller -o yaml -w $salida
  if ($LASTEXITCODE -ne 0) { throw "kubeseal fallo con $componente" }
  Write-Host "  sellado: secretos\$componente.yaml"
}

Write-Host "Listo: 8 archivos cifrados en $carpeta"
