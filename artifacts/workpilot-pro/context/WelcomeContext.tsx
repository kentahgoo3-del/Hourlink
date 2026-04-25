import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { GuidedTour, resetTour, shouldShowTour } from "@/components/GuidedTour";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";

const ONBOARDING_KEY = "hl_onboarding_done";

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
}

export function WelcomeProvider({ children }: Props) {
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [tourVisible, setTourVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((done) => {
      if (!done) {
        setWelcomeVisible(true);
      }
      setReady(true);
    });
  }, []);

  const handleWelcomeDismiss = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    setWelcomeVisible(false);
    const show = await shouldShowTour();
    if (show) {
      setTimeout(() => setTourVisible(true), 400);
    }
  };

  const handleTriggerWelcome = () => {
    setWelcomeVisible(true);
  };

  const handleTriggerTour = async () => {
    await resetTour();
    setTourVisible(true);
  };

  return (
    <WelcomeContext.Provider
      value={{
        triggerWelcome: handleTriggerWelcome,
        triggerTour: handleTriggerTour,
      }}
    >
      {children}
      {ready && welcomeVisible && (
        <WelcomeOverlay onDismiss={handleWelcomeDismiss} />
      )}
      <GuidedTour visible={tourVisible} onDismiss={() => setTourVisible(false)} />
    </WelcomeContext.Provider>
  );
}
