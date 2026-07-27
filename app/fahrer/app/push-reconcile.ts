export async function snapshotThenTechnicalAck(
  notificationId: string,
  fetchSnapshot: () => Promise<void>,
  acknowledge: (notificationId: string) => Promise<void>,
): Promise<void> {
  await fetchSnapshot();
  await acknowledge(notificationId);
}
