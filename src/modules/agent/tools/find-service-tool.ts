import { z } from "zod";
import { listServices } from "@/modules/catalog";
import { matchesQuery, type Tool } from "../domain";

export const findServiceInputSchema = z.object({
  businessId: z.string().min(1),
  /** Búsqueda parcial por nombre, sin distinguir mayúsculas ni tildes. Si se omite, devuelve todos. */
  query: z.string().min(1).optional(),
});

export type FindServiceInput = z.infer<typeof findServiceInputSchema>;

export interface ServiceMatch {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

export interface FindServiceOutput {
  services: ServiceMatch[];
}

/** Filtra servicios por nombre. Pura — separada de `execute` para poder testearla sin tocar la base. */
export function filterServicesByQuery(services: ServiceMatch[], query?: string): ServiceMatch[] {
  if (!query) return services;
  return services.filter((service) => matchesQuery(service.name, query));
}

/**
 * Busca servicios del negocio por nombre. Devuelve precio y duración —no
 * hay campo de descripción todavía en el modelo `Service`, así que no se
 * inventa uno acá.
 */
export const findServiceTool: Tool<FindServiceInput, FindServiceOutput> = {
  name: "FIND_SERVICE",
  description:
    "Busca servicios del negocio por nombre (búsqueda parcial) y devuelve precio y duración.",
  inputSchema: findServiceInputSchema,
  async execute(input) {
    const allServices = await listServices(input.businessId);
    return { services: filterServicesByQuery(allServices, input.query) };
  },
};
