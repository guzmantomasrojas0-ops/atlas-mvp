import { resolvePeriodRange, type AnalyticsOverview, type AnalyticsPeriod } from "./domain";
import {
  countBookingsByStatus,
  countNewClients,
  countPaymentStatus,
  peakHoursInRange,
  revenueByLocalDay,
  sumConfirmedRevenue,
  topServicesInRange,
  whatsappConversion,
} from "./data";

const TOP_SERVICES_LIMIT = 5;

/**
 * Arma el panel de analytics de un negocio para un período. Dispara todas las
 * agregaciones en paralelo (son independientes entre sí) y computa las tasas
 * derivadas acá — la capa de datos solo cuenta/suma, las proporciones son
 * lógica de dominio pura.
 */
export async function getAnalyticsOverview(
  businessId: string,
  timezone: string,
  period: AnalyticsPeriod,
  now: Date = new Date(),
): Promise<AnalyticsOverview> {
  const { start, end } = resolvePeriodRange(period, now);

  const [
    revenueTotal,
    revenueByDay,
    bookings,
    newClients,
    topServices,
    peakHours,
    whatsapp,
    payments,
  ] = await Promise.all([
    sumConfirmedRevenue(businessId, start, end),
    revenueByLocalDay(businessId, timezone, start, end),
    countBookingsByStatus(businessId, start, end),
    countNewClients(businessId, start, end),
    topServicesInRange(businessId, start, end, TOP_SERVICES_LIMIT),
    peakHoursInRange(businessId, timezone, start, end),
    whatsappConversion(businessId, start, end),
    countPaymentStatus(businessId),
  ]);

  const bookingsTotal = bookings.confirmed + bookings.cancelled;

  return {
    revenueTotal,
    revenueByDay,
    bookingsTotal,
    bookingsConfirmed: bookings.confirmed,
    bookingsCancelled: bookings.cancelled,
    cancellationRate: bookingsTotal === 0 ? 0 : bookings.cancelled / bookingsTotal,
    newClients,
    topServices,
    peakHours,
    whatsappConversations: whatsapp.conversations,
    whatsappConverted: whatsapp.converted,
    whatsappConversionRate:
      whatsapp.conversations === 0 ? 0 : whatsapp.converted / whatsapp.conversations,
    paymentsPending: payments.pending,
    paymentsConfirmed: payments.confirmed,
  };
}
