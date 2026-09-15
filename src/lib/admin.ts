"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

/**
 * Allowlist de ADM.
 *
 * ATENÇÃO — esta checagem roda no cliente e serve apenas para esconder a UI.
 * Ela não impede ninguém de chamar as funções do banco diretamente pelo
 * console. Quando isso passar a importar de verdade (editor de mapas, reset de
 * sala), a mesma regra precisa ser replicada nas Regras de Segurança do
 * Realtime Database, que é a única camada que o cliente não contorna.
 */
const DEFAULT_ADMIN_EMAILS = ["alienoctopusbr@gmail.com"];

export const ADMIN_EMAILS: string[] = (
    process.env.NEXT_PUBLIC_ADMIN_EMAILS
        ? process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(",")
        : DEFAULT_ADMIN_EMAILS
).map(e => e.trim().toLowerCase()).filter(Boolean);

export function isAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/** Reage ao login: o Firebase Auth restaura a sessao de forma assincrona, entao
 *  ler auth.currentUser na primeira renderizacao devolveria null e o ADM veria
 *  a UI aparecer "piscando" depois. */
export function useIsAdmin(): boolean {
    const [admin, setAdmin] = useState(false);
    useEffect(() => onAuthStateChanged(auth, u => setAdmin(isAdmin(u?.email))), []);
    return admin;
}
