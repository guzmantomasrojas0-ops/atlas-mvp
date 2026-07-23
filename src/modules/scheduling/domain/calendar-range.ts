import { toUtcInstant } from "./timezone";

export interface DateRange {
  rangeStart: Date;
  rangeEnd: Date;
}

/** Suma (o resta) días a una fecha "YYYY-MM-DD", sin líos de zona horaria. */
export function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + amount);
  return utcDate.toISOString().slice(0, 10);
}

/** El lunes de la semana ISO (lunes a domingo) que contiene esta fecha. */
export function startOfWeekIso(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = utcDate.getUTCDay(); // 0 = domingo … 6 = sábado
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addDays(date, -daysSinceMonday);
}

/** Rango UTC [rangeStart, rangeEnd) que cubre un día o una semana, en la zona horaria del negocio. */
export function getCalendarRange(view: "day" | "week", date: string, timezone: string): DateRange {
  if (view === "day") {
    return {
      rangeStart: toUtcInstant(date, "00:00", timezone),
      rangeEnd: toUtcInstant(addDays(date, 1), "00:00", timezone),
    };
  }

  const weekStart = startOfWeekIso(date);
  return {
    rangeStart: toUtcInstant(weekStart, "00:00", timezone),
    rangeEnd: toUtcInstant(addDays(weekStart, 7), "00:00", timezone),
  };
}

const WEEKDAY_NAMES_ES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MONTH_NAMES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function dateStringToParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return {
    year,
    day,
    monthName: MONTH_NAMES_ES[month - 1],
    weekday: WEEKDAY_NAMES_ES[(utcDate.getUTCDay() + 6) % 7],
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Etiqueta legible en español para el rango visible del calendario (sin depender de zona horaria). */
export function formatCalendarRangeLabel(view: "day" | "week", date: string): string {
  if (view === "day") {
    const { weekday, day, monthName, year } = dateStringToParts(date);
    return `${capitalize(weekday)} ${day} de ${monthName} de ${year}`;
  }

  const weekStart = startOfWeekIso(date);
  const weekEnd = addDays(weekStart, 6);
  const start = dateStringToParts(weekStart);
  const end = dateStringToParts(weekEnd);

  if (start.monthName === end.monthName) {
    return `${start.day} – ${end.day} de ${start.monthName} de ${start.year}`;
  }
  return `${start.day} de ${start.monthName} – ${end.day} de ${end.monthName} de ${end.year}`;
}
