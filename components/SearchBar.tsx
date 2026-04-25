'use client';

import { useState, type FormEvent } from 'react';
import { LoaderCircle, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SearchBarProps {
  onSearch: (query: string, pincode: string) => void;
  loading?: boolean;
}

const QUICK_SEARCHES = ['milk', 'tomato', 'bread', 'atta'];

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [pincode, setPincode] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!query.trim()) {
      setError('Please enter a product name.');
      return;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      setError('Please enter a valid 6-digit PIN code.');
      return;
    }

    onSearch(query.trim(), pincode.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl">
      <div className="glass-panel rounded-[2rem] p-4 shadow-[0_18px_60px_rgba(15,23,42,0.1)] sm:p-5">
        <div className="grid gap-3 md:grid-cols-[1.2fr_0.55fr_auto]">
          <label className="rounded-[1.5rem] border border-black/6 bg-white/84 px-4 py-3 shadow-sm">
            <span className="ui-font mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              Search product
            </span>
            <Input
              type="text"
              placeholder="Milk, tomatoes, atta, shampoo..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-auto border-0 bg-transparent px-0 py-0 text-base shadow-none focus-visible:ring-0"
              disabled={loading}
            />
          </label>

          <label className="rounded-[1.5rem] border border-black/6 bg-white/84 px-4 py-3 shadow-sm">
            <span className="ui-font mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              PIN code
            </span>
            <Input
              type="text"
              placeholder="560001"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="h-auto border-0 bg-transparent px-0 py-0 text-base shadow-none focus-visible:ring-0"
              disabled={loading}
              maxLength={6}
            />
          </label>

          <Button
            type="submit"
            disabled={loading}
            className="h-full min-h-20 rounded-[1.5rem] bg-[color:var(--color-surface-strong)] px-8 text-base font-semibold text-[color:var(--color-surface-foreground)] shadow-[0_18px_35px_rgba(15,23,42,0.18)] hover:bg-[color:var(--color-surface-strong)]/92"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Searching...
              </span>
            ) : (
              'Compare now'
            )}
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-black/6 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {QUICK_SEARCHES.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuery(suggestion)}
                className="rounded-full border border-black/8 bg-white/74 px-3 py-1.5 text-sm font-medium text-foreground/72 transition-colors hover:bg-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            Try a serviceable PIN like <span className="font-semibold text-foreground/80">560001</span> for Bengaluru smoke tests.
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
