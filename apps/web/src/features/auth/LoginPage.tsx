import { useState, type FormEvent } from "react";
import { KeyRound, Store } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useLoginMutation } from "../../services/api";
import { useLanguage } from "../../lib/i18n";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";

export function LoginPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [login, state] = useLoginMutation();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void login({ email, password });
  };
  return <main className="relative grid min-h-dvh place-items-center px-4 py-10">
    <div className="absolute right-4 top-4"><LanguageSwitcher /></div>
    <Card className="w-full max-w-md p-6 sm:p-8">
      <div className="mb-7"><div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-emerald-100 text-primary"><Store /></div><p className="text-sm font-semibold uppercase tracking-wide text-primary">Koperasi</p><h1 className="mt-1 text-2xl font-bold">{t("Masuk ke kasir")}</h1><p className="mt-2 text-sm text-slate-500">{t("Gunakan akun yang dibuat oleh administrator.")}</p></div>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium">Email<Input className="mt-1.5" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="block text-sm font-medium">{t("Kata sandi")}<Input className="mt-1.5" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {state.isError && <p role="alert" className="text-sm text-red-600">{t("Email atau kata sandi salah, atau layanan belum tersedia.")}</p>}
        <Button className="w-full" disabled={state.isLoading}><KeyRound className="h-4 w-4" />{state.isLoading ? t("Memeriksa…") : t("Masuk")}</Button>
      </form>
    </Card>
  </main>;
}
