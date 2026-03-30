"use client";

import { useEffect, useState, useRef } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue, query, orderByChild, limitToLast } from "firebase/database";
import { RollLog } from "@/types/character";

export function TerminalLog({ roomId, heightClass = "h-64" }: { roomId: string, heightClass?: string }) {
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
            case 'Warden Damage': return 'text-red-500 font-bold bg-red-950/80 px-2';
            case 'Warden Stress': return 'text-amber-500 font-bold bg-amber-950/80 px-2';
            case 'Warden Message': return 'text-cyan-400 font-bold';
            // Ship combat events
            case 'Ship Fire': return 'text-orange-400 font-bold bg-orange-950/60 px-1';
            case 'Ship Evade': return 'text-sky-400 font-bold bg-sky-950/60 px-1';
            case 'Ship Repair': return 'text-amber-300 font-bold bg-amber-950/40 px-1';
            case 'Ship Scan': return 'text-violet-400 font-bold bg-violet-950/40 px-1';
            case 'Ship Damage': return 'text-red-400 bg-red-950/40 px-1';
            case 'Ship Critical': return 'text-red-500 font-bold bg-red-900/50 px-2 animate-pulse';
            case 'System Failure': return 'text-red-600 font-bold bg-red-950/80 px-2';
            case 'Tabela de Pânico': return 'text-amber-400 font-bold bg-amber-900/40 px-1';
            default: return 'text-zinc-500';
        }
    };

    return (
        <div className={`bg-zinc-950 border border-emerald-900 p-4 ${heightClass} flex flex-col font-mono text-xs shadow-inner shadow-black/50 overflow-hidden`}>
            <div className="text-emerald-700 text-[10px] mb-2 border-b border-emerald-900/50 pb-1 flex justify-between uppercase tracking-widest">
                <span>COMMLINK_UPLINK::SECTOR_{roomId}</span>
                <span className="animate-pulse">REC</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1" ref={scrollRef}>
                {logs.length === 0 && <div className="text-emerald-900">Aguardando telemetria...</div>}
                {logs.map(log => {
                    const isPanic = log.result.includes('Panic');
                    const isWarden = log.result.includes('Warden Damage') || log.result.includes('Warden Stress');
                    const isWardenMsg = log.result === 'Warden Message';
                    const isShipEvent = log.result.startsWith('Ship ') || log.result === 'System Failure' || log.result === 'Tabela de Pânico';
                    const hasMod = !!log.modifier;

                    if (isWardenMsg) {
                        return (
                            <div key={log.id} className="border-l-2 pl-2 py-1 border-cyan-900/50 bg-cyan-950/10 mb-1">
                                <span className="text-cyan-600/70 text-[10px]">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                                <span className="text-cyan-300 italic">&quot;{log.statName}&quot;</span>
                            </div>
                        );
                    }

                    // Last Words rendering
                    if (log.result === 'Last Words') {
                        return (
                            <div key={log.id} className="border-l-4 border-red-600 pl-3 py-3 mb-2 bg-red-950/20 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-2 h-2 text-red-500/20">💀</div>
                                <span className="text-red-500/70 text-[10px] uppercase font-bold tracking-widest block mb-1">
                                    [{new Date(log.timestamp).toLocaleTimeString()}] ÓBITO REGISTRADO: {log.playerName}
                                </span>
                                <span className="text-zinc-300 font-mono italic">
                                    "{log.customMessage}"
                                </span>
                            </div>
                        );
                    }

                    // Ship combat event rendering
                    if (isShipEvent) {
                        const shipIcon = (() => {
                            switch (log.result) {
                                case 'Ship Fire': return '🔥';
                                case 'Ship Evade': return '💨';
                                case 'Ship Scan': return '🔍';
                                case 'Ship Repair': return '🔧';
                                case 'Ship Damage': return '💥';
                                case 'Ship Critical': return '💀';
                                case 'System Failure': return '⚠️';
                                case 'Tabela de Pânico': return '🧠';
                                default: return '🚀';
                            }
                        })();
                        const shipBorder = (() => {
                            switch (log.result) {
                                case 'Ship Fire': return 'border-orange-600/50 bg-orange-950/10';
                                case 'Ship Evade': return 'border-sky-600/50 bg-sky-950/10';
                                case 'Ship Scan': return 'border-violet-600/50 bg-violet-950/10';
                                case 'Ship Repair': return 'border-amber-600/50 bg-amber-950/10';
                                case 'Ship Damage': return 'border-red-900/50 bg-red-950/10';
                                case 'Ship Critical': return 'border-red-500/80 bg-red-950/20';
                                case 'System Failure': return 'border-red-700/80 bg-red-950/20';
                                case 'Tabela de Pânico': return 'border-amber-600/50 bg-amber-950/10';
                                default: return 'border-zinc-800/50';
                            }
                        })();
                        return (
                            <div key={log.id} className={`border-l-2 pl-2 py-1 mb-1 ${shipBorder}`}>
                                <span className="text-emerald-600/70 text-[10px]">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                                <span className="text-[10px]">{shipIcon}</span>{' '}
                                <span className="text-zinc-400 font-bold">NAVE:</span>{' '}
                                <span className="text-emerald-400 font-bold">{log.playerName}</span>{' '}
                                <span className="text-zinc-500">{log.statName}</span>{' '}
                                {log.roll > 0 && <><span className="text-emerald-700">rolou</span> <span className="font-bold text-zinc-300">{log.roll.toString().padStart(2, '0')}</span>{' '}</>}
                                {'=> '}<span className={`uppercase ${getResultColor(log.result)}`}>{log.result}</span>
                            </div>
                        );
                    }

                    return (
                        <div key={log.id} className={`border-l-2 pl-2 py-1 mb-1 ${isPanic ? 'border-amber-600/50 bg-amber-950/10' : isWarden ? 'border-red-900/80' : 'border-emerald-900/30'}`}>
                            <span className="text-emerald-600/70 text-[10px]">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}

                            {isWarden ? (
                                <>
                                    <span className="text-red-500 font-bold">Warden Override:</span>{' '}
                                    <span className="text-emerald-500">Alvo {log.playerName} sofreu </span>
                                    <span className="text-zinc-300 font-bold">{log.statValue}</span>{' '}
                                    <span className={`uppercase ${getResultColor(log.result)}`}>{log.statName}</span>
                                </>
                            ) : (
                                <>
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
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
