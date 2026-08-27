
CREATE DATABASE db_auth;
CREATE DATABASE db_productos;
CREATE DATABASE db_ordenes;

-- Agregada en la P5: Notificaciones dejo de ser un servicio sin datos.
-- Ahora consume la cola y guarda cada aviso procesado, mas los resumenes
-- que le manda el cronjob.
CREATE DATABASE db_notificaciones;

-- Agregada en la P5: la llenan los dos cronjobs encadenados. El primero
-- inserta cada ejecucion, el segundo lee esos registros para resumirlos.
CREATE DATABASE db_bitacora;
