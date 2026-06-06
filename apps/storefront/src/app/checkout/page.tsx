'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  User,
  MapPin,
  MessageCircle,
  Loader2,
  CheckCircle,
  ExternalLink,
  Copy,
  Check,
  Share2,
} from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useCart } from '@/providers/cart-provider';
import { useCreateOrder } from '@/hooks/use-api';
import { apiFetch, FUNCTIONS_URL, api } from '@/services/api';
import { saveRecentOrder } from '@/app/orders/track/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const validationSchema = Yup.object({
  customerName: Yup.string().required('Name is required'),
  customerPhone: Yup.string()
    .required('Phone number is required')
    .matches(/^\+\d{7,15}$/, 'Enter a valid number with country code (e.g. +237696000000)'),
  customerEmail: Yup.string().email('Invalid email address'),
  customerWhatsapp: Yup.string()
    .matches(/^(\+\d{7,15})?$/, 'Enter a valid number with country code (e.g. +237696000000)'),
  shippingName: Yup.string(),
  shippingPhone: Yup.string()
    .matches(/^(\+\d{7,15})?$/, 'Enter a valid number with country code (e.g. +237696000000)'),
  shippingAddress: Yup.string().required('Shipping address is required'),
  shippingCity: Yup.string().required('City is required'),
  shippingProvince: Yup.string().required('Province is required'),
  shippingPostalCode: Yup.string(),
  customerNotes: Yup.string(),
});

type CheckoutFormValues = Yup.InferType<typeof validationSchema>;

const initialValues: CheckoutFormValues = {
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  customerWhatsapp: '',
  shippingName: '',
  shippingPhone: '',
  shippingAddress: '',
  shippingCity: '',
  shippingProvince: '',
  shippingPostalCode: '',
  customerNotes: '',
};

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const createOrder = useCreateOrder();

  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [orderCreated, setOrderCreated] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [trackingCopied, setTrackingCopied] = useState(false);
  // Stock violations detected at checkout load time
  const [stockErrors, setStockErrors] = useState<string[]>([]);

  // Pre-flight stock check: re-fetch current inventory for all cart items
  // and flag anything that exceeds available stock before the user submits.
  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;

    (async () => {
      const errors: string[] = [];
      await Promise.all(
        items.map(async (item) => {
          try {
            const product = await api.getProduct(item.productId);
            if (!product.inventoryTracked) return;

            const available = item.variantId
              ? (product.variants.find((v) => v.id === item.variantId)?.inventoryQuantity ?? 0)
              : product.inventoryQuantity;

            if (item.quantity > available) {
              const label = item.variantName
                ? `${item.productName} (${item.variantName})`
                : item.productName;
              errors.push(
                available === 0
                  ? `${label} is out of stock`
                  : `${label}: only ${available} available (you have ${item.quantity})`,
              );
            }
          } catch {
            // Network failure — skip; server will catch it on submit
          }
        }),
      );
      if (!cancelled) setStockErrors(errors);
    })();

    return () => { cancelled = true; };
  }, [items]);

  const formatPrice = (price: number) => {
    return `FCFA ${price.toLocaleString('id-ID')}`;
  };

  const shippingCost = Math.min(1000, Math.round(totalPrice * 0));
  const orderTotal = totalPrice + shippingCost;

  const formik = useFormik<CheckoutFormValues>({
    initialValues,
    validationSchema,
    onSubmit: async (values) => {
      if (items.length === 0) {
        toast.error('Your cart is empty');
        return;
      }

      // Block submit if pre-flight stock check found violations
      if (stockErrors.length > 0) {
        stockErrors.forEach((msg) => toast.error(msg));
        return;
      }

      const orderData = {
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        customerEmail: values.customerEmail || undefined,
        customerWhatsapp: values.customerWhatsapp || values.customerPhone,
        shippingName: values.shippingName || values.customerName,
        shippingPhone: values.shippingPhone || values.customerPhone,
        shippingAddress: values.shippingAddress,
        shippingCity: values.shippingCity,
        shippingProvince: values.shippingProvince,
        shippingPostalCode: values.shippingPostalCode,
        shippingCost: shippingCost > 0 ? shippingCost : undefined,
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        customerNotes: values.customerNotes || undefined,
      };

      let order: Awaited<ReturnType<typeof createOrder.mutateAsync>>;
      try {
        order = await createOrder.mutateAsync(orderData);
      } catch (error) {
        const msg =
          error instanceof Error && error.message
            ? error.message
            : 'Failed to create order. Please try again.';
        toast.error(msg);
        console.error('Order creation failed:', error);
        return;
      }

      // Track purchased products locally so the product page can gate the rating UI
      try {
        const existing = JSON.parse(
          localStorage.getItem('purchased-product-ids') ?? '[]',
        ) as string[];
        const newIds = items.map((item) => item.productId);
        const merged = Array.from(new Set([...existing, ...newIds]));
        localStorage.setItem('purchased-product-ids', JSON.stringify(merged));
      } catch {
        // non-critical – ignore storage errors
      }

      // Build tokenised tracking URL and persist to sessionStorage for this session
      const tUrl = `${window.location.origin}/orders/${order.id}?token=${encodeURIComponent(order.lookupToken)}`;
      try {
        sessionStorage.setItem(`order-token-${order.id}`, order.lookupToken);
      } catch {
        // ignore storage errors
      }
      // Save to localStorage so the /orders/track page can list it later
      saveRecentOrder({
        id: order.id,
        orderNumber: order.orderNumber,
        trackingUrl: tUrl,
        createdAt: order.createdAt,
      });
      setTrackingUrl(tUrl);
      setOrderNumber(order.orderNumber);
      clearCart();
      setOrderCreated(true);
      toast.success('Order created successfully!');

      // Fetch WhatsApp URL — non-blocking after order is confirmed
      try {
        const { url: waUrl } = await apiFetch<{ url: string }>(
          `${FUNCTIONS_URL}/orders-whatsapp-link?id=${encodeURIComponent(order.id)}&token=${encodeURIComponent(order.lookupToken)}`,
        );
        setWhatsappUrl(waUrl);
      } catch (error) {
        console.warn('WhatsApp link generation failed:', error);
        // Order was created successfully; WhatsApp link is non-critical
      }
    },
  });

  const handleBillingChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    formik.handleChange(e);
    if (sameAsBilling) {
      if (e.target.name === 'customerName') {
        formik.setFieldValue('shippingName', e.target.value);
      } else if (e.target.name === 'customerPhone') {
        formik.setFieldValue('shippingPhone', e.target.value);
      }
    }
  };

  const handleSameAsBillingChange = (checked: boolean) => {
    setSameAsBilling(checked);
    if (checked) {
      formik.setFieldValue('shippingName', formik.values.customerName);
      formik.setFieldValue('shippingPhone', formik.values.customerPhone);
    }
  };

  // Helper: field error shown only after the field has been touched
  const fieldError = (name: keyof CheckoutFormValues) =>
    formik.touched[name] && formik.errors[name]
      ? (formik.errors[name] as string)
      : null;

  if (items.length === 0 && !orderCreated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">No items to checkout</h1>
          <p className="text-muted-foreground mb-6">
            Add some products to your cart first
          </p>
          <Link href="/">
            <Button>Browse Products</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (orderCreated) {
    const canShare = typeof navigator !== 'undefined' && !!navigator.share;

    const handleCopyTracking = async () => {
      if (!trackingUrl) return;
      // Try modern Clipboard API first; fall back to execCommand for older/mobile browsers
      let success = false;
      try {
        await navigator.clipboard.writeText(trackingUrl);
        success = true;
      } catch {
        // Clipboard API not available (HTTP, focus issue, permission denied)
      }
      if (!success) {
        try {
          const ta = document.createElement('textarea');
          ta.value = trackingUrl;
          ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          success = document.execCommand('copy');
          document.body.removeChild(ta);
        } catch {
          // execCommand also failed
        }
      }
      if (success) {
        setTrackingCopied(true);
        setTimeout(() => setTrackingCopied(false), 2000);
      } else {
        toast.error('Copy not supported on this browser. Use the Share button.');
      }
    };

    const handleShare = async () => {
      if (!trackingUrl || !navigator.share) return;
      try {
        await navigator.share({
          title: `Order #${orderNumber} tracking`,
          text: 'Track your ShopPk order here:',
          url: trackingUrl,
        });
      } catch {
        // User dismissed share sheet — not an error
      }
    };

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8">
            {/* Success icon */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold">Order Created!</h1>
              {orderNumber && (
                <p className="text-sm text-muted-foreground mt-1">
                  Order{' '}
                  <span className="font-mono font-semibold text-foreground">
                    #{orderNumber}
                  </span>
                </p>
              )}
            </div>

            {/* WhatsApp CTA — primary action */}
            {whatsappUrl && (
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700 mb-3"
                size="lg"
                onClick={() => window.open(whatsappUrl, '_blank')}
              >
                <MessageCircle className="h-5 w-5" />
                Send Order via WhatsApp
              </Button>
            )}

            {/* Tracking CTA */}
            {trackingUrl && (
              <Link href={trackingUrl}>
                <Button variant="outline" className="w-full gap-2 mb-3" size="lg">
                  <ExternalLink className="h-4 w-4" />
                  Track your order
                </Button>
              </Link>
            )}

            <Separator className="my-4" />

            {/* Save tracking link reminder */}
            {trackingUrl && (
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-700/50 p-3 mb-4">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Save your tracking link
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                  This is your only way to check order status and download digital
                  products without an account.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 flex-1 border-amber-300 hover:border-amber-400"
                    onClick={handleCopyTracking}
                  >
                    {trackingCopied ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {trackingCopied ? 'Copied!' : 'Copy link'}
                  </Button>
                  {canShare && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 flex-1 border-amber-300 hover:border-amber-400"
                      onClick={handleShare}
                    >
                      <Share2 className="h-3 w-3" />
                      Share
                    </Button>
                  )}
                </div>
              </div>
            )}

            <Link href="/">
              <Button variant="ghost" className="w-full text-muted-foreground" size="sm">
                Continue Shopping
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Cart
        </Link>

        <h1 className="text-2xl font-bold mb-6">Checkout</h1>

        <form onSubmit={formik.handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Name *</Label>
                      <Input
                        id="customerName"
                        name="customerName"
                        placeholder="Your name..."
                        value={formik.values.customerName}
                        onChange={handleBillingChange}
                        onBlur={formik.handleBlur}
                      />
                      {fieldError('customerName') && (
                        <p className="text-xs text-destructive">
                          {fieldError('customerName')}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Phone *</Label>
                      <PhoneInput
                        id="customerPhone"
                        value={formik.values.customerPhone}
                        onChange={(v) => {
                          formik.setFieldValue('customerPhone', v);
                          if (sameAsBilling) formik.setFieldValue('shippingPhone', v);
                        }}
                        onBlur={() => formik.setFieldTouched('customerPhone', true)}
                      />
                      {fieldError('customerPhone') && (
                        <p className="text-xs text-destructive">
                          {fieldError('customerPhone')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerEmail">Email (Optional)</Label>
                      <Input
                        id="customerEmail"
                        name="customerEmail"
                        type="email"
                        placeholder="poukamtech@..."
                        value={formik.values.customerEmail}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                      />
                      {fieldError('customerEmail') && (
                        <p className="text-xs text-destructive">
                          {fieldError('customerEmail')}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerWhatsapp">WhatsApp</Label>
                      <PhoneInput
                        id="customerWhatsapp"
                        value={formik.values.customerWhatsapp ?? ''}
                        onChange={(v) => formik.setFieldValue('customerWhatsapp', v)}
                        onBlur={() => formik.setFieldTouched('customerWhatsapp', true)}
                        placeholder="same as phone"
                      />
                      {fieldError('customerWhatsapp') && (
                        <p className="text-xs text-destructive">
                          {fieldError('customerWhatsapp')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Shipping Address */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Shipping Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Same as billing toggle */}
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      onChange={(e) =>
                        handleSameAsBillingChange(e.target.checked)
                      }
                      className="accent-primary"
                    />
                    Same as customer info
                  </label>

                  <div
                    className={`grid sm:grid-cols-2 gap-4 ${sameAsBilling ? 'hidden' : ''}`}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="shippingName">Recipient Name</Label>
                      <Input
                        id="shippingName"
                        name="shippingName"
                        placeholder="Recipient name..."
                        value={
                          formik.values.shippingName ||
                          formik.values.customerName
                        }
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        disabled={sameAsBilling}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shippingPhone">Recipient Phone</Label>
                      <PhoneInput
                        id="shippingPhone"
                        value={formik.values.shippingPhone || formik.values.customerPhone}
                        onChange={(v) => formik.setFieldValue('shippingPhone', v)}
                        onBlur={() => formik.setFieldTouched('shippingPhone', true)}
                        disabled={sameAsBilling}
                      />
                      {fieldError('shippingPhone') && (
                        <p className="text-xs text-destructive">
                          {fieldError('shippingPhone')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shippingAddress">Street Address *</Label>
                    <Textarea
                      id="shippingAddress"
                      name="shippingAddress"
                      placeholder="Pk10, entree ruccotel, Douala Bassa"
                      value={formik.values.shippingAddress}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    {fieldError('shippingAddress') && (
                      <p className="text-xs text-destructive">
                        {fieldError('shippingAddress')}
                      </p>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shippingCity">City *</Label>
                      <Input
                        id="shippingCity"
                        name="shippingCity"
                        placeholder="Douala"
                        value={formik.values.shippingCity}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                      />
                      {fieldError('shippingCity') && (
                        <p className="text-xs text-destructive">
                          {fieldError('shippingCity')}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shippingProvince">Province *</Label>
                      <Input
                        id="shippingProvince"
                        name="shippingProvince"
                        placeholder="Littoral"
                        value={formik.values.shippingProvince}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                      />
                      {fieldError('shippingProvince') && (
                        <p className="text-xs text-destructive">
                          {fieldError('shippingProvince')}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shippingPostalCode">
                        Postal Code (Optional)
                      </Label>
                      <Input
                        id="shippingPostalCode"
                        name="shippingPostalCode"
                        placeholder="12345"
                        value={formik.values.shippingPostalCode}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                      />
                      {fieldError('shippingPostalCode') && (
                        <p className="text-xs text-destructive">
                          {fieldError('shippingPostalCode')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="customerNotes">
                      Order Notes (Optional)
                    </Label>
                    <Textarea
                      id="customerNotes"
                      name="customerNotes"
                      placeholder="Any special instructions for your order..."
                      value={formik.values.customerNotes}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-20">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Items */}
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {items.map((item) => (
                      <div
                        key={`${item.productId}-${item.variantId || 'default'}`}
                        className="flex justify-between text-sm"
                      >
                        <span className="truncate flex-1">
                          {item.productName} x{item.quantity}
                        </span>
                        <span className="ml-2 flex-shrink-0">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(totalPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>
                      {shippingCost > 0 ? formatPrice(shippingCost) : 'TBD'}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-primary">
                      {formatPrice(orderTotal)}
                    </span>
                  </div>
                </CardContent>
                <div className="p-6 pt-0">
                  {stockErrors.length > 0 && (
                    <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 space-y-1">
                      {stockErrors.map((msg, i) => (
                        <p key={i} className="text-sm text-red-700 dark:text-red-400">
                          ⚠ {msg}
                        </p>
                      ))}
                      <p className="text-xs text-red-500 dark:text-red-500 pt-1">
                        Please update your cart before placing the order.
                      </p>
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full gap-2"
                    size="lg"
                    disabled={createOrder.isPending || stockErrors.length > 0}
                  >
                    {createOrder.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating Order...
                      </>
                    ) : (
                      <>
                        <MessageCircle className="h-4 w-4" />
                        Create Order & WhatsApp
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-3">
                    You'll be redirected to WhatsApp to complete your order
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
