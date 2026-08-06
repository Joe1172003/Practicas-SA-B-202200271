interface Props {
  tipo: 'error' | 'exito' | 'aviso';
  mensaje: string | null;
}

const ESTILOS: Record<Props['tipo'], string> = {
  error: 'border-red-200 bg-red-50 text-red-700',
  exito: 'border-green-200 bg-green-50 text-green-700',
  aviso: 'border-amber-200 bg-amber-50 text-amber-700',
};

export function Alerta({ tipo, mensaje }: Props) {
  if (!mensaje) {
    return null;
  }

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${ESTILOS[tipo]}`}>
      {mensaje}
    </div>
  );
}