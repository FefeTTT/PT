import { z } from "zod";

/**
 * Schema para horarios con prefijo de día válido: L, M, Mi, J, V.
 * Formato: Dia:HH:MM-HH:MM
 */
export const HorarioKdeSchema = z.string().regex(
  /^(L|M|Mi|J|V):\d{2}:\d{2}-\d{2}:\d{2}$/,
  "El horario debe tener el formato Dia:HH:MM-HH:MM con día válido (L|M|Mi|J|V)"
);

/**
 * Request para POST /predecir_kde_unificado
 */
export const KdeRequestSchema = z.object({
  eco: z.string(),
  horario: HorarioKdeSchema,
});

/**
 * Response de POST /predecir_kde_unificado (compacto)
 */
export const KdeResponseSchema = z.object({
  eco: z.string(),
  tipo_eco: z.enum(["regular", "irregular"]),
  score: z.number(),
});

export type KdeRequest = z.infer<typeof KdeRequestSchema>;
export type KdeResponse = z.infer<typeof KdeResponseSchema>;
