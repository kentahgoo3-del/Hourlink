import React, { createContext, useContext, useState } from "react";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";

interface WelcomeContextValue {
  triggerWelcome: () => void;
}

const WelcomeContext = createContext<WelcomeContextValue>({ triggerWelcome: () => {} });

export function useWelcome() {
  return useContext(WelcomeContext);
}

interface Props {
  children: React.ReactNode;
  initialVisible?: boolean;
}

export function WelcomeProvider({ children, initialVisible = true }: Props) {
  const [visible, setVisible] = useState(initialVisible);

  return (
    <WelcomeContext.Provider value={{ triggerWelcome: () => setVisible(true) }}>
      {children}
      {visible && <WelcomeOverlay onDismiss={() => setVisible(false)} />}
    </WelcomeContext.Provider>
  );
}
