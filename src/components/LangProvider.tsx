"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { tr, type Lang, type Translation } from "@/lib/i18n";
import { localeFor } from "@/lib/format";

interface LangCtx {
  lang: Lang;
  dir: "rtl" | "ltr";
  locale: string;
  t: Translation;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<LangCtx | null>(null);
const STORAGE_KEY = "sdc_lang";

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "ar") setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value: LangCtx = {
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    locale: localeFor(lang),
    t: tr(lang),
    setLang,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLang must be used within LangProvider");
  return c;
}
