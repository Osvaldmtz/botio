type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
};

export function KpiJarvisTable<T>({ columns, rows, rowKey }: Props<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-slate-500">
            {columns.map((col) => (
              <th key={col.key} className="pb-2 pr-4 text-[10px] font-semibold uppercase tracking-wider">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-white/5 transition hover:bg-white/[0.02]">
              {columns.map((col) => (
                <td key={col.key} className={col.className ?? 'py-2.5 pr-4 text-slate-300'}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
