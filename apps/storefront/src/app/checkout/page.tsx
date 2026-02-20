'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Phone,
  Mail,
  User,
  MapPin,
  Building2,
  MessageCircle,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { useCart } from '@/providers/cart-provider';
import { useCreateOrder } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface CheckoutFormData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerWhatsapp: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingProvince: string;
  shippingPostalCode: string;
  customerNotes: string;
}

const initialFormData: CheckoutFormData = {
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
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();
  const createOrder = useCreateOrder();
  
  const [formData, setFormData] = useState<CheckoutFormData>(initialFormData);
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [orderCreated, setOrderCreated] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  const formatPrice = (price: number) => {
    return `Rp ${price.toLocaleString('id-ID')}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-fill shipping if same as billing
    if (sameAsBilling) {
      if (name === 'customerName') {
        setFormData((prev) => ({ ...prev, shippingName: value }));
      } else if (name === 'customerPhone') {
        setFormData((prev) => ({ ...prev, shippingPhone: value }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    // Validate required fields
    if (!formData.customerName || !formData.customerPhone || !formData.shippingAddress) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const orderData = {
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail || undefined,
        customerWhatsapp: formData.customerWhatsapp || formData.customerPhone,
        shippingName: formData.shippingName || formData.customerName,
        shippingPhone: formData.shippingPhone || formData.customerPhone,
        shippingAddress: formData.shippingAddress,
        shippingCity: formData.shippingCity,
        shippingProvince: formData.shippingProvince,
        shippingPostalCode: formData.shippingPostalCode,
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        customerNotes: formData.customerNotes || undefined,
      };

      const order = await createOrder.mutateAsync(orderData);
      
      // Generate WhatsApp URL
      const phone = items[0]?.ownerWhatsapp?.replace(/\D/g, '') || '6281234567890';
      const message = generateWhatsAppMessage(order, items);
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      
      setWhatsappUrl(waUrl);
      setOrderCreated(true);
      clearCart();
      
      toast.success('Order created successfully!');
    } catch (error) {
      toast.error('Failed to create order. Please try again.');
      console.error('Order creation failed:', error);
    }
  };

  const generateWhatsAppMessage = (order: any, cartItems: any[]) => {
    const items = cartItems
      .map((item) => `- ${item.productName} x${item.quantity} = ${formatPrice(item.price * item.quantity)}`)
      .join('\n');

    return `Halo, saya ingin memesan:

📄 *Order ID:* ${order.orderNumber}

📦 *Item Pesanan:*
${items}

💰 *Total:* ${formatPrice(totalPrice)}

👤 *Nama:* ${formData.customerName}
📱 *Telepon:* ${formData.customerPhone}
📍 *Alamat:*
${formData.shippingAddress}
${formData.shippingCity}, ${formData.shippingProvince}
${formData.shippingPostalCode}

${formData.customerNotes ? `📝 *Catatan:* ${formData.customerNotes}` : ''}

Mohon konfirmasi pesanan saya. Terima kasih! 🙏`;
  };

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
              Your order has been created successfully. Click the button below to send your order via WhatsApp.
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

        <form onSubmit={handleSubmit}>
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
                        placeholder="John Doe"
                        value={formData.customerName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Phone *</Label>
                      <Input
                        id="customerPhone"
                        name="customerPhone"
                        placeholder="+62 812 3456 7890"
                        value={formData.customerPhone}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerEmail">Email (Optional)</Label>
                      <Input
                        id="customerEmail"
                        name="customerEmail"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.customerEmail}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerWhatsapp">WhatsApp</Label>
                      <Input
                        id="customerWhatsapp"
                        name="customerWhatsapp"
                        placeholder="+62 812 3456 7890"
                        value={formData.customerWhatsapp}
                        onChange={handleInputChange}
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
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shippingName">Recipient Name</Label>
                      <Input
                        id="shippingName"
                        name="shippingName"
                        placeholder="John Doe"
                        value={formData.shippingName || formData.customerName}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shippingPhone">Recipient Phone</Label>
                      <Input
                        id="shippingPhone"
                        name="shippingPhone"
                        placeholder="+62 812 3456 7890"
                        value={formData.shippingPhone || formData.customerPhone}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shippingAddress">Street Address *</Label>
                    <Textarea
                      id="shippingAddress"
                      name="shippingAddress"
                      placeholder="Jl. Sudirman No. 123, RT 01/RW 02"
                      value={formData.shippingAddress}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shippingCity">City *</Label>
                      <Input
                        id="shippingCity"
                        name="shippingCity"
                        placeholder="Jakarta"
                        value={formData.shippingCity}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shippingProvince">Province *</Label>
                      <Input
                        id="shippingProvince"
                        name="shippingProvince"
                        placeholder="DKI Jakarta"
                        value={formData.shippingProvince}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shippingPostalCode">Postal Code *</Label>
                      <Input
                        id="shippingPostalCode"
                        name="shippingPostalCode"
                        placeholder="12345"
                        value={formData.shippingPostalCode}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="customerNotes">Order Notes (Optional)</Label>
                    <Textarea
                      id="customerNotes"
                      name="customerNotes"
                      placeholder="Any special instructions for your order..."
                      value={formData.customerNotes}
                      onChange={handleInputChange}
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
                    <span className="text-muted-foreground text-sm">TBD</span>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-primary">{formatPrice(totalPrice)}</span>
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
