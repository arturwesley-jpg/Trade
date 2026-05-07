export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateSymbol = (symbol: string): boolean => {
  // Basic validation for trading symbols (e.g., BTC-USDT, ETH-USD)
  const symbolRegex = /^[A-Z]{2,10}-[A-Z]{2,10}$/;
  return symbolRegex.test(symbol);
};

export const validatePrice = (price: string): boolean => {
  const priceNum = parseFloat(price);
  return !isNaN(priceNum) && priceNum > 0;
};

export const validateQuantity = (quantity: string): boolean => {
  const quantityNum = parseFloat(quantity);
  return !isNaN(quantityNum) && quantityNum > 0;
};
