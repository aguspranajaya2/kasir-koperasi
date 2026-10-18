import { Languages } from "lucide-react";
import { Button } from "./ui/button";
import { useLanguage } from "../lib/i18n";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const nextLanguage = language === "id" ? "en" : "id";
  return <Button type="button" size="sm" variant="outline" className="shrink-0" aria-label={language === "id" ? "Switch language to English" : "Ganti bahasa ke Indonesia"} onClick={() => setLanguage(nextLanguage)}><Languages className="h-4 w-4" /><span className="hidden sm:inline">{nextLanguage === "en" ? "English" : "Indonesia"}</span><span className="sm:hidden">{nextLanguage.toUpperCase()}</span></Button>;
}
