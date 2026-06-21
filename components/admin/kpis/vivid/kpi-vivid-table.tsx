import { cn } from '@/lib/cn';

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

export function KpiVividTable<T>({ columns, rows, rowKey }: Props<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-bg-border text-fg-tertiary">
            {columns.map((col) => (
              <th key={col.key} className="pb-2 pr-4 text-[10px] font-semibold uppercase tracking-wider">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-bg-border/60 hover:bg-bg-subtle/50">
              {columns.map((col) => (
                <td key={col.key} className={cn('py-2.5 pr-4 text-fg', col.className)}>
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
