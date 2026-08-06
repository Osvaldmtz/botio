'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, RefreshCw } from 'lucide-react';

type ReportMeta = {
  report_date: string;
  public_url: string | null;
  path: string | null;
};

export function WeeklyReportCard() {
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/weekly-marketing-report/meta')
      .then(async (res) => {
        if (!res.ok) throw new Error('Sin reporte disponible');
        return res.json() as Promise<ReportMeta>;
      })
      .then(setMeta)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-400" />
          <h3 className="text-base font-semibold text-white">Reporte Semanal</h3>
        </div>
        {loading ? <RefreshCw className="h-4 w-4 animate-spin text-gray-500" /> : null}
      </div>

      <p className="mb-4 text-sm text-gray-400">
        Consolidado SEO + Google Ads + Meta. Enviado por Telegram cada lunes 9am CDMX.
      </p>

      {error ? (
        <p className="text-sm text-amber-400/90">{error}</p>
      ) : meta?.report_date ? (
        <p className="mb-4 text-sm text-gray-300">
          Último reporte: <span className="font-medium text-white">{meta.report_date}</span>
        </p>
      ) : null}

      <a
        href="/api/weekly-marketing-report/latest"
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
      >
        <Download className="h-4 w-4" />
        Descargar HTML
      </a>
    </div>
  );
}
