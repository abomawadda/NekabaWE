import { useState } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState('light');
  return { theme, setTheme };
}