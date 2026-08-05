import { SetMetadata } from '@nestjs/common';
import { Role } from '../../common/role.enum';

export const ROLES_KEY = 'roles_permitidos';

/**
 * Marca qué roles pueden entrar a una ruta.
 *
 * `SetMetadata` solo pega una etiqueta al método; no valida nada por sí solo.
 * Quien lee esa etiqueta y decide es RolesGuard. La ventaja de separarlo así
 * es que la regla de acceso queda escrita justo encima de la ruta, a la vista,
 * en vez de escondida dentro de un if en el cuerpo del controlador.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
