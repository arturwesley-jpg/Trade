import { ReactNode } from 'react';
import type { OnboardingState, OnboardingStep, UserPreferences, OnboardingChecklist } from './types';
interface OnboardingContextValue {
    state: OnboardingState;
    startOnboarding: () => void;
    skipOnboarding: () => void;
    completeStep: (step: OnboardingStep) => void;
    updatePreferences: (preferences: Partial<UserPreferences>) => void;
    updateChecklist: (updates: Partial<OnboardingChecklist>) => void;
    unlockAchievement: (achievementId: string) => void;
    startTutorial: (tutorialId: string) => void;
    endTutorial: () => void;
}
export declare function OnboardingProvider({ children }: {
    children: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function useOnboarding(): OnboardingContextValue;
export {};
