'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { VariantBuilder } from '@/components/products/variant-builder';
import { useCategories, useCreateProduct } from '@/hooks/use-queries';
import type { CreateProductDto } from '@/types';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useFormik } from 'formik';
import { useRouter } from 'next/navigation';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import * as Yup from 'yup';

const validationSchema: Yup.Schema<CreateProductDto> = Yup.object({
  sku: Yup.string().required('SKU is required'),
  name: Yup.string().required('product name is required'),
  slug: Yup.string(),
  description: Yup.string().required('Description is required'),
  type: Yup.string().oneOf(['PHYSICAL', 'DIGITAL']).required(),
  price: Yup.number().min(10, 'Price must be greater than 10').required(),
  comparePrice: Yup.number()
    .min(10, 'Compare Price must be greater than 10')
    .optional(),
  costPrice: Yup.number()
    .min(10, 'Cost Price must be greater than 10')
    .optional(),
  inventoryQuantity: Yup.number().min(0).required(),
  inventoryTracked: Yup.boolean(),
  lowStockThreshold: Yup.number().min(0),
  downloadUrl: Yup.string().url().optional(),
  downloadLimit: Yup.number().min(1).optional(),
  downloadExpiry: Yup.number().min(1).optional(),
  ownerName: Yup.string(),
  ownerWhatsapp: Yup.string().required('Owner WhatsApp is required'),
  categoryId: Yup.string().required('Category is required'),
  isActive: Yup.boolean(),
  isFeatured: Yup.boolean(),
  isBestSeller: Yup.boolean(),
  variants: Yup.array()
    .of(
      Yup.object({
        sku: Yup.string().required('Variant SKU is required'),
        name: Yup.string().required('Variant name is required'),
        option1Name: Yup.string().optional(),
        option1Value: Yup.string().optional(),
        option2Name: Yup.string().optional(),
        option2Value: Yup.string().optional(),
        option3Name: Yup.string().optional(),
        option3Value: Yup.string().optional(),
        price: Yup.number().min(10, 'Price must be greater than 10').required(),
        comparePrice: Yup.number()
          .min(10, 'Compare Price must be greater than 10')
          .optional(),
        inventoryQuantity: Yup.number().min(0).required(),
        weight: Yup.number().min(0).optional(),
        image: Yup.string().url().required('Variant image URL is required'),
        isActive: Yup.boolean().optional(),
      }),
    )
    .optional(),
  images: Yup.array()
    .of(
      Yup.object({
        url: Yup.string().url().required('Product image URL is required'),
        alt: Yup.string().optional(),
        isPrimary: Yup.boolean().required('Primary image is required'),
        order: Yup.number().min(0).optional(),
      }),
    )
    .min(1, 'At least one product image is required')
    .required('Product images are required'),
});

export default function NewProductPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const { data: categories = [] } = useCategories();
  const createProduct = useCreateProduct();

  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');

  const formik = useFormik<CreateProductDto>({
    initialValues: {
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
      variants: [],
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        const productData: CreateProductDto = {
          ...values,
          images: imageUrls.map((url, index) => ({
            url,
            alt: values.name,
            isPrimary: index === 0,
            order: index,
          })),
        };

        await createProduct.mutateAsync(productData);

        enqueueSnackbar('Product created successfully!', {
          variant: 'success',
        });

        router.push('/products');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to create product';
        enqueueSnackbar(message, { variant: 'error' });
      }
    },
  });

  // Auto-generate slug from name
  useEffect(() => {
    if (formik.values.name && !formik.values.slug) {
      const slug = formik.values.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      formik.setFieldValue('slug', slug);
    }
  }, [formik.values.name, formik.values.slug]);

  const handleAddImage = () => {
    // Normalize URL: collapse double slashes in path (but not in the protocol https://)
    const normalizedUrl = newImageUrl.trim().replace(/([^:])\/{2,}/g, '$1/');
    if (normalizedUrl && !imageUrls.includes(normalizedUrl)) {
      const updatedUrls = [...imageUrls, normalizedUrl];
      setImageUrls(updatedUrls);
      // Sync with Formik for validation
      formik.setFieldValue(
        'images',
        updatedUrls.map((url, index) => ({
          url,
          alt: formik.values.name || 'Product image',
          isPrimary: index === 0,
          order: index,
        })),
        true, // validate after setting value
      );
      setNewImageUrl('');
    }
  };

  const handleRemoveImage = (index: number) => {
    const updatedUrls = imageUrls.filter((_, i) => i !== index);
    setImageUrls(updatedUrls);
    // Sync with Formik for validation
    formik.setFieldValue(
      'images',
      updatedUrls.map((url, idx) => ({
        url,
        alt: formik.values.name || 'Product image',
        isPrimary: idx === 0,
        order: idx,
      })),
      true, // validate after setting value
    );
  };

  const handleSetPrimaryImage = (index: number) => {
    const newUrls = [...imageUrls];
    const [selected] = newUrls.splice(index, 1);
    newUrls.unshift(selected);
    setImageUrls(newUrls);
    // Sync with Formik for validation
    formik.setFieldValue(
      'images',
      newUrls.map((url, idx) => ({
        url,
        alt: formik.values.name || 'Product image',
        isPrimary: idx === 0,
        order: idx,
      })),
      false, // no need to validate for reordering
    );
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

      <form onSubmit={formik.handleSubmit}>
        <Grid container spacing={3}>
          {/* Main Content */}
          <Grid size={{ xs: 12, lg: 8 }}>
            {/* Basic Info */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Basic Information
                </Typography>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="SKU"
                      name="sku"
                      value={formik.values.sku}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.sku && Boolean(formik.errors.sku)}
                      helperText={formik.touched.sku && formik.errors.sku}
                      disabled={createProduct.isPending}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Name *"
                      name="name"
                      value={formik.values.name}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.name && Boolean(formik.errors.name)}
                      helperText={formik.touched.name && formik.errors.name}
                      disabled={createProduct.isPending}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Slug"
                      name="slug"
                      value={formik.values.slug}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      helperText="Auto-generated from name"
                      disabled={createProduct.isPending}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="Description *"
                      name="description"
                      value={formik.values.description}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={
                        formik.touched.description &&
                        Boolean(formik.errors.description)
                      }
                      helperText={
                        formik.touched.description && formik.errors.description
                      }
                      disabled={createProduct.isPending}
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
                    onKeyDown={(e) => e.key === 'Enter' && handleAddImage()}
                    placeholder="https://example.com/image.jpg"
                    disabled={createProduct.isPending}
                  />
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddImage}
                    disabled={!newImageUrl || createProduct.isPending}
                  >
                    Add
                  </Button>
                </Box>

                {formik.touched.images &&
                  formik.errors.images &&
                  typeof formik.errors.images === 'string' && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ display: 'block', mb: 2 }}
                    >
                      {formik.errors.images}
                    </Typography>
                  )}

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
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          mt: 1,
                        }}
                      >
                        {index !== 0 && (
                          <Button
                            size="small"
                            onClick={() => handleSetPrimaryImage(index)}
                            disabled={createProduct.isPending}
                          >
                            Set Primary
                          </Button>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveImage(index)}
                          color="error"
                          disabled={createProduct.isPending}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>

            {/* Variants */}
            <Card sx={{ mb: 3 }}>
              <VariantBuilder
                productSku={formik.values.sku}
                productName={formik.values.name}
                basePrice={formik.values.price}
                variants={formik.values.variants || []}
                onChange={(variants) =>
                  formik.setFieldValue('variants', variants)
                }
              />
            </Card>

            {/* Pricing & Inventory */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Pricing & Inventory
                </Typography>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Price *"
                      name="price"
                      value={formik.values.price}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={
                        formik.touched.price && Boolean(formik.errors.price)
                      }
                      helperText={formik.touched.price && formik.errors.price}
                      InputProps={{ endAdornment: 'FCFA' }}
                      inputProps={{ step: 'any' }}
                      disabled={createProduct.isPending}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Compare at Price"
                      name="comparePrice"
                      value={formik.values.comparePrice || ''}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      InputProps={{ endAdornment: 'FCFA' }}
                      inputProps={{ step: 'any' }}
                      disabled={createProduct.isPending}
                      error={
                        formik.touched.comparePrice &&
                        Boolean(formik.errors.comparePrice)
                      }
                      helperText={
                        formik.touched.comparePrice &&
                        formik.errors.comparePrice
                      }
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Cost per Item"
                      name="costPrice"
                      value={formik.values.costPrice || ''}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      InputProps={{ endAdornment: 'FCFA' }}
                      inputProps={{ step: 'any' }}
                      disabled={createProduct.isPending}
                      error={
                        formik.touched.costPrice &&
                        Boolean(formik.errors.costPrice)
                      }
                      helperText={
                        formik.touched.costPrice && formik.errors.costPrice
                      }
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Quantity"
                      name="inventoryQuantity"
                      value={formik.values.inventoryQuantity}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={
                        formik.touched.inventoryQuantity &&
                        Boolean(formik.errors.inventoryQuantity)
                      }
                      helperText={
                        formik.touched.inventoryQuantity &&
                        formik.errors.inventoryQuantity
                      }
                      disabled={createProduct.isPending}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Low Stock Threshold"
                      name="lowStockThreshold"
                      value={formik.values.lowStockThreshold}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={
                        formik.touched.lowStockThreshold &&
                        Boolean(formik.errors.lowStockThreshold)
                      }
                      helperText={
                        formik.touched.lowStockThreshold &&
                        formik.errors.lowStockThreshold
                      }
                      disabled={createProduct.isPending}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          name="inventoryTracked"
                          checked={formik.values.inventoryTracked}
                          onChange={formik.handleChange}
                          disabled={createProduct.isPending}
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
          <Grid size={{ xs: 12, lg: 4 }}>
            {/* Status */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Status
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      name="isActive"
                      checked={formik.values.isActive}
                      onChange={formik.handleChange}
                      disabled={createProduct.isPending}
                    />
                  }
                  label="Active"
                />
                <FormControlLabel
                  control={
                    <Switch
                      name="isFeatured"
                      checked={formik.values.isFeatured}
                      onChange={formik.handleChange}
                      disabled={createProduct.isPending}
                    />
                  }
                  label="Featured"
                />
                <FormControlLabel
                  control={
                    <Switch
                      name="isBestSeller"
                      checked={formik.values.isBestSeller}
                      onChange={formik.handleChange}
                      disabled={createProduct.isPending}
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

                <FormControl
                  fullWidth
                  sx={{ mb: 2 }}
                  error={
                    formik.touched.categoryId &&
                    Boolean(formik.errors.categoryId)
                  }
                  disabled={createProduct.isPending}
                >
                  <InputLabel>Category *</InputLabel>
                  <Select
                    name="categoryId"
                    value={formik.values.categoryId}
                    label="Category *"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  >
                    {categories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {formik.touched.categoryId && formik.errors.categoryId && (
                    <Typography variant="caption" color="error">
                      {formik.errors.categoryId}
                    </Typography>
                  )}
                </FormControl>

                <FormControl fullWidth disabled={createProduct.isPending}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    name="type"
                    value={formik.values.type}
                    label="Type"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
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
                  name="ownerName"
                  value={formik.values.ownerName}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={createProduct.isPending}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="WhatsApp Number *"
                  name="ownerWhatsapp"
                  value={formik.values.ownerWhatsapp}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="+628123456789"
                  error={
                    formik.touched.ownerWhatsapp &&
                    Boolean(formik.errors.ownerWhatsapp)
                  }
                  helperText={
                    formik.touched.ownerWhatsapp && formik.errors.ownerWhatsapp
                  }
                  disabled={createProduct.isPending}
                />
              </CardContent>
            </Card>

            {/* Digital Product Settings */}
            {formik.values.type === 'DIGITAL' && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                    Digital Product
                  </Typography>

                  <TextField
                    fullWidth
                    label="Download URL"
                    name="downloadUrl"
                    value={formik.values.downloadUrl || ''}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    sx={{ mb: 2 }}
                    disabled={createProduct.isPending}
                    error={
                      formik.touched.downloadUrl &&
                      Boolean(formik.errors.downloadUrl)
                    }
                    helperText={
                      formik.touched.downloadUrl && formik.errors.downloadUrl
                    }
                  />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Download Limit"
                        name="downloadLimit"
                        value={formik.values.downloadLimit || ''}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        disabled={createProduct.isPending}
                        error={
                          formik.touched.downloadLimit &&
                          Boolean(formik.errors.downloadLimit)
                        }
                        helperText={
                          formik.touched.downloadLimit &&
                          formik.errors.downloadLimit
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Expiry (Days)"
                        name="downloadExpiry"
                        value={formik.values.downloadExpiry || ''}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        disabled={createProduct.isPending}
                        error={
                          formik.touched.downloadExpiry &&
                          Boolean(formik.errors.downloadExpiry)
                        }
                        helperText={
                          formik.touched.downloadExpiry &&
                          formik.errors.downloadExpiry
                        }
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
