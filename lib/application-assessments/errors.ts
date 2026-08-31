const messages: Array<[string, string]> = [
  ['manager is outside assessment location', 'Dieser Test gehört zu einem anderen Standort.'],
  ['assessment does not match candidate department', 'Der Test passt nicht zum Bereich der Bewerbung.'],
  ['assessment does not match candidate position', 'Der Test passt nicht zur Stelle der Bewerbung.'],
  ['assessment session is not active', 'Dieser Test kann nicht mehr bearbeitet werden.'],
  ['assessment session expired', 'Dieser Testlink ist abgelaufen.'],
  ['assessment template not found', 'Der Bewerbungstest wurde nicht gefunden.'],
  ['question ', 'Bitte prüfe die Fragen und Antwortmöglichkeiten.'],
];

export function assessmentErrorMessage(message?: string | null) {
  return messages.find(([key]) => message?.includes(key))?.[1] ?? 'Der Bewerbungstest konnte nicht verarbeitet werden. Bitte versuche es erneut.';
}
