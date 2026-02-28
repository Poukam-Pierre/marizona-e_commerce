'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { IVariant } from '@/types';

interface VariantOption {
  name: string;
  values: string[];
}

const optionValidationSchema = Yup.object({
  name: Yup.string().required('Option name is required'),
  value: Yup.string().required('Value is required'),
});

const variantValidationSchema = Yup.object({
  sku: Yup.string().required('SKU is required'),
  name: Yup.string().required('Name is required'),
  price: Yup.number()
    .min(0, 'Price must be 0 or greater')
    .required('Price is required'),
  comparePrice: Yup.number().min(0).nullable(),
  inventoryQuantity: Yup.number()
    .min(0, 'Inventory must be 0 or greater')
    .required('Inventory is required'),
  weight: Yup.number().min(0).nullable(),
  image: Yup.string()
    .url('Must be a valid URL')
    .required('Image URL is required'),
});

interface VariantBuilderProps {
  productSku: string;
  productName: string;
  basePrice: number;
  variants: IVariant[];
  onChange: (variants: IVariant[]) => void;
}

export function VariantBuilder({
  productSku,
  basePrice,
  variants,
  onChange,
}: VariantBuilderProps) {
  const [options, setOptions] = useState<VariantOption[]>([]);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(
    null,
  );
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);

  // Formik for option addition
  const optionFormik = useFormik({
    initialValues: { name: '', value: '' },
    validationSchema: optionValidationSchema,
    onSubmit: (values, { resetForm }) => {
      const existingOption = options.find((opt) => opt.name === values.name);
      if (existingOption) {
        setOptions(
          options.map((opt) =>
            opt.name === values.name
              ? { ...opt, values: [...opt.values, values.value] }
              : opt,
          ),
        );
      } else {
        setOptions([...options, { name: values.name, values: [values.value] }]);
      }
      resetForm();
    },
  });

  // Formik for variant editing
  const variantFormik = useFormik<IVariant>({
    initialValues: {
      sku: '',
      name: '',
      image: '',
      price: basePrice,
      comparePrice: undefined,
      inventoryQuantity: 0,
      weight: undefined,
      isActive: true,
    },
    validationSchema: variantValidationSchema,
    enableReinitialize: true,
    onSubmit: (values) => {
      if (editingVariantIndex !== null) {
        const newVariants = [...variants];
        newVariants[editingVariantIndex] = values;
        onChange(newVariants);
      } else {
        onChange([...variants, values]);
      }
      setVariantDialogOpen(false);
      setEditingVariantIndex(null);
      variantFormik.resetForm();
    },
  });

  // Remove option value
  const handleRemoveOptionValue = (optionName: string, value: string) => {
    setOptions(
      options
        .map((opt) =>
          opt.name === optionName
            ? { ...opt, values: opt.values.filter((v) => v !== value) }
            : opt,
        )
        .filter((opt) => opt.values.length > 0),
    );
  };

  // Generate variants from options
  const handleGenerateVariants = () => {
    if (options.length === 0) return;

    const generateCombinations = (
      opts: VariantOption[],
      index = 0,
      current: Record<string, string> = {},
    ): Record<string, string>[] => {
      if (index === opts.length) {
        return [current];
      }

      const option = opts[index];
      const combinations: Record<string, string>[] = [];

      for (const value of option.values) {
        const newCurrent = { ...current, [option.name]: value };
        combinations.push(...generateCombinations(opts, index + 1, newCurrent));
      }

      return combinations;
    };

    const combinations = generateCombinations(options);
    const newVariants: IVariant[] = combinations.map((combo) => {
      const values = Object.values(combo);
      const name = values.join(' - ');
      const sku = `${productSku}-${Object.values(combo)
        .map((v) => v.substring(0, 3).toUpperCase())
        .join('-')}`;

      return {
        sku,
        name,
        image: '',
        option1Name: options[0]?.name,
        option1Value: combo[options[0]?.name || ''],
        option2Name: options[1]?.name,
        option2Value: combo[options[1]?.name || ''],
        option3Name: options[2]?.name,
        option3Value: combo[options[2]?.name || ''],
        price: basePrice,
        inventoryQuantity: 0,
        isActive: true,
      };
    });

    onChange(newVariants);
    setOptionDialogOpen(false);
  };

  // Edit variant
  const handleEditVariant = (index: number) => {
    setEditingVariantIndex(index);
    variantFormik.setValues(variants[index]);
    setVariantDialogOpen(true);
  };

  // Delete variant
  const handleDeleteVariant = (index: number) => {
    onChange(variants.filter((_, i) => i !== index));
  };

  // Add manual variant
  const handleAddManualVariant = () => {
    setEditingVariantIndex(null);
    variantFormik.setValues({
      sku: `${productSku}-VAR-${variants.length + 1}`,
      name: '',
      image: '',
      price: basePrice,
      inventoryQuantity: 0,
      isActive: true,
    });
    setVariantDialogOpen(true);
  };

  return (
    <Card>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            Product Variants
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddManualVariant}
              size="small"
            >
              Add Variant
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOptionDialogOpen(true)}
              size="small"
            >
              Generate from Options
            </Button>
          </Box>
        </Box>

        {variants.length > 0 ? (
          <Paper variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>SKU</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Price(FCFA)</TableCell>
                  <TableCell>Stock</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {variants.map((variant, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {variant.sku}
                      </Typography>
                    </TableCell>
                    <TableCell>{variant.name}</TableCell>
                    <TableCell>{variant.price.toFixed(2)}</TableCell>
                    <TableCell>{variant.inventoryQuantity}</TableCell>
                    <TableCell>
                      <Chip
                        label={variant.isActive ? 'Active' : 'Inactive'}
                        color={variant.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleEditVariant(index)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteVariant(index)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No variants yet. Add variants manually or generate from options.
            </Typography>
          </Paper>
        )}
      </CardContent>

      {/* Option Builder Dialog */}
      <Dialog
        open={optionDialogOpen}
        onClose={() => setOptionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Generate Variants from Options</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add option names (e.g., Size, Color) and their values. Variants
              will be automatically generated from all combinations.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                size="small"
                label="Option Name"
                name="name"
                value={optionFormik.values.name}
                onChange={optionFormik.handleChange}
                onBlur={optionFormik.handleBlur}
                error={
                  optionFormik.touched.name && Boolean(optionFormik.errors.name)
                }
                helperText={
                  optionFormik.touched.name && optionFormik.errors.name
                }
                placeholder="e.g., Size, Color"
              />
              <TextField
                size="small"
                label="Value"
                name="value"
                value={optionFormik.values.value}
                onChange={optionFormik.handleChange}
                onBlur={optionFormik.handleBlur}
                error={
                  optionFormik.touched.value &&
                  Boolean(optionFormik.errors.value)
                }
                helperText={
                  optionFormik.touched.value && optionFormik.errors.value
                }
                placeholder="e.g., Small, Red"
              />
              <Button
                variant="contained"
                onClick={() => optionFormik.handleSubmit()}
              >
                Add
              </Button>
            </Box>

            {options.map((option) => (
              <Box key={option.name} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  {option.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {option.values.map((value) => (
                    <Chip
                      key={value}
                      label={value}
                      onDelete={() =>
                        handleRemoveOptionValue(option.name, value)
                      }
                      size="small"
                    />
                  ))}
                </Box>
              </Box>
            ))}

            {options.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                This will generate{' '}
                {options.reduce((acc, opt) => acc * opt.values.length, 1)}{' '}
                variant
                {options.reduce((acc, opt) => acc * opt.values.length, 1) !== 1
                  ? 's'
                  : ''}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOptionDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleGenerateVariants}
            disabled={options.length === 0}
          >
            Generate Variants
          </Button>
        </DialogActions>
      </Dialog>

      {/* Variant Edit Dialog */}
      <Dialog
        open={variantDialogOpen}
        onClose={() => setVariantDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingVariantIndex !== null ? 'Edit Variant' : 'Add Variant'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              fullWidth
              label="SKU"
              name="sku"
              value={variantFormik.values.sku}
              onChange={variantFormik.handleChange}
              onBlur={variantFormik.handleBlur}
              error={
                variantFormik.touched.sku && Boolean(variantFormik.errors.sku)
              }
              helperText={variantFormik.touched.sku && variantFormik.errors.sku}
            />
            <TextField
              fullWidth
              label="Name"
              name="name"
              value={variantFormik.values.name}
              onChange={variantFormik.handleChange}
              onBlur={variantFormik.handleBlur}
              error={
                variantFormik.touched.name && Boolean(variantFormik.errors.name)
              }
              helperText={
                variantFormik.touched.name && variantFormik.errors.name
              }
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                type="number"
                label="Price"
                name="price"
                value={variantFormik.values.price}
                onChange={variantFormik.handleChange}
                onBlur={variantFormik.handleBlur}
                error={
                  variantFormik.touched.price &&
                  Boolean(variantFormik.errors.price)
                }
                helperText={
                  variantFormik.touched.price && variantFormik.errors.price
                }
                InputProps={{ endAdornment: 'FCFA' }}
              />
              <TextField
                fullWidth
                type="number"
                label="Compare Price"
                name="comparePrice"
                value={variantFormik.values.comparePrice || ''}
                onChange={variantFormik.handleChange}
                onBlur={variantFormik.handleBlur}
                error={
                  variantFormik.touched.comparePrice &&
                  Boolean(variantFormik.errors.comparePrice)
                }
                helperText={
                  variantFormik.touched.comparePrice &&
                  variantFormik.errors.comparePrice
                }
                InputProps={{ endAdornment: 'FCFA' }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                type="number"
                label="Inventory"
                name="inventoryQuantity"
                value={variantFormik.values.inventoryQuantity}
                onChange={variantFormik.handleChange}
                onBlur={variantFormik.handleBlur}
                error={
                  variantFormik.touched.inventoryQuantity &&
                  Boolean(variantFormik.errors.inventoryQuantity)
                }
                helperText={
                  variantFormik.touched.inventoryQuantity &&
                  variantFormik.errors.inventoryQuantity
                }
              />
              <TextField
                fullWidth
                type="number"
                label="Weight (kg)"
                name="weight"
                value={variantFormik.values.weight || ''}
                onChange={variantFormik.handleChange}
                onBlur={variantFormik.handleBlur}
                error={
                  variantFormik.touched.weight &&
                  Boolean(variantFormik.errors.weight)
                }
                helperText={
                  variantFormik.touched.weight && variantFormik.errors.weight
                }
              />
            </Box>
            <TextField
              fullWidth
              label="Image URL"
              name="image"
              value={variantFormik.values.image || ''}
              onChange={variantFormik.handleChange}
              onBlur={variantFormik.handleBlur}
              error={
                variantFormik.touched.image &&
                Boolean(variantFormik.errors.image)
              }
              helperText={
                variantFormik.touched.image && variantFormik.errors.image
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVariantDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => variantFormik.handleSubmit()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
