'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface SearchSuggestion {
  id: number;
  name: string;
  type: string;
  image: string;
  slug: string;
}

interface ToySearchProps {
  onSearch: (query: string) => void;
  debounceMs?: number;
  minChars?: number;
  isLoading?: boolean;
  initialValue?: string;
}

export function ToySearch({
  onSearch,
  debounceMs = 300,
  minChars = 2,
  isLoading = false,
  initialValue = '',
}: ToySearchProps): JSX.Element {
  const [query, setQuery] = useState(initialValue);
  const [debouncedQuery, setDebouncedQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Sync when initialValue changes externally (e.g. filters cleared from parent)
  useEffect(() => {
    setQuery(initialValue);
    setDebouncedQuery(initialValue);
  }, [initialValue]);

  // Debounce the query for the parent search callback
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  // Trigger parent search callback
  useEffect(() => {
    if (debouncedQuery.length === 0 || debouncedQuery.length >= minChars) {
      onSearch(debouncedQuery);
    }
  }, [debouncedQuery, onSearch, minChars]);

  // Fetch autocomplete suggestions
  useEffect(() => {
    if (query.length < minChars) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ data: SearchSuggestion[] }>(
          `/toys/suggest?q=${encodeURIComponent(query)}&limit=5`
        );
        setSuggestions(res.data.data);
        setShowSuggestions(res.data.data.length > 0);
        setHighlightedIndex(-1);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, minChars, debounceMs]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    onSearch('');
  }, [onSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      router.push(`/toys/${suggestions[highlightedIndex].id}`);
      setShowSuggestions(false);
    }
  }, [showSuggestions, suggestions, highlightedIndex, router]);

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.length >= minChars) {
            setShowSuggestions(true);
          }
        }}
        onFocus={() => {
          if (suggestions.length > 0) setShowSuggestions(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={`Pretražite igračke... (min ${minChars} karaktera)`}
        className="w-full rounded-md border border-input bg-background px-4 py-2 pl-10 pr-10 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        disabled={isLoading}
      />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>

      {isLoading ? (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <svg
            className="animate-spin h-5 w-5 text-primary"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      ) : query && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Obriši pretragu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-border bg-card shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before click registers
                router.push(`/toys/${s.id}`);
                setShowSuggestions(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors ${
                i === highlightedIndex ? 'bg-muted' : ''
              }`}
            >
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.image}
                  alt={s.name}
                  className="h-10 w-10 rounded object-cover flex-shrink-0 bg-muted"
                />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                <span className="text-xs text-muted-foreground">{s.type}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {query.length > 0 && query.length < minChars && (
        <p className="mt-1 text-xs text-muted-foreground">
          Unesite još {minChars - query.length} karakter{minChars - query.length > 1 ? 'a' : ''} za pretragu
        </p>
      )}
    </div>
  );
}
