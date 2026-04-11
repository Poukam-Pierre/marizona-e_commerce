'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Typography,
  Skeleton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  TablePagination,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { AdminLayout } from '@/components/layout/admin-layout';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/hooks/use-queries';
import type { Category, CreateCategoryDto, UpdateCategoryDto } from '@/types';

// Validation schema
const categorySchema: Yup.ObjectSchema<CreateCategoryDto> = Yup.object({
  name: Yup.string()
    .required('Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  slug: Yup.string()
    .required('Slug is required')
    .matches(
      /^[a-z0-9-]+$/,
      'Slug must contain only lowercase letters, numbers, and hyphens',
    )
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug must be at most 100 characters'),
  description: Yup.string().max(
    500,
    'Description must be at most 500 characters',
  ),
  image: Yup.string().url('Must be a valid URL').optional(),
  parentId: Yup.string().optional(),
  isActive: Yup.boolean(),
  order: Yup.number().integer().min(0),
});

function TableSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((row) => (
        <TableRow key={row}>
          <TableCell>
            <Skeleton width={200} />
          </TableCell>
          <TableCell>
            <Skeleton width={120} />
          </TableCell>
          <TableCell>
            <Skeleton width={80} />
          </TableCell>
          <TableCell>
            <Skeleton width={60} />
          </TableCell>
          <TableCell>
            <Skeleton width={100} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function CategoriesPage() {
  const { enqueueSnackbar } = useSnackbar();

  const { data: categories = [], isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const initialValues: CreateCategoryDto = {
    name: '',
    slug: '',
    description: '',
    parentId: '',
    isActive: true,
    order: 0,
  };

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
  };

  const handleOpenDelete = (id: string) => {
    setCategoryToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleCloseDelete = () => {
    setCategoryToDelete(null);
    setDeleteDialogOpen(false);
  };

  const handleSubmit = async (values: CreateCategoryDto) => {
    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({
          id: editingCategory.id,
          data: values as UpdateCategoryDto,
        });
        enqueueSnackbar('Category updated successfully', {
          variant: 'success',
        });
      } else {
        await createCategory.mutateAsync(values);
        enqueueSnackbar('Category created successfully', {
          variant: 'success',
        });
      }
      handleCloseDialog();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Operation failed';
      enqueueSnackbar(message, { variant: 'error' });
      throw error; // Re-throw to let Formik handle the error state
    }
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;

    try {
      await deleteCategory.mutateAsync(categoryToDelete);
      enqueueSnackbar('Category deleted successfully', { variant: 'success' });
      handleCloseDelete();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete category';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  // Generate slug from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  // Get root categories only for table display
  const rootCategories = categories.filter((c) => !c.parentId);
  const paginatedCategories = rootCategories.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  return (
    <AdminLayout title="Categories">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
        >
          Add Category
        </Button>
      </Box>

      {/* Categories Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Products</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableSkeleton />
              ) : paginatedCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    <FolderIcon
                      sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }}
                    />
                    <Typography color="text.secondary">
                      No categories found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCategories.map((category) => (
                  <TableRow key={category.id} hover>
                    <TableCell>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1,
                            bgcolor: 'grey.100',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {category.image ? (
                            <Box
                              component="img"
                              src={category.image}
                              alt={category.name}
                              sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: 1,
                              }}
                            />
                          ) : (
                            <FolderIcon color="action" />
                          )}
                        </Box>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {category.name}
                          </Typography>
                          {category.description && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {category.description.slice(0, 50)}...
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {category.slug}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={category._count?.products || 0}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={category.isActive ? 'Active' : 'Inactive'}
                        color={category.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEdit(category)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDelete(category.id)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={rootCategories.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <Formik
          initialValues={
            editingCategory
              ? {
                  name: editingCategory.name,
                  slug: editingCategory.slug,
                  description: editingCategory.description || '',
                  image: editingCategory.image || undefined,
                  parentId: editingCategory.parentId || undefined,
                  isActive: editingCategory.isActive,
                  order: editingCategory.order,
                }
              : initialValues
          }
          validationSchema={categorySchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({
            values,
            errors,
            touched,
            handleChange,
            handleBlur,
            setFieldValue,
            isSubmitting,
          }) => (
            <Form>
              <DialogTitle>
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </DialogTitle>
              <DialogContent>
                <Box
                  sx={{
                    pt: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <TextField
                    fullWidth
                    label="Name"
                    name="name"
                    value={values.name}
                    onChange={(e) => {
                      handleChange(e);
                      // Auto-generate slug when creating new category
                      if (!editingCategory) {
                        setFieldValue('slug', generateSlug(e.target.value));
                      }
                    }}
                    onBlur={handleBlur}
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    required
                  />
                  <TextField
                    fullWidth
                    label="Slug"
                    name="slug"
                    value={values.slug}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.slug && Boolean(errors.slug)}
                    helperText={touched.slug && errors.slug}
                    required
                  />
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Description"
                    name="description"
                    value={values.description}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.description && Boolean(errors.description)}
                    helperText={touched.description && errors.description}
                  />
                  <TextField
                    fullWidth
                    label="Image URL"
                    name="image"
                    value={values.image || ''}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.image && Boolean(errors.image)}
                    helperText={touched.image && errors.image}
                    placeholder="https://example.com/image.jpg"
                  />
                  <FormControl fullWidth>
                    <InputLabel>Parent Category</InputLabel>
                    <Select
                      name="parentId"
                      value={values.parentId || ''}
                      label="Parent Category"
                      onChange={handleChange}
                      onBlur={handleBlur}
                    >
                      <MenuItem value="">None (Root)</MenuItem>
                      {categories
                        .filter((c) => c.id !== editingCategory?.id)
                        .map((cat) => (
                          <MenuItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    type="number"
                    label="Sort Order"
                    name="order"
                    value={values.order}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.order && Boolean(errors.order)}
                    helperText={touched.order && errors.order}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        name="isActive"
                        checked={values.isActive}
                        onChange={handleChange}
                      />
                    }
                    label="Active"
                  />
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseDialog} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editingCategory
                      ? 'Update'
                      : 'Create'}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDelete}>
        <DialogTitle>Delete Category</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this category? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDelete}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleteCategory.isPending}
          >
            {deleteCategory.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
}
