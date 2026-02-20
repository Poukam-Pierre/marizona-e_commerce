'use client';

import { Box, Card, CardContent, Typography, Skeleton, Chip } from '@mui/material';
import {
  Inventory as InventoryIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
  AttachMoney as MoneyIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useProducts, useCategories } from '@/hooks/use-queries';

function StatCard({ 
  title, 
  value, 
  icon, 
  color,
  loading 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              {title}
            </Typography>
            {loading ? (
              <Skeleton width={80} height={40} />
            ) : (
              <Typography variant="h4" fontWeight={700} sx={{ mt: 1 }}>
                {value}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: `${color}15`,
              color: color,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function StatSkeleton() {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Skeleton width={100} height={20} />
            <Skeleton width={80} height={40} sx={{ mt: 1 }} />
          </Box>
          <Skeleton width={48} height={48} sx={{ borderRadius: 2 }} />
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: productsData, isLoading: productsLoading } = useProducts({ limit: 1 });
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  const totalProducts = productsData?.meta?.total || 0;
  const totalCategories = categories.length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const isLoading = productsLoading || categoriesLoading;

  return (
    <AdminLayout title="Dashboard">
      {/* Stats Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 3,
          mb: 4,
        }}
      >
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Products"
              value={totalProducts}
              icon={<InventoryIcon />}
              color="#7c3aed"
            />
            <StatCard
              title="Categories"
              value={totalCategories}
              icon={<CategoryIcon />}
              color="#ec4899"
            />
            <StatCard
              title="Total Orders"
              value={0}
              icon={<ReceiptIcon />}
              color="#10b981"
            />
            <StatCard
              title="Low Stock Alerts"
              value={0}
              icon={<WarningIcon />}
              color="#f59e0b"
            />
          </>
        )}
      </Box>

      {/* Quick Actions */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: 3,
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Welcome to ShopNx Admin
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use the sidebar to navigate between different sections. You can manage products, categories, and orders from here.
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Store Info
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">API Status</Typography>
                <Chip label="Running" color="success" size="small" />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Products</Typography>
                <Typography variant="body2" fontWeight={500}>{totalProducts}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Categories</Typography>
                <Typography variant="body2" fontWeight={500}>{totalCategories}</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </AdminLayout>
  );
}
