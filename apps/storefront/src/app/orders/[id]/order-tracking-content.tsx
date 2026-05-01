'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Star,
  BadgeCheck,
  XCircle,
  Download,
  Lock,
  TimerOff,
  Ban,
  AlertTriangle,
  Copy,
  Check,
  MapPin,
  Phone,
} from 'lucide-react';
import { useOrder } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { OrderItem, OrderStatus, PaymentStatus } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

type StepStatus = 'completed' | 'active' | 'pending';

type StepDef = {
  key: OrderStatus;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
};

const PHYSICAL_STEPS: StepDef[] = [
  { key: 'PENDING', label: 'Order Placed', shortLabel: 'Placed', icon: Clock },
  {
    key: 'CONFIRMED',
    label: 'Confirmed',
    shortLabel: 'Confirmed',
    icon: BadgeCheck,
  },
  {
    key: 'PROCESSING',
    label: 'Processing',
    shortLabel: 'Processing',
    icon: Package,
  },
  { key: 'SHIPPED', label: 'Shipped', shortLabel: 'Shipped', icon: Truck },
  {
    key: 'DELIVERED',
    label: 'Delivered',
    shortLabel: 'Delivered',
    icon: CheckCircle2,
  },
  { key: 'COMPLETED', label: 'Completed', shortLabel: 'Done', icon: Star },
];

const DIGITAL_STEPS: StepDef[] = [
  { key: 'PENDING', label: 'Order Placed', shortLabel: 'Placed', icon: Clock },
  {
    key: 'CONFIRMED',
    label: 'Confirmed',
    shortLabel: 'Confirmed',
    icon: BadgeCheck,
  },
  { key: 'COMPLETED', label: 'Ready', shortLabel: 'Ready', icon: Download },
];

const ORDER_STEPS = PHYSICAL_STEPS;
const TERMINAL_NEGATIVE: OrderStatus[] = ['CANCELLED', 'REFUNDED'];

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

const PAYMENT_BADGE: Record<
  PaymentStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: 'Payment Pending',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  PROCESSING: {
    label: 'Payment Processing',
    className: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  PAID: {
    label: 'Paid',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  FAILED: {
    label: 'Payment Failed',
    className: 'bg-red-100 text-red-800 border-red-300',
  },
  REFUNDED: {
    label: 'Refunded',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  PARTIAL: {
    label: 'Partial Payment',
    className: 'bg-orange-100 text-orange-800 border-orange-300',
  },
};

// ─── Digital download card ────────────────────────────────────────────────────

function DigitalDownloadCard({
  item,
  orderId,
  token,
}: {
  item: OrderItem;
  orderId: string;
  token: string;
}) {
  if (item.productType !== 'DIGITAL') return null;

  const downloadHref = `/api/v1/orders/${orderId}/items/${item.id}/download?token=${encodeURIComponent(token)}`;

  if (item.downloadEligible) {
    const remaining =
      item.downloadLimit !== null
        ? item.downloadLimit - item.downloadCount
        : null;
    const expiryDate = item.downloadExpiry
      ? new Date(item.downloadExpiry).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : null;

    return (
      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-3">
        <div className="flex items-start gap-3">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              Ready to download
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {remaining !== null && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  {remaining} download{remaining !== 1 ? 's' : ''} remaining
                </p>
              )}
              {expiryDate && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Expires {expiryDate}
                </p>
              )}
            </div>
            <a
              href={downloadHref}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <Download className="h-3 w-3" />
              Download file
            </a>
          </div>
        </div>
      </div>
    );
  }

  const blockedConfig: Record<
    NonNullable<OrderItem['downloadBlockedReason']>,
    {
      icon: React.FC<{ className?: string }>;
      title: string;
      message: string;
      color: string;
    }
  > = {
    NOT_PAID: {
      icon: Lock,
      title: 'Awaiting payment',
      message: 'Download will be unlocked once payment is confirmed.',
      color: 'amber',
    },
    ORDER_CANCELLED: {
      icon: Ban,
      title: 'Order cancelled',
      message: 'Downloads are no longer available for this order.',
      color: 'red',
    },
    LINK_EXPIRED: {
      icon: TimerOff,
      title: 'Link expired',
      message: item.downloadExpiry
        ? `Expired on ${new Date(item.downloadExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`
        : 'Download link has expired.',
      color: 'slate',
    },
    LIMIT_REACHED: {
      icon: XCircle,
      title: 'Limit reached',
      message: `You've reached the maximum of ${item.downloadLimit} download${item.downloadLimit !== 1 ? 's' : ''}.`,
      color: 'red',
    },
  };

  if (!item.downloadBlockedReason) return null;
  const cfg = blockedConfig[item.downloadBlockedReason];
  const Icon = cfg.icon;

  const styles: Record<
    string,
    { wrap: string; icon: string; title: string; body: string }
  > = {
    amber: {
      wrap: 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800',
      icon: 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400',
      title: 'text-amber-900 dark:text-amber-100',
      body: 'text-amber-700 dark:text-amber-300',
    },
    red: {
      wrap: 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800',
      icon: 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400',
      title: 'text-red-900 dark:text-red-100',
      body: 'text-red-700 dark:text-red-300',
    },
    slate: {
      wrap: 'border-slate-200 bg-slate-50 dark:bg-slate-800/30 dark:border-slate-700',
      icon: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
      title: 'text-slate-700 dark:text-slate-300',
      body: 'text-slate-500 dark:text-slate-400',
    },
  };
  const s = styles[cfg.color] ?? styles.slate;

  return (
    <div className={`mt-3 rounded-lg border p-3 ${s.wrap}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${s.icon}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className={`text-xs font-semibold ${s.title}`}>{cfg.title}</p>
          <p className={`text-xs mt-0.5 ${s.body}`}>{cfg.message}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Copy-to-clipboard hook ───────────────────────────────────────────────────

function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    let success = false;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch {
        // blocked (HTTP / permissions) — fall through
      }
    }

    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        success = true;
      } catch {
        // execCommand also failed
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Could not copy — please copy the link manually.');
    }
  };
  return { copied, copy };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function TrackingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl px-4 py-8 space-y-5">
        <Skeleton className="h-4 w-28" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-44 rounded-full" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function TrackingError() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 mb-5">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
      </div>
      <h1 className="text-xl font-bold mb-2">Order not found</h1>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        This tracking link may have expired or is invalid. Check your original
        order confirmation message.
      </p>
      <Link href="/">
        <Button variant="outline" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to store
        </Button>
      </Link>
    </div>
  );
}

// ─── Format helpers ───────────────────────────────────────────────────────────

const fmt = (price: number, currency = 'XAF') =>
  `${currency} ${price.toLocaleString('fr-CM')}`;

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

const fmtShort = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })
    : null;

// ─── Main content component ───────────────────────────────────────────────────

export default function OrderTrackingContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params.id as string;
  const token = searchParams.get('token') ?? '';

  const { data: order, isLoading, isError } = useOrder(orderId, token);
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    if (orderId && token) {
      try {
        sessionStorage.setItem(`order-token-${orderId}`, token);
      } catch {
        // ignore storage errors
      }
    }
  }, [orderId, token]);

  if (!token) return <TrackingError />;
  if (isLoading) return <TrackingSkeleton />;
  if (isError || !order) return <TrackingError />;

  const isTerminalNegative = TERMINAL_NEGATIVE.includes(order.status);
  const paymentCfg = PAYMENT_BADGE[order.paymentStatus];
  const trackingUrl = typeof window !== 'undefined' ? window.location.href : '';

  const expiryDate = order.lookupTokenExpiry
    ? new Date(order.lookupTokenExpiry).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const isDigitalOnly =
    order.items.length > 0 &&
    order.items.every((i) => i.productType === 'DIGITAL');
  const steps = isDigitalOnly ? DIGITAL_STEPS : PHYSICAL_STEPS;
  const activeStepIdxInSet = steps.findIndex((s) => s.key === order.status);
  const progressPctInSet =
    activeStepIdxInSet <= 0
      ? 0
      : Math.round((activeStepIdxInSet / (steps.length - 1)) * 100);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl px-4 py-8 space-y-5">
        {/* Back navigation */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to store
        </Link>

        {/* Page heading */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Order <span className="text-primary">#{order.orderNumber}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Placed {fmtDate(order.createdAt)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${paymentCfg.className}`}
            >
              {paymentCfg.label}
            </span>
          </div>
        </div>

        {/* Status pill */}
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium ${
              isTerminalNegative
                ? 'border-red-200 bg-red-50 text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-300'
                : 'border-primary/30 bg-primary/5 text-primary'
            }`}
          >
            {!isTerminalNegative && (
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            )}
            {isTerminalNegative && <XCircle className="h-3.5 w-3.5" />}
            {STATUS_LABELS[order.status]}
          </div>
        </div>

        {/* Cancelled / Refunded banner */}
        {isTerminalNegative && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4">
            <XCircle className="h-5 w-5 flex-shrink-0 text-red-500 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                Order {order.status === 'CANCELLED' ? 'Cancelled' : 'Refunded'}
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                {order.status === 'REFUNDED'
                  ? 'A refund has been initiated. Please allow a few business days to process.'
                  : 'This order has been cancelled. Contact us if this was a mistake.'}
              </p>
            </div>
          </div>
        )}

        {/* Status stepper */}
        {!isTerminalNegative && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Order progress
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-5">
              {isDigitalOnly && (
                <p className="text-xs text-muted-foreground mb-4">
                  Digital product — available to download once confirmed &amp;
                  paid.
                </p>
              )}
              <div className="relative mb-3">
                <div className="absolute top-5 left-5 right-5 h-0.5 bg-border" />
                <div
                  className="absolute top-5 left-5 h-0.5 bg-primary transition-all duration-700 ease-out"
                  style={{ width: `calc(${progressPctInSet}% * 0.9)` }}
                />
                <div
                  className={`relative grid gap-1 ${
                    steps.length === 3 ? 'grid-cols-3' : 'grid-cols-6'
                  }`}
                >
                  {steps.map((step) => {
                    const fullIdx = ORDER_STEPS.findIndex(
                      (s) => s.key === step.key,
                    );
                    const fullCurr = ORDER_STEPS.findIndex(
                      (s) => s.key === order.status,
                    );
                    const state: StepStatus =
                      fullCurr === -1
                        ? 'pending'
                        : fullIdx < fullCurr
                          ? 'completed'
                          : fullIdx === fullCurr
                            ? 'active'
                            : 'pending';
                    const Icon = step.icon;
                    const timestamps: Partial<
                      Record<OrderStatus, string | null>
                    > = {
                      PENDING: order.createdAt,
                      CONFIRMED: order.confirmedAt,
                      DELIVERED: order.deliveredAt,
                      COMPLETED: order.completedAt,
                    };
                    const ts = timestamps[step.key] ?? null;

                    return (
                      <div
                        key={step.key}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <div
                          className={`z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                            state === 'completed'
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : state === 'active'
                                ? 'border-primary bg-background text-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]'
                                : 'border-border bg-background text-muted-foreground/50'
                          }`}
                        >
                          {state === 'completed' ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Icon className="h-4 w-4" />
                          )}
                        </div>
                        <span
                          className={`text-center text-[10px] leading-snug ${
                            state === 'active'
                              ? 'font-semibold text-foreground'
                              : state === 'completed'
                                ? 'text-muted-foreground'
                                : 'text-muted-foreground/40'
                          }`}
                        >
                          {step.shortLabel}
                        </span>
                        {ts && state !== 'pending' && (
                          <span className="hidden sm:block text-[9px] text-muted-foreground/50 text-center">
                            {fmtShort(ts)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Items
              <Badge variant="secondary" className="text-xs font-normal">
                {order.items.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {order.items.map((item, i) => (
              <div key={item.id}>
                <div className="flex gap-3">
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.productImage ? (
                      <Image
                        src={item.productImage}
                        alt={item.productName}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <Package className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug line-clamp-2">
                          {item.productName}
                        </p>
                        {item.variantName && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.variantName}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            Qty {item.quantity}
                          </span>
                          {item.productType === 'DIGITAL' && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 font-normal"
                            >
                              Digital
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-primary flex-shrink-0">
                        {fmt(item.totalPrice, order.currency)}
                      </span>
                    </div>
                    <DigitalDownloadCard
                      item={item}
                      orderId={order.id}
                      token={token}
                    />
                  </div>
                </div>
                {i < order.items.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Delivery details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Delivery details</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Shipping address
                </p>
                <p className="text-sm font-medium mt-0.5">
                  {order.shippingCity}, {order.shippingProvince}
                </p>
              </div>
            </div>
            {order.maskedPhone && (
              <>
                <Separator />
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Phone on file
                    </p>
                    <p className="text-sm font-medium mt-0.5">
                      {order.maskedPhone}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Order summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Order summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{fmt(order.subtotal, order.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span>
                {order.shippingCost > 0
                  ? fmt(order.shippingCost, order.currency)
                  : 'Free'}
              </span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-emerald-600">
                  −{fmt(order.discount, order.currency)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-primary">
                {fmt(order.total, order.currency)}
              </span>
            </div>
            {order.paidAt && (
              <div className="flex justify-between text-xs text-muted-foreground pt-0.5">
                <span>Paid on</span>
                <span>{fmtDate(order.paidAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save tracking link reminder */}
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-700/50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                Save this tracking link
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                This is your only way to view your order without an account.
                {expiryDate && ` Link valid until ${expiryDate}.`}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 border-amber-300 hover:border-amber-400"
                onClick={() => copy(trackingUrl)}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? 'Copied!' : 'Copy tracking link'}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="pb-4 text-center text-xs text-muted-foreground">
          Need help?{' '}
          <Link
            href="/"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Contact us
          </Link>
        </p>
      </div>
    </div>
  );
}
