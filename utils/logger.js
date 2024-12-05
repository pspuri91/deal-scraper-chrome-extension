export const logger = {
  background: (message, data) => {
    console.log(`[Background] ${message}`, data || '');
  },
  content: (message, data) => {
    console.log(`[Content] ${message}`, data || '');
  },
  error: (context, message, error) => {
    console.error(`[${context}] Error: ${message}`, error);
  }
};