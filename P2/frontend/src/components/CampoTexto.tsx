
interface Props {
  label: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  autoComplete?: string;
}

export function CampoTexto({ label, type = 'text', value, onChange, placeholder, autoComplete}: Props) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900
                   placeholder:text-gray-400
                   focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
    </label>
  );
}