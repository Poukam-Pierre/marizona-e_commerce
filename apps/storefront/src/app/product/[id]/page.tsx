'use client';

import { use, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingCart,
  Package,
  Phone,
  Share2,
  Check,
  Star,
  Truck,
  Download,
  AlertCircle,
} from 'lucide-react';
import { useProduct } from '@/hooks/use-api';
import { useCart } from '@/providers/cart-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const { data: product, isLoading, error } = useProduct(productId);
  const { addItem, items } = useCart();

  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The product you're looking for doesn't exist or has been removed.
        </p>
        <Link href="/">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
        </Link>
      </div>
    );
  }

  const primaryImage = product.images[selectedImage]?.url || product.image;
  const hasDiscount = product.comparePrice && product.comparePrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.comparePrice! - product.price) / product.comparePrice!) * 100)
    : 0;

  const selectedVariantData = selectedVariant
    ? product.variants.find((v) => v.id === selectedVariant)
    : null;
  const currentPrice = selectedVariantData?.price || product.price;
  const currentComparePrice = selectedVariantData?.comparePrice || product.comparePrice;
  const currentStock = selectedVariantData
    ? selectedVariantData.inventoryQuantity
    : product.inventoryQuantity;

  const isOutOfStock = product.inventoryTracked && currentStock <= 0;
  const maxQuantity = product.inventoryTracked ? currentStock : 999;

  const handleAddToCart = () => {
    const variant = selectedVariant
      ? product.variants.find((v) => v.id === selectedVariant)
      : null;
    
    addItem(product, quantity, selectedVariant || undefined, variant?.name);
    toast.success(`${product.name} added to cart`, {
      description: quantity > 1 ? `${quantity} items` : undefined,
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: product.name,
        text: product.description || '',
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  };

  // Group variants by option1Name
  const variantOptions: Record<string, Array<{ value: string; id: string }>> = {};
  product.variants.forEach((v) => {
    if (v.option1Name && v.option1Value) {
      if (!variantOptions[v.option1Name]) {
        variantOptions[v.option1Name] = [];
      }
      if (!variantOptions[v.option1Name].find((opt) => opt.value === v.option1Value)) {
        variantOptions[v.option1Name].push({ value: v.option1Value, id: v.id });
      }
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Products
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
              {primaryImage ? (
                <Image
                  src={primaryImage}
                  alt={product.name}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Package className="h-24 w-24 text-slate-400" />
                </div>
              )}
              
              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {product.isFeatured && (
                  <Badge className="bg-amber-500">Featured</Badge>
                )}
                {hasDiscount && (
                  <Badge className="bg-red-500">-{discountPercent}%</Badge>
                )}
                {product.type === 'DIGITAL' && (
                  <Badge variant="secondary">
                    <Download className="h-3 w-3 mr-1" />
                    Digital
                  </Badge>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.images.map((img, index) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(index)}
                    className={`relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                      selectedImage === index
                        ? 'border-primary'
                        : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                  >
                    <Image
                      src={img.url}
                      alt={img.alt || product.name}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Category */}
            {product.category && (
              <Link
                href={`/?categoryId=${product.category.id}`}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                {product.category.name}
              </Link>
            )}

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold">{product.name}</h1>

            {/* Rating */}
            {product.rating && (
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.floor(product.rating!)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {product.rating.toFixed(1)} ({product.reviewCount} reviews)
                </span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary">
                Rp {currentPrice.toLocaleString('id-ID')}
              </span>
              {currentComparePrice && currentComparePrice > currentPrice && (
                <span className="text-lg text-muted-foreground line-through">
                  Rp {currentComparePrice.toLocaleString('id-ID')}
                </span>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2">
              {product.inventoryTracked ? (
                currentStock > 0 ? (
                  currentStock <= product.lowStockThreshold ? (
                    <Badge variant="outline" className="text-amber-600 border-amber-600">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Only {currentStock} left
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                      <Check className="h-3 w-3 mr-1" />
                      In Stock
                    </Badge>
                  )
                ) : (
                  <Badge variant="outline" className="text-red-600 border-red-600">
                    Out of Stock
                  </Badge>
                )
              ) : (
                <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                  <Check className="h-3 w-3 mr-1" />
                  Available
                </Badge>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-muted-foreground">{product.description}</p>
            )}

            <Separator />

            {/* Variants */}
            {product.variants.length > 0 && (
              <div className="space-y-4">
                {Object.entries(variantOptions).map(([optionName, values]) => (
                  <div key={optionName}>
                    <label className="text-sm font-medium mb-2 block">{optionName}</label>
                    <div className="flex flex-wrap gap-2">
                      {values.map((opt) => (
                        <Button
                          key={opt.id}
                          variant={selectedVariant === opt.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedVariant(opt.id)}
                        >
                          {opt.value}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quantity */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantity</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                  disabled={quantity >= maxQuantity}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                className="flex-1 gap-2"
                size="lg"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
              >
                <ShoppingCart className="h-5 w-5" />
                Add to Cart
              </Button>
              <Button variant="outline" size="icon" onClick={handleShare}>
                <Share2 className="h-5 w-5" />
              </Button>
            </div>

            {/* Owner Info */}
            {product.ownerName && (
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <h3 className="font-medium mb-2">Seller Information</h3>
                  <p className="text-sm text-muted-foreground">{product.ownerName}</p>
                  {product.ownerWhatsapp && (
                    <a
                      href={`https://wa.me/${product.ownerWhatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 mt-2"
                    >
                      <Phone className="h-4 w-4" />
                      Contact via WhatsApp
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Digital Product Info */}
            {product.type === 'DIGITAL' && product.downloadUrl && (
              <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Download className="h-5 w-5 text-blue-600" />
                    <div>
                      <h3 className="font-medium text-blue-900 dark:text-blue-100">
                        Digital Product
                      </h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        After purchase, you will receive a download link.
                        {product.downloadLimit && ` Maximum ${product.downloadLimit} downloads.`}
                        {product.downloadExpiry && ` Link expires in ${product.downloadExpiry} days.`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Shipping Info for Physical Products */}
            {product.type === 'PHYSICAL' && (
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Truck className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-medium">Shipping</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Delivery available nationwide. Shipping cost calculated at checkout.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <Skeleton className="h-5 w-32 mb-6" />
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Skeleton className="aspect-square rounded-xl" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="w-20 h-20 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
