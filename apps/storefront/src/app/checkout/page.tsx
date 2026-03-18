'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  User,
  MapPin,
  MessageCircle,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useCart } from '@/providers/cart-provider';
import { useCreateOrder } from '@/hooks/use-api';
import { apiFetch, API_ENDPOINTS } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const validationSchema = Yup.object({
  customerName: Yup.string().required('Name is required'),
  customerPhone: Yup.string().required('Phone number is required'),
  customerEmail: Yup.string().email('Invalid email address'),
  customerWhatsapp: Yup.string(),
  shippingName: Yup.string(),
  shippingPhone: Yup.string(),
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

      try {
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

        const order = await createOrder.mutateAsync(orderData);

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

        // Fetch WhatsApp URL from backend (includes properly formatted message)
        const { url: waUrl } = await apiFetch<{ url: string }>(
          `${API_ENDPOINTS.orders}/${order.id}/whatsapp`,
        );

        setWhatsappUrl(waUrl);
        setOrderCreated(true);
        clearCart();

        toast.success('Order created successfully!');
      } catch (error) {
        toast.error('Failed to create order. Please try again.');
        console.error('Order creation failed:', error);
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Order Created!</h1>
            <p className="text-muted-foreground mb-6">
              Your order has been created successfully. Click the button below
              to send your order via WhatsApp.
            </p>

            {whatsappUrl && (
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
                size="lg"
                onClick={() => {
                  window.open(whatsappUrl, '_blank');
                }}
              >
                <MessageCircle className="h-5 w-5" />
                Send Order via WhatsApp
              </Button>
            )}

            <Separator className="my-6" />

            <Link href="/">
              <Button variant="outline" className="w-full">
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
                      <Input
                        id="customerPhone"
                        name="customerPhone"
                        placeholder="+237 696..."
                        value={formik.values.customerPhone}
                        onChange={handleBillingChange}
                        onBlur={formik.handleBlur}
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
                      <Input
                        id="customerWhatsapp"
                        name="customerWhatsapp"
                        placeholder="+237 696..."
                        value={formik.values.customerWhatsapp}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                      />
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
                      <Input
                        id="shippingPhone"
                        name="shippingPhone"
                        placeholder="+237 696..."
                        value={
                          formik.values.shippingPhone ||
                          formik.values.customerPhone
                        }
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        disabled={sameAsBilling}
                      />
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
                  <Button
                    type="submit"
                    className="w-full gap-2"
                    size="lg"
                    disabled={createOrder.isPending}
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
