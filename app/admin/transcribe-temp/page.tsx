'use client';

import { useCallback, useRef, useState } from 'react';
import { transcribeAudio } from './actions';

type FileStatus = 'pending' | 'transcribing' | 'done' | 'error';

interface FileEntry {
  id: string;
  file: File;
  status: FileStatus;
  text?: string;
  error?: string;
}

export default function TranscribeTempPage() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const newEntries: FileEntry[] = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
    }));
    setEntries((prev) => [...prev, ...newEntries]);
  }, []);

  const transcribeOne = useCallback(async (entry: FileEntry) => {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: 'transcribing' } : e)));
    try {
      const formData = new FormData();
      formData.append('file', entry.file, entry.file.name);
      const result = await transcribeAudio(formData);
      if ('error' in result) throw new Error(result.error);
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, status: 'done', text: result.text } : e))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, status: 'error', error: message } : e))
      );
    }
  }, []);

  const transcribeAll = useCallback(() => {
    entries.filter((e) => e.status === 'pending' || e.status === 'error').forEach(transcribeOne);
  }, [entries, transcribeOne]);

  const downloadText = (entry: FileEntry) => {
    if (!entry.text) return;
    const blob = new Blob([entry.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = entry.file.name.replace(/\.[^.]+$/, '') + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyText = async (entry: FileEntry) => {
    if (!entry.text) return;
    await navigator.clipboard.writeText(entry.text);
  };

  return (
    <div className="min-h-screen bg-[#F8F7FF] p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Transcripción temporal</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Herramienta interna puntual. Arrastra audios, transcribe, descarga el texto. No es parte del producto.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
            dragOver ? 'border-[#7C3DE3] bg-[#F3EEFD]' : 'border-[#EDE7F6] bg-white'
          }`}
        >
          <p className="text-sm text-[#1A1A2E]">Arrastra archivos de audio aquí</p>
          <p className="mt-1 text-xs text-[#6B7280]">o haz click para seleccionarlos</p>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {entries.length > 0 && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={transcribeAll}
              className="rounded-lg bg-[#7C3DE3] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Transcribir todo
            </button>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-[#EDE7F6] bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#1A1A2E]">{entry.file.name}</span>
                <span
                  className={`text-xs font-medium ${
                    entry.status === 'done'
                      ? 'text-[#10B981]'
                      : entry.status === 'error'
                        ? 'text-[#EF4444]'
                        : entry.status === 'transcribing'
                          ? 'text-[#F59E0B]'
                          : 'text-[#6B7280]'
                  }`}
                >
                  {entry.status === 'pending' && 'Pendiente'}
                  {entry.status === 'transcribing' && 'Transcribiendo…'}
                  {entry.status === 'done' && 'Listo'}
                  {entry.status === 'error' && 'Error'}
                </span>
              </div>

              {entry.status === 'pending' && (
                <button
                  onClick={() => transcribeOne(entry)}
                  className="mt-3 rounded-lg border border-[#7C3DE3] px-3 py-1.5 text-xs font-medium text-[#7C3DE3] hover:bg-[#F3EEFD]"
                >
                  Transcribir
                </button>
              )}

              {entry.status === 'error' && (
                <div className="mt-2">
                  <p className="text-xs text-[#EF4444]">{entry.error}</p>
                  <button
                    onClick={() => transcribeOne(entry)}
                    className="mt-2 rounded-lg border border-[#7C3DE3] px-3 py-1.5 text-xs font-medium text-[#7C3DE3] hover:bg-[#F3EEFD]"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {entry.status === 'done' && entry.text && (
                <div className="mt-3">
                  <textarea
                    readOnly
                    value={entry.text}
                    rows={6}
                    className="w-full rounded-lg border border-[#EDE7F6] bg-[#F8F7FF] p-2 text-xs text-[#1A1A2E]"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => downloadText(entry)}
                      className="rounded-lg bg-[#7C3DE3] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    >
                      Descargar .txt
                    </button>
                    <button
                      onClick={() => copyText(entry)}
                      className="rounded-lg border border-[#EDE7F6] px-3 py-1.5 text-xs font-medium text-[#1A1A2E] hover:bg-[#F8F7FF]"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
