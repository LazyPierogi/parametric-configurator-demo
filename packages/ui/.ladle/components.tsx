import type { GlobalProvider } from '@ladle/react';
import '../stories/global.css';

export const Provider: GlobalProvider = ({ children }) => {
  return children;
};
