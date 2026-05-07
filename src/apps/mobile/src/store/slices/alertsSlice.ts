import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '@services/api-client';
import type { Alert } from '@/types';

interface AlertsState {
  alerts: Alert[];
  isLoading: boolean;
  error: string | null;
}

const initialState: AlertsState = {
  alerts: [],
  isLoading: false,
  error: null,
};

export const fetchAlerts = createAsyncThunk(
  'alerts/fetchAlerts',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiClient.getAlerts();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch alerts');
    }
  }
);

export const createAlert = createAsyncThunk(
  'alerts/createAlert',
  async (
    data: { symbol: string; condition: 'above' | 'below'; targetPrice: number },
    { rejectWithValue }
  ) => {
    try {
      const alert = await apiClient.createAlert(data);
      return alert;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create alert');
    }
  }
);

export const deleteAlert = createAsyncThunk(
  'alerts/deleteAlert',
  async (id: string, { rejectWithValue }) => {
    try {
      await apiClient.deleteAlert(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete alert');
    }
  }
);

export const updateAlert = createAsyncThunk(
  'alerts/updateAlert',
  async (
    { id, data }: { id: string; data: { isActive?: boolean; targetPrice?: number } },
    { rejectWithValue }
  ) => {
    try {
      const alert = await apiClient.updateAlert(id, data);
      return alert;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update alert');
    }
  }
);

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    clearAlerts: (state) => {
      state.alerts = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAlerts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.alerts = action.payload;
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createAlert.fulfilled, (state, action) => {
        state.alerts.push(action.payload);
      })
      .addCase(deleteAlert.fulfilled, (state, action) => {
        state.alerts = state.alerts.filter((alert) => alert.id !== action.payload);
      })
      .addCase(updateAlert.fulfilled, (state, action) => {
        const index = state.alerts.findIndex((alert) => alert.id === action.payload.id);
        if (index !== -1) {
          state.alerts[index] = action.payload;
        }
      });
  },
});

export const { clearAlerts } = alertsSlice.actions;
export default alertsSlice.reducer;
