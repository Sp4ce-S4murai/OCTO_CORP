"use client";

import { useEffect, useState, useRef } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue, query, orderByChild, limitToLast } from "firebase/database";
import { RollLog } from "@/types/character";

export function TerminalLog({ roomId }: { roomId: string }) {
    const [logs, setLogs] = useState<RollLog[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const logsRef = query(ref(database, `rooms/${roomId}/logs`), orderByChild('timestamp'), limitToLast(50));

        const unsubscribe = onValue(logsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const sortedLogs = Object.values(data) as RollLog[];
                sortedLogs.sort((a, b) => a.timestamp - b.timestamp);
                setLogs(sortedLogs);
            }
        });

        return () => unsubscribe();
    }, [roomId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const getResultColor = (result: string) => {
        switch (result) {
            case 'Critical Success': return 'text-emerald-300 bg-emerald-900/40 px-1 font-bold';
            case 'Success': return 'text-emerald-500';
            case 'Critical Failure': return 'text-amber-500 font-bold bg-amber-900/40 px-1';
            case 'Failure': return 'text-amber-600';
            case 'Panic Fail': return 'text-red-500 font-bold bg-red-900/50 px-2 animate-pulse';
            case 'Panic Success': return 'text-sky-400 font-bold bg-sky-900/30 px-1';
            default: return 'text-zinc-500';
        }
    };

    return (
        <div className="bg-zinc-950 border border-emerald-900 p-4 h-64 flex flex-col font-mono text-sm shadow-inner shadow-black/50 overflow-hidden">
            <div className="text-emerald-700 text-xs mb-2 border-b border-emerald-900/50 pb-1 flex justify-between">
                <span>COMMLINK_UPLINK::SECTOR_{roomId}</span>
                <span className="animate-pulse">REC</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1" ref={scrollRef}>
                {logs.length === 0 && <div className="text-emerald-900">Aguardando telemetria...</div>}
                {logs.map(log => {
                    const isPanic = log.result.includes('Panic');
                    const hasMod = !!log.modifier;

                    return (
                        <div key={log.id} className={`border-l-2 pl-2 py-1 ${isPanic ? 'border-amber-600/50 bg-amber-950/10' : 'border-emerald-900/30'}`}>
                            <span className="text-emerald-600/70 text-xs">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                            <span className="text-emerald-400 font-bold">{log.playerName}</span> testou{' '}
                            {isPanic ? (
                                <span className="text-amber-500 font-bold">PÂNICO (vs {log.statValue})</span>
                            ) : (
                                <span className="text-emerald-400">
                                    {log.statName} ({log.statValue})
                                    {hasMod && <span className="text-emerald-300"> + {log.modifier!.name} (+{log.modifier!.value})</span>}
                                    {hasMod && <span className="text-emerald-500"> = Alvo ({log.statValue + log.modifier!.value})</span>}
                                </span>
                            )}{' '}
                            <span className="text-emerald-700">rolando</span> <span className="font-bold text-zinc-300">{log.roll.toString().padStart(isPanic ? 1 : 2, '0')}</span>{' '}
                            {'=>'} <span className={`uppercase ${getResultColor(log.result)}`}>{log.result}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
