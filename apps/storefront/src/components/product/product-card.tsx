'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Package, ShoppingCart, Star, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useCart } from '@/providers/cart-provider';
import { toast } from 'sonner';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const primaryImage =
    product.image || product.images.find((img) => img.isPrimary)?.url;
  const hasDiscount =
    product.comparePrice && product.comparePrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.comparePrice! - product.price) / product.comparePrice!) * 100)
    : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <Link href={`/product/${product.id}`}>
      <Card className="group overflow-hidden h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        {/* Image */}
        <div className="relative aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden">
          {primaryImage ? (
            <Image
              src={primaryImage}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Package className="h-12 w-12 text-slate-400" />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.isFeatured && (
              <Badge className="bg-amber-500 hover:bg-amber-600">Featured</Badge>
            )}
            {hasDiscount && (
              <Badge className="bg-red-500 hover:bg-red-600">-{discountPercent}%</Badge>
            )}
            {product.type === 'DIGITAL' && (
              <Badge variant="secondary">Digital</Badge>
            )}
          </div>

          {/* Quick View Button */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button variant="secondary" size="sm" className="gap-2">
              <Eye className="h-4 w-4" />
              View Details
            </Button>
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-4">
          {/* Category */}
          {product.category && (
            <p className="text-xs text-muted-foreground mb-1">{product.category.name}</p>
          )}

          {/* Name */}
          <h3 className="font-semibold text-lg line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>

          {/* Rating */}
          {product.rating && (
            <div className="flex items-center gap-1 mb-2">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="text-sm font-medium">{product.rating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-primary">
              FCFA {product.price.toLocaleString('id-ID')}
            </span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">
                FCFA {product.comparePrice!.toLocaleString('id-ID')}
              </span>
            )}
          </div>

          {/* Stock Status */}
          <div className="mt-2">
            {product.inventoryTracked ? (
              product.inventoryQuantity > 0 ? (
                product.inventoryQuantity <= product.lowStockThreshold ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Only {product.inventoryQuantity} left
                  </span>
                ) : (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    In Stock
                  </span>
                )
              ) : (
                <span className="text-xs text-red-600 dark:text-red-400">Out of Stock</span>
              )
            ) : (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">Available</span>
            )}
          </div>
        </CardContent>

        {/* Footer */}
        <CardFooter className="p-4 pt-0">
          <Button
            className="w-full gap-2"
            onClick={handleAddToCart}
            disabled={product.inventoryTracked && product.inventoryQuantity <= 0}
          >
            <ShoppingCart className="h-4 w-4" />
            Add to Cart
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
