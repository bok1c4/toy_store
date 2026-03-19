'use client';

import { useState, useEffect, useCallback } from 'react';

interface ToySearchProps {
  onSearch: (query: string) => void;
  debounceMs?: number;
  minChars?: number;
  isLoading?: boolean;
}

export function ToySearch({ 
  onSearch, 
  debounceMs = 300, 
  minChars = 2,
  isLoading = false 
}: ToySearchProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  useEffect(() => {
    if (debouncedQuery.length === 0 || debouncedQuery.length >= minChars) {
      onSearch(debouncedQuery);
    }
  }, [debouncedQuery, onSearch, minChars]);

  const handleClear = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    onSearch('');
  }, [onSearch]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
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
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
      
      {query.length > 0 && query.length < minChars && (
        <p className="mt-1 text-xs text-muted-foreground">
          Unesite još {minChars - query.length} karakter{minChars - query.length > 1 ? 'a' : ''} za pretragu
        </p>
      )}
    </div>
  );
}
