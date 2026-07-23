-- Prisma no puede expresar un EXCLUDE constraint en schema.prisma — esta
-- migración se escribe a mano. Es la garantía real contra doble-reserva bajo
-- condiciones de carrera (ver PLAN.md, sección 7 y riesgo técnico #1). El
-- chequeo en `scheduling.service.ts` (findOverlappingAppointments) es una
-- validación anticipada para dar un mensaje de error amable — esto de acá
-- es lo que realmente lo impide si dos requests llegan casi al mismo tiempo.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Ninguna reserva CONFIRMED puede solaparse en el tiempo con otra del mismo
-- miembro del equipo. Las reservas CANCELLED/COMPLETED/NO_SHOW no participan
-- del constraint — cancelar una reserva libera el horario para otra.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "staffId" WITH =,
    tstzrange("startsAt", "endsAt") WITH &&
  )
  WHERE (status = 'CONFIRMED'::"AppointmentStatus");
