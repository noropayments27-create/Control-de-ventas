import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ChartColumn, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
        rememberMe,
      });
      if (result.error) throw new Error(result.error.message || "No se pudo iniciar sesión.");
      window.location.assign("/");
    } catch {
      setError("Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.");
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand">
          <ChartColumn strokeWidth={2.5} aria-hidden="true" />
          <h1>Control de ventas</h1>
        </div>
        <h2>Bienvenido</h2>
        <p className="login-subtitle">Ingresa con tu cuenta para continuar.</p>
        <form onSubmit={submit}>
          <label className="login-field">
            Correo electrónico
            <span className="login-input-wrap">
              <input
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </span>
          </label>
          <label className="login-field">
            Contraseña
            <span className="login-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contraseña"
              />
              <button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </span>
          </label>
          <label className="login-remember">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            Recuérdame
          </label>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button className="login-submit" type="submit" disabled={busy}>
            <LockKeyhole size={18} style={{ display: "inline", marginRight: 8 }} />
            {busy ? "Ingresando…" : "Iniciar sesión"}
          </button>
        </form>
      </section>
    </main>
  );
}
