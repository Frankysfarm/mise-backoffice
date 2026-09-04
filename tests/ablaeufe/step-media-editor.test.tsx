import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepMediaEditor } from '@/app/(admin)/shift-guides/[id]/step-media-editor';

const GUIDE_ID = '11111111-2222-4333-8444-555555555555';
const image = { kind: 'image' as const, path: `t1/guides/${GUIDE_ID}/a.jpg`, caption: 'Ventil' };

describe('Medien-Verwaltung im Listen-Editor', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lädt eine Datei hoch und meldet das neue Medium nach oben', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ media: { kind: 'image', path: `t1/guides/${GUIDE_ID}/neu.jpg` } }),
    });
    const onChange = vi.fn();
    render(<StepMediaEditor guideId={GUIDE_ID} media={[image]} onChange={onChange} />);
    const input = screen.getByLabelText(/Bild oder Video hinzufügen/i);
    fireEvent.change(input, { target: { files: [new File(['x'], 'neu.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([
      image,
      { kind: 'image', path: `t1/guides/${GUIDE_ID}/neu.jpg`, caption: '' },
    ]));
    expect(fetch).toHaveBeenCalledWith(`/api/ablaeufe/guides/${GUIDE_ID}/media`, expect.objectContaining({ method: 'POST' }));
  });

  it('zeigt Server-Fehler an statt still zu verschlucken', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Videos dürfen höchstens 50 MB groß sein.' }),
    });
    const onChange = vi.fn();
    render(<StepMediaEditor guideId={GUIDE_ID} media={[]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Bild oder Video hinzufügen/i), {
      target: { files: [new File(['x'], 'riesig.mp4', { type: 'video/mp4' })] },
    });
    await waitFor(() => expect(screen.getByText('Videos dürfen höchstens 50 MB groß sein.')).toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('entfernt ein Medium über die Lösch-Route und blockt bei 5 Medien weitere Uploads', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const onChange = vi.fn();
    const first = render(<StepMediaEditor guideId={GUIDE_ID} media={[image]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /entfernen/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([]));
    expect(fetch).toHaveBeenCalledWith(`/api/ablaeufe/guides/${GUIDE_ID}/media`, expect.objectContaining({ method: 'DELETE' }));

    first.unmount();
    const five = Array.from({ length: 5 }, (_, i) => ({ kind: 'image' as const, path: `t1/guides/${GUIDE_ID}/${i}.jpg`, caption: '' }));
    render(<StepMediaEditor guideId={GUIDE_ID} media={five} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/Bild oder Video hinzufügen/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Höchstens 5 Medien/i)).toBeInTheDocument();
  });

  it('übernimmt Beschriftungs-Änderungen', () => {
    const onChange = vi.fn();
    render(<StepMediaEditor guideId={GUIDE_ID} media={[image]} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Ventil'), { target: { value: 'Ventil öffnen' } });
    expect(onChange).toHaveBeenCalledWith([{ ...image, caption: 'Ventil öffnen' }]);
  });
});
