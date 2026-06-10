import { z } from "zod";

export const HorarioValidoSchema = z.string().regex(
  /^((L|M|Mi|J|V):)?\d{1,2}:\d{2}-\d{1,2}:\d{2}(\|(L|M|Mi|J|V):\d{1,2}:\d{2}-\d{1,2}:\d{2})*$/,
  "El horario debe tener el formato Dia:HH:MM-HH:MM|... o HH:MM-HH:MM"
);

export const WarmupPayloadSchema = z.object({
  profesores_vigentes: z.array(z.string()),
  programacion: z.array(
    z.object({
      uea: z.string().refine(
        (val) => /^(1100|1111|1112|1113)/.test(val),
        "La UEA debe comenzar por 1100, 1111, 1112 o 1113"
      ),
      grupos: z.array(HorarioValidoSchema)
    })
  )
});

export type WarmupPayload = z.infer<typeof WarmupPayloadSchema>;
