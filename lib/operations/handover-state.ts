export type HandoverState = { status: string; readAt: string | null; confirmedAt: string | null };

export function advanceHandover(state: HandoverState, action: 'read' | 'confirm', at: string): HandoverState {
  if (action === 'read') {
    if (state.confirmedAt) throw new Error('Bereits bestätigt');
    return { ...state, status: 'gelesen', readAt: state.readAt ?? at };
  }
  if (!state.readAt) throw new Error('Vor der Bestätigung muss die Übergabe gelesen werden');
  if (state.confirmedAt) throw new Error('Bereits bestätigt');
  return { ...state, status: 'angenommen', confirmedAt: at };
}
