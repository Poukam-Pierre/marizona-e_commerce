'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import {
  useCategories,
  useDashboardStats,
  useHealthCheck,
} from '@/hooks/use-queries';
import {
  Inventory as InventoryIcon,
  AttachMoney as MoneyIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Typography,
} from '@mui/material';

function StatCard({
  title,
  value,
  icon,
  color,
  loading,
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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
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
  // Hooks queries
  const { data: categories = [], isLoading: categoriesLoading } =
    useCategories();
  const { data: dashboardStats, isLoading: dashboardStatsLoading } =
    useDashboardStats();
  const { data: healthCheck, isLoading: healthLoading } = useHealthCheck();

  const totalProducts = dashboardStats?.totalProducts || 0;
  const totalRevenue = dashboardStats?.totalRevenue || 0;
  const totalLowStock = dashboardStats?.lowStockProducts || 0;
  const totalOrders = dashboardStats?.totalOrders || 0;
  const totalCategories = categories.length;
  const isLoading = categoriesLoading || dashboardStatsLoading;

  // Get API status from health check
  const apiStatus = healthCheck?.status || 'unknown';
  const getStatusColor = () => {
    switch (apiStatus) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'unhealthy':
        return 'error';
      default:
        return 'default';
    }
  };
  const getStatusLabel = () => {
    if (healthLoading) return 'Checking...';
    switch (apiStatus) {
      case 'healthy':
        return 'Running';
      case 'degraded':
        return 'Degraded';
      case 'unhealthy':
        return 'Down';
      default:
        return 'Unknown';
    }
  };

  // format currency in XAF
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-CM', {
      style: 'currency',
      currency: 'XAF',
    }).format(value);
  };

  return (
    <AdminLayout title="Dashboard">
      {/* Stats Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
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
              title="Revenue"
              value={formatCurrency(totalRevenue)}
              icon={<MoneyIcon />}
              color="#ec4899"
            />
            <StatCard
              title="Total Orders"
              value={totalOrders}
              icon={<ReceiptIcon />}
              color="#10b981"
            />
            <StatCard
              title="Low Stock Alerts"
              value={totalLowStock}
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
              Welcome to ShopPk Admin
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use the sidebar to navigate between different sections. You can
              manage products, categories, and orders from here.
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
                <Typography variant="body2" color="text.secondary">
                  API Status
                </Typography>
                <Chip
                  label={getStatusLabel()}
                  color={getStatusColor()}
                  size="small"
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Products
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {totalProducts}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Categories
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {totalCategories}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </AdminLayout>
  );
}
