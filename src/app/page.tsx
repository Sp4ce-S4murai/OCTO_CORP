"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from "firebase/auth";
import {
  createRoom,
  verifyRoomPassword,
  subscribeToUserCharacters,
  saveUserCharacter,
  deleteUserCharacter,
  createEmptyCharacter
} from "../lib/database";
import { CharacterSheet } from "../types/character";

type AppMode = 'login' | 'dashboard' | 'diretor' | 'jogador_library' | 'jogador_join';

export default function Home() {
  const router = useRouter();

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(true);

  // App Flow State
  const [appMode, setAppMode] = useState<AppMode>('login');

  // Diretor Flow State
  const [wardenRoomId, setWardenRoomId] = useState("");
  const [wardenRoomPswd, setWardenRoomPswd] = useState("");
  const [wardenLoading, setWardenLoading] = useState(false);

  // Jogador Flow State
  const [myCharacters, setMyCharacters] = useState<CharacterSheet[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterSheet | null>(null);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinRoomPswd, setJoinRoomPswd] = useState("");
  const [playerLoading, setPlayerLoading] = useState(false);

  // Character Creation State
  const [newCharName, setNewCharName] = useState("");
  const [isCreatingChar, setIsCreatingChar] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setAppMode('dashboard');
      } else {
        setAppMode('login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Player Profile Characters
  useEffect(() => {
    if (user && (appMode === 'jogador_library' || appMode === 'dashboard')) {
      const unsub = subscribeToUserCharacters(user.uid, (chars) => {
        setMyCharacters(chars);
      });
      return () => unsub();
    }
  }, [user, appMode]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      setAuthError(error.message || "Erro na autenticação.");
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError("");
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setAuthError(error.message || "Erro no login com Google.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // --- DIRETOR FLOW ---
  const handleCreateOrJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (!wardenRoomId || !wardenRoomPswd) {
      setAuthError("Preencha o Setor e a Senha para criar/entrar.");
      return;
    }

    setWardenLoading(true);

    try {
      // Assume that if password matches or room does not exist, we are good to go.
      // Note: createRoom handles creating setting the password initially. 
      // Realistically, to handle both securely in one go:
      const isPswdCorrect = await verifyRoomPassword(wardenRoomId, wardenRoomPswd);

      if (!isPswdCorrect) {
        setAuthError("Senha incorreta ou Sala já existe com outra senha.");
        setWardenLoading(false);
        return;
      }

      // Force update password (if it's a new room, it sets it, if existing, it just rewrites same)
      await createRoom(wardenRoomId, wardenRoomPswd);
      router.push(`/sala/${wardenRoomId}/diretor`);
    } catch (err: any) {
      setAuthError("Erro de Conexão com o Setor: " + err.message);
      setWardenLoading(false);
    }
  };

  // --- JOGADOR FLOW ---
  const handleCreateNewCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCharName.trim()) return;

    const newId = `char_${Date.now()}`;
    const newChar = createEmptyCharacter(newId, newCharName);

    await saveUserCharacter(user.uid, newChar);
    setIsCreatingChar(false);
    setNewCharName("");
  };

  const handleSelectCharacterToJoin = (char: CharacterSheet) => {
    setSelectedCharacter(char);
    setJoinRoomId("");
    setJoinRoomPswd("");
    setAppMode('jogador_join');
  };

  const handleDeleteCharacter = async (e: React.MouseEvent, charId: string) => {
    e.stopPropagation();
    if (!user || !confirm("Certeza que deseja deletar este operador? O processo é irreversível.")) return;
    await deleteUserCharacter(user.uid, charId);
  }

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCharacter || !joinRoomId) return;

    setAuthError("");
    setPlayerLoading(true);

    try {
      const isAllowed = await verifyRoomPassword(joinRoomId, joinRoomPswd);
      if (!isAllowed) {
        setAuthError("Acesso Negado: Senha Incorreta para este Setor.");
        setPlayerLoading(false);
        return;
      }

      // A cópia do personagem para o "playerLog" da sala específica
      // acontecerá ao acessar a URL `jogador/[id]`. Apenas validamos e redirecionamos.
      router.push(`/sala/${joinRoomId}/jogador/${selectedCharacter.id}`);
    } catch (err: any) {
      setAuthError("Erro de Conexão: " + err.message);
      setPlayerLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-emerald-500 font-mono flex items-center justify-center p-4">
        <p className="animate-pulse">Sincronizando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-emerald-500 font-mono flex items-center justify-center p-4">
      <div className="max-w-md w-full border border-emerald-900 bg-zinc-950/80 p-8 shadow-2xl shadow-emerald-900/20">
        <h1 className="text-3xl font-bold uppercase tracking-widest text-emerald-400 mb-2 border-b-2 border-emerald-900 pb-4 flex justify-between items-center">
          <span>MOTHERSHIP_OS</span>
          {user && appMode !== 'dashboard' && (
            <button
              onClick={() => setAppMode('dashboard')}
              className="text-xs text-emerald-600 hover:text-emerald-400 uppercase"
            >
              [ VOLTAR ]
            </button>
          )}
        </h1>

        {!user ? (
          <>
            <p className="text-emerald-700 mb-6 text-sm">Autenticação necessária para acesso ao sistema.</p>

            {authError && (
              <div className="bg-red-900/20 border border-red-900 text-red-500 p-3 mb-6 text-sm">
                {authError}
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="flex flex-col gap-4 mb-6">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-emerald-600">CREDENCIAL (EMAIL)</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-900/50 border border-emerald-800 p-2 outline-none focus:border-emerald-400 active:bg-zinc-900 text-emerald-300 font-bold"
                  placeholder="operador@octo.corp"
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-emerald-600">CÓDIGO DE ACESSO (SENHA)</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-900/50 border border-emerald-800 p-2 outline-none focus:border-emerald-400 active:bg-zinc-900 text-emerald-300 font-bold tracking-widest"
                  placeholder="••••••••"
                  required
                />
              </label>

              <button
                type="submit"
                className="bg-emerald-900/20 hover:bg-emerald-800/50 border border-emerald-700 text-emerald-400 p-3 uppercase tracking-widest font-bold transition-colors mt-2"
              >
                {isLoginView ? "INICIAR SESSÃO" : "REGISTRAR OPERADOR"}
              </button>
            </form>

            <div className="flex flex-col gap-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-emerald-900/50"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-zinc-950 px-2 text-emerald-700">OU CONEXÃO EXTERNA</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="bg-transparent hover:bg-zinc-900 border border-emerald-900 text-emerald-600 hover:text-emerald-400 p-3 uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                ACESSO GOOGLE
              </button>

              <button
                type="button"
                onClick={() => setIsLoginView(!isLoginView)}
                className="text-emerald-700 hover:text-emerald-500 text-sm underline decoration-emerald-900/50 hover:decoration-emerald-500/50 transition-colors mt-2"
              >
                {isLoginView ? "Não possui credenciais? Criar conta." : "Já é um operador? Fazer login."}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* LOGGED IN HEADER */}
            <div className="flex justify-between items-center mb-6 border-b border-emerald-900/50 pb-4">
              <p className="text-emerald-600 text-sm truncate pr-4">
                Operador: <span className="text-emerald-400 font-bold">{user.email}</span>
              </p>
              <button
                onClick={handleLogout}
                className="text-emerald-700 hover:text-red-500 text-xs uppercase underline transition-colors"
              >
                Desconectar
              </button>
            </div>

            {authError && (
              <div className="bg-red-900/20 border border-red-900 text-red-500 p-3 mb-6 text-sm">
                {authError}
              </div>
            )}

            {/* MAIN DASHBOARD */}
            {appMode === 'dashboard' && (
              <div className="flex flex-col gap-6">
                <p className="text-emerald-700 mb-2 text-sm text-center">Identificação confirmada. Selecione o protocolo operacional.</p>

                <button
                  onClick={() => setAppMode('jogador_library')}
                  className="bg-emerald-900/20 hover:bg-emerald-800/50 border border-emerald-700 text-emerald-400 p-6 text-xl uppercase tracking-widest font-bold transition-colors"
                >
                  [ ACESSO JOGADOR ]
                </button>

                <button
                  onClick={() => setAppMode('diretor')}
                  className="bg-transparent hover:bg-zinc-900 border border-emerald-900 text-emerald-700 hover:text-emerald-500 p-6 text-xl uppercase tracking-widest font-bold transition-colors"
                >
                  [ ACESSO DIRETOR ]
                </button>
              </div>
            )}

            {/* WARDEN (DIRETOR) FLOW */}
            {appMode === 'diretor' && (
              <form onSubmit={handleCreateOrJoinRoom} className="flex flex-col gap-6">
                <p className="text-emerald-500 mb-2 font-bold uppercase border-b border-emerald-900/50 pb-2">Protocolo: Iniciar Setor</p>

                <label className="flex flex-col gap-1">
                  <span className="text-sm text-emerald-600">ID DO SETOR (NOME DA SALA)</span>
                  <input
                    type="text"
                    value={wardenRoomId}
                    onChange={(e) => setWardenRoomId(e.target.value)}
                    className="bg-zinc-900/50 border border-emerald-800 p-2 outline-none focus:border-emerald-400 active:bg-zinc-900 text-emerald-300 font-bold tracking-widest"
                    placeholder="ex: OMEGA-4"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 mb-4">
                  <span className="text-sm text-emerald-600">CÓDIGO DE ENTRADA (SENHA)</span>
                  <input
                    type="password"
                    value={wardenRoomPswd}
                    onChange={(e) => setWardenRoomPswd(e.target.value)}
                    className="bg-zinc-900/50 border border-emerald-800 p-2 outline-none focus:border-emerald-400 active:bg-zinc-900 text-emerald-300 font-bold tracking-widest"
                    placeholder="••••••••"
                    required
                  />
                  <span className="text-xs text-emerald-700 mt-1">Obrigatório para segurança da sala.</span>
                </label>

                <button
                  type="submit"
                  disabled={wardenLoading}
                  className="bg-emerald-900/20 hover:bg-emerald-800/50 border border-emerald-700 text-emerald-400 p-3 uppercase tracking-widest font-bold transition-colors disabled:opacity-50"
                >
                  {wardenLoading ? "LST. CONEXÕES..." : "INICIALIZAR SETOR"}
                </button>
              </form>
            )}

            {/* PLAYER LIBRARY FLOW */}
            {appMode === 'jogador_library' && (
              <div className="flex flex-col gap-4">
                <p className="text-emerald-500 mb-2 font-bold uppercase border-b border-emerald-900/50 pb-2">Arquivo de Operadores Pessoais</p>

                {myCharacters.length === 0 ? (
                  <p className="text-emerald-700 text-sm text-center py-4 border border-dashed border-emerald-900/50">
                    Nenhum registro encontrado.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {myCharacters.map(char => (
                      <div key={char.id} className="border border-emerald-900/50 bg-zinc-900/50 p-3 flex justify-between items-center group cursor-pointer hover:border-emerald-600 transition-colors" onClick={() => handleSelectCharacterToJoin(char)}>
                        <div>
                          <p className="font-bold text-emerald-400 uppercase tracking-widest">{char.name}</p>
                          <p className="text-xs text-emerald-600">{char.characterClass} | HP: {char.vitals.health.current}</p>
                        </div>
                        <div className="flex gap-4 items-center">
                          <span className="text-xs text-emerald-700 group-hover:text-emerald-400 transition-colors uppercase">Selecionar {'>'}</span>
                          <button
                            onClick={(e) => handleDeleteCharacter(e, char.id)}
                            className="text-red-900 hover:text-red-500 transition-colors p-1 z-10"
                            title="Deletar Personagem"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isCreatingChar ? (
                  <form onSubmit={handleCreateNewCharacter} className="mt-4 border border-emerald-800 p-4 bg-emerald-950/20">
                    <label className="flex flex-col gap-1 mb-4">
                      <span className="text-xs text-emerald-500">NOME DE REGISTRO DA UNIDADE</span>
                      <input
                        type="text"
                        value={newCharName}
                        onChange={(e) => setNewCharName(e.target.value)}
                        className="bg-zinc-950 border border-emerald-700 p-2 outline-none focus:border-emerald-400 text-emerald-300 font-bold tracking-widest"
                        placeholder="ex: JOHN_DOE_87"
                        required
                        autoFocus
                      />
                    </label>
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold p-2 uppercase">Gravar</button>
                      <button type="button" onClick={() => setIsCreatingChar(false)} className="flex-1 border border-emerald-800 text-emerald-600 hover:text-emerald-400 text-xs font-bold p-2 uppercase">Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setIsCreatingChar(true)}
                    className="mt-4 border border-dashed border-emerald-800 text-emerald-600 py-3 text-sm font-bold tracking-widest hover:bg-emerald-950/30 hover:text-emerald-400 transition-all uppercase"
                  >
                    + NOVO OPERADOR
                  </button>
                )}
              </div>
            )}

            {/* PLAYER JOIN ROOM FLOW */}
            {appMode === 'jogador_join' && selectedCharacter && (
              <form onSubmit={handleJoinRoom} className="flex flex-col gap-6">
                <p className="text-emerald-500 mb-2 font-bold uppercase border-b border-emerald-900/50 pb-2 flex justify-between">
                  <span>Conectar ao Setor</span>
                  <span className="text-emerald-700 text-xs mt-1 shrink-0">Op: {selectedCharacter.name}</span>
                </p>

                <label className="flex flex-col gap-1">
                  <span className="text-sm text-emerald-600">ID DO SETOR (NOME DA SALA)</span>
                  <input
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    className="bg-zinc-900/50 border border-emerald-800 p-2 outline-none focus:border-emerald-400 active:bg-zinc-900 text-emerald-300 font-bold tracking-widest"
                    placeholder="Buscar Sinal..."
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 mb-4">
                  <span className="text-sm text-emerald-600">CÓDIGO DE ENTRADA (SENHA)</span>
                  <input
                    type="password"
                    value={joinRoomPswd}
                    onChange={(e) => setJoinRoomPswd(e.target.value)}
                    className="bg-zinc-900/50 border border-emerald-800 p-2 outline-none focus:border-emerald-400 active:bg-zinc-900 text-emerald-300 font-bold tracking-widest"
                    placeholder="••••••••"
                    required
                  />
                </label>

                <button
                  type="submit"
                  disabled={playerLoading}
                  className="bg-emerald-900/20 hover:bg-emerald-800/50 border border-emerald-700 text-emerald-400 p-3 uppercase tracking-widest font-bold transition-colors disabled:opacity-50"
                >
                  {playerLoading ? "AUTENTICANDO..." : "CONECTAR PERSONAGEM"}
                </button>
              </form>
            )}

          </>
        )}
      </div>
    </div>
  );
}
