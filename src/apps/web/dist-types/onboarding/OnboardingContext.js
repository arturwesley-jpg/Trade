import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect } from 'react';
const OnboardingContext = createContext(undefined);
const STORAGE_KEY = 'trade-onboarding-state';
const initialState = {
    isActive: false,
    progress: {
        currentStep: 'welcome',
        completedSteps: [],
        skipped: false,
        startedAt: new Date().toISOString()
    },
    checklist: {
        profileComplete: false,
        firstAlertCreated: false,
        firstPaperTradeCreated: false,
        telegramConnected: false,
        signalsExplored: false,
        documentationReviewed: false
    },
    achievements: [
        {
            id: 'first-login',
            title: 'Welcome Aboard',
            description: 'Completed your first login',
            icon: '🎉'
        },
        {
            id: 'profile-complete',
            title: 'Profile Master',
            description: 'Completed your trading profile',
            icon: '👤'
        },
        {
            id: 'first-alert',
            title: 'Alert Creator',
            description: 'Created your first price alert',
            icon: '🔔'
        },
        {
            id: 'first-trade',
            title: 'Paper Trader',
            description: 'Executed your first paper trade',
            icon: '📈'
        },
        {
            id: 'telegram-connected',
            title: 'Connected',
            description: 'Connected Telegram notifications',
            icon: '💬'
        },
        {
            id: 'explorer',
            title: 'Signal Explorer',
            description: 'Explored trading signals',
            icon: '🔍'
        },
        {
            id: 'scholar',
            title: 'Knowledge Seeker',
            description: 'Reviewed platform documentation',
            icon: '📚'
        },
        {
            id: 'onboarding-complete',
            title: 'Onboarding Champion',
            description: 'Completed the full onboarding process',
            icon: '🏆'
        }
    ]
};
export function OnboardingProvider({ children }) {
    const [state, setState] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            }
            catch {
                return initialState;
            }
        }
        return initialState;
    });
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [state]);
    const startOnboarding = () => {
        setState(prev => ({
            ...prev,
            isActive: true,
            progress: {
                ...prev.progress,
                currentStep: 'welcome',
                startedAt: new Date().toISOString()
            }
        }));
    };
    const skipOnboarding = () => {
        setState(prev => ({
            ...prev,
            isActive: false,
            progress: {
                ...prev.progress,
                skipped: true,
                completedAt: new Date().toISOString()
            }
        }));
    };
    const completeStep = (step) => {
        setState(prev => {
            const completedSteps = [...prev.progress.completedSteps, step];
            const stepOrder = [
                'welcome',
                'account-setup',
                'exchange-connection',
                'first-alert',
                'first-paper-trade',
                'dashboard-tour',
                'complete'
            ];
            const currentIndex = stepOrder.indexOf(step);
            const nextStep = stepOrder[currentIndex + 1] || 'complete';
            const isComplete = nextStep === 'complete';
            return {
                ...prev,
                isActive: !isComplete,
                progress: {
                    ...prev.progress,
                    currentStep: nextStep,
                    completedSteps,
                    completedAt: isComplete ? new Date().toISOString() : undefined
                }
            };
        });
    };
    const updatePreferences = (preferences) => {
        setState(prev => ({
            ...prev,
            progress: {
                ...prev.progress,
                preferences: {
                    ...prev.progress.preferences,
                    ...preferences
                }
            }
        }));
    };
    const updateChecklist = (updates) => {
        setState(prev => ({
            ...prev,
            checklist: {
                ...prev.checklist,
                ...updates
            }
        }));
        // Auto-unlock achievements based on checklist
        if (updates.profileComplete)
            unlockAchievement('profile-complete');
        if (updates.firstAlertCreated)
            unlockAchievement('first-alert');
        if (updates.firstPaperTradeCreated)
            unlockAchievement('first-trade');
        if (updates.telegramConnected)
            unlockAchievement('telegram-connected');
        if (updates.signalsExplored)
            unlockAchievement('explorer');
        if (updates.documentationReviewed)
            unlockAchievement('scholar');
    };
    const unlockAchievement = (achievementId) => {
        setState(prev => ({
            ...prev,
            achievements: prev.achievements.map(achievement => achievement.id === achievementId && !achievement.unlockedAt
                ? { ...achievement, unlockedAt: new Date().toISOString() }
                : achievement)
        }));
    };
    const startTutorial = (tutorialId) => {
        setState(prev => ({
            ...prev,
            currentTutorial: tutorialId
        }));
    };
    const endTutorial = () => {
        setState(prev => ({
            ...prev,
            currentTutorial: undefined
        }));
    };
    return (_jsx(OnboardingContext.Provider, { value: {
            state,
            startOnboarding,
            skipOnboarding,
            completeStep,
            updatePreferences,
            updateChecklist,
            unlockAchievement,
            startTutorial,
            endTutorial
        }, children: children }));
}
export function useOnboarding() {
    const context = useContext(OnboardingContext);
    if (!context) {
        throw new Error('useOnboarding must be used within OnboardingProvider');
    }
    return context;
}
