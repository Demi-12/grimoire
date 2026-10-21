"use client";

import { Skeleton, SkeletonRegion } from "./skeleton";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type AdminUser, type Me } from "@/lib/api-client";
import type { AccountStatus, SiteRole } from "@/lib/permissions";

type Locale = "en" | "es";

const text = {
  en: {
    approved: "Members", blocked: "Blocked",
    unblock: "Unblock", block: "Block", signOut: "Sign out everywhere", delete: "Delete",
    role: "Role", roles: { admin: "Admin", user: "Member" } as Record<SiteRole, string>,
    joined: (date: string) => `joined ${date}`, you: "you",
    stats: (campaigns: number, characters: number) => `${campaigns} campaign${campaigns === 1 ? "" : "s"} · ${characters} character${characters === 1 ? "" : "s"}`,
    twoFactor: "2FA",
    deleteConfirm: (name: string) => `Delete ${name}'s account? Their characters and the campaigns they created are deleted too. This can't be undone.`,
    blockConfirm: (name: string) => `Block ${name}? They'll be signed out and can't sign in until you unblock them.`,
    revoked: "Sessions closed.", error: "That change couldn't be saved.", loading: "Reading the roll of names…",
    roleHelp: "Anyone can sign up. Admins manage accounts; being a DM or a player depends on each campaign (its creator is the DM).",
  },
  es: {
    approved: "Miembros", blocked: "Bloqueados",
    unblock: "Desbloquear", block: "Bloquear", signOut: "Cerrar sus sesiones", delete: "Eliminar",
    role: "Rol", roles: { admin: "Admin", user: "Miembro" } as Record<SiteRole, string>,
    joined: (date: string) => `desde ${date}`, you: "tú",
    stats: (campaigns: number, characters: number) => `${campaigns} campaña${campaigns === 1 ? "" : "s"} · ${characters} personaje${characters === 1 ? "" : "s"}`,
    twoFactor: "2FA",
    deleteConfirm: (name: string) => `¿Eliminar la cuenta de ${name}? También se borran sus personajes y las campañas que creó. No se puede deshacer.`,
    blockConfirm: (name: string) => `¿Bloquear a ${name}? Se cerrarán sus sesiones y no podrá entrar hasta que lo desbloquees.`,
    revoked: "Sesiones cerradas.", error: "No se pudo guardar el cambio.", loading: "Leyendo el registro de nombres…",
    roleHelp: "Cualquiera puede registrarse. Los admins gestionan cuentas; ser DM o jugador depende de cada campaña (quien la crea es el DM).",
  },
};

/** Roles, blocking and cleanup of accounts for site admins. */
export default function AdminUsers({ me, locale }: { me: Me; locale: Locale }) {
  const t = text[locale];
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await api<{ users: AdminUser[] }>("/api/admin/users");
    setUsers(data.users);
  }, []);

  useEffect(() => { load().catch(() => setError(t.error)); }, [load, t.error]);

  async function change(user: AdminUser, body: { role?: SiteRole; status?: AccountStatus; revokeSessions?: boolean } | "delete") {
    setBusyId(user.id);
    setError("");
    setMessage("");
    try {
      if (body === "delete") await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
      else await api(`/api/admin/users/${user.id}`, { method: "PATCH", body });
      if (body !== "delete" && body.revokeSessions) setMessage(t.revoked);
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 409 ? cause.message : t.error);
    } finally {
      setBusyId("");
    }
  }

  if (!users) return error ? <p role="alert" className="admin-error">{error}</p> : <SkeletonRegion label={t.loading} className="skeleton-grid">{[0, 1, 2, 3].map((item) => <div key={item} className="skeleton-row"><Skeleton width={36} height={36} className="skeleton-circle" /><div className="skeleton-grow"><Skeleton width="35%" height={14} /><Skeleton width="55%" height={10} style={{ marginTop: 8 }} /></div><Skeleton width={90} height={32} /></div>)}</SkeletonRegion>;

  const dateFormat = new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", { dateStyle: "medium" });
  const groups: { status: AccountStatus; title: string }[] = [
    { status: "approved", title: t.approved },
    { status: "blocked", title: t.blocked },
  ];

  return <div className="admin-users">
    {message && <p role="status" className="admin-message">{message}</p>}
    {error && <p role="alert" className="admin-error">{error}</p>}
    <p className="admin-help">{t.roleHelp}</p>
    {groups.map(({ status, title }) => {
      const members = users.filter((user) => user.status === status);
      if (!members.length) return null;
      return <section key={status} className={`admin-group admin-group-${status}`} aria-labelledby={`admin-${status}`}>
        <h2 id={`admin-${status}`}>{title} <small>{members.length}</small></h2>
        <ul>
          {members.map((user) => {
            const isMe = user.id === me.id;
            const busy = busyId === user.id;
            return <li key={user.id} className="admin-user">
              <span className="admin-seal" aria-hidden="true">{user.name.slice(0, 1).toLocaleUpperCase()}</span>
              <div className="admin-identity">
                <b>{user.name}{isMe && <em> · {t.you}</em>}</b>
                <span>{user.email}</span>
                <small>
                  {t.joined(dateFormat.format(new Date(user.createdAt)))} · {t.stats(user.campaignCount, user.characterCount)}
                  {user.twoFactorEnabled && <> · {t.twoFactor}</>}
                </small>
              </div>
              <div className="admin-actions">
                <label><span className="sr-only">{t.role}</span>
                  <select aria-label={`${t.role}: ${user.name}`} value={user.role} disabled={isMe || busy}
                    onChange={(event) => void change(user, { role: event.target.value as SiteRole })}>
                    {(["user", "admin"] as const).map((role) => <option key={role} value={role}>{t.roles[role]}</option>)}
                  </select>
                </label>
                {!isMe && status === "approved" && <>
                  <button type="button" className="button button-quiet" disabled={busy} onClick={() => void change(user, { revokeSessions: true })}>{t.signOut}</button>
                  <button type="button" className="button button-quiet" disabled={busy} onClick={() => { if (window.confirm(t.blockConfirm(user.name))) void change(user, { status: "blocked" }); }}>{t.block}</button>
                </>}
                {!isMe && status === "blocked" && <button type="button" className="button button-quiet" disabled={busy} onClick={() => void change(user, { status: "approved" })}>{t.unblock}</button>}
                {!isMe && <button type="button" className="small-action danger-action" disabled={busy} onClick={() => { if (window.confirm(t.deleteConfirm(user.name))) void change(user, "delete"); }}>{t.delete}</button>}
              </div>
            </li>;
          })}
        </ul>
      </section>;
    })}
  </div>;
}
