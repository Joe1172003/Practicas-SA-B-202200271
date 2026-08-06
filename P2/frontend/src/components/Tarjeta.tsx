import type { ReactNode } from 'react';


interface Props {
  children: ReactNode;
  ancho?: 'chico' | 'grande';
}

export function Tarjeta({ children, ancho = 'chico' }: Props) {
  const anchoMaximo = ancho === 'chico' ? 'max-w-md' : 'max-w-2xl';

  return (
    <div className={`flex w-full ${anchoMaximo} flex-col gap-5 rounded-2xl bg-white p-8 shadow-md`}>
      {children}
    </div>
  );
}