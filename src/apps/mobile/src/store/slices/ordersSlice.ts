import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '@services/api-client';
import type { Order } from '@/types';

interface OrdersState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
}

const initialState: OrdersState = {
  orders: [],
  isLoading: false,
  error: null,
};

export const fetchOrders = createAsyncThunk(
  'orders/fetchOrders',
  async (params?: { status?: string; limit?: number }, { rejectWithValue }) => {
    try {
      const data = await apiClient.getOrders(params);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch orders');
    }
  }
);

export const createOrder = createAsyncThunk(
  'orders/createOrder',
  async (
    data: {
      symbol: string;
      type: 'market' | 'limit';
      side: 'buy' | 'sell';
      quantity: number;
      price?: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const order = await apiClient.createOrder(data);
      return order;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create order');
    }
  }
);

export const cancelOrder = createAsyncThunk(
  'orders/cancelOrder',
  async (id: string, { rejectWithValue }) => {
    try {
      await apiClient.cancelOrder(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cancel order');
    }
  }
);

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearOrders: (state) => {
      state.orders = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrders.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.isLoading = false;
        state.orders = action.payload;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createOrder.fulfilled, (state, action) => {
        state.orders.unshift(action.payload);
      })
      .addCase(cancelOrder.fulfilled, (state, action) => {
        const index = state.orders.findIndex((order) => order.id === action.payload);
        if (index !== -1) {
          state.orders[index].status = 'cancelled';
        }
      });
  },
});

export const { clearOrders } = ordersSlice.actions;
export default ordersSlice.reducer;
