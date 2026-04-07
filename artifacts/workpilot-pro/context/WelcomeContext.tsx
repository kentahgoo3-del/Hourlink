import React, { createContext, useContext, useState } from "react";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";
import { GuidedTour, shouldShowTour, resetTour } from "@/components/GuidedTour";

interface WelcomeContextValue {
  triggerWelcome: () => void;
  triggerTour: () => void;
}

const WelcomeContext = createContext<WelcomeContextValue>({
  triggerWelcome: () => {},
  triggerTour: () => {},
});

export function useWelcome() {
  return useContext(WelcomeContext);
}

interface Props {
  children: React.ReactNode;
  initialVisible?: boolean;
}

export function WelcomeProvider({ children, initialVisible = true }: Props) {
  const [welcomeVisible, setWelcomeVisible] = useState(initialVisible);
  const [tourVisible, setTourVisible] = useState(false);

  const handleWelcomeDismiss = async () => {
    setWelcomeVisible(false);
    const show = await shouldShowTour();
    if (show) {
      setTimeout(() => setTourVisible(true), 400);
    }
  };

  const handleTriggerTour = async () => {
    await resetTour();
    setTourVisible(true);
  };

  return (
    <WelcomeContext.Provider value={{
      triggerWelcome: () => setWelcomeVisible(true),
      triggerTour: handleTriggerTour,
    }}>
      {children}
      {welcomeVisible && <WelcomeOverlay onDismiss={handleWelcomeDismiss} />}
      <GuidedTour visible={tourVisible} onDismiss={() => setTourVisible(false)} />
    </WelcomeContext.Provider>
  );
}
