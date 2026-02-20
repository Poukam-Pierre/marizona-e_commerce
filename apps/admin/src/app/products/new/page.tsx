'use client';

import { useState, useEffect } from 'react';
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
  Divider,
  Chip,
  IconButton,
  Avatar,
  Paper,
  Skeleton,
  Alert,
  Autocomplete,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useCategories, useCreateProduct, useSendPushNotification } from '@/hooks/use-queries';
import type { CreateProductDto } from '@/types';

export default function NewProductPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const createProduct = useCreateProduct();
  const sendNotification = useSendPushNotification();

  const [formData, setFormData] = useState<CreateProductDto>({
    sku: '',
    name: '',
    slug: '',
    description: '',
    type: 'PHYSICAL',
    price: 0,
    comparePrice: undefined,
    costPrice: undefined,
    inventoryQuantity: 0,
    inventoryTracked: true,
    lowStockThreshold: 10,
    weight: undefined,
    downloadUrl: undefined,
    downloadLimit: undefined,
    downloadExpiry: undefined,
    ownerName: '',
    ownerWhatsapp: '',
    categoryId: '',
    isActive: true,
    isFeatured: false,
    isBestSeller: false,
    images: [],
  });

  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-generate slug from name
  useEffect(() => {
    if (formData.name && !formData.slug) {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  }, [formData.name, formData.slug]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.sku) newErrors.sku = 'SKU is required';
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.description) newErrors.description = 'Description is required';
    if (!formData.categoryId) newErrors.categoryId = 'Category is required';
    if (formData.price <= 0) newErrors.price = 'Price must be greater than 0';
    if (!formData.ownerWhatsapp) newErrors.ownerWhatsapp = 'Owner WhatsApp is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      enqueueSnackbar('Please fill in all required fields', { variant: 'error' });
      return;
    }

    try {
      const productData = {
        ...formData,
        images: imageUrls.map((url, index) => ({
          url,
          alt: formData.name,
          isPrimary: index === 0,
        })),
      };

      const product = await createProduct.mutateAsync(productData);
      
      // Send notification for new product
      try {
        await sendNotification.mutateAsync({
          title: 'New Product Added!',
          body: `${formData.name} is now available for $${formData.price}`,
        });
      } catch {
        // Notification failed, but product was created
      }

      enqueueSnackbar('Product created successfully!', { variant: 'success' });
      router.push('/products');
    } catch (error: any) {
      enqueueSnackbar(error.message || 'Failed to create product', { variant: 'error' });
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

  const handleSetPrimaryImage = (index: number) => {
    const newUrls = [...imageUrls];
    const [selected] = newUrls.splice(index, 1);
    newUrls.unshift(selected);
    setImageUrls(newUrls);
  };

  return (
    <AdminLayout title="Add New Product">
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/products')}
        >
          Back to Products
        </Button>
      </Box>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Main Content */}
          <Grid item xs={12} lg={8}>
            {/* Basic Info */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Basic Information
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="SKU *"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      error={!!errors.sku}
                      helperText={errors.sku}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Name *"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      error={!!errors.name}
                      helperText={errors.name}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Slug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      helperText="Auto-generated from name"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="Description *"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      error={!!errors.description}
                      helperText={errors.description}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Images */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Product Images
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    fullWidth
                    label="Image URL"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddImage}
                    disabled={!newImageUrl}
                  >
                    Add
                  </Button>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {imageUrls.map((url, index) => (
                    <Paper
                      key={index}
                      sx={{
                        p: 1,
                        position: 'relative',
                        border: index === 0 ? 2 : 1,
                        borderColor: index === 0 ? 'primary.main' : 'divider',
                      }}
                    >
                      <Avatar
                        variant="rounded"
                        src={url}
                        sx={{ width: 100, height: 100 }}
                      />
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                        {index !== 0 && (
                          <Button
                            size="small"
                            onClick={() => handleSetPrimaryImage(index)}
                          >
                            Set Primary
                          </Button>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveImage(index)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>

            {/* Pricing & Inventory */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Pricing & Inventory
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Price *"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      error={!!errors.price}
                      helperText={errors.price}
                      InputProps={{ startAdornment: '$' }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Compare at Price"
                      value={formData.comparePrice || ''}
                      onChange={(e) => setFormData({ ...formData, comparePrice: parseFloat(e.target.value) || undefined })}
                      InputProps={{ startAdornment: '$' }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Cost per Item"
                      value={formData.costPrice || ''}
                      onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || undefined })}
                      InputProps={{ startAdornment: '$' }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Quantity"
                      value={formData.inventoryQuantity}
                      onChange={(e) => setFormData({ ...formData, inventoryQuantity: parseInt(e.target.value) || 0 })}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Low Stock Threshold"
                      value={formData.lowStockThreshold}
                      onChange={(e) => setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) || 0 })}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.inventoryTracked}
                          onChange={(e) => setFormData({ ...formData, inventoryTracked: e.target.checked })}
                        />
                      }
                      label="Track Inventory"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Sidebar */}
          <Grid item xs={12} lg={4}>
            {/* Status */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Status
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                  }
                  label="Active"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isFeatured}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                    />
                  }
                  label="Featured"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isBestSeller}
                      onChange={(e) => setFormData({ ...formData, isBestSeller: e.target.checked })}
                    />
                  }
                  label="Best Seller"
                />
              </CardContent>
            </Card>

            {/* Category & Type */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Organization
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }} error={!!errors.categoryId}>
                  <InputLabel>Category *</InputLabel>
                  <Select
                    value={formData.categoryId}
                    label="Category *"
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  >
                    {categories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.categoryId && (
                    <Typography variant="caption" color="error">
                      {errors.categoryId}
                    </Typography>
                  )}
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={formData.type}
                    label="Type"
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'PHYSICAL' | 'DIGITAL' })}
                  >
                    <MenuItem value="PHYSICAL">Physical</MenuItem>
                    <MenuItem value="DIGITAL">Digital</MenuItem>
                  </Select>
                </FormControl>
              </CardContent>
            </Card>

            {/* Owner Info */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Owner Information
                </Typography>
                
                <TextField
                  fullWidth
                  label="Owner Name"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="WhatsApp Number *"
                  value={formData.ownerWhatsapp}
                  onChange={(e) => setFormData({ ...formData, ownerWhatsapp: e.target.value })}
                  placeholder="+628123456789"
                  error={!!errors.ownerWhatsapp}
                  helperText={errors.ownerWhatsapp}
                />
              </CardContent>
            </Card>

            {/* Digital Product Settings */}
            {formData.type === 'DIGITAL' && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                    Digital Product
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="Download URL"
                    value={formData.downloadUrl || ''}
                    onChange={(e) => setFormData({ ...formData, downloadUrl: e.target.value })}
                    sx={{ mb: 2 }}
                  />
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Download Limit"
                        value={formData.downloadLimit || ''}
                        onChange={(e) => setFormData({ ...formData, downloadLimit: parseInt(e.target.value) || undefined })}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Expiry (Days)"
                        value={formData.downloadExpiry || ''}
                        onChange={(e) => setFormData({ ...formData, downloadExpiry: parseInt(e.target.value) || undefined })}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardContent>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  type="submit"
                  startIcon={<SaveIcon />}
                  disabled={createProduct.isPending}
                >
                  {createProduct.isPending ? 'Saving...' : 'Save Product'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </form>
    </AdminLayout>
  );
}
