import { z } from 'zod';

/** Opciones del wizard — exactas del mockup. */
export const TAMANOS = ['1-10', '11-50', '51-200', '+200'] as const;

export const SERVICIOS = [
  'Capacitación en IA',
  'Consultoría de IA',
  'Automatización de procesos',
  'Consultoría tecnológica',
  'Calidad y DevOps',
  'Piloto o solución personalizada',
  'Otro',
] as const;

/** Límites únicos: Zod en el servidor y atributos HTML en el form. */
export const LIMITES = {
  nombreMin: 2,
  nombreMax: 120,
  emailMax: 180,
  telefonoMax: 40,
  empresaMax: 160,
  mensajeMin: 10,
  mensajeMax: 5000,
} as const;

const vacioAUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

export const contactoSchema = z.object({
  nombre: z.string().trim().min(LIMITES.nombreMin).max(LIMITES.nombreMax),
  email: z.string().trim().max(LIMITES.emailMax).email(),
  telefono: z.preprocess(
    vacioAUndefined,
    z
      .string()
      .trim()
      .max(LIMITES.telefonoMax)
      .regex(/^[+0-9 ().-]{6,40}$/)
      .optional(),
  ),
  empresa: z.preprocess(
    vacioAUndefined,
    z.string().trim().max(LIMITES.empresaMax).optional(),
  ),
  tamano_empresa: z.preprocess(vacioAUndefined, z.enum(TAMANOS).optional()),
  servicio: z.preprocess(vacioAUndefined, z.enum(SERVICIOS).optional()),
  mensaje: z.string().trim().min(LIMITES.mensajeMin).max(LIMITES.mensajeMax),
});

export type ContactoInput = z.infer<typeof contactoSchema>;

export const ERROR_CODES = [
  'nombre',
  'email',
  'mensaje',
  'invalido',
  'captcha',
  'limite',
  'servidor',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function firstErrorCode(err: z.ZodError): ErrorCode {
  const field = err.issues[0]?.path[0];
  if (field === 'nombre' || field === 'email' || field === 'mensaje') return field;
  return 'invalido';
}
