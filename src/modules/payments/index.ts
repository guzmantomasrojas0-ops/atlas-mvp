export {
  AppointmentCancelledForPaymentError,
  confirmPaymentInputSchema,
  NoActivePaymentError,
  PaymentAlreadyConfirmedError,
  PaymentAppointmentNotFoundError,
  paymentMethodLabels,
  PAYMENT_METHODS,
} from "./domain";
export type { ConfirmPaymentInput, PaymentMethodValue, PaymentRecordStatusValue } from "./domain";
export { confirmPayment, getAppointmentPayment, listPayments, revertPayment } from "./service";
export type { PaymentListItem } from "./service";
