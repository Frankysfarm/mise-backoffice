'use client';

import { useRef, useState, useTransition } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { EmployeeAvatar } from './employee-avatar';

type EmployeeLike = {
  id: string;
  vorname?: string | null;
  nachname?: string | null;
  avatar_url?: string | null;
};

export function AvatarUploader({
  employee,
  onUploaded,
  maxSizeMB = 2,
}: {
  employee: EmployeeLike;
  onUploaded?: (url: string) => void;
  maxSizeMB?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(employee.avatar_url ?? null);
  const [message, setMessage] = useState('');
  const [busy, start] = useTransition();

  async function handleFile(file: File) {
    if (file.size > maxSizeMB * 1024 * 1024) {
      setMessage(`Max. ${maxSizeMB} MB.`);
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setMessage('Bitte JPG, PNG oder WebP verwenden.');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setMessage('');

    start(async () => {
      const form = new FormData();
      form.set('employeeId', employee.id);
      form.set('file', file);
      try {
        const response = await fetch('/api/employees/avatar', { method: 'POST', body: form });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          setMessage(result?.error ?? 'Upload fehlgeschlagen.');
          setPreview(employee.avatar_url ?? null);
        } else {
          setPreview(result.avatarUrl);
          onUploaded?.(result.avatarUrl);
          setMessage('Profilbild gespeichert.');
        }
      } catch {
        setMessage('Upload fehlgeschlagen.');
        setPreview(employee.avatar_url ?? null);
      } finally {
        URL.revokeObjectURL(localPreview);
      }
    });
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = '';
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onChange} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="group relative inline-flex items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-1 hover:border-indigo-400"
        aria-label="Profilbild ändern"
      >
        <EmployeeAvatar employee={{ ...employee, avatar_url: preview }} size="xl" />
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </span>
        )}
        {!busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
            <Upload className="h-6 w-6 text-white" />
          </span>
        )}
      </button>
      {message && <p className="text-xs font-semibold text-slate-600">{message}</p>}
    </div>
  );
}
