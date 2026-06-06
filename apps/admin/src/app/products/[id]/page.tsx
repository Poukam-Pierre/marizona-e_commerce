'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { VariantBuilder } from '@/components/products/variant-builder';
import {
  useCategories,
  useProduct,
  useUpdateProduct,
} from '@/hooks/use-queries';
import type { UpdateProductDto } from '@/types';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  Alert,
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
  Skeleton,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useFormik } from 'formik';
import { useRouter } from 'next/navigation';
import { useSnackbar } from 'notistack';
import { use, useEffect, useState } from 'react';
import * as Yup from 'yup';

// const validationSchema: Yup.Schema<UpdateProductDto> = Yup.object({
const validationSchema = Yup.object({
  sku: Yup.string().optional(),
  name: Yup.string().optional(),
  slug: Yup.string().optional(),
  description: Yup.string().optional(),
  type: Yup.string().oneOf(['PHYSICAL', 'DIGITAL']).optional(),
  price: Yup.number().min(10, 'Price must be greater than 10').optional(),
  comparePrice: Yup.number()
    .min(10, 'Compare Price must be greater than 10')
    .optional(),
  costPrice: Yup.number()
    .min(10, 'Cost Price must be greater than 10')
    .optional(),
  inventoryQuantity: Yup.number().min(0).optional(),
  inventoryTracked: Yup.boolean().optional(),
  lowStockThreshold: Yup.number().min(0).optional(),
  weight: Yup.number().min(0).nullable(),
  downloadUrl: Yup.string().url().optional(),
  downloadLimit: Yup.number().min(1).optional(),
  downloadExpiry: Yup.number().min(1).optional(),
  ownerName: Yup.string().optional(),
  ownerWhatsapp: Yup.string().optional(),
  categoryId: Yup.string().optional(),
  metaTitle: Yup.string().optional(),
  metaDescription: Yup.string().optional(),
  isActive: Yup.boolean().optional(),
  isFeatured: Yup.boolean().optional(),
  isBestSeller: Yup.boolean().optional(),
  variants: Yup.array()
    .of(
      Yup.object({
        sku: Yup.string().optional(),
        name: Yup.string().optional(),
        option1Name: Yup.string().nullable(),
        option1Value: Yup.string().nullable(),
        option2Name: Yup.string().nullable(),
        option2Value: Yup.string().nullable(),
        option3Name: Yup.string().nullable(),
        option3Value: Yup.string().nullable(),
        price: Yup.number().min(10, 'Price must be greater than 10').optional(),
        comparePrice: Yup.number()
          .min(10, 'Compare Price must be greater than 10')
          .nullable(),
        inventoryQuantity: Yup.number().min(0).optional(),
        weight: Yup.number().nullable(),
        image: Yup.string().url().optional(),
        isActive: Yup.boolean().optional(),
      }),
    )
    .optional(),
  images: Yup.array()
    .of(
      Yup.object({
        url: Yup.string().url().optional(),
        alt: Yup.string().optional(),
        isPrimary: Yup.boolean().optional(),
        order: Yup.number().min(0).optional(),
      }),
    )
    .optional(),
});

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const { data: product, isLoading: productLoading } = useProduct(id);
  const { data: categories = [] } = useCategories();
  const updateProduct = useUpdateProduct();

  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');

  const formik = useFormik<UpdateProductDto>({
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
      weight: undefined,
      downloadUrl: undefined,
      downloadLimit: undefined,
      downloadExpiry: undefined,
      ownerName: '',
      ownerWhatsapp: '',
      categoryId: '',
      metaTitle: '',
      metaDescription: '',
      isActive: true,
      isFeatured: false,
      isBestSeller: false,
      images: [],
      variants: [],
    },
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      try {
        const productData: UpdateProductDto = {
          ...values,
          images: imageUrls.map((url, index) => ({
            url,
            alt: values.name || 'Product image',
            isPrimary: index === 0,
            order: index,
          })),
        };

        await updateProduct.mutateAsync({ id, data: productData });

        enqueueSnackbar('Product updated successfully!', {
          variant: 'success',
        });
        router.push('/products');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to update product';
        enqueueSnackbar(message, { variant: 'error' });
      }
    },
  });

  useEffect(() => {
    if (product) {
      formik.setValues({
        sku: product.sku || '',
        name: product.name || '',
        slug: product.slug || '',
        description: product.description || '',
        type: product.type || 'PHYSICAL',
        price: product.price ?? 0,
        comparePrice: product.comparePrice ?? undefined,
        costPrice: product.costPrice ?? undefined,
        inventoryQuantity: product.inventoryQuantity ?? 0,
        inventoryTracked: product.inventoryTracked ?? true,
        lowStockThreshold: product.lowStockThreshold ?? 10,
        weight: product.weight || undefined,
        downloadUrl: product.downloadUrl || undefined,
        downloadLimit: product.downloadLimit || undefined,
        downloadExpiry: product.downloadExpiry || undefined,
        ownerName: product.ownerName || '',
        ownerWhatsapp: product.ownerWhatsapp || '',
        categoryId: product.categoryId || '',
        metaTitle: product.metaTitle || '',
        metaDescription: product.metaDescription || '',
        isActive: product.isActive ?? true,
        isFeatured: product.isFeatured ?? false,
        isBestSeller: product.isBestSeller ?? false,
        images: product.images || [],
        variants:
          product.variants
            ?.filter((v) => v.image)
            .map((v) => ({
              ...v,
              image: v.image as string,
            })) || [],
      });
      setImageUrls(product.images?.map((img) => img.url) || []);
    }
  }, [product]);

  const handleAddImage = () => {
    if (newImageUrl && !imageUrls.includes(newImageUrl)) {
      const updatedUrls = [...imageUrls, newImageUrl];
      setImageUrls(updatedUrls);
      formik.setFieldValue(
        'images',
        updatedUrls.map((url, index) => ({
          url,
          alt: formik.values.name || 'Product image',
          isPrimary: index === 0,
          order: index,
        })),
        true,
      );
      setNewImageUrl('');
    }
  };

  const handleRemoveImage = (index: number) => {
    const updatedUrls = imageUrls.filter((_, i) => i !== index);
    setImageUrls(updatedUrls);
    formik.setFieldValue(
      'images',
      updatedUrls.map((url, idx) => ({
        url,
        alt: formik.values.name || 'Product image',
        isPrimary: idx === 0,
        order: idx,
      })),
      true,
    );
  };

  const handleSetPrimaryImage = (index: number) => {
    const newUrls = [...imageUrls];
    const [selected] = newUrls.splice(index, 1);
    newUrls.unshift(selected);
    setImageUrls(newUrls);
    formik.setFieldValue(
      'images',
      newUrls.map((url, idx) => ({
        url,
        alt: formik.values.name || 'Product image',
        isPrimary: idx === 0,
        order: idx,
      })),
      false,
    );
  };

  if (productLoading) {
    return (
      <AdminLayout title="Edit Product">
        <Box sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/products')}
          >
            Back to Products
          </Button>
        </Box>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Skeleton height={60} sx={{ mb: 2 }} />
                <Skeleton height={60} />
                <Skeleton height={60} />
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <Card>
              <CardContent>
                <Skeleton height={100} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </AdminLayout>
    );
  }

  if (!product) {
    return (
      <AdminLayout title="Edit Product">
        <Box sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/products')}
          >
            Back to Products
          </Button>
        </Box>
        <Alert severity="error">Product not found</Alert>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Edit Product">
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
                      disabled={updateProduct.isPending}
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
                      disabled={updateProduct.isPending}
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
                      disabled={updateProduct.isPending}
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
                      disabled={updateProduct.isPending}
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
                    disabled={updateProduct.isPending}
                  />
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddImage}
                    disabled={!newImageUrl || updateProduct.isPending}
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
                            disabled={updateProduct.isPending}
                          >
                            Set Primary
                          </Button>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveImage(index)}
                          color="error"
                          disabled={updateProduct.isPending}
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
                productSku={formik.values.sku || ''}
                productName={formik.values.name || ''}
                basePrice={formik.values.price || 0}
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
                      disabled={updateProduct.isPending}
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
                      disabled={updateProduct.isPending}
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
                      disabled={updateProduct.isPending}
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
                      disabled={updateProduct.isPending}
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
                      disabled={updateProduct.isPending}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Weight (kg)"
                      name="weight"
                      value={formik.values.weight || ''}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={
                        formik.touched.weight && Boolean(formik.errors.weight)
                      }
                      helperText={formik.touched.weight && formik.errors.weight}
                      inputProps={{ step: 'any' }}
                      disabled={updateProduct.isPending}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          name="inventoryTracked"
                          checked={formik.values.inventoryTracked ?? true}
                          onChange={formik.handleChange}
                          disabled={updateProduct.isPending}
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
                      checked={formik.values.isActive ?? true}
                      onChange={formik.handleChange}
                      disabled={updateProduct.isPending}
                    />
                  }
                  label="Active"
                />
                <FormControlLabel
                  control={
                    <Switch
                      name="isFeatured"
                      checked={formik.values.isFeatured ?? false}
                      onChange={formik.handleChange}
                      disabled={updateProduct.isPending}
                    />
                  }
                  label="Featured"
                />
                <FormControlLabel
                  control={
                    <Switch
                      name="isBestSeller"
                      checked={formik.values.isBestSeller ?? false}
                      onChange={formik.handleChange}
                      disabled={updateProduct.isPending}
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
                  disabled={updateProduct.isPending}
                >
                  <InputLabel>Category</InputLabel>
                  <Select
                    name="categoryId"
                    value={formik.values.categoryId || ''}
                    label="Category"
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

                <FormControl fullWidth disabled={updateProduct.isPending}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    name="type"
                    value={formik.values.type || 'PHYSICAL'}
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
                  value={formik.values.ownerName || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={updateProduct.isPending}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="WhatsApp Number"
                  name="ownerWhatsapp"
                  value={formik.values.ownerWhatsapp || ''}
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
                  disabled={updateProduct.isPending}
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
                    disabled={updateProduct.isPending}
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
                        disabled={updateProduct.isPending}
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
                        disabled={updateProduct.isPending}
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

            {/* SEO Meta */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  SEO & Meta
                </Typography>

                <TextField
                  fullWidth
                  label="Meta Title"
                  name="metaTitle"
                  value={formik.values.metaTitle || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={updateProduct.isPending}
                  sx={{ mb: 2 }}
                  helperText="Optional: Override default SEO title"
                />
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Meta Description"
                  name="metaDescription"
                  value={formik.values.metaDescription || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={updateProduct.isPending}
                  helperText="Optional: Override default SEO description"
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  type="submit"
                  startIcon={<SaveIcon />}
                  disabled={updateProduct.isPending}
                >
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
