export {
  appointmentInputSchema,
  AppointmentNotFoundError,
  InvalidReferenceError,
  isWithinBusinessHours,
  OutsideBusinessHoursError,
  rescheduleAppointmentInputSchema,
  SchedulingConflictError,
  findAvailableSlots,
  findConflict,
  formatInBusinessTimezone,
  rangesOverlap,
  toBusinessLocalTime,
  toUtcInstant,
} from "./domain";
export type { AppointmentInput, RescheduleAppointmentInput, TimeRange } from "./domain";
export {
  cancelAppointment,
  createAppointment,
  createAppointmentForClient,
  getAppointmentsByClient,
  listAppointments,
  rescheduleAppointment,
  searchAvailability,
} from "./service";
export type {
  AppointmentListItem,
  CreatedAppointment,
  CreateAppointmentForClientInput,
  StaffAvailability,
} from "./service";
