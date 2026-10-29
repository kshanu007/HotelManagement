import { useState } from 'react';
import type { RecordData } from '@annapurna/types';
import { ChevronLeft, ChevronRight, Search, Columns3 } from 'lucide-react';
import { display, label } from '../../utils/format';
import { Button } from '../ui/button';
import { Empty, Loading } from '../feedback/QueryState';
export interface TableProps {
  items: RecordData[];
  columns: string[];
  total: number;
  page: number;
  limit: number;
  onPage: (p: number) => void;
  search?: string;
  onSearch?: (q: string) => void;
  onView?: (row: RecordData) => void;
  onSort?: (key: string) => void;
  loading?: boolean;
  selected?: string[];
  onSelect?: (ids: string[]) => void;
  cell?: (row: RecordData, key: string) => React.ReactNode;
}
export function DataTable({
  items,
  columns,
  total,
  page,
  limit,
  onPage,
  search,
  onSearch,
  onView,
  onSort,
  loading,
  selected,
  onSelect,
  cell,
}: TableProps) {
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = columns.filter((k) => !hidden.includes(k));
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {onSearch && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="relative w-full max-w-sm">
            <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
            <input
              aria-label="Search records"
              className="pl-9"
              placeholder="Search records…"
              value={search ?? ''}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          <details className="relative">
            <summary className="flex cursor-pointer items-center gap-2 text-xs">
              <Columns3 size={15} /> Columns
            </summary>
            <div className="absolute right-0 z-10 mt-2 min-w-44 rounded-lg border bg-card p-3 shadow-lg">
              {columns.map((c) => (
                <label key={c} className="flex items-center gap-2 py-1 text-xs">
                  <input
                    className="w-4"
                    type="checkbox"
                    checked={!hidden.includes(c)}
                    onChange={() =>
                      setHidden((h) => (h.includes(c) ? h.filter((k) => k !== c) : [...h, c]))
                    }
                  />
                  {label(c)}
                </label>
              ))}
            </div>
          </details>
        </div>
      )}
      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                {onSelect && (
                  <th className="p-4">
                    <input
                      className="w-4"
                      aria-label="Select this page"
                      type="checkbox"
                      checked={items.every((r) => selected?.includes(r._id))}
                      onChange={(e) => onSelect(e.target.checked ? items.map((r) => r._id) : [])}
                    />
                  </th>
                )}
                {visible.map((c) => (
                  <th key={c} className="whitespace-nowrap px-5 py-3 font-medium">
                    {onSort &&
                    ['createdAt', 'name', 'date', 'startDate', 'endDate', 'amountPaise'].includes(
                      c,
                    ) ? (
                      <button onClick={() => onSort(c)}>{label(c)} ↕</button>
                    ) : (
                      label(c)
                    )}
                  </th>
                ))}
                {onView && <th className="px-5 py-3">Details</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((row) => (
                <tr key={row._id} className="hover:bg-muted/40">
                  {onSelect && (
                    <td className="p-4">
                      <input
                        aria-label={`Select ${row._id}`}
                        className="w-4"
                        type="checkbox"
                        checked={selected?.includes(row._id) ?? false}
                        onChange={(e) =>
                          onSelect(
                            e.target.checked
                              ? [...(selected ?? []), row._id]
                              : (selected ?? []).filter((id) => id !== row._id),
                          )
                        }
                      />
                    </td>
                  )}
                  {visible.map((c) => (
                    <td className="max-w-80 whitespace-nowrap px-5 py-4" key={c}>
                      {cell?.(row, c) ??
                        (c === 'status' ? (
                          <span className="badge">
                            {display(
                              (row.displayLabels as Record<string, string> | undefined)?.[c] ??
                                row[c],
                              c,
                            )}
                          </span>
                        ) : (
                          display(
                            (row.displayLabels as Record<string, string> | undefined)?.[c] ??
                              row[c],
                            c,
                          )
                        ))}
                    </td>
                  ))}
                  {onView && (
                    <td className="px-5 py-3">
                      <Button variant="ghost" size="sm" onClick={() => onView(row)}>
                        View →
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
        <span>
          {total === 0
            ? '0 records'
            : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total} records`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Previous page"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span>Page {page}</span>
          <Button
            aria-label="Next page"
            variant="outline"
            size="sm"
            disabled={page * limit >= total}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
