import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '@services/api-client';
import type { MarketData } from '@/types';

interface MarketState {
  data: Record<string, MarketData>;
  watchlist: string[];
  isLoading: boolean;
  error: string | null;
}

const initialState: MarketState = {
  data: {},
  watchlist: ['BTC-USDT', 'ETH-USDT', 'BNB-USDT'],
  isLoading: false,
  error: null,
};

export const fetchMarketData = createAsyncThunk(
  'market/fetchMarketData',
  async (symbols?: string[], { rejectWithValue }) => {
    try {
      const data = await apiClient.getMarketData(symbols);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch market data');
    }
  }
);

export const fetchMarketDataBySymbol = createAsyncThunk(
  'market/fetchMarketDataBySymbol',
  async (symbol: string, { rejectWithValue }) => {
    try {
      const data = await apiClient.getMarketDataBySymbol(symbol);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch market data');
    }
  }
);

const marketSlice = createSlice({
  name: 'market',
  initialState,
  reducers: {
    updateMarketData: (state, action: PayloadAction<MarketData>) => {
      state.data[action.payload.symbol] = action.payload;
    },
    addToWatchlist: (state, action: PayloadAction<string>) => {
      if (!state.watchlist.includes(action.payload)) {
        state.watchlist.push(action.payload);
      }
    },
    removeFromWatchlist: (state, action: PayloadAction<string>) => {
      state.watchlist = state.watchlist.filter((symbol) => symbol !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMarketData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMarketData.fulfilled, (state, action) => {
        state.isLoading = false;
        if (Array.isArray(action.payload)) {
          action.payload.forEach((item: MarketData) => {
            state.data[item.symbol] = item;
          });
        }
      })
      .addCase(fetchMarketData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchMarketDataBySymbol.fulfilled, (state, action) => {
        state.data[action.payload.symbol] = action.payload;
      });
  },
});

export const { updateMarketData, addToWatchlist, removeFromWatchlist } = marketSlice.actions;
export default marketSlice.reducer;
