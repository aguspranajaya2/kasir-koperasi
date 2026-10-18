import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface Product {
  _id: string;
  sku: string;
  barcode?: string;
  name: string;
  unit: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
}
export interface CartLine { product: Product; qty: number }
interface CartState { lines: CartLine[] }
const initialState: CartState = { lines: [] };

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart(state, action: PayloadAction<Product>) {
      const line = state.lines.find((item) => item.product._id === action.payload._id);
      if (line) line.qty = Math.min(line.qty + 1, action.payload.stock);
      else if (action.payload.stock > 0) state.lines.push({ product: action.payload, qty: 1 });
    },
    setQuantity(state, action: PayloadAction<{ productId: string; qty: number }>) {
      const line = state.lines.find((item) => item.product._id === action.payload.productId);
      if (!line) return;
      line.qty = Math.min(Math.max(0, action.payload.qty), line.product.stock);
      if (line.qty === 0) state.lines = state.lines.filter((item) => item.product._id !== action.payload.productId);
    },
    removeLine(state, action: PayloadAction<string>) { state.lines = state.lines.filter((line) => line.product._id !== action.payload); },
    clearCart(state) { state.lines = []; }
  }
});

export const { addToCart, setQuantity, removeLine, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
