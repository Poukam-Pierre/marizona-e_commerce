'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Typography,
  Tab,
  Tabs,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Skeleton,
  InputAdornment,
  Avatar,
  IconButton,
} from '@mui/material';
import {
  Save as SaveIcon,
  Store as StoreIcon,
  Language as LanguageIcon,
  Notifications as NotificationsIcon,
  Share as ShareIcon,
  PhotoCamera as PhotoCameraIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useSettings, useUpdateSettings } from '@/hooks/use-queries';

// Validation schema - all fields are optional
const settingsSchema = Yup.object({
  // General
  storeName: Yup.string()
    .max(255, 'Store name must be at most 255 characters')
    .nullable(),
  storeDescription: Yup.string()
    .max(1000, 'Description must be at most 1000 characters')
    .nullable(),
  storeLogo: Yup.string()
    .url('Must be a valid URL')
    .nullable()
    .transform((value) => (value === '' ? null : value)),
  storeEmail: Yup.string()
    .email('Must be a valid email')
    .nullable()
    .transform((value) => (value === '' ? null : value)),
  storePhone: Yup.string()
    .max(50, 'Phone must be at most 50 characters')
    .nullable(),
  storeAddress: Yup.string()
    .max(500, 'Address must be at most 500 characters')
    .nullable(),
  // Store
  currency: Yup.string()
    .max(10, 'Currency must be at most 10 characters')
    .nullable(),
  currencySymbol: Yup.string()
    .max(10, 'Currency symbol must be at most 10 characters')
    .nullable(),
  taxRate: Yup.number()
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%')
    .nullable()
    .transform((value, originalValue) => (originalValue === '' ? null : value)),
  taxEnabled: Yup.boolean(),
  shippingCost: Yup.number()
    .min(0, 'Shipping cost cannot be negative')
    .nullable()
    .transform((value, originalValue) => (originalValue === '' ? null : value)),
  freeShippingThreshold: Yup.number()
    .min(0, 'Free shipping threshold cannot be negative')
    .nullable()
    .transform((value, originalValue) => (originalValue === '' ? null : value)),
  inventoryThreshold: Yup.number()
    .integer()
    .min(0, 'Inventory threshold cannot be negative')
    .nullable()
    .transform((value, originalValue) => (originalValue === '' ? null : value)),
  // SEO
  seoTitle: Yup.string()
    .max(60, 'Meta title should be at most 60 characters')
    .nullable(),
  seoDescription: Yup.string()
    .max(160, 'Meta description should be at most 160 characters')
    .nullable(),
  seoKeywords: Yup.string()
    .max(500, 'Keywords must be at most 500 characters')
    .nullable(),
  googleAnalyticsId: Yup.string()
    .max(50, 'Analytics ID must be at most 50 characters')
    .nullable(),
  facebookPixelId: Yup.string()
    .max(50, 'Pixel ID must be at most 50 characters')
    .nullable(),
  // Social
  socialFacebook: Yup.string()
    .url('Must be a valid URL')
    .nullable()
    .transform((value) => (value === '' ? null : value)),
  socialInstagram: Yup.string()
    .url('Must be a valid URL')
    .nullable()
    .transform((value) => (value === '' ? null : value)),
  socialTwitter: Yup.string()
    .url('Must be a valid URL')
    .nullable()
    .transform((value) => (value === '' ? null : value)),
  socialYoutube: Yup.string()
    .url('Must be a valid URL')
    .nullable()
    .transform((value) => (value === '' ? null : value)),
  socialTiktok: Yup.string()
    .url('Must be a valid URL')
    .nullable()
    .transform((value) => (value === '' ? null : value)),
  // Notifications
  emailNotifications: Yup.boolean(),
  orderConfirmation: Yup.boolean(),
  orderShipped: Yup.boolean(),
  orderDelivered: Yup.boolean(),
  lowStockAlert: Yup.boolean(),
  newCustomer: Yup.boolean(),
  marketingEmails: Yup.boolean(),
});

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function SettingsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [activeTab, setActiveTab] = useState(0);

  // Initial values for Formik
  const initialValues = {
    // General
    storeName: '',
    storeDescription: '',
    storeLogo: '',
    storeEmail: '',
    storePhone: '',
    storeAddress: '',
    // Store
    currency: 'XAF',
    currencySymbol: 'FCFA',
    taxRate: 0,
    taxEnabled: false,
    shippingCost: 0,
    freeShippingThreshold: 0,
    inventoryThreshold: 10,
    // SEO
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    googleAnalyticsId: '',
    facebookPixelId: '',
    // Social
    socialFacebook: '',
    socialInstagram: '',
    socialTwitter: '',
    socialYoutube: '',
    socialTiktok: '',
    // Notifications
    emailNotifications: true,
    orderConfirmation: true,
    orderShipped: true,
    orderDelivered: true,
    lowStockAlert: true,
    newCustomer: true,
    marketingEmails: false,
  };

  // Merge API settings with initial values
  const mergedInitialValues = {
    ...initialValues,
    ...(settings?.general || {}),
    ...(settings?.store || {}),
    ...(settings?.seo || {}),
    ...(settings?.social || {}),
    ...(settings?.notifications || {}),
  };

  const handleSubmit = async (values: typeof initialValues) => {
    try {
      // Filter out undefined, null, and empty string values
      const settingsToUpdate = [
        // General
        { key: 'storeName', value: values.storeName, category: 'general' },
        {
          key: 'storeDescription',
          value: values.storeDescription,
          category: 'general',
        },
        { key: 'storeLogo', value: values.storeLogo, category: 'general' },
        { key: 'storeEmail', value: values.storeEmail, category: 'general' },
        { key: 'storePhone', value: values.storePhone, category: 'general' },
        {
          key: 'storeAddress',
          value: values.storeAddress,
          category: 'general',
        },
        // Store
        { key: 'currency', value: values.currency, category: 'store' },
        {
          key: 'currencySymbol',
          value: values.currencySymbol,
          category: 'store',
        },
        { key: 'taxRate', value: values.taxRate, category: 'store' },
        { key: 'taxEnabled', value: values.taxEnabled, category: 'store' },
        { key: 'shippingCost', value: values.shippingCost, category: 'store' },
        {
          key: 'freeShippingThreshold',
          value: values.freeShippingThreshold,
          category: 'store',
        },
        {
          key: 'inventoryThreshold',
          value: values.inventoryThreshold,
          category: 'store',
        },
        // SEO
        { key: 'seoTitle', value: values.seoTitle, category: 'seo' },
        {
          key: 'seoDescription',
          value: values.seoDescription,
          category: 'seo',
        },
        { key: 'seoKeywords', value: values.seoKeywords, category: 'seo' },
        {
          key: 'googleAnalyticsId',
          value: values.googleAnalyticsId,
          category: 'seo',
        },
        {
          key: 'facebookPixelId',
          value: values.facebookPixelId,
          category: 'seo',
        },
        // Social
        {
          key: 'socialFacebook',
          value: values.socialFacebook,
          category: 'social',
        },
        {
          key: 'socialInstagram',
          value: values.socialInstagram,
          category: 'social',
        },
        {
          key: 'socialTwitter',
          value: values.socialTwitter,
          category: 'social',
        },
        {
          key: 'socialYoutube',
          value: values.socialYoutube,
          category: 'social',
        },
        { key: 'socialTiktok', value: values.socialTiktok, category: 'social' },
        // Notifications
        {
          key: 'emailNotifications',
          value: values.emailNotifications,
          category: 'notifications',
        },
        {
          key: 'orderConfirmation',
          value: values.orderConfirmation,
          category: 'notifications',
        },
        {
          key: 'orderShipped',
          value: values.orderShipped,
          category: 'notifications',
        },
        {
          key: 'orderDelivered',
          value: values.orderDelivered,
          category: 'notifications',
        },
        {
          key: 'lowStockAlert',
          value: values.lowStockAlert,
          category: 'notifications',
        },
        {
          key: 'newCustomer',
          value: values.newCustomer,
          category: 'notifications',
        },
        {
          key: 'marketingEmails',
          value: values.marketingEmails,
          category: 'notifications',
        },
      ].filter((setting) => {
        // Only include settings that have defined, non-empty values
        // Keep boolean values (including false) and numeric values (including 0)
        if (typeof setting.value === 'boolean') return true;
        if (typeof setting.value === 'number') return true;
        // For strings, exclude null, undefined, and empty strings
        return (
          setting.value !== null &&
          setting.value !== undefined &&
          setting.value !== ''
        );
      });
      await updateSettings.mutateAsync({ settings: settingsToUpdate });
      enqueueSnackbar('Settings saved successfully!', { variant: 'success' });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to save settings';
      enqueueSnackbar(message, { variant: 'error' });
      throw error;
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Settings">
        <Skeleton height={400} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Settings">
      <Formik
        initialValues={mergedInitialValues}
        validationSchema={settingsSchema}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {({
          values,
          errors,
          touched,
          handleChange,
          handleBlur,
          isSubmitting,
          dirty,
        }) => (
          <Form>
            {/* Header Actions */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={!dirty || isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>

            {dirty && (
              <Alert severity="info" sx={{ mb: 3 }}>
                You have unsaved changes. Don&apos;t forget to save your
                settings.
              </Alert>
            )}

            <Card>
              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                <Tab
                  icon={<StoreIcon />}
                  label="General"
                  iconPosition="start"
                />
                <Tab
                  icon={<LanguageIcon />}
                  label="Store"
                  iconPosition="start"
                />
                <Tab icon={<ShareIcon />} label="SEO" iconPosition="start" />
                <Tab icon={<ShareIcon />} label="Social" iconPosition="start" />
                <Tab
                  icon={<NotificationsIcon />}
                  label="Notifications"
                  iconPosition="start"
                />
              </Tabs>

              {/* General Settings */}
              <TabPanel value={activeTab} index={0}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                    General Settings
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          mb: 2,
                        }}
                      >
                        <Avatar
                          src={values.storeLogo}
                          sx={{
                            width: 80,
                            height: 80,
                            bgcolor: 'primary.main',
                          }}
                        >
                          {values.storeName?.charAt(0) || 'S'}
                        </Avatar>
                        <Box>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 1 }}
                          >
                            Store Logo
                          </Typography>
                          <TextField
                            size="small"
                            name="storeLogo"
                            placeholder="Logo URL"
                            value={values.storeLogo}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={
                              touched.storeLogo && Boolean(errors.storeLogo)
                            }
                            InputProps={{
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton size="small">
                                    <PhotoCameraIcon />
                                  </IconButton>
                                </InputAdornment>
                              ),
                            }}
                          />
                          {touched.storeLogo && errors.storeLogo && (
                            <Typography
                              variant="caption"
                              color="error"
                              display="block"
                            >
                              {errors.storeLogo}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        name="storeName"
                        label="Store Name"
                        value={values.storeName}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.storeName && Boolean(errors.storeName)}
                        helperText={touched.storeName && errors.storeName}
                        placeholder="My Awesome Store"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        name="storeEmail"
                        label="Store Email"
                        type="email"
                        value={values.storeEmail}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.storeEmail && Boolean(errors.storeEmail)}
                        helperText={touched.storeEmail && errors.storeEmail}
                        placeholder="contact@mystore.com"
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        name="storeDescription"
                        label="Store Description"
                        multiline
                        rows={3}
                        value={values.storeDescription}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.storeDescription &&
                          Boolean(errors.storeDescription)
                        }
                        helperText={
                          touched.storeDescription && errors.storeDescription
                        }
                        placeholder="Brief description of your store..."
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        name="storePhone"
                        label="Phone Number"
                        value={values.storePhone}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.storePhone && Boolean(errors.storePhone)}
                        helperText={touched.storePhone && errors.storePhone}
                        placeholder="+1 234 567 8900"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        name="storeAddress"
                        label="Address"
                        value={values.storeAddress}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.storeAddress && Boolean(errors.storeAddress)
                        }
                        helperText={touched.storeAddress && errors.storeAddress}
                        placeholder="123 Main St, City, Country"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </TabPanel>

              {/* Store Settings */}
              <TabPanel value={activeTab} index={1}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                    Store Settings
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12 }}>
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        Currency Settings
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        name="currency"
                        label="Currency"
                        value={values.currency}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.currency && Boolean(errors.currency)}
                        helperText={touched.currency && errors.currency}
                        placeholder="USD"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        name="currencySymbol"
                        label="Currency Symbol"
                        value={values.currencySymbol}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.currencySymbol &&
                          Boolean(errors.currencySymbol)
                        }
                        helperText={
                          touched.currencySymbol && errors.currencySymbol
                        }
                        placeholder="$"
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Divider sx={{ my: 2 }} />
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        Tax Settings
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            name="taxEnabled"
                            checked={values.taxEnabled}
                            onChange={handleChange}
                          />
                        }
                        label="Enable Tax"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        name="taxRate"
                        label="Tax Rate (%)"
                        value={values.taxRate}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.taxRate && Boolean(errors.taxRate)}
                        helperText={touched.taxRate && errors.taxRate}
                        disabled={!values.taxEnabled}
                        InputProps={{ inputProps: { min: 0, max: 100 } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Divider sx={{ my: 2 }} />
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        Shipping Settings
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        name="shippingCost"
                        label="Default Shipping Cost"
                        value={values.shippingCost}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.shippingCost && Boolean(errors.shippingCost)
                        }
                        helperText={touched.shippingCost && errors.shippingCost}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              {values.currencySymbol}
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        name="freeShippingThreshold"
                        label="Free Shipping Threshold"
                        value={values.freeShippingThreshold}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.freeShippingThreshold &&
                          Boolean(errors.freeShippingThreshold)
                        }
                        helperText={
                          (touched.freeShippingThreshold &&
                            errors.freeShippingThreshold) ||
                          'Orders above this amount get free shipping'
                        }
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              {values.currencySymbol}
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Divider sx={{ my: 2 }} />
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        Inventory Settings
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        name="inventoryThreshold"
                        label="Low Stock Threshold"
                        value={values.inventoryThreshold}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.inventoryThreshold &&
                          Boolean(errors.inventoryThreshold)
                        }
                        helperText={
                          (touched.inventoryThreshold &&
                            errors.inventoryThreshold) ||
                          'Alert when stock falls below this number'
                        }
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </TabPanel>

              {/* SEO Settings */}
              <TabPanel value={activeTab} index={2}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                    SEO Settings
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        name="seoTitle"
                        label="Meta Title"
                        value={values.seoTitle}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.seoTitle && Boolean(errors.seoTitle)}
                        helperText={
                          (touched.seoTitle && errors.seoTitle) ||
                          `${values.seoTitle.length}/60 characters`
                        }
                        placeholder="My Awesome Store - Best Products Online"
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        name="seoDescription"
                        multiline
                        rows={3}
                        label="Meta Description"
                        value={values.seoDescription}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.seoDescription &&
                          Boolean(errors.seoDescription)
                        }
                        helperText={
                          (touched.seoDescription && errors.seoDescription) ||
                          `${values.seoDescription.length}/160 characters`
                        }
                        placeholder="Shop the best products at My Awesome Store..."
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        name="seoKeywords"
                        label="Meta Keywords"
                        value={values.seoKeywords}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.seoKeywords && Boolean(errors.seoKeywords)
                        }
                        helperText={
                          (touched.seoKeywords && errors.seoKeywords) ||
                          'Comma-separated keywords'
                        }
                        placeholder="ecommerce, online store, products"
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Divider sx={{ my: 2 }} />
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        Analytics & Tracking
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        name="googleAnalyticsId"
                        label="Google Analytics ID"
                        value={values.googleAnalyticsId}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.googleAnalyticsId &&
                          Boolean(errors.googleAnalyticsId)
                        }
                        helperText={
                          touched.googleAnalyticsId && errors.googleAnalyticsId
                        }
                        placeholder="G-XXXXXXXXXX"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        name="facebookPixelId"
                        label="Facebook Pixel ID"
                        value={values.facebookPixelId}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.facebookPixelId &&
                          Boolean(errors.facebookPixelId)
                        }
                        helperText={
                          touched.facebookPixelId && errors.facebookPixelId
                        }
                        placeholder="XXXXXXXXXXXXXXXX"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </TabPanel>

              {/* Social Media Settings */}
              <TabPanel value={activeTab} index={3}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                    Social Media Links
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        name="socialFacebook"
                        label="Facebook"
                        value={values.socialFacebook}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.socialFacebook &&
                          Boolean(errors.socialFacebook)
                        }
                        helperText={
                          touched.socialFacebook && errors.socialFacebook
                        }
                        placeholder="https://facebook.com/mystore"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        name="socialInstagram"
                        label="Instagram"
                        value={values.socialInstagram}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.socialInstagram &&
                          Boolean(errors.socialInstagram)
                        }
                        helperText={
                          touched.socialInstagram && errors.socialInstagram
                        }
                        placeholder="https://instagram.com/mystore"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        name="socialTwitter"
                        label="Twitter / X"
                        value={values.socialTwitter}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.socialTwitter && Boolean(errors.socialTwitter)
                        }
                        helperText={
                          touched.socialTwitter && errors.socialTwitter
                        }
                        placeholder="https://twitter.com/mystore"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        name="socialYoutube"
                        label="YouTube"
                        value={values.socialYoutube}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.socialYoutube && Boolean(errors.socialYoutube)
                        }
                        helperText={
                          touched.socialYoutube && errors.socialYoutube
                        }
                        placeholder="https://youtube.com/@mystore"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        name="socialTiktok"
                        label="TikTok"
                        value={values.socialTiktok}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={
                          touched.socialTiktok && Boolean(errors.socialTiktok)
                        }
                        helperText={touched.socialTiktok && errors.socialTiktok}
                        placeholder="https://tiktok.com/@mystore"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </TabPanel>

              {/* Notification Settings */}
              <TabPanel value={activeTab} index={4}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                    Notification Settings
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            name="emailNotifications"
                            checked={values.emailNotifications}
                            onChange={handleChange}
                          />
                        }
                        label={
                          <Box>
                            <Typography fontWeight={500}>
                              Email Notifications
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Enable or disable all email notifications
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Divider sx={{ my: 1 }} />
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ mb: 2, mt: 2 }}
                      >
                        Order Notifications
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            name="orderConfirmation"
                            checked={values.orderConfirmation}
                            onChange={handleChange}
                            disabled={!values.emailNotifications}
                          />
                        }
                        label="Order Confirmation"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            name="orderShipped"
                            checked={values.orderShipped}
                            onChange={handleChange}
                            disabled={!values.emailNotifications}
                          />
                        }
                        label="Order Shipped"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            name="orderDelivered"
                            checked={values.orderDelivered}
                            onChange={handleChange}
                            disabled={!values.emailNotifications}
                          />
                        }
                        label="Order Delivered"
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Divider sx={{ my: 1 }} />
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ mb: 2, mt: 2 }}
                      >
                        Admin Notifications
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            name="lowStockAlert"
                            checked={values.lowStockAlert}
                            onChange={handleChange}
                            disabled={!values.emailNotifications}
                          />
                        }
                        label="Low Stock Alerts"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            name="newCustomer"
                            checked={values.newCustomer}
                            onChange={handleChange}
                            disabled={!values.emailNotifications}
                          />
                        }
                        label="New Customer Registration"
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Divider sx={{ my: 1 }} />
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ mb: 2, mt: 2 }}
                      >
                        Marketing
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            name="marketingEmails"
                            checked={values.marketingEmails}
                            onChange={handleChange}
                            disabled={!values.emailNotifications}
                          />
                        }
                        label="Marketing Emails"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </TabPanel>
            </Card>
          </Form>
        )}
      </Formik>
    </AdminLayout>
  );
}
