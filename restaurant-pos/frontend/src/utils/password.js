/**
 * Validación estricta de contraseña.
 * Retorna un string con el error, o null si es válida.
 */
export function validarPassword(pwd) {
  if (!pwd || pwd.length < 8)
    return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(pwd))
    return 'Debe contener al menos una letra mayúscula';
  if (!/[a-z]/.test(pwd))
    return 'Debe contener al menos una letra minúscula';
  if (!/[0-9]/.test(pwd))
    return 'Debe contener al menos un número';
  if (!/[!@#$%^&*()\-_=+{}\[\]|;:',.<>?/`~\\"]/.test(pwd))
    return 'Debe contener al menos un carácter especial (!@#$%...)';
  return null;
}

/**
 * Indicador visual de fortaleza de contraseña.
 * Retorna { nivel: 0-4, texto, color }
 */
export function fortalezaPassword(pwd) {
  if (!pwd) return { nivel: 0, texto: '', color: '' };
  let puntos = 0;
  if (pwd.length >= 8)   puntos++;
  if (/[A-Z]/.test(pwd)) puntos++;
  if (/[0-9]/.test(pwd)) puntos++;
  if (/[!@#$%^&*()\-_=+{}\[\]|;:',.<>?/`~\\"]/.test(pwd)) puntos++;

  const niveles = [
    { nivel: 0, texto: '',           color: '' },
    { nivel: 1, texto: 'Muy débil',  color: '#e74c3c' },
    { nivel: 2, texto: 'Débil',      color: '#e67e22' },
    { nivel: 3, texto: 'Aceptable',  color: '#f1c40f' },
    { nivel: 4, texto: 'Fuerte',     color: '#2ecc71' },
  ];
  return niveles[puntos];
}