import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Input de contraseña reutilizable con icono de ojo.
 * Props: todas las de un <input> normal + ninguna extra obligatoria.
 */
export default function PasswordInput({ id, name, value, onChange, placeholder, disabled, className = '' }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-wrapper">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder || '••••••••'}
        disabled={disabled}
        className={`password-input ${className}`}
        autoComplete="current-password"
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
