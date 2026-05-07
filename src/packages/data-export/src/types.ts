export type ExportFormat = 'csv' | 'json' | 'xlsx' | 'pdf';
export type ExportDataType = 'trades' | 'positions' | 'alerts' | 'signals' | 'performance' | 'tax' | 'all';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';
export type DeliveryMethod = 'download' | 'email' | 's3';

export interface ExportRequest {
  id?: string;
  userId: string;
  dataType: ExportDataType;
  format: ExportFormat;
  dateRange: {
    start: Date;
    end: Date;
  };
  filters?: Record<string, any>;
  includeMetadata?: boolean;
  anonymize?: boolean;
}

export interface ExportJob {
  id: string;
  userId: string;
  request: ExportRequest;
  status: ExportStatus;
  progress: number;
  filePath?: string;
  fileSize?: number;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt?: Date;
}

export interface ScheduledExport {
  id: string;
  userId: string;
  name: string;
  request: Omit<ExportRequest, 'dateRange'>;
  frequency: ScheduleFrequency;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:mm format
  deliveryMethod: DeliveryMethod;
  deliveryConfig: {
    email?: string;
    s3Bucket?: string;
    s3Key?: string;
  };
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportResult {
  jobId: string;
  filePath: string;
  fileSize: number;
  recordCount: number;
  format: ExportFormat;
  completedAt: Date;
}

export interface GDPRExportRequest {
  userId: string;
  includePersonalData: boolean;
  includeActivityData: boolean;
  includeFinancialData: boolean;
  format: 'json' | 'zip';
}

export interface DataDeletionRequest {
  userId: string;
  deletePersonalData: boolean;
  deleteActivityData: boolean;
  deleteFinancialData: boolean;
  anonymizeInstead?: boolean;
  reason?: string;
}

export interface TaxReport {
  userId: string;
  year: number;
  totalTrades: number;
  totalGains: number;
  totalLosses: number;
  netGainLoss: number;
  shortTermGains: number;
  longTermGains: number;
  trades: Array<{
    date: Date;
    symbol: string;
    type: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    fee: number;
    gainLoss?: number;
    holdingPeriod?: number;
  }>;
}

export interface PerformanceMetrics {
  userId: string;
  dateRange: { start: Date; end: Date };
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  averagePnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
  averageHoldingTime: number;
}
