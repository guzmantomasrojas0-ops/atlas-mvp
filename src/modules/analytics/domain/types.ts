export interface RevenuePoint {
  /** Día local del negocio, "YYYY-MM-DD". */
  date: string;
  amount: number;
}

export interface ServiceSales {
  serviceId: string;
  serviceName: string;
  bookings: number;
  revenue: number;
}

export interface PeakHour {
  /** Hora local del negocio, 0–23. */
  hour: number;
  bookings: number;
}

export interface AnalyticsOverview {
  /** Ingresos confirmados (pagos CONFIRMED) dentro del período. */
  revenueTotal: number;
  revenueByDay: RevenuePoint[];
  /** Reservas creadas en el período (cualquier estado). */
  bookingsTotal: number;
  bookingsConfirmed: number;
  bookingsCancelled: number;
  /** Proporción cancelada sobre el total, 0–1. */
  cancellationRate: number;
  newClients: number;
  topServices: ServiceSales[];
  peakHours: PeakHour[];
  /** Conversión de conversaciones de WhatsApp a reservas, 0–1. */
  whatsappConversionRate: number;
  whatsappConversations: number;
  whatsappConverted: number;
  /** Estado de cobros — snapshot actual, no acotado al período (una cita pendiente vieja sigue pendiente hoy). */
  paymentsPending: number;
  paymentsConfirmed: number;
}
