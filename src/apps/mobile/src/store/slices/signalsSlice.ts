import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '@services/api-client';
import type { Signal } from '@/types';

interface SignalsState {
  signals: Signal[];
  isLoading: boolean;
  error: string | null;
}

const initialState: SignalsState = {
  signals: [],
  isLoading: false,
  error: null,
};

export const fetchSignals = createAsyncThunk(
  'signals/fetchSignals',
  async (params?: { symbol?: string; limit?: number }, { rejectWithValue }) => {
    try {
      const data = await apiClient.getSignals(params);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch signals');
    }
  }
);

const signalsSlice = createSlice({
  name: 'signals',
  initialState,
  reducers: {
    addSignal: (state, action) => {
      state.signals.unshift(action.payload);
    },
    clearSignals: (state) => {
      state.signals = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSignals.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSignals.fulfilled, (state, action) => {
        state.isLoading = false;
        state.signals = action.payload;
      })
      .addCase(fetchSignals.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { addSignal, clearSignals } = signalsSlice.actions;
export default signalsSlice.reducer;
