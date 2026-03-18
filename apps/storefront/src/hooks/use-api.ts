'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { ProductQuery, CreateOrderDto } from '@/types';

// Query Keys
export const queryKeys = {
  products: (query?: ProductQuery) => ['products', query] as const,
  product: (id: string) => ['product', id] as const,
  productBySlug: (slug: string) => ['product', 'slug', slug] as const,
  categories: () => ['categories'] as const,
  category: (id: string) => ['category', id] as const,
  order: (id: string) => ['order', id] as const,
};

// Products
export function useProducts(query?: ProductQuery) {
  return useQuery({
    queryKey: queryKeys.products(query),
    queryFn: () => api.getProducts(query),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => api.getProduct(id),
    enabled: !!id,
  });
}

export function useProductBySlug(slug: string) {
  return useQuery({
    queryKey: queryKeys.productBySlug(slug),
    queryFn: () => api.getProductBySlug(slug),
    enabled: !!slug,
  });
}

// Categories
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => api.getCategories(),
  });
}

export function useCategory(id: string) {
  return useQuery({
    queryKey: queryKeys.category(id),
    queryFn: () => api.getCategory(id),
    enabled: !!id,
  });
}

// Orders
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrderDto) => api.createOrder(data),
    onSuccess: () => {
      // Optionally invalidate any relevant queries
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => api.getOrder(id),
    enabled: !!id,
  });
}

// WhatsApp
export function useWhatsAppLink(orderId: string) {
  return useQuery({
    queryKey: ['whatsapp', orderId],
    queryFn: () => api.getWhatsAppLink(orderId),
    enabled: !!orderId,
  });
}

// Rating
export function useRateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) =>
      api.rateProduct(id, rating),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.product(id) });
    },
  });
}
