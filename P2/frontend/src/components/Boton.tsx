import type { ReactNode } from 'react';


interface Props {
  children: ReactNode;
  type?: 'button' | 'submit';
  cargando?: boolean;
  onClick?: () => void;
}

export function Boton({ children, type = 'button', cargando = false, onClick }: Props) {
  return (
    <button
      type={type}
      disabled={cargando}
      onClick={onClick}
      className="flex items-center justify-center rounded-lg bg-indigo-400 px-4 py-2
                 font-medium text-white transition-colors
                 hover:bg-indigo-500
                 disabled:cursor-not-allowed disabled:bg-indigo-300">
      {cargando ? 'Espera…' : children}
    </button>
  );
}