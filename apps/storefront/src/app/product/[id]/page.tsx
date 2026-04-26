'use client';

import { useState, useEffect } from 'react';
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
import { useProduct, useRateProduct } from '@/hooks/use-api';
import { useCart } from '@/providers/cart-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const { data: product, isLoading, error } = useProduct(productId);
  const { addItem } = useCart();
  const rateProduct = useRateProduct();

  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});
  const [directVariantId, setDirectVariantId] = useState<string | null>(null);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [mainImgError, setMainImgError] = useState(false);
  const [thumbImgErrors, setThumbImgErrors] = useState<Record<number, boolean>>(
    {},
  );

  useEffect(() => {
    try {
      const purchased = JSON.parse(
        localStorage.getItem('purchased-product-ids') ?? '[]',
      ) as string[];
      setHasPurchased(purchased.includes(productId));
    } catch {
      // ignore
    }
  }, [productId]);

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

  // Build variant option groups from all three option slots
  const variantOptions: Record<string, string[]> = {};
  product.variants.forEach((v) => {
    (
      [
        [v.option1Name, v.option1Value],
        [v.option2Name, v.option2Value],
        [v.option3Name, v.option3Value],
      ] as [string | null, string | null][]
    ).forEach(([optName, optValue]) => {
      if (optName && optValue) {
        if (!variantOptions[optName]) variantOptions[optName] = [];
        if (!variantOptions[optName].includes(optValue)) {
          variantOptions[optName].push(optValue);
        }
      }
    });
  });

  // Find variant matching ALL currently selected options
  const hasOptionVariants = Object.keys(variantOptions).length > 0;

  const selectedVariantData = hasOptionVariants
    ? (Object.keys(selectedOptions).length > 0
        ? (product.variants.find((v) =>
            Object.entries(selectedOptions).every(
              ([optName, optValue]) =>
                (v.option1Name === optName && v.option1Value === optValue) ||
                (v.option2Name === optName && v.option2Value === optValue) ||
                (v.option3Name === optName && v.option3Value === optValue),
            ),
          ) ?? null)
        : null)
    : directVariantId
      ? (product.variants.find((v) => v.id === directVariantId) ?? null)
      : null;
  const selectedVariantId = selectedVariantData?.id ?? null;

  // Prepend variant image to gallery when a variant with its own image is selected
  const displayImages = selectedVariantData?.image
    ? [
        {
          id: `variant-${selectedVariantData.id}`,
          url: selectedVariantData.image,
          alt: selectedVariantData.name,
          order: -1,
          isPrimary: false,
        },
        ...product.images.filter(
          (img) => img.url !== selectedVariantData.image,
        ),
      ]
    : product.images;

  const primaryImage = displayImages[selectedImage]?.url || product.image;
  const comparePrice = product.comparePrice;
  const hasDiscount = comparePrice != null && comparePrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((comparePrice - product.price) / comparePrice) * 100)
    : 0;

  const currentPrice = selectedVariantData?.price || product.price;
  const currentComparePrice =
    selectedVariantData?.comparePrice || product.comparePrice;
  const currentStock = selectedVariantData
    ? selectedVariantData.inventoryQuantity
    : product.inventoryQuantity;

  const isOutOfStock = product.inventoryTracked && currentStock <= 0;
  const maxQuantity = product.inventoryTracked ? currentStock : 999;

  const handleOptionSelect = (optionName: string, optionValue: string) => {
    setSelectedOptions((prev) => ({ ...prev, [optionName]: optionValue }));
    setDirectVariantId(null);
    setSelectedImage(0);
    setMainImgError(false);
  };

  const handleAddToCart = () => {
    addItem(
      product,
      quantity,
      selectedVariantId || undefined,
      selectedVariantData?.name,
    );
    toast.success(`${product.name} added to cart`, {
      description: quantity > 1 ? `${quantity} items` : undefined,
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: product.description || '',
          url: window.location.href,
        });
        // return;
      } catch {
        // user cancelled or share unavailable — fall through
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard');
        return;
      } catch {
        // clipboard blocked (HTTP / permissions) — fall through
      }
    }

    // Final fallback: execCommand (works on HTTP)
    try {
      const textarea = document.createElement('textarea');
      textarea.value = window.location.href;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error(
        'Could not copy link. Please copy it manually from the address bar.',
      );
    }
  };

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
              {primaryImage && !mainImgError ? (
                <Image
                  src={primaryImage}
                  alt={product.name}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  onError={() => setMainImgError(true)}
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
            {displayImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {displayImages.map((img, index) => (
                  <button
                    key={img.id}
                    onClick={() => {
                      setSelectedImage(index);
                      setMainImgError(false);
                    }}
                    className={`relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                      selectedImage === index
                        ? 'border-primary'
                        : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                  >
                    {thumbImgErrors[index] ? (
                      <div className="flex items-center justify-center h-full bg-slate-100 dark:bg-slate-800">
                        <Package className="h-6 w-6 text-slate-400" />
                      </div>
                    ) : (
                      <Image
                        src={img.url}
                        alt={img.alt || product.name}
                        fill
                        className="object-cover"
                        onError={() =>
                          setThumbImgErrors((prev) => ({
                            ...prev,
                            [index]: true,
                          }))
                        }
                      />
                    )}
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
            {product.rating != null && (
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.floor(product.rating ?? 0)
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

            {/* Rate this product — only shown to verified buyers */}
            {hasPurchased ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {product.rating != null
                    ? 'Your rating:'
                    : 'Be the first to rate:'}
                </span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      onClick={() =>
                        rateProduct.mutate({ id: product.id, rating: i + 1 })
                      }
                      onMouseEnter={() => setHoveredRating(i + 1)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className={`h-5 w-5 cursor-pointer transition-colors ${
                        i < hoveredRating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 hover:text-amber-300'
                      }`}
                    />
                  ))}
                </div>
                {rateProduct.isPending && (
                  <span className="text-xs text-muted-foreground">Saving…</span>
                )}
                {rateProduct.isSuccess && (
                  <span className="text-xs text-emerald-600">Thanks!</span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Purchase this product to leave a rating.
              </p>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary">
                FCFA {currentPrice.toLocaleString('id-ID')}
              </span>
              {currentComparePrice && currentComparePrice > currentPrice && (
                <span className="text-lg text-muted-foreground line-through">
                  FCFA {currentComparePrice.toLocaleString('id-ID')}
                </span>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2">
              {product.inventoryTracked ? (
                currentStock > 0 ? (
                  currentStock <= product.lowStockThreshold ? (
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-600"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Only {currentStock} left
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-emerald-600 border-emerald-600"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      In Stock
                    </Badge>
                  )
                ) : (
                  <Badge
                    variant="outline"
                    className="text-red-600 border-red-600"
                  >
                    Out of Stock
                  </Badge>
                )
              ) : (
                <Badge
                  variant="outline"
                  className="text-emerald-600 border-emerald-600"
                >
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
                {hasOptionVariants ? (
                  Object.entries(variantOptions).map(([optionName, values]) => (
                    <div key={optionName}>
                      <label className="text-sm font-medium mb-2 block">
                        {optionName}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {values.map((optValue) => (
                          <Button
                            key={optValue}
                            variant={
                              selectedOptions[optionName] === optValue
                                ? 'default'
                                : 'outline'
                            }
                            size="sm"
                            onClick={() =>
                              handleOptionSelect(optionName, optValue)
                            }
                          >
                            {optValue}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  // Fallback: variants have no option fields — select by name
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Variant
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.map((v) => (
                        <Button
                          key={v.id}
                          variant={
                            directVariantId === v.id ? 'default' : 'outline'
                          }
                          size="sm"
                          onClick={() => {
                            setDirectVariantId(v.id);
                            setSelectedImage(0);
                            setMainImgError(false);
                          }}
                        >
                          {v.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
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
                  onClick={() =>
                    setQuantity(Math.min(maxQuantity, quantity + 1))
                  }
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
                  <p className="text-sm text-muted-foreground">
                    {product.ownerName}
                  </p>
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
                        {product.downloadLimit &&
                          ` Maximum ${product.downloadLimit} downloads.`}
                        {product.downloadExpiry &&
                          ` Link expires in ${product.downloadExpiry} days.`}
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
                        Delivery available nationwide. Shipping cost calculated
                        at checkout.
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
