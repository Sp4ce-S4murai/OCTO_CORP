"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [playerId, setPlayerId] = useState("");

  const joinAsPlayer = () => {
    if (roomId && playerId) {
      router.push(`/sala/${roomId}/jogador/${playerId}`);
    } else {
      alert("Preencha SETOR e ID DA UNIDADE.");
    }
  };

  const joinAsWarden = () => {
    if (roomId) {
      router.push(`/sala/${roomId}/diretor`);
    } else {
      alert("Preencha o SETOR para acessar.");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-emerald-500 font-mono flex items-center justify-center p-4">
      <div className="max-w-md w-full border border-emerald-900 bg-zinc-950/80 p-8 shadow-2xl shadow-emerald-900/20">
        <h1 className="text-3xl font-bold uppercase tracking-widest text-emerald-400 mb-2 border-b-2 border-emerald-900 pb-4">
          MOTHERSHIP_OS v1.0
        </h1>
        <p className="text-emerald-700 mb-8 text-sm">Estabelecendo conexão sub-espacial. Identifique-se.</p>

        <div className="flex flex-col gap-6">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-emerald-600">ID DO SETOR (SALA)</span>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="bg-zinc-900/50 border border-emerald-800 p-2 outline-none focus:border-emerald-400 active:bg-zinc-900 text-emerald-300 font-bold uppercase tracking-widest"
              placeholder="ex: OMEGA-4"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-emerald-600">ID DA UNIDADE (SEU NOME JOGADOR)</span>
            <input
              type="text"
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              className="bg-zinc-900/50 border border-emerald-800 p-2 outline-none focus:border-emerald-400 active:bg-zinc-900 text-emerald-300 font-bold uppercase tracking-widest"
              placeholder="ex: ALIEN_DUDE"
            />
          </label>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <button
              onClick={joinAsPlayer}
              className="bg-emerald-900/20 hover:bg-emerald-800/50 border border-emerald-700 text-emerald-400 p-3 uppercase tracking-widest font-bold transition-colors"
            >
              JOGADOR
            </button>
            <button
              onClick={joinAsWarden}
              className="bg-transparent hover:bg-zinc-900 border border-emerald-900 text-emerald-700 hover:text-emerald-500 p-3 uppercase tracking-widest font-bold transition-colors"
            >
              DIRETOR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
