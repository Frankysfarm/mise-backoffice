import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StepMediaGallery } from '@/app/(neo)/neo/app/ablaeufe/schichtleitfaeden/[id]/ausfuehren/step-media';

const media = [
  { kind: 'image' as const, path: 't1/guides/g1/a.jpg', caption: 'Ventil öffnen' },
  { kind: 'video' as const, path: 't1/guides/g1/b.mp4', caption: '' },
  { kind: 'image' as const, path: 't1/guides/g1/fehlt.jpg', caption: 'Ohne URL' },
];
const urls = {
  't1/guides/g1/a.jpg': 'https://signed.example/a.jpg',
  't1/guides/g1/b.mp4': 'https://signed.example/b.mp4',
};

describe('Anleitungs-Medien in der Schritt-Ansicht', () => {
  it('zeigt Bilder mit signierter URL und Beschriftung', () => {
    render(<StepMediaGallery media={media} urls={urls} />);
    const image = screen.getByAltText('Ventil öffnen');
    expect(image).toHaveAttribute('src', 'https://signed.example/a.jpg');
    expect(screen.getByText('Ventil öffnen')).toBeInTheDocument();
  });
  it('zeigt Videos als abspielbares Element', () => {
    const { container } = render(<StepMediaGallery media={media} urls={urls} />);
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('src', 'https://signed.example/b.mp4');
    expect(video).toHaveAttribute('controls');
  });
  it('überspringt Medien ohne auflösbare URL und rendert ohne Medien gar nichts', () => {
    const { container } = render(<StepMediaGallery media={media} urls={urls} />);
    expect(screen.queryByText('Ohne URL')).not.toBeInTheDocument();
    expect(container.querySelectorAll('img,video')).toHaveLength(2);
    const empty = render(<StepMediaGallery media={[]} urls={{}} />);
    expect(empty.container.firstChild).toBeNull();
  });
});
