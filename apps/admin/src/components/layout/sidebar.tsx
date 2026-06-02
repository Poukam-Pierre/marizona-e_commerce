'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Avatar,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Inventory as ProductsIcon,
  Category as CategoriesIcon,
  Receipt as OrdersIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  ChevronLeft as ChevronLeftIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/auth-store';

const drawerWidth = 260;

const menuItems = [
  { text: 'Dashboard', href: '/dashboard', icon: <DashboardIcon /> },
  { text: 'Products', href: '/products', icon: <ProductsIcon /> },
  { text: 'Categories', href: '/categories', icon: <CategoriesIcon /> },
  { text: 'Orders', href: '/orders', icon: <OrdersIcon /> },
  { text: 'Settings', href: '/settings', icon: <SettingsIcon /> },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      window.location.href = '/login';
    }
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
              S
            </Typography>
          </Box>
          <Typography variant="h6" fontWeight={700}>
            ShopPk
          </Typography>
        </Box>
        {isMobile && (
          <IconButton onClick={onClose} size="small">
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      {/* Navigation */}
      <List sx={{ flex: 1, px: 1, py: 2 }}>
        {menuItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.href}
                onClick={isMobile ? onClose : undefined}
                selected={isActive}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? 'white' : 'text.secondary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{ fontWeight: 500 }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* User Section */}
      <Divider />
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: 'primary.main',
            }}
          >
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {user?.name || 'Admin'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.role || 'Admin'}
            </Typography>
          </Box>
        </Box>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 2,
            color: 'error.main',
            '&:hover': {
              bgcolor: 'error.main',
              color: 'white',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            primaryTypographyProps={{ fontWeight: 500 }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: { width: drawerWidth },
        }}
      >
        {drawerContent}
      </Drawer>
    );
  }

  return (
    <Box
      component="nav"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {drawerContent}
    </Box>
  );
}
