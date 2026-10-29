import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';
afterEach(cleanup);
describe('shared table', () => {
  it('shows empty state and prevents paging beyond the result', () => {
    render(
      <DataTable items={[]} columns={['name']} total={0} page={1} limit={20} onPage={() => {}} />,
    );
    expect(screen.getByText(/No records yet/)).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });
  it('provides row actions, search, and server pagination', () => {
    const view = vi.fn(),
      search = vi.fn(),
      page = vi.fn();
    render(
      <DataTable
        items={[{ _id: 'a', createdAt: '2026-10-29', name: 'Asha' }]}
        columns={['name']}
        total={21}
        page={1}
        limit={20}
        onPage={page}
        onView={view}
        onSearch={search}
      />,
    );
    fireEvent.click(screen.getByText('View →'));
    expect(view).toHaveBeenCalledWith(expect.objectContaining({ name: 'Asha' }));
    fireEvent.change(screen.getByLabelText('Search records'), { target: { value: 'Ash' } });
    expect(search).toHaveBeenCalledWith('Ash');
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(page).toHaveBeenCalledWith(2);
  });
});
