export type DeliveryPaymentState = {
  bezahlt?: boolean | null;
  zahlungsart?: string | null;
};

/** Cash is collected at the door only while a cash/legacy payment is unpaid. */
export function needsCashCollection(payment: DeliveryPaymentState | null | undefined): boolean {
  return payment?.bezahlt !== true
    && (payment?.zahlungsart === 'bar' || payment?.zahlungsart == null);
}
