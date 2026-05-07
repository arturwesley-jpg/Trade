import { motion } from "framer-motion";

export interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ title = "Erro", message, onRetry }: ErrorMessageProps) {
  return (
    <motion.div
      className="error-message"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      role="alert"
      aria-live="assertive"
    >
      <div className="error-content">
        <div className="error-icon" aria-hidden="true">
          ⚠
        </div>
        <div className="error-text">
          <h3 className="error-title">{title}</h3>
          <p className="error-description">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry} type="button">
          Tentar novamente
        </button>
      )}
    </motion.div>
  );
}
