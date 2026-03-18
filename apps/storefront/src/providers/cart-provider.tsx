'use client';

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
} from 'react';
import type { CartItem, Product } from '@/types';

interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { productId: string; variantId?: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { productId: string; variantId?: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: CartItem[] };

const CART_STORAGE_KEY = 'shopnx_cart';

function calculateTotals(items: CartItem[]): { totalItems: number; totalPrice: number } {
  return items.reduce(
    (acc, item) => ({
      totalItems: acc.totalItems + item.quantity,
      totalPrice: acc.totalPrice + item.price * item.quantity,
    }),
    { totalItems: 0, totalPrice: 0 },
  );
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingIndex = state.items.findIndex(
        (item) =>
          item.productId === action.payload.productId &&
          item.variantId === action.payload.variantId,
      );

      let newItems: CartItem[];
      if (existingIndex >= 0) {
        newItems = state.items.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + action.payload.quantity }
            : item,
        );
      } else {
        newItems = [...state.items, action.payload];
      }

      const totals = calculateTotals(newItems);
      return { ...state, items: newItems, ...totals };
    }

    case 'REMOVE_ITEM': {
      const newItems = state.items.filter(
        (item) =>
          !(
            item.productId === action.payload.productId &&
            item.variantId === action.payload.variantId
          ),
      );
      const totals = calculateTotals(newItems);
      return { ...state, items: newItems, ...totals };
    }

    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        const newItems = state.items.filter(
          (item) =>
            !(
              item.productId === action.payload.productId &&
              item.variantId === action.payload.variantId
            ),
        );
        const totals = calculateTotals(newItems);
        return { ...state, items: newItems, ...totals };
      }

      const newItems = state.items.map((item) =>
        item.productId === action.payload.productId &&
        item.variantId === action.payload.variantId
          ? { ...item, quantity: action.payload.quantity }
          : item,
      );
      const totals = calculateTotals(newItems);
      return { ...state, items: newItems, ...totals };
    }

    case 'CLEAR_CART':
      return { items: [], totalItems: 0, totalPrice: 0 };

    case 'LOAD_CART': {
      const totals = calculateTotals(action.payload);
      return { items: action.payload, ...totals };
    }

    default:
      return state;
  }
}

interface CartContextType extends CartState {
  addItem: (product: Product, quantity: number, variantId?: string, variantName?: string) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    totalItems: 0,
    totalPrice: 0,
  });

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const items = JSON.parse(savedCart);
        dispatch({ type: 'LOAD_CART', payload: items });
      }
    } catch (error) {
      console.error('Failed to load cart from localStorage:', error);
    }
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.items));
    } catch (error) {
      console.error('Failed to save cart to localStorage:', error);
    }
  }, [state.items]);

  const addItem = (
    product: Product,
    quantity: number,
    variantId?: string,
    variantName?: string,
  ) => {
    const variant = variantId
      ? product.variants.find((v) => v.id === variantId)
      : null;
    const price = variant?.price ?? product.price;

    dispatch({
      type: 'ADD_ITEM',
      payload: {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productImage: variant?.image || product.image || product.images[0]?.url,
        productType: product.type,
        price,
        quantity,
        variantId,
        variantName,
        ownerWhatsapp: product.ownerWhatsapp,
      },
    });
  };

  const removeItem = (productId: string, variantId?: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { productId, variantId } });
  };

  const updateQuantity = (
    productId: string,
    quantity: number,
    variantId?: string,
  ) => {
    dispatch({
      type: 'UPDATE_QUANTITY',
      payload: { productId, quantity, variantId },
    });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  return (
    <CartContext.Provider
      value={{
        ...state,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
