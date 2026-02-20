'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Typography,
  IconButton,
  Avatar,
  Paper,
  Skeleton,
  Alert,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useProduct, useCategories, useUpdateProduct } from '@/hooks/use-queries';
import type { UpdateProductDto } from '@/types';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  
  const { data: product, isLoading: productLoading } = useProduct(id);
  const { data: categories = [] } = useCategories();
  const updateProduct = useUpdateProduct();

  const [formData, setFormData] = useState<UpdateProductDto>({});
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');

  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku,
        name: product.name,
        slug: product.slug,
        description: product.description,
        type: product.type,
        price: product.price,
        comparePrice: product.comparePrice || undefined,
        costPrice: product.costPrice || undefined,
        inventoryQuantity: product.inventoryQuantity,
        inventoryTracked: product.inventoryTracked,
        lowStockThreshold: product.lowStockThreshold,
        ownerName: product.ownerName || '',
        ownerWhatsapp: product.ownerWhatsapp || '',
        categoryId: product.categoryId,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        isBestSeller: product.isBestSeller,
      });
      setImageUrls(product.images?.map(img => img.url) || []);
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProduct.mutateAsync({
        id,
        data: {
          ...formData,
          images: imageUrls.map((url, index) => ({
            url,
            alt: formData.name,
            isPrimary: index === 0,
          })),
        },
      });
      enqueueSnackbar('Product updated successfully!', { variant: 'success' });
      router.push('/products');
    } catch (error: any) {
      enqueueSnackbar(error.message || 'Failed to update product', { variant: 'error' });
    }
  };

  const handleAddImage = () => {
    if (newImageUrl && !imageUrls.includes(newImageUrl)) {
      setImageUrls([...imageUrls, newImageUrl]);
      setNewImageUrl('');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  if (productLoading) {
    return (
      <AdminLayout title="Edit Product">
        <Skeleton height={400} />
      </AdminLayout>
    );
  }

  if (!product) {
    return (
      <AdminLayout title="Edit Product">
        <Alert severity="error">Product not found</Alert>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Edit Product">
      <Box sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/products')}>
          Back to Products
        </Button>
      </Box>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Basic Information</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="SKU" value={formData.sku || ''} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Name" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth multiline rows={4} label="Description" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Images</Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField fullWidth label="Image URL" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} />
                  <Button variant="contained" onClick={handleAddImage} disabled={!newImageUrl}>Add</Button>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {imageUrls.map((url, index) => (
                    <Paper key={index} sx={{ p: 1 }}>
                      <Avatar variant="rounded" src={url} sx={{ width: 80, height: 80 }} />
                      <IconButton size="small" onClick={() => handleRemoveImage(index)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Pricing</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField fullWidth type="number" label="Price" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField fullWidth type="number" label="Quantity" value={formData.inventoryQuantity || ''} onChange={(e) => setFormData({ ...formData, inventoryQuantity: parseInt(e.target.value) || 0 })} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Status</Typography>
                <FormControlLabel control={<Switch checked={formData.isActive || false} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />} label="Active" />
                <FormControlLabel control={<Switch checked={formData.isFeatured || false} onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })} />} label="Featured" />
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Category</Typography>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select value={formData.categoryId || ''} label="Category" onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}>
                    {categories.map((cat) => (<MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>))}
                  </Select>
                </FormControl>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Button fullWidth variant="contained" size="large" type="submit" disabled={updateProduct.isPending}>
                  {updateProduct.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </form>
    </AdminLayout>
  );
}
