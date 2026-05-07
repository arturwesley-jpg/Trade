export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';
export type TradingExperience = 'beginner' | 'intermediate' | 'advanced';
export type OnboardingStep =
  | 'welcome'
  | 'account-setup'
  | 'exchange-connection'
  | 'first-alert'
  | 'first-paper-trade'
  | 'dashboard-tour'
  | 'complete';

export interface UserPreferences {
  riskTolerance: RiskTolerance;
  tradingExperience: TradingExperience;
  preferredAssets: string[];
  notificationPreferences: NotificationPreferences;
  tradingGoals: string[];
}

export interface NotificationPreferences {
  email: boolean;
  telegram: boolean;
  push: boolean;
  priceAlerts: boolean;
  signalAlerts: boolean;
  tradeExecutions: boolean;
  dailySummary: boolean;
}

export interface OnboardingProgress {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  skipped: boolean;
  startedAt: string;
  completedAt?: string;
  preferences?: UserPreferences;
}

export interface OnboardingChecklist {
  profileComplete: boolean;
  firstAlertCreated: boolean;
  firstPaperTradeCreated: boolean;
  telegramConnected: boolean;
  signalsExplored: boolean;
  documentationReviewed: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  progress?: number;
  maxProgress?: number;
}

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: string;
  videoUrl?: string;
  canSkip: boolean;
}

export interface OnboardingState {
  isActive: boolean;
  progress: OnboardingProgress;
  checklist: OnboardingChecklist;
  achievements: Achievement[];
  currentTutorial?: string;
}
