'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  Button,
  IconButton,
  Chip,
  Typography,
  Skeleton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreIcon,
  WhatsApp as WhatsAppIcon,
  LocalShipping as ShippingIcon,
  Payments as PaymentsIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useOrders, useUpdateOrder } from '@/hooks/use-queries';
import type { Order, OrderStatus, PaymentStatus } from '@/types';
import { ORDER_ALLOWED_TRANSITIONS, DIGITAL_ORDER_ALLOWED_TRANSITIONS } from '@/types';

const statusColors: Record<
  OrderStatus,
  'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  PROCESSING: 'primary',
  SHIPPED: 'secondary',
  DELIVERED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'error',
  REFUNDED: 'default',
};

const statusLabels: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

const paymentColors: Record<
  PaymentStatus,
  'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
> = {
  PENDING:    'warning',
  PROCESSING: 'info',
  PAID:       'success',
  FAILED:     'error',
  REFUNDED:   'default',
  PARTIAL:    'warning',
};

const paymentLabels: Record<PaymentStatus, string> = {
  PENDING:    'Pending',
  PROCESSING: 'Processing',
  PAID:       'Paid',
  FAILED:     'Failed',
  REFUNDED:   'Refunded',
  PARTIAL:    'Partial',
};

function TableSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((row) => (
        <TableRow key={row}>
          <TableCell>
            <Skeleton width={120} />
          </TableCell>
          <TableCell>
            <Skeleton width={150} />
          </TableCell>
          <TableCell>
            <Skeleton width={80} />
          </TableCell>
          <TableCell>
            <Skeleton width={100} />
          </TableCell>
          <TableCell>
            <Skeleton width={80} />
          </TableCell>
          <TableCell>
            <Skeleton width={100} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function OrdersPage() {
  const { enqueueSnackbar } = useSnackbar();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus>('PENDING');
  const [newPaymentStatus, setNewPaymentStatus] = useState<PaymentStatus>('PENDING');

  const { data, isLoading } = useOrders({
    page: page + 1,
    limit: rowsPerPage,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const updateOrder = useUpdateOrder();

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    order: Order,
  ) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedOrder(order);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleOpenStatusDialog = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setNewPaymentStatus(order.paymentStatus);
    setStatusDialogOpen(true);
    handleMenuClose();
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder) return;
    const payload: { status?: OrderStatus; paymentStatus?: PaymentStatus } = {};
    if (newStatus !== selectedOrder.status) payload.status = newStatus;
    if (newPaymentStatus !== selectedOrder.paymentStatus) payload.paymentStatus = newPaymentStatus;
    if (!payload.status && !payload.paymentStatus) {
      setStatusDialogOpen(false);
      return;
    }
    try {
      await updateOrder.mutateAsync({ id: selectedOrder.id, data: payload });
      enqueueSnackbar('Order updated successfully', { variant: 'success' });
      setStatusDialogOpen(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const handleConfirmPayment = async (order: Order) => {
    handleMenuClose();
    if (order.paymentStatus === 'PAID') {
      enqueueSnackbar('Payment is already confirmed', { variant: 'info' });
      return;
    }
    try {
      await updateOrder.mutateAsync({ id: order.id, data: { paymentStatus: 'PAID' } });
      enqueueSnackbar(`Payment confirmed for order #${order.orderNumber}`, { variant: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const handleWhatsAppContact = (order: Order) => {
    const phone = order.customerWhatsapp || order.customerPhone;
    if (phone) {
      const message = encodeURIComponent(
        `Hi ${order.customerName}, this is regarding your order #${order.orderNumber}.`,
      );
      window.open(
        `https://wa.me/${phone.replace(/\D/g, '')}?text=${message}`,
        '_blank',
      );
    } else {
      enqueueSnackbar('No WhatsApp number available', { variant: 'warning' });
    }
    handleMenuClose();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-CM', {
      style: 'currency',
      currency: 'XAF',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <AdminLayout title="Orders">
      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 250 }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">All Status</MenuItem>
            {Object.entries(statusLabels).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Orders Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Order Status</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableSkeleton />
              ) : data?.data.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">
                      No orders found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data?.data.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          #{order.orderNumber}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {order.items.length} item(s)
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
                      >
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: 'primary.light',
                          }}
                        >
                          {order.customerName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {order.customerName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {order.customerEmail}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {formatCurrency(order.total)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabels[order.status]}
                        color={statusColors[order.status]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={paymentLabels[order.paymentStatus as PaymentStatus] ?? order.paymentStatus}
                        color={paymentColors[order.paymentStatus as PaymentStatus] ?? 'default'}
                        size="small"
                        variant={order.paymentStatus === 'PAID' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(order.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={(e) => handleMenuOpen(e, order)}>
                        <MoreIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={data?.meta.total || 0}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => selectedOrder && handleOpenStatusDialog(selectedOrder)}
        >
          <ShippingIcon sx={{ mr: 1.5 }} fontSize="small" />
          Update Status
        </MenuItem>
        <MenuItem
          onClick={() => selectedOrder && handleConfirmPayment(selectedOrder)}
          disabled={selectedOrder?.paymentStatus === 'PAID'}
        >
          <PaymentsIcon sx={{ mr: 1.5 }} fontSize="small" color={selectedOrder?.paymentStatus === 'PAID' ? 'disabled' : 'success'} />
          {selectedOrder?.paymentStatus === 'PAID' ? 'Payment Confirmed ✓' : 'Confirm Payment'}
        </MenuItem>
        <MenuItem
          onClick={() => selectedOrder && handleWhatsAppContact(selectedOrder)}
        >
          <WhatsAppIcon sx={{ mr: 1.5 }} fontSize="small" color="success" />
          Contact via WhatsApp
        </MenuItem>
      </Menu>

      {/* Status Update Dialog */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
      >
        <DialogTitle>Update Order Status</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {selectedOrder?.items.every((i) => i.productType === 'DIGITAL') && (
              <Typography variant="caption" color="info.main">
                Digital order — shipping steps are not applicable.
              </Typography>
            )}
            <FormControl fullWidth>
              <InputLabel>Order Status</InputLabel>
              <Select
                value={newStatus}
                label="Order Status"
                onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
              >
                {selectedOrder && (() => {
                  const isDigital = selectedOrder.items.every((i) => i.productType === 'DIGITAL');
                  const transitions = isDigital
                    ? DIGITAL_ORDER_ALLOWED_TRANSITIONS[selectedOrder.status]
                    : ORDER_ALLOWED_TRANSITIONS[selectedOrder.status];
                  return transitions.map((value) => (
                    <MenuItem key={value} value={value}>
                      {statusLabels[value]}
                    </MenuItem>
                  ));
                })()}
                {/* Always keep the current status selectable */}
                {selectedOrder && (
                  <MenuItem value={selectedOrder.status}>
                    {statusLabels[selectedOrder.status]} (current)
                  </MenuItem>
                )}
                {selectedOrder && (() => {
                  const isDigital = selectedOrder.items.every((i) => i.productType === 'DIGITAL');
                  const transitions = isDigital
                    ? DIGITAL_ORDER_ALLOWED_TRANSITIONS[selectedOrder.status]
                    : ORDER_ALLOWED_TRANSITIONS[selectedOrder.status];
                  return transitions.length === 0 ? (
                    <MenuItem disabled value="">
                      No transitions available — terminal state
                    </MenuItem>
                  ) : null;
                })()}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Payment Status</InputLabel>
              <Select
                value={newPaymentStatus}
                label="Payment Status"
                onChange={(e) => setNewPaymentStatus(e.target.value as PaymentStatus)}
              >
                {(['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL'] as PaymentStatus[]).map((value) => (
                  <MenuItem key={value} value={value}>
                    {paymentLabels[value]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdateStatus}
            disabled={updateOrder.isPending}
          >
            {updateOrder.isPending ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
}
