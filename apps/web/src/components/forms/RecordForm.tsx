import { useState } from 'react';
import { useForm, useWatch, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';
import { useQuery } from '@tanstack/react-query';
import type { Field } from '../../config/resources.config';
import { defaults } from '../../config/resources.config';
import { resourceApi } from '../../services/resources';
import { keys } from '../../config/query.config';
import { label, rupeesToPaise, currency } from '../../utils/format';
import { Button } from '../ui/button';
type Values = Record<string, unknown>;
export function ReferenceSelect({
  resource,
  value,
  onChange,
  id,
  optional,
}: {
  resource: string;
  value: string;
  onChange: (v: string) => void;
  id: string;
  optional?: boolean;
}) {
  const [search, setSearch] = useState('');
  const params = {
    q: search,
    limit: 100,
    ...(['mess-plans', 'saas-plans'].includes(resource) ? { status: 'active' } : {}),
  };
  const query = useQuery({
    queryKey: keys.list(resource, params),
    queryFn: ({ signal }) => resourceApi.list(resource, params, signal),
  });
  const selected = useQuery({
    queryKey: keys.detail(resource, value ?? ''),
    queryFn: () => resourceApi.detail(resource, value),
    enabled: !!value && !query.data?.items.some((row) => row._id === value),
  });
  const options = [
    ...(query.data?.items ?? []),
    ...(selected.data && !query.data?.items.some((row) => row._id === selected.data._id)
      ? [selected.data]
      : []),
  ];
  return (
    <div className="space-y-1">
      <input
        aria-label={`Search ${resource}`}
        placeholder="Type to search records…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">
          {query.isPending ? 'Loading…' : optional ? 'None' : 'Select a record'}
        </option>
        {options.map((r) => (
          <option key={r._id} value={r._id}>
            {String(r.name ?? r.planName ?? r.receiptNo ?? r._id)}
            {r.customerCode ? ` · ${r.customerCode}` : ''}
            {r.startDate ? ` · ${r.startDate} to ${r.endDate}` : ''}
            {resource === 'mess-plans'
              ? ` | ${currency(r.pricePaise)} | ${r.durationDays} days | ${r.meal}`
              : ''}
          </option>
        ))}
      </select>
      {query.error && <p className="text-xs text-destructive">{query.error.message}</p>}
      {selected.error && <p className="text-xs text-destructive">{selected.error.message}</p>}
    </div>
  );
}
function CurrencyInput({
  value,
  onChange,
  id,
}: {
  value: unknown;
  onChange: (v: number) => void;
  id: string;
}) {
  const [text, setText] = useState((Number(value ?? 0) / 100).toFixed(2));
  return (
    <input
      id={id}
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const v = rupeesToPaise(e.target.value);
        if (v !== undefined) {
          setText(e.target.value);
          onChange(v);
        }
      }}
    />
  );
}
function ItemsInput({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const items = (value ?? []) as {
    name: string;
    quantity: number;
    unit: string;
    ratePaise: number;
  }[];
  const update = (i: number, k: string, v: unknown) =>
    onChange(items.map((row, n) => (n === i ? { ...row, [k]: v } : row)));
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-3">
          <input
            aria-label={`Item ${i + 1} name`}
            placeholder="Item name"
            value={item.name}
            onChange={(e) => update(i, 'name', e.target.value)}
          />
          <input
            aria-label={`Item ${i + 1} quantity`}
            type="number"
            min="1"
            step="1"
            value={item.quantity}
            onChange={(e) => update(i, 'quantity', Number(e.target.value))}
          />
          <input
            aria-label={`Item ${i + 1} unit`}
            placeholder="Unit"
            value={item.unit}
            onChange={(e) => update(i, 'unit', e.target.value)}
          />
          <div>
            <span className="text-xs text-muted-foreground">Rate (₹) per unit</span>
            <CurrencyInput
              id={`item-${i}`}
              value={item.ratePaise}
              onChange={(v) => update(i, 'ratePaise', v)}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(items.filter((_, n) => n !== i))}
          >
            Remove item
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...items, { name: '', quantity: 1, unit: 'kg', ratePaise: 0 }])}
      >
        Add purchase item
      </Button>
    </div>
  );
}
export function RecordForm({
  fields,
  schema,
  initial,
  onSubmit,
  pending,
  submitLabel = 'Save record',
  preview,
}: {
  fields: Field[];
  schema: ZodType;
  initial?: Values;
  onSubmit: (values: Values) => Promise<void>;
  pending?: boolean;
  submitLabel?: string;
  preview?: (values: Values) => React.ReactNode;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema as ZodType<Values, Values>) as Resolver<Values>,
    defaultValues: { ...defaults(fields), ...initial },
  });
  const values = useWatch({ control: form.control });
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {fields.map((f) => (
        <div className="field" key={f.key}>
          <label htmlFor={f.key}>
            {f.label ?? label(f.key)}
            {f.type === 'money' && !f.label ? ' (₹)' : ''}
            {f.optional && <span className="ml-2 text-xs text-muted-foreground">Optional</span>}
          </label>
          <Controller
            control={form.control}
            name={f.key}
            render={({ field }) =>
              f.ref ? (
                <ReferenceSelect
                  resource={f.ref}
                  id={f.key}
                  value={field.value as string}
                  onChange={(v) => field.onChange(v || (!f.optional ? '' : undefined))}
                  optional={f.optional}
                />
              ) : f.type === 'checks' ? (
                <div className="flex gap-4">
                  {f.options?.map((option) => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        className="w-4"
                        type="checkbox"
                        checked={((field.value as string[]) ?? []).includes(option)}
                        onChange={(e) =>
                          field.onChange(
                            e.target.checked
                              ? [...((field.value as string[]) ?? []), option]
                              : ((field.value as string[]) ?? []).filter((v) => v !== option),
                          )
                        }
                      />
                      {label(option)}
                    </label>
                  ))}
                </div>
              ) : f.type === 'items' ? (
                <ItemsInput value={field.value} onChange={field.onChange} />
              ) : f.type === 'money' ? (
                <CurrencyInput id={f.key} value={field.value} onChange={field.onChange} />
              ) : f.type === 'select' ? (
                <select id={f.key} value={String(field.value ?? '')} onChange={field.onChange}>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {label(o)}
                    </option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea id={f.key} rows={3} {...field} value={String(field.value ?? '')} />
              ) : (
                <input
                  id={f.key}
                  {...field}
                  value={String(field.value ?? '')}
                  type={f.type ?? 'text'}
                  autoComplete={f.type === 'password' ? 'new-password' : undefined}
                  onChange={(e) =>
                    field.onChange(f.type === 'number' ? Number(e.target.value) : e.target.value)
                  }
                />
              )
            }
          />
          {form.formState.errors[f.key] && (
            <p role="alert" className="text-xs text-destructive">
              {String(form.formState.errors[f.key]?.message ?? 'Check the supplied values')}
            </p>
          )}
        </div>
      ))}
      {preview?.(values)}
      <Button className="mt-2" disabled={pending || form.formState.isSubmitting}>
        {pending || form.formState.isSubmitting ? 'Please wait…' : submitLabel}
      </Button>
    </form>
  );
}
