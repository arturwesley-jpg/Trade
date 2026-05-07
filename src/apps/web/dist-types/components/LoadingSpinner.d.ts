export interface LoadingSpinnerProps {
    size?: "small" | "medium" | "large";
    message?: string;
    fullScreen?: boolean;
}
export declare function LoadingSpinner({ size, message, fullScreen }: LoadingSpinnerProps): import("react/jsx-runtime").JSX.Element;
export declare function InlineSpinner({ size }: {
    size?: number;
}): import("react/jsx-runtime").JSX.Element;
