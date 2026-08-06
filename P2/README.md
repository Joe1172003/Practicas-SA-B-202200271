<p align="left">
Universidad San Carlos de Guatemala<br>
Facultad de Ingeniería<br>
Ingeniería en ciencias y sistemas<br>
Laboratorio de Software Avanzado 

Nombre: Sergio Joel Rodas Valdez<br>
Carné: 202200271
</p>


# Práctica 2  Autenticación y Autorización

Módulo de registro, login y autorización por roles (`ADMIN` y `CLIENTE`) con JWT en cookies HTTP-only y datos sensibles cifrados con AES-256-GCM.


## 1. Tecnologías

| Tecnología | Uso | Ventajas | Desventajas |
|---|---|---|---|
| **NestJS 11** | Backend | *Guards* declarativos que separan autenticación de autorización; inyección de dependencias incluida | Más ceremonioso que Express (módulos, providers, decoradores) |
| **React 19 + Vite** | Frontend | Arranque instantáneo y recarga en caliente; componentes reutilizables | Hay que elegir y configurar router, estilos, etc. a mano |
| **TypeScript** | Ambos | Errores detectados al compilar, no en producción | Configuración de decoradores con detalles finos |
| **PostgreSQL (Neon)** | Base de datos | Serverless, sin instalar nada garantiza un correo por cuenta | Latencia de red; la instancia se suspende por inactividad |
| **TypeORM** | ORM | Genera las tablas desde las entidades, sin escribir SQL | `synchronize` es peligroso fuera de desarrollo |
| **Tailwind CSS** | Estilos | Todo en `className`, sin archivos CSS que mantener | El JSX se llena de clases largas |
| **`node:crypto`** | AES y HMAC | Viene en Node: cero dependencias en lo más delicado | API de bajo nivel|
| **bcryptjs** | Hash de contraseñas | JavaScript puro | Más lento que el `bcrypt` nativo |

---

## 2. Ejecución

**Requisitos:** Node.js 22 o superior y una base de datos PostgreSQL en [Neon](https://neon.tech).

### Backend
```bash
cd P2/backend
npm install
```

Crear `P2/backend/.env` con estas variables (las llaves se generan con los comandos de abajo):

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173

DATABASE_URL=postgresql://usuario:password@host.neon.tech/neondb?sslmode=require
DB_SYNCHRONIZE=true

JWT_SECRET=<llave generada>
JWT_EXPIRES_IN_SECONDS=60
JWT_RENEWAL_GRACE_SECONDS=120

COOKIE_NAME=access_token
COOKIE_SECURE=false

AES_KEY=<llave generada>
BLIND_INDEX_KEY=<llave generada>

BCRYPT_SALT_ROUNDS=12
```

Generar las tres llaves:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # AES_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # BLIND_INDEX_KEY
```

```bash
npm run start:dev     # http://localhost:3000
```

> La tabla `users` **se crea sola** al arrancar: TypeORM la genera leyendo la entidad
> `user.entity.ts`. No hay que escribir SQL ni entrar a la consola de Neon.

### Frontend

```bash
cd P2/frontend
npm install
npm run dev           # http://localhost:5173
```
---

## 3. Endpoints

| Método | Ruta | Protección |
|---|---|---|
| `POST` | `/auth/register` | Pública |
| `POST` | `/auth/login` | Pública |
| `POST` | `/auth/logout` | Pública |
| `GET` | `/auth/me` | Sesión válida |
| `GET` | `/api/reportes` | **Solo `ADMIN`** |
| `GET` | `/api/dashboard` | `ADMIN` y `CLIENTE` |

---

## 4. JWT

Un JWT tiene tres partes: `cabecera.payload.firma`. El **payload va codificado en base64, no cifrado** cualquiera con el token puede leerlo. La firma impide modificarlo, no leerlo.

Por eso el token solo lleva el id y el rol. El nombre y el correo se quedan en la base de datos cifrados con AES:

```ts
// src/auth/jwt-payload.interface.ts
export interface JwtPayload {
  sub: string;
  rol: Role;
}
```

### Firma y verificación con renovación automática

```ts
// src/auth/token.service.ts
async firmar(payload: JwtPayload): Promise<string> {
  return this.jwtService.signAsync(payload, {
    expiresIn: this.config.expiresInSeconds,   // JWT_EXPIRES_IN_SECONDS = 60
  });
}

async verificar(token: string): Promise<ResultadoVerificacion> {
  try {
    const payload = await this.jwtService.verifyAsync<JwtPayloadFirmado>(token);
    return { payload, necesitaRenovacion: false };
  } catch (error) {
    if (!this.esTokenExpirado(error)) {
      throw new UnauthorizedException('Token inválido');
    }
    return this.intentarRenovacion(token);
  }
}

// El token expiró: lo reabrimos ignorando la expiración (pero sin ignorar la
// firma) para ver hace cuánto vencio.
private async intentarRenovacion(token: string): Promise<ResultadoVerificacion> {
  const payload = await this.jwtService.verifyAsync<JwtPayloadFirmado>(token, {
    ignoreExpiration: true,
  });

  const segundosDesdeQueExpiro = Math.floor(Date.now() / 1000) - payload.exp;

  if (segundosDesdeQueExpiro > this.config.renewalGraceSeconds) {
    throw new UnauthorizedException('La sesión expiró. Vuelve a iniciar sesión.');
  }

  return { payload, necesitaRenovacion: true };
}
```

La renovación ocurre dentro del guard, **en cualquier ruta protegida**, sin que el
frontend tenga que llamar a ningún endpoint de *refresh* o pedir la actualizacion:

```ts
// src/auth/guards/jwt-auth.guard.ts
const { payload, necesitaRenovacion } = await this.tokens.verificar(token);

if (necesitaRenovacion) {
  const tokenNuevo = await this.tokens.firmar({ sub, rol });
  this.cookies.establecerToken(response, tokenNuevo);   // reemplaza la cookie
  response.setHeader('X-Token-Renovado', 'true');       // aviso para el frontend
}
```

```
  login              +60 s                          +180 s
    │                  │                               │
    ├──────────────────┼───────────────────────────────┤
    │  token vigente   │  vencido, se renuevo solo     │  401
    │     200 OK       │  200 OK  ( cookie nueva )     │
```

---

## 5. AES

Se usa **AES-256 en modo GCM**. Frente a CBC, GCM añade una *etiqueta de
autenticación*: si alguien altera un solo bit del texto cifrado en la base de
datos, el descifrado lanza error en vez de devolver basura.

```ts
// src/crypto/aes-cipher.service.ts
const ALGORITMO = 'aes-256-gcm';
const LONGITUD_IV = 12;         // 96 bits
const LONGITUD_ETIQUETA = 16;   // 128 bits

cifrar(textoPlano: string): string {
  const iv = randomBytes(LONGITUD_IV);  // aleatorio en cada llamada
  const cifrador = createCipheriv(ALGORITMO, this.llave, iv);

  const cifrado = Buffer.concat([
    cifrador.update(textoPlano, 'utf8'),
    cifrador.final(),
  ]);
  const etiqueta = cifrador.getAuthTag();

  // base64( vesctorIncial[12] || etiqueta[16] || texto_cifrado[n] )
  return Buffer.concat([iv, etiqueta, cifrado]).toString('base64');
}

descifrar(valorAlmacenado: string): string {
  const bytes = Buffer.from(valorAlmacenado, 'base64');

  const iv       = bytes.subarray(0, LONGITUD_IV);
  const etiqueta = bytes.subarray(LONGITUD_IV, LONGITUD_IV + LONGITUD_ETIQUETA);
  const cifrado  = bytes.subarray(LONGITUD_IV + LONGITUD_ETIQUETA);

  const descifrador = createDecipheriv(ALGORITMO, this.llave, iv);
  descifrador.setAuthTag(etiqueta);

  try {
    return Buffer.concat([
      descifrador.update(cifrado),
      descifrador.final(),      // aquí falla si el dato fue alterado
    ]).toString('utf8');
  } catch {
    throw new InternalServerErrorException(
      'No se pudo descifrar el dato: fue alterado o la llave AES cambió',
    );
  }
}
```

### Contraseñas: bcrypt, no AES

AES es **reversible** para el nombre y el correo, porque hay que volver
a mostrarlos. Para una contraseña sería un error: si se filtran la base de datos y la llave, el atacante las obtiene en texto plano.

```ts
// src/users/users.service.ts
const usuario = this.repositorio.create({
  nombreCifrado: this.aes.cifrar(datos.nombre.trim()),               // AES, reversible
  correoCifrado: this.aes.cifrar(datos.correo.trim().toLowerCase()), // AES, reversible
  correoIndice,                                                      // HMAC, para buscar
  passwordHash: await this.hasher.hashear(datos.password),           // bcrypt, irreversible
  rol: datos.rol,
});
```
---

## 6. Cookies HTTP-only

El requisito dice que el token no debe ser visible para el usuario. Eso se logra
con `httpOnly: true`: el navegador guarda la cookie y la manda sola en cada
petición, pero `document.cookie` no la ve.

```ts
// src/auth/cookie.service.ts
private opcionesBase(): CookieOptions {
  return {
    httpOnly: true,                                // JavaScript no puede leerla
    secure: this.config.secure,                    // solo por HTTPS (false en localhost)
    sameSite: this.config.secure ? 'none' : 'lax', 
    path: '/',
  };
}

private opciones(): CookieOptions {
  return {
    ...this.opcionesBase(),
    // La cookie debe durar mas que el token: si durara lo mismo, el navegador la
    // borraría justo cuando expira y la renovación nunca podría ocurrir.
    maxAge: (this.tokenService.duracionSegundos +
             this.tokenService.graciaSegundos) * 1000,
  };
}

establecerToken(response: Response, token: string): void {
  response.cookie(this.config.name, token, this.opciones());
}

leerToken(request: Request): string | undefined {
  return request.cookies?.[this.config.name] as string | undefined;
}
```

### Del lado del frontend

El navegador solo manda la cookie a otro origen si cada petición lo pide:

```ts
// frontend/src/api/client.ts
respuesta = await fetch(BASE_URL + ruta, {
  ...opciones,
  credentials: 'include',   // sin esto la cookie no viaja
});
```

Y el backend debe autorizar ese origen explícitamente (con `credentials`, el
comodín `*` está prohibido):

```ts
// src/main.ts
app.enableCors({
  origin: config.corsOrigins,
  credentials: true,
  exposedHeaders: ['X-Token-Renovado'],   // para que el frontend pueda leerla
});
```

---

## 7. Autorización por roles

Dos guards, en este orden:

| Guard | Pregunta | Si falla |
|---|---|---|
| `JwtAuthGuard` | ¿Quién sos? autenticación | `401` |
| `RolesGuard` | ¿Podés? autorización | `403` |

```ts
// src/protected/protected.controller.ts
@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard) // se ejecutan de izquierda a derecha
export class ProtectedController {

  @Get('reportes')
  @Roles(Role.ADMIN)  // Ruta 1: solo administradores
  reportes(@UsuarioActual() usuario: JwtPayload) { ... }

  @Get('dashboard')
  @Roles(Role.ADMIN, Role.CLIENTE)  // Ruta 2: ambos roles
  dashboard(@UsuarioActual() usuario: JwtPayload) { ... }
}
```

```ts
// src/auth/guards/roles.guard.ts
const rolesPermitidos = this.reflector.getAllAndOverride<Role[] | undefined>(
  ROLES_KEY, [context.getHandler(), context.getClass()],
);

if (!rolesPermitidos.includes(usuario.rol)) {
  throw new ForbiddenException('Tu rol no tiene permiso para acceder a este recurso');
}
```

El orden importa: `JwtAuthGuard` cuelga el usuario en la petición y `RolesGuard` lo
lee. Al revés siempre respondería 401.

---

## 8. Diagrama de secuencia

### Autenticación

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend (React)
    participant C as AuthController
    participant S as AuthService
    participant US as UsersService
    participant CR as Cripto (AES/HMAC/bcrypt)
    participant DB as PostgreSQL

    U->>F: correo + contraseña
    F->>C: POST /auth/login<br/>credentials: 'include'
    C->>S: login(dto)

    S->>US: buscarPorCorreo(correo)
    US->>CR: HMAC del correo (índice ciego)
    CR-->>US: hash determinista
    US->>DB: SELECT WHERE correo_indice = ...
    DB-->>US: fila cifrada

    alt Credenciales incorrectas
        S-->>C: 401 "Correo o contraseña incorrectos"
        C-->>F: 401
    else Credenciales correctas
        S->>US: bcrypt.compare(password, hash) -> true
        S->>S: firmar JWT { sub, rol }<br/>expira en 60 s
        S->>US: aPerfil() -> descifra nombre y correo con AES
        S-->>C: { perfil, token }
        C->>C: cookie HttpOnly (maxAge = 60 + 120 s)
        C-->>F: 200 + Set-Cookie<br/>{ usuario } (sin token en el JSON)
        F-->>U: Página de confirmación
    end
```

### Autorización (ruta protegida y renovación automática)

```mermaid
sequenceDiagram
    participant F as Frontend
    participant JG as JwtAuthGuard
    participant TS as TokenService
    participant RG as RolesGuard
    participant CT as ProtectedController

    F->>JG: GET /api/reportes<br/>Cookie: access_token (la manda el navegador solo)

    alt No hay cookie
        JG-->>F: 401 "No hay sesión activa"
    else Hay token
        JG->>TS: verificar(token)

        alt Token vigente
            TS-->>JG: necesitaRenovacion: false
        else Vencido hace menos de la gracia
            TS->>TS: reabrir con ignoreExpiration<br/>(la FIRMA sí se valida)
            TS-->>JG: necesitaRenovacion: true
            JG->>TS: firmar token nuevo
            JG-->>F: Set-Cookie nueva + X-Token-Renovado: true
            Note over JG,F: Renovación transparente
        else Firma inválida o vencido hace demasiado
            TS-->>JG: lanza 401
            JG-->>F: 401 "La sesión expiró"
        end

        JG->>JG: request.usuario = { sub, rol }
        JG->>RG: continuar

        RG->>RG: leer @Roles de la ruta -> [ADMIN]

        alt El rol alcanza
            RG->>CT: continuar
            CT-->>F: 200 + datos
        else El rol NO alcanza (CLIENTE en ruta de ADMIN)
            RG-->>F: 403 "Tu rol no tiene permiso"
        end
    end
```