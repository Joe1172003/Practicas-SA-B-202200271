# Práctica 4 — Contratos de los microservicios

Referencia para probar el sistema con Postman. Todo entra por el **API Gateway**
en `http://localhost:3000`, que es el único punto público.

> Este documento cubre solo los contratos (ruta, cuerpo, respuesta). Los
> diagramas, los principios SOLID y las preguntas teóricas van aparte.

---

## Antes de empezar

### 1. Levantar el sistema

```bash
cd P4
docker compose up -d --build
```

Esperá a que los seis contenedores estén arriba:

```bash
docker compose ps
```

`auth`, `productos`, `ordenes`, `notificaciones` y `postgres` deben decir
`(healthy)`.

### 2. Configurar Postman

**Esto es obligatorio o nada va a funcionar.** El JWT viaja en una cookie
`HttpOnly`, no en un header `Authorization`.

| Dónde | Qué activar |
|---|---|
| Settings → General | **Automatically follow redirects**: ON |
| Pestaña Cookies (bajo el botón Send) | Que exista el dominio `localhost` |

Postman guarda y reenvía las cookies solo si el *cookie jar* está activo. Si
hacés login y `GET /auth/me` te da 401, es que la cookie no se está mandando.

**Variable de entorno recomendada:**

| Variable | Valor |
|---|---|
| `gateway` | `http://localhost:3000` |

### 3. Puertos

| Servicio | Puerto | ¿Público? |
|---|---|---|
| **gateway** | 3000 | **Sí — usá este** |
| auth | 3001 | Solo para depurar |
| productos | 3002 | Solo para depurar / GraphQL Sandbox |
| ordenes | 3003 | Solo para depurar / GraphQL Sandbox |
| notificaciones | 3004 | Solo para depurar |
| postgres | 5433 | Para pgAdmin / DBeaver |

---

## Índice

- [Salud del sistema](#salud-del-sistema)
- [1. AUTH](#1-auth--autenticación)
- [2. PRODUCTOS](#2-productos--catálogo-graphql)
- [3. ÓRDENES](#3-ÓRDENES-GraphQL)
- [4. NOTIFICACIONES](#4-notificaciones)

---

## Salud del sistema

### `GET {{gateway}}/health`

Sin cuerpo, sin sesión.

```json
{
  "estado": "ok",
  "servicio": "api-gateway",
  "hora": "2026-08-19T22:52:57.178Z"
}
```

---

# 1. AUTH — Autenticación

Microservicio de la Práctica 2 convertido. Dueño de usuarios y roles.
El gateway conserva los mismos nombres de ruta que tenía la P2.

---

### `POST {{gateway}}/auth/register`

Crea una cuenta, devuelve la cookie con el JWT y dispara la notificación de
bienvenida al servicio en Python.

**Headers**

```
Content-Type: application/json
```

**Body**

```json
{
  "nombre": "Sergio Rodas",
  "correo": "sergio@test.com",
  "password": "password123",
  "rol": "ADMIN"
}
```

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `nombre` | string | Sí | 2 a 100 caracteres |
| `correo` | string | Sí | formato de correo, máx. 160 |
| `password` | string | Sí | 8 a 72 caracteres |
| `rol` | string | No | `ADMIN` o `CLIENTE`. Por defecto `CLIENTE` |

> Necesitás al menos **un usuario ADMIN** para poder crear productos.
> Registrá uno con `"rol": "ADMIN"`.

**Respuesta `201 Created`**

```json
{
  "mensaje": "Cuenta creada correctamente",
  "usuario": {
    "id": "94205ef1-86f1-4c2f-97c6-14fd94a3d0ce",
    "nombre": "Sergio Rodas",
    "correo": "sergio@test.com",
    "rol": "ADMIN"
  }
}
```

Además viene el header:

```
Set-Cookie: access_token=eyJhbGci...; Path=/; HttpOnly; SameSite=Lax; Max-Age=1200
```

**Otras respuestas**

| Código | Cuándo |
|---|---|
| `400` | Datos inválidos (contraseña corta, correo malformado…) |
| `409` | Ya existe una cuenta con ese correo |
| `503` | El microservicio de auth no responde |

---

### `POST {{gateway}}/auth/login`

**Body**

```json
{
  "correo": "sergio@test.com",
  "password": "password123"
}
```

**Respuesta `200 OK`** — igual que el registro, con `Set-Cookie`.

```json
{
  "mensaje": "Inicio de sesión correcto",
  "usuario": {
    "id": "94205ef1-86f1-4c2f-97c6-14fd94a3d0ce",
    "nombre": "Sergio Rodas",
    "correo": "sergio@test.com",
    "rol": "ADMIN"
  }
}
```

| Código | Cuándo |
|---|---|
| `401` | Correo o contraseña incorrectos |

> El mensaje del 401 es el mismo si el correo no existe o si la contraseña
> está mal. Es a propósito: evita que alguien descubra qué correos están
> registrados.

---

### `GET {{gateway}}/auth/me`

Devuelve el perfil del dueño de la cookie. **Requiere sesión.**

Sin body.

**Respuesta `200 OK`**

```json
{
  "usuario": {
    "id": "94205ef1-86f1-4c2f-97c6-14fd94a3d0ce",
    "nombre": "Sergio Rodas",
    "correo": "sergio@test.com",
    "rol": "ADMIN"
  }
}
```

| Código | Cuándo |
|---|---|
| `401` | No hay cookie, o el token es inválido o ya expiró |

> Si el token venció hace poco (dentro del periodo de gracia), la respuesta trae
> un `Set-Cookie` nuevo: es la renovación automática de la Práctica 2, que
> sigue viva a través del gateway.

---

### `POST {{gateway}}/auth/logout`

Borra la cookie. Sin body. No requiere que el token siga siendo válido.

**Respuesta `200 OK`**

```json
{ "mensaje": "Sesión cerrada" }
```

---

# 2. PRODUCTOS — Catálogo GraphQL

**Todas las operaciones van a la misma ruta y con el mismo método:**

```
POST {{gateway}}/graphql/productos
Content-Type: application/json
```

**Estructura del body — siempre esta:**

```json
{
  "query": "...",
  "variables": {}
}
```

> `variables` es opcional. **No mandés ningún otro campo**: el gateway rechaza
> con `400` cualquier propiedad que no sea `query`, `variables` u
> `operationName`.

**Sesión:** las consultas son públicas (podés ver el catálogo sin login). Las
mutaciones exigen rol **ADMIN**.

---

## Tipos del esquema

```graphql
type Producto {
  id: ID!
  nombre: String!
  descripcion: String!
  precio: Float!
  stockDisponible: Int!
  stockApartado: Int!
  categoriaId: ID!
  categoria: Categoria!
}

type Categoria {
  id: ID!
  nombre: String!
}
```

---

### Query `categorias`

Empezá por aquí: necesitás un `categoriaId` para crear productos, y **no existe
mutación para crear categorías** (vienen sembradas al arrancar).

```GraphQL
{
    categorias {
        id
        nombre
    }
}
```

**Respuesta**

```json
{
    "data": {
        "categorias": [
            {
                "id": "3e20db8f-fc63-4b17-9d7e-621ecc8fdd13",
                "nombre": "Accesorios"
            },
            {
                "id": "314da74d-4359-4a0c-8425-a403f908ea2e",
                "nombre": "Celulares"
            },
            {
                "id": "6b30874c-57b6-4649-bdf7-b6b2116482c8",
                "nombre": "Laptops"
            }
        ]
    }
}
```

---

### Query `productos`

Dos filtros opcionales que se combinan con AND.

| Argumento | Tipo | Qué hace |
|---|---|---|
| `categoria` | String | Nombre exacto de la categoría (sin distinguir mayúsculas) |
| `busqueda` | String | Texto contenido en el nombre del producto |

**Sin filtros**
#### Listar productos
```GraphQL
{
    productos {
        id
        nombre
        descripcion
        precio
        stockDisponible
        stockApartado
        categoria {
            nombre
        }
    }
}
```
#### Buscar productos

**Con filtros, usando variables**

#### QUERY
```GraphQL
query ($categoria: String, $busqueda: String) {
    productos(categoria: $categoria, busqueda: $busqueda){
        id
        nombre
        precio
        stockDisponible
    }
}
```
#### GRAPHQL VARIABLES
```GraphQL
{
    "categoria": "Laptops",
    "busqueda": "Lenovo"
}
```


**Respuesta**

```json
{
  "data": {
    "productos": [
      {
        "id": "8df84adf-2bf0-4b6b-bdde-6bacf72bcb11",
        "nombre": "Laptop Lenovo ThinkPad",
        "precio": 8500,
        "stockDisponible": 10
      }
    ]
  }
}
```

---

#### Buscar por id

Uno solo, por id.


#### QUERY
```GraphQL
query ($id: ID!) {
    producto(id: $id){
        id
        nombre
        precio
        stockDisponible
        categoria{
            nombre
        }
    }
}
```
#### GRAPHQL VARIABLES
```GraphQL
{
    "id": "7c26c693-c4fc-4a88-9bf5-04273c832b61"
}
```

**Respuesta si no existe** — devuelve `null`, no un error:

```json
{ "data": { "producto": null } }
```

**si Existe ejemplo**
```json
{
    "data": {
        "producto": {
            "id": "7c26c693-c4fc-4a88-9bf5-04273c832b61",
            "nombre": "Celular Samsung A54",
            "precio": 2300.5,
            "stockDisponible": 25,
            "categoria": {
                "nombre": "Celulares"
            }
        }
    }
}
```

---

### Mutation `crearProducto` — solo ADMIN

**Requiere cookie de un usuario con rol `ADMIN`.**

#### QUERY
```GraphQL
mutation ($input: CrearProductoInput!) {
  crearProducto(input: $input) {
    id
    nombre
    precio
    stockDisponible
    categoria {
      nombre
    }
  }
}
```

#### GRAPHQL VARIABLES
```GraphQL
{
  "input": {
    "nombre": "Iphone 16",
    "descripcion": "Camara 120 MGPX",
    "precio": 5000,
    "stockDisponible": 8,
    "categoriaId": "314da74d-4359-4a0c-8425-a403f908ea2e"
  }
}
```

**`CrearProductoInput`**

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `nombre` | String | Sí | máx. 150 caracteres |
| `descripcion` | String | Sí | no vacío |
| `precio` | Float | Sí | mayor a 0, máx. 2 decimales |
| `stockDisponible` | Int | Sí | entero ≥ 0 |
| `categoriaId` | String | Sí | UUID de una categoría existente |

**Respuesta**

```json
{
    "data": {
        "crearProducto": {
            "id": "e7e07ef2-7ca1-4e86-8cb4-6be02d144f58",
            "nombre": "Iphone 16",
            "precio": 5000,
            "stockDisponible": 8,
            "categoria": {
                "nombre": "Celulares"
            }
        }
    }
}
```

**Errores**

| Mensaje | Cuándo |
|---|---|
| `Esta operación requiere iniciar sesión` | Sin cookie |
| `Solo un usuario con rol ADMIN puede modificar el catálogo` | Sesión de CLIENTE |
| `El precio tiene que ser mayor a cero` | Validación |
| `La categoría indicada no existe` | `categoriaId` inválido |

---

### Mutation `actualizarProducto` — solo ADMIN

Todos los campos del input son **opcionales**: se cambia solo lo que mandés.

#### QUERY
```GraphQL
mutation ($id: ID!, $input: ActualizarProductoInput!) {
  actualizarProducto(id: $id, input: $input) {
    id
    nombre
    precio
    stockDisponible
    categoria {
        nombre
    }
  }
}
```
#### GRAPHQL VARIABLES
```GraphQL
{
    "id": "bd9f436a-fbc1-43aa-9ab0-84875ef3b249",
    "input": {
        "nombre": "Iphone 16 Pro Max",
        "precio": 7000,
        "stockDisponible": 12
    }
}
```

**Respuesta**

```json
{
    "data": {
        "actualizarProducto": {
            "id": "bd9f436a-fbc1-43aa-9ab0-84875ef3b249",
            "nombre": "Iphone 16 Pro Max",
            "precio": 7000,
            "stockDisponible": 12,
            "categoria": {
                "nombre": "Celulares"
            }
        }
    }
}
```


**`ActualizarProductoInput`** — mismos campos y reglas que `CrearProductoInput`,
pero todos opcionales.

> **No se puede modificar `stockApartado` desde aquí.** Esa columna solo la
> mueven los endpoints internos como parte de la saga; si un ADMIN pudiera
> editarla a mano, dejaría el inventario descuadrado respecto a las órdenes en
> curso.

---

# 3-ÓRDENES-GraphQL

```
POST {{gateway}}/graphql/ordenes
Content-Type: application/json
```

**Todas las operaciones exigen sesión.** Sin cookie el gateway responde `401` antes de siquiera llamar al microservicio.


### Crear ordenes

#### QUERY
```GraphQL
mutation ($input: CrearOrdenInput!){
    crearOrden(input: $input) { 
        id
        estado
        total
        motivo
        lineas { 
            productoId
            nombreProducto
            precioUnitario
            cantidad
        }
    } 
}
```

### GRAPHQL VARIABLES
```GraphQL
{
  "input": {
    "claveIdempotencia": "{{$guid}}",
    "lineas": [
        { 
            "productoId": "570ef1cf-e65c-4472-833b-9ef7536deab6",
            "cantidad": 2 
        },
        {
            "productoId": "60c36600-e917-4c44-bc6e-01c0044ba598",
            "cantidad": 7 
        }
    ]
  }
}
```

**Respuesta con éxito** — `PENDIENTE`

```json
{
    "data": {
        "crearOrden": {
            "id": "efcf03b7-bc60-43b8-b59c-0db44d00599b",
            "estado": "PENDIENTE",
            "total": 120,
            "motivo": null,
            "lineas": [
                {
                    "productoId": "570ef1cf-e65c-4472-833b-9ef7536deab6",
                    "nombreProducto": "Mouse Logitech M170",
                    "precioUnitario": 120,
                    "cantidad": 1
                }
            ]
        }
    }
}
```   


**`CrearOrdenInput`**

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `claveIdempotencia` | String | Sí | **UUID v4** |
| `lineas` | [LineaDeOrdenInput!]! | Sí | al menos 1 elemento |

**`LineaDeOrdenInput`**

| Campo | Tipo | Reglas |
|---|---|---|
| `productoId` | ID | UUID v4 de un producto existente |
| `cantidad` | Int | entero ≥ 1 |

> **`{{$guid}}` es una variable dinámica de Postman**: genera un UUID v4 nuevo
> en cada envío. Usala tal cual y no tenés que inventar la clave a mano.
>
> Para **probar la idempotencia**, poné un UUID fijo y mandá la petición dos veces: te devuelve la misma orden y el stock baja una sola vez.


### Confirmar pago


#### QUERY
```GraphQL
mutation ($id: ID!){
    confirmarPago(ordenId: $id){
        id 
        estado
        total
        motivo
        lineas {
            nombreProducto
            precioUnitario
        }
    }
}
```

#### Variables
```
  {
    "id": "bd27934d-78c7-4c6c-9ddb-2b5b3f449068"
  }
```

**Respuesta**

```json
{
    "data": {
        "confirmarPago": {
            "id": "bd27934d-78c7-4c6c-9ddb-2b5b3f449068",
            "estado": "PAGADA",
            "total": 59740,
            "motivo": null,
            "lineas": [
                {
                    "nombreProducto": "Mouse Logitech M170",
                    "precioUnitario": 120
                },
                {
                    "nombreProducto": "Laptop Lenovo ThinkPad",
                    "precioUnitario": 8500
                }
            ]
        }
    }
}
```

| Error | Cuándo |
|---|---|
| `No se puede pagar una orden en estado PAGADA` | Ya estaba pagada |
| `No se puede pagar una orden en estado CANCELADA` | Ya se canceló |
| `La orden no existe` | Id inválido, o la orden es de otro usuario |

---

### Cancelar orden

**Aquí es donde se ve la compensación de la saga.** Solo funciona sobre órdenes `PENDIENTE`.

#### QUERY
```GraphQL
mutation ($id: ID!) {
    cancelarOrden(ordenId: $id) {
        id
        estado
        motivo
    } 
}
```

#### VARIABLES
```GraphQL
  {
      "id": "efcf03b7-bc60-43b8-b59c-0db44d00599b"
  }
```


**Respuesta**
```json
{
    "data": {
        "cancelarOrden": {
            "id": "efcf03b7-bc60-43b8-b59c-0db44d00599b",
            "estado": "CANCELADA",
            "motivo": "Cancelada por el cliente"
        }
    }
}
```

> Justo después de esto, consultá `productos` otra vez: el `stockDisponible` debe haber vuelto a su valor original y `stockApartado` a 0. Esa es la compensación.

| Error | Cuándo |
|---|---|
| `No se puede cancelar una orden en estado PAGADA` | Una orden pagada se devuelve, no se cancela |

---

### Consultar

#### Ver mis ordenes

Solo las del usuario de la cookie. Sin argumentos, ordenadas de la más reciente a la más vieja.

#### Query
```GraphQL
query{ 
    misOrdenes {
        id
        estado
        total
        motivo
        fecha
        lineas { 
            nombreProducto
            precioUnitario
            cantidad
        } 
    }
}
```

**Respuesta**

```json
{
  "data": {
    "misOrdenes": [
      { "id": "7700767f-...", "estado": "RECHAZADA", "total": 0, "motivo": "Stock insuficiente..." },
      { "id": "0638eb74-...", "estado": "PAGADA", "total": 8500, "motivo": null },
      { "id": "31329de4-...", "estado": "CANCELADA", "total": 120, "motivo": "Cancelada por el cliente" }
    ]
  }
}
```

---

### Consultar Orden por ID

Una sola orden por id, **siempre que sea del usuario**.

#### Query
```GraphQL
query ($id: ID!) {
     orden(id: $id) {
        id
        estado
        total
        motivo
        lineas { 
            nombreProducto
            precioUnitario
            cantidad 
        } 
    } 
}
```

### GRAPHQL VARIABLES
```GraphQL
  {
      "id": "efcf03b7-bc60-43b8-b59c-0db44d00599b"
  }
```



> Si el id es de la orden de **otro usuario**, la respuesta es `null`, no un error de permisos. El filtro por usuario va dentro de la consulta a la base.

---

# 4. NOTIFICACIONES

Este microservicio tiene **dos caras**, y la diferencia es importante:

| Endpoint | ¿Pasa por el gateway? | Por qué |
|---|---|---|
| `GET /notificaciones` | **Sí** | Solo lee, y solo del usuario |
| `POST /interno/notificar` | **No** | Escribe: nadie de afuera debe poder disparar avisos a nombre de otro |

---

## Ruta pública

### `GET {{gateway}}/notificaciones`

Historial de las notificaciones **del usuario logueado**. Requiere sesión.

**Parámetros de consulta**

**Ejemplo**

```
GET {{gateway}}/notificaciones?limite=10
```

**Respuesta `200 OK`** — las más recientes primero:

```json
{
  "email": "historial@test.com",
  "total": 2,
  "notificaciones": [
    {
      "fecha": "2026-08-20T21:13:47.920465+00:00",
      "tipo": "orden_cancelada",
      "email": "historial@test.com",
      "mensaje": "Tu orden 72fc97d4-... fue cancelada. Motivo: Cancelada por el cliente",
      "datos": {
        "ordenId": "72fc97d4-569f-4a5c-86dc-68b1150a047e",
        "motivo": "Cancelada por el cliente"
      }
    },
    {
      "fecha": "2026-08-20T21:13:44.464671+00:00",
      "tipo": "usuario_registrado",
      "email": "historial@test.com",
      "mensaje": "¡Bienvenido a la tienda, Sergio Historial! Tu cuenta quedó creada.",
      "datos": { "nombre": "Sergio Historial" }
    }
  ]
}
```

| Código | Cuándo |
|---|---|
| `401` | No hay sesión |
| `503` | El microservicio de notificaciones no responde |

> **De dónde salen estos datos:** este servicio no tiene base de datos. El
> historial se reconstruye leyendo el mismo archivo `notificaciones.log` que
> escribe `/interno/notificar`. Una operación escribe, la otra lee.
