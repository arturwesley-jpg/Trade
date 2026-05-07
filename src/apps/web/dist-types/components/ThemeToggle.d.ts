/**
 * Theme Toggle Component
 * Allows users to switch between dark and light themes
 */
interface ThemeToggleProps {
    theme?: "dark" | "light";
    onToggle?: (theme: "dark" | "light") => void;
    className?: string;
}
export declare const ThemeToggle: import("react").NamedExoticComponent<ThemeToggleProps>;
export {};
