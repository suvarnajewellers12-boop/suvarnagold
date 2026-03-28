import { createContext, useContext, useState } from "react";

type AccessibilityContextType = {
  isEnabled: boolean;
  toggleAccessibility: () => void;
};

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

export const AccessibilityProvider = ({ children }: { children: React.ReactNode }) => {
  const [isEnabled, setIsEnabled] = useState(false);

  const toggleAccessibility = () => {
    setIsEnabled((prev) => !prev);
  };

  return (
    <AccessibilityContext.Provider value={{ isEnabled, toggleAccessibility }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error("useAccessibility must be used inside provider");
  return context;
};