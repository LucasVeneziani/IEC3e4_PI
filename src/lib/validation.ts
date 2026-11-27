export const USERNAME_REGEX = /^[A-Za-z0-9_.]{3,20}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** No mínimo 8 caracteres, uma maiúscula, uma minúscula, um número e um caractere especial. */
export const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const PASSWORD_RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: 'Mínimo de 8 caracteres', test: (v) => v.length >= 8 },
  { label: 'Uma letra maiúscula', test: (v) => /[A-Z]/.test(v) },
  { label: 'Uma letra minúscula', test: (v) => /[a-z]/.test(v) },
  { label: 'Um número', test: (v) => /\d/.test(v) },
  { label: 'Um caractere especial (!@#$...)', test: (v) => /[^A-Za-z0-9]/.test(v) },
];
