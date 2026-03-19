'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { ToyCard, Toy } from '@/components/toys/ToyCard';
import { ToyFilters, AgeGroup, ToyType } from '@/components/toys/ToyFilters';
import { ToySearch } from '@/components/toys/ToySearch';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useWishlist } from '@/hooks/useWishlist';
import { useCartStore } from '@/store/cartStore';

interface ToysResponse {
  data: Toy[];
  total: number;
  page: number;
  per_page: number;
}

interface AgeGroupsResponse {
  data: AgeGroup[];
}

interface ToyTypesResponse {
  data: ToyType[];
}

export default function ToysPage(): JSX.Element {
  const [toys, setToys] = useState<Toy[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [toyTypes, setToyTypes] = useState<ToyType[]>([]);

  const [selectedAgeGroup, setSelectedAgeGroup] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);
  const isFetching = useRef(false);

  // Wishlist and cart functionality
  const { items: wishlistItems, addItem: addToWishlist, removeItem: removeFromWishlist } = useWishlist();
  const addToCartStore = useCartStore((state) => state.addItem);

  const handleAddToCart = useCallback(async (toyId: number) => {
    await addToCartStore(toyId, 1);
  }, [addToCartStore]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchFilters = useCallback(async () => {
    try {
      const [ageGroupsRes, toyTypesRes] = await Promise.all([
        api.get<AgeGroupsResponse>('/toys/age-groups'),
        api.get<ToyTypesResponse>('/toys/types'),
      ]);
      if (isMounted.current) {
        setAgeGroups(ageGroupsRes.data.data);
        setToyTypes(toyTypesRes.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch filters:', err);
    }
  }, []);

  const fetchToys = useCallback(async () => {
    if (isFetching.current) {
      return;
    }
    
    isFetching.current = true;
    
    if (isMounted.current) {
      setIsLoading(true);
      setError(null);
    }
    
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('per_page', perPage.toString());
      if (selectedAgeGroup) params.append('age_group', selectedAgeGroup);
      if (selectedType) params.append('type', selectedType);
      if (searchQuery) params.append('q', searchQuery);

      const response = await api.get<ToysResponse>(`/toys?${params.toString()}`);
      
      if (isMounted.current) {
        setToys(response.data.data);
        setTotal(response.data.total);
      }
    } catch (err) {
      if (isMounted.current) {
        setError('Unable to load toys. Please try again later.');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
      isFetching.current = false;
    }
  }, [page, selectedAgeGroup, selectedType, searchQuery]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchToys();
  }, [fetchToys]);

  const handleAgeGroupChange = useCallback((ageGroup: string) => {
    setSelectedAgeGroup(ageGroup);
    setPage(1);
  }, []);

  const handleTypeChange = useCallback((type: string) => {
    setSelectedType(type);
    setPage(1);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedAgeGroup('');
    setSelectedType('');
    setSearchQuery('');
    setPage(1);
  }, []);

  const totalPages = Math.ceil(total / perPage);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage !== page) {
      setPage(newPage);
    }
  }, [page]);

  const handleRetry = useCallback(() => {
    fetchToys();
  }, [fetchToys]);

  const isInWishlist = useCallback((toyId: number) => {
    return wishlistItems.some((item) => item.toy_id === toyId);
  }, [wishlistItems]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="mb-8 font-display text-3xl font-bold text-foreground">Katalog igračaka</h1>

        <div className="mb-6">
          <ToySearch onSearch={handleSearch} />
        </div>

        <div className="grid gap-8 lg:grid-cols-4">
          <aside className="lg:col-span-1">
            <div className="rounded-lg bg-card border border-border p-4 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Filteri</h2>
              <ToyFilters
                ageGroups={ageGroups}
                toyTypes={toyTypes}
                selectedAgeGroup={selectedAgeGroup}
                selectedType={selectedType}
                onAgeGroupChange={handleAgeGroupChange}
                onTypeChange={handleTypeChange}
                onClearFilters={handleClearFilters}
              />
            </div>
          </aside>

          <main className="lg:col-span-3">
            {error && (
              <div className="mb-6 rounded-lg bg-destructive/10 p-4 text-destructive">
                <div className="flex items-center justify-between">
                  <span>{error}</span>
                  <Button onClick={handleRetry} variant="destructive" size="sm">
                    Pokušaj ponovo
                  </Button>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse rounded-lg bg-card border border-border p-4 shadow-sm">
                    <div className="aspect-square rounded-lg bg-muted" />
                    <div className="mt-4 h-4 w-3/4 rounded bg-muted" />
                    <div className="mt-2 h-4 w-1/2 rounded bg-muted" />
                    <div className="mt-4 h-8 w-full rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : toys.length === 0 ? (
              <div className="rounded-lg bg-card border border-border py-12 text-center shadow-sm">
                <p className="text-muted-foreground">Nema igračaka koje odgovaraju vašim kriterijumima.</p>
                <Button onClick={handleClearFilters} variant="link" className="mt-4">
                  Obriši filtere
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-muted-foreground">
                  Prikazano {toys.length} od {total} igračaka (Strana {page} od {totalPages})
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {toys.map((toy) => (
                    <ToyCard
                      key={toy.toyId}
                      toy={toy}
                      onAddToCart={handleAddToCart}
                      onAddToWishlist={addToWishlist}
                      onRemoveFromWishlist={removeFromWishlist}
                      isInWishlist={isInWishlist(toy.toyId)}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-8">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handlePageChange(Math.max(1, page - 1));
                            }}
                            className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handlePageChange(pageNum);
                              }}
                              isActive={page === pageNum}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        
                        <PaginationItem>
                          <PaginationNext 
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handlePageChange(Math.min(totalPages, page + 1));
                            }}
                            className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
