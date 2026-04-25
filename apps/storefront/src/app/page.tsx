'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  SlidersHorizontal,
  X,
  Package,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
} from 'lucide-react';
import { useProducts, useCategories } from '@/hooks/use-api';
import { ProductCard } from '@/components/product/product-card';
import { ProductCardSkeleton } from '@/components/product/product-card-skeleton';
import { NotificationToggle } from '@/components/NotificationToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get initial values from URL
  const initialPage = parseInt(searchParams.get('page') || '1');
  const initialLimit = parseInt(searchParams.get('limit') || '12');
  const initialSearch = searchParams.get('search') || '';
  const initialCategory = searchParams.get('categoryId') || 'all';
  const initialType = searchParams.get('type') as 'PHYSICAL' | 'DIGITAL' | null;
  const initialSortBy = searchParams.get('sortBy') || 'createdAt';
  const initialSortOrder = (searchParams.get('sortOrder') || 'desc') as
    | 'asc'
    | 'desc';

  // Local state
  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState(initialSearch);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [type, setType] = useState<'PHYSICAL' | 'DIGITAL' | 'all'>(
    initialType || 'all',
  );
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
  const [limit] = useState(initialLimit);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Queries
  const { data, isLoading, error } = useProducts({
    page,
    limit,
    search: search || undefined,
    categoryId: categoryId === 'all' ? undefined : categoryId,
    type: type === 'all' ? undefined : type,
    sortBy,
    sortOrder,
  });

  const { data: categories = [] } = useCategories();

  // Update URL with current filters
  const updateUrl = (params: Record<string, string | number | undefined>) => {
    const newParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== 1) {
        newParams.set(key, String(value));
      }
    });
    router.push(`/?${newParams.toString()}`, { scroll: false });
  };

  // Handlers
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
    updateUrl({ search: searchInput, categoryId, type, sortBy, sortOrder });
  };

  const handleFilterChange = (key: string, value: string) => {
    setPage(1);
    if (key === 'categoryId') {
      setCategoryId(value);
      updateUrl({
        search,
        categoryId: value === 'all' ? undefined : value,
        type: type === 'all' ? undefined : type,
        sortBy,
        sortOrder,
      });
    } else if (key === 'type') {
      setType(value as 'PHYSICAL' | 'DIGITAL' | 'all');
      updateUrl({
        search,
        categoryId: categoryId === 'all' ? undefined : categoryId,
        type: value === 'all' ? undefined : value,
        sortBy,
        sortOrder,
      });
    } else if (key === 'sortBy') {
      setSortBy(value);
      updateUrl({ search, categoryId, type, sortBy: value, sortOrder });
    } else if (key === 'sortOrder') {
      setSortOrder(value as 'asc' | 'desc');
      updateUrl({ search, categoryId, type, sortBy, sortOrder: value });
    }
  };

  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setCategoryId('all');
    setType('all');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
    router.push('/');
  };

  const hasActiveFilters = search || categoryId !== 'all' || type !== 'all';

  // Pagination
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    updateUrl({ page: newPage, search, categoryId, type, sortBy, sortOrder });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeFiltersCount = [search, categoryId, type].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              Discover Amazing Products
            </h1>
            <p className="text-slate-300 text-lg mb-8">
              Browse our curated collection and checkout seamlessly via WhatsApp
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="search"
                placeholder="Search for products..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-12 pr-4 h-12 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:bg-white/20"
              />
            </form>
          </div>
        </div>
      </section>

      {/* Notification Toggle */}
      <div className="container mx-auto px-4 py-6">
        <NotificationToggle />
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 items-start md:items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Sheet (Mobile) */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2 md:hidden">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  {/* Category Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Category
                    </label>
                    <Select
                      value={categoryId}
                      onValueChange={(v) => handleFilterChange('categoryId', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Type Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Product Type
                    </label>
                    <Select
                      value={type}
                      onValueChange={(v) => handleFilterChange('type', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="PHYSICAL">Physical</SelectItem>
                        <SelectItem value="DIGITAL">Digital</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Sort */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Sort by</label>
                    <Select value={sortBy} onValueChange={(v) => handleFilterChange('sortBy', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="createdAt">Newest</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="price">Price</SelectItem>
                        <SelectItem value="soldCount">Best Sellers</SelectItem>
                        <SelectItem value="rating">Top Rated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Order</label>
                    <Select value={sortOrder} onValueChange={(v) => handleFilterChange('sortOrder', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Descending</SelectItem>
                        <SelectItem value="asc">Ascending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="w-full"
                    >
                      Clear All Filters
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {/* Desktop Filters */}
            <div className="hidden md:flex items-center gap-4 flex-wrap">
              <Select
                value={categoryId}
                onValueChange={(v) => handleFilterChange('categoryId', v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={type}
                onValueChange={(v) => handleFilterChange('type', v)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="PHYSICAL">Physical</SelectItem>
                  <SelectItem value="DIGITAL">Digital</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={sortBy}
                onValueChange={(v) => handleFilterChange('sortBy', v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Newest</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="soldCount">Best Sellers</SelectItem>
                  <SelectItem value="rating">Top Rated</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={sortOrder}
                onValueChange={(v) => handleFilterChange('sortOrder', v)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Desc</SelectItem>
                  <SelectItem value="asc">Asc</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="gap-1"
                >
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">View:</span>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-6 md:hidden">
            {search && (
              <Badge variant="secondary" className="gap-1">
                Search: {search}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setSearch('')}
                />
              </Badge>
            )}
            {categoryId !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                {categories.find((c) => c.id === categoryId)?.name}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setCategoryId('all')}
                />
              </Badge>
            )}
            {type !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                {type}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setType('all')}
                />
              </Badge>
            )}
          </div>
        )}

        {/* Results Count */}
        {data?.meta && (
          <p className="text-sm text-muted-foreground mb-4">
            Showing {data.data.length} of {data.meta.total} products
          </p>
        )}

        {/* Product Grid */}
        {isLoading ? (
          <div className={`grid gap-4 md:gap-6 ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1'}`}>
            {Array.from({ length: limit }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Failed to load products
            </h3>
            <p className="text-muted-foreground mb-4">Please try again later</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        ) : data?.data.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filters
            </p>
            <Button onClick={clearFilters}>Clear Filters</Button>
          </div>
        ) : (
          <>
            <div className={`grid gap-4 md:gap-6 ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1'}`}>
              {data?.data.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Pagination */}
            {data && data.meta.totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from(
                    { length: Math.min(5, data.meta.totalPages) },
                    (_, i) => {
                      let pageNum: number;
                      if (data.meta.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= data.meta.totalPages - 2) {
                        pageNum = data.meta.totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? 'default' : 'outline'}
                          size="icon"
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    },
                  )}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === data.meta.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
