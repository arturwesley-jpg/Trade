export interface ErrorMessageProps {
    title?: string;
    message: string;
    onRetry?: () => void;
}
export declare function ErrorMessage({ title, message, onRetry }: ErrorMessageProps): import("react/jsx-runtime").JSX.Element;
