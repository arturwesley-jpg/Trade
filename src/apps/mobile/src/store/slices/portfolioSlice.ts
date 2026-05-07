import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '@services/api-client';
import type { Portfolio } from '@/types';

interface PortfolioState {
  portfolio: Portfolio | null;
  metrics: any;
  isLoading: boolean;
  error: string | null;
}

const initialState: PortfolioState = {
  portfolio: null,
  metrics: null,
  isLoading: false,
  error: null,
};

export const fetchPortfolio = createAsyncThunk(
  'portfolio/fetchPortfolio',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiClient.getPortfolio();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch portfolio');
    }
  }
);

export const fetchMetrics = createAsyncThunk(
  'portfolio/fetchMetrics',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiClient.getMetrics();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch metrics');
    }
  }
);

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    clearPortfolio: (state) => {
      state.portfolio = null;
      state.metrics = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPortfolio.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPortfolio.fulfilled, (state, action) => {
        state.isLoading = false;
        state.portfolio = action.payload;
      })
      .addCase(fetchPortfolio.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchMetrics.fulfilled, (state, action) => {
        state.metrics = action.payload;
      });
  },
});

export const { clearPortfolio } = portfolioSlice.actions;
export default portfolioSlice.reducer;
