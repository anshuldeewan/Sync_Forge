export const getApiUrl = (): string => {
  if (typeof process.env.NEXT_PUBLIC_API_URL !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return 'http://localhost:3001';
};
