import { api } from '@/services/api';
import type {
  CreateCategoryDto,
  CreateProductDto,
  QueryParams,
  UpdateCategoryDto,
  UpdateOrderDto,
  UpdateProductDto,
} from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Query Keys
export const queryKeys = {
  health: ['health'] as const,
  dashboard: {
    stats: ['dashboard', 'stats'] as const,
    lowStock: ['dashboard', 'lowStock'] as const,
    recentOrders: ['dashboard', 'recentOrders'] as const,
  },
  categories: ['categories'] as const,
  category: (id: string) => ['categories', id] as const,
  products: (params?: QueryParams) => ['products', params] as const,
  product: (id: string) => ['products', id] as const,
  orders: (params?: QueryParams & { status?: string }) =>
    ['orders', params] as const,
  order: (id: string) => ['orders', id] as const,
};

// Health Check Hook
export function useHealthCheck() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.checkHealth(),
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 1,
  });
}

// Dashboard Hooks
export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats,
    queryFn: () => api.getDashboardStats(),
  });
}

export function useLowStockProducts() {
  return useQuery({
    queryKey: queryKeys.dashboard.lowStock,
    queryFn: () => api.getLowStockProducts(),
  });
}

export function useRecentOrders() {
  return useQuery({
    queryKey: queryKeys.dashboard.recentOrders,
    queryFn: () => api.getRecentOrders(),
  });
}

// Category Hooks
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
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

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryDto) => api.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryDto }) =>
      api.updateCategory(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      queryClient.invalidateQueries({ queryKey: queryKeys.category(id) });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
}

// Product Hooks
export function useProducts(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.products(params),
    queryFn: () => api.getProducts(params),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => api.getProduct(id),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductDto) => api.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductDto }) =>
      api.updateProduct(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products() });
      queryClient.invalidateQueries({ queryKey: queryKeys.product(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
    },
  });
}

export function useUploadProductImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productId,
      images,
    }: {
      productId: string;
      images: File[];
    }) => api.uploadProductImages(productId, images),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.product(productId) });
    },
  });
}

// Order Hooks
export function useOrders(params?: QueryParams & { status?: string }) {
  return useQuery({
    queryKey: queryKeys.orders(params),
    queryFn: () => api.getOrders(params),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => api.getOrder(id),
    enabled: !!id,
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrderDto }) =>
      api.updateOrder(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.recentOrders,
      });
    },
  });
}

// Notification Hook
export function useSendPushNotification() {
  return useMutation({
    mutationFn: ({ title, body }: { title: string; body: string }) =>
      api.sendPushNotification(title, body),
  });
}
