import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface SettingsContextValue {
  brightness: number;
  setBrightness: (v: number) => void;
  language: "en" | "hi";
  setLanguage: (v: "en" | "hi") => void;
  theme: "dark" | "light";
  setTheme: (v: "dark" | "light") => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [brightness, setBrightness] = useState(100);
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    document.documentElement.style.filter = `brightness(${brightness}%)`;
  }, [brightness]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
    }
  }, [theme]);

  return (
    <SettingsContext.Provider value={{ brightness, setBrightness, language, setLanguage, theme, setTheme }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
