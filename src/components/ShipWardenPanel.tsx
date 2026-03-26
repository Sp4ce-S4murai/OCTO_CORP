"use client";

import { useState } from "react";
import { ShipState, SHIP_PRESETS, ENEMY_PRESETS, ShipTemplate, EnemyShip } from "@/types/ship";
import { createShip, deleteShip, addEnemyShip, removeEnemyShip, applyShipDamage, damageSystem, drainResource, startShipCombat, endShipCombat, advanceShipPhase, updateShipField, pushShipAlert, clearAlerts, refillResource } from "@/lib/shipDatabase";
import { pushLog } from "@/lib/database";
import { Shield, Trash2, Plus, Crosshair, Zap, AlertTriangle, Play, Square, SkipForward, Fuel, Wind, CircleDot, Wrench } from "lucide-react";

interface ShipWardenPanelProps {
    roomId: string;
    ship: ShipState | null;
}

export function ShipWardenPanel({ roomId, ship }: ShipWardenPanelProps) {
    const [selectedPreset, setSelectedPreset] = useState<string>(Object.keys(SHIP_PRESETS)[0]);
    const [customName, setCustomName] = useState("");
    const [selectedEnemyPreset, setSelectedEnemyPreset] = useState<string>(Object.keys(ENEMY_PRESETS)[0]);
    const [manualDamage, setManualDamage] = useState("");
    const [drainAmount, setDrainAmount] = useState("10");

    const handleCreateShip = () => {
        const template = SHIP_PRESETS[selectedPreset];
        if (!template) return;
        const finalTemplate: ShipTemplate = {
            ...template,
            name: customName.trim() || template.name,
        };
        createShip(roomId, finalTemplate);
        setCustomName("");
        pushLog(roomId, {
            timestamp: Date.now(),
            playerName: "SISTEMA",
            playerId: "SYSTEM",
            statName: `NAVE COMISSIONADA: ${finalTemplate.name} (${finalTemplate.class})`,
            statValue: 0, roll: 0, result: 'Warden Message'
        });
    };

    const handleDeleteShip = () => {
        deleteShip(roomId);
        pushLog(roomId, {
            timestamp: Date.now(),
            playerName: "SISTEMA",
            playerId: "SYSTEM",
            statName: 'NAVE DESCOMISSIONADA',
            statValue: 0, roll: 0, result: 'Warden Message'
        });
    };

    const handleAddEnemy = () => {
        const preset = ENEMY_PRESETS[selectedEnemyPreset];
        if (!preset) return;
        addEnemyShip(roomId, preset);
        pushLog(roomId, {
            timestamp: Date.now(),
            playerName: "SISTEMA NAVE",
            playerId: "SHIP",
            statName: `CONTATO HOSTIL DETECTADO: ${preset.name}`,
            statValue: 0, roll: 0, result: 'Ship Damage'
        });
    };

    const handleApplyDamage = () => {
        const dmg = parseInt(manualDamage);
        if (isNaN(dmg) || dmg <= 0) return;
        applyShipDamage(roomId, dmg, "Dano Manual do Diretor");
        setManualDamage("");
    };

    const handleDrainResource = (resource: string) => {
        const amount = parseInt(drainAmount);
        if (isNaN(amount) || amount <= 0) return;
        drainResource(roomId, resource, amount);
    };

    const handleForceCollectivePanic = () => {
        pushShipAlert(roomId, 'catastrophic', 'TESTE DE PÂNICO COLETIVO — ORDEM DO DIRETOR');
        pushLog(roomId, {
            timestamp: Date.now(),
            playerName: "SISTEMA",
            playerId: "SYSTEM",
            statName: 'PÂNICO COLETIVO: TODOS OS TRIPULANTES',
            statValue: 0, roll: 0, result: 'Warden Panic'
        });
    };

    const SYSTEM_NAMES: Record<string, string> = {
        propulsion: 'Propulsão', lifeSupport: 'Suporte de Vida',
        weapons: 'Armamento', sensors: 'Sensores'
    };

    const CRITICAL_EVENTS = [
        { label: '💥 Brecha no Casco', action: () => { drainResource(roomId, 'oxygen', 20); pushShipAlert(roomId, 'catastrophic', 'BRECHA NO CASCO — PERDA DE ATMOSFERA'); } },
        { label: '🔥 Falha de Propulsão', action: () => { damageSystem(roomId, 'propulsion', 60); } },
        { label: '⚡ Curto no Armamento', action: () => { damageSystem(roomId, 'weapons', 50); applyShipDamage(roomId, 5, 'Curto-Circuito Interno'); } },
        { label: '📡 Colapso de Sensores', action: () => { damageSystem(roomId, 'sensors', 70); } },
        { label: '⛽ Vazamento de Combustível', action: () => { drainResource(roomId, 'fuel', 30); pushShipAlert(roomId, 'critical', 'VAZAMENTO DE COMBUSTÍVEL DETECTADO'); } },
        { label: '💀 Falha no Suporte de Vida', action: () => { damageSystem(roomId, 'lifeSupport', 60); handleForceCollectivePanic(); } },
    ];

    // --- NO SHIP: Creation UI ---
    if (!ship) {
        return (
            <section className="bg-zinc-950/80 border border-cyan-900/50 p-6 flex flex-col gap-4">
                <h2 className="text-xl font-bold tracking-widest text-cyan-500 flex items-center gap-2 uppercase">
                    <Shield size={24} /> COMISSIONAMENTO DE NAVE
                </h2>
                <div className="flex flex-wrap gap-3 items-end">
                    <label className="flex flex-col">
                        <span className="text-xs text-cyan-600 mb-1 uppercase font-bold tracking-widest">Classe</span>
                        <select
                            value={selectedPreset}
                            onChange={e => setSelectedPreset(e.target.value)}
                            className="bg-zinc-950 border border-cyan-900 text-cyan-300 p-2 text-sm outline-none"
                        >
                            {Object.keys(SHIP_PRESETS).map(key => (
                                <option key={key} value={key}>{key}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col flex-1 min-w-[200px]">
                        <span className="text-xs text-cyan-600 mb-1 uppercase font-bold tracking-widest">Nome (Opcional)</span>
                        <input
                            type="text"
                            placeholder={SHIP_PRESETS[selectedPreset]?.name || "Nome da Nave"}
                            value={customName}
                            onChange={e => setCustomName(e.target.value)}
                            className="bg-zinc-950 border border-cyan-900 text-cyan-300 p-2 text-sm outline-none"
                        />
                    </label>
                    <button
                        onClick={handleCreateShip}
                        className="bg-cyan-950/50 hover:bg-cyan-900 text-cyan-400 border border-cyan-800 px-6 py-2 font-bold tracking-widest flex items-center gap-2 transition-colors uppercase"
                    >
                        <Plus size={16} /> COMISSIONAR
                    </button>
                </div>
            </section>
        );
    }

    // --- SHIP ACTIVE: Management Panel ---
    return (
        <section className="bg-zinc-950/80 border border-cyan-900/50 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold tracking-widest text-cyan-500 flex items-center gap-2 uppercase">
                    <Shield size={24} /> COMANDO DA NAVE: {ship.name}
                </h2>
                <button
                    onClick={handleDeleteShip}
                    className="bg-red-950/50 hover:bg-red-900 text-red-500 border border-red-900 px-4 py-2 text-xs font-bold tracking-widest flex items-center gap-2 transition-colors uppercase"
                >
                    <Trash2 size={14} /> DESCOMISSIONAR
                </button>
            </div>

            {/* COMBAT CONTROLS */}
            <div className="border border-red-900/30 bg-red-950/10 p-4 flex flex-col gap-3">
                <h3 className="text-sm font-bold tracking-widest text-red-500 uppercase flex items-center gap-2">
                    <Crosshair size={16} /> CONTROLE DE COMBATE ESPACIAL
                </h3>
                <div className="flex flex-wrap gap-2">
                    {!ship.combat?.isActive ? (
                        <button onClick={() => startShipCombat(roomId)} disabled={!ship.enemies || Object.keys(ship.enemies).length === 0}
                            className="bg-red-950/50 hover:bg-red-900 text-red-400 border border-red-800 px-4 py-2 text-xs font-bold tracking-widest flex items-center gap-2 transition-colors uppercase disabled:opacity-30 disabled:cursor-not-allowed">
                            <Play size={14} /> INICIAR COMBATE
                        </button>
                    ) : (
                        <>
                            <button onClick={() => advanceShipPhase(roomId)}
                                className="bg-amber-950/50 hover:bg-amber-900 text-amber-400 border border-amber-800 px-4 py-2 text-xs font-bold tracking-widest flex items-center gap-2 transition-colors uppercase">
                                <SkipForward size={14} /> AVANÇAR FASE
                            </button>
                            <button onClick={() => endShipCombat(roomId)}
                                className="bg-red-950/50 hover:bg-red-900 text-red-500 border border-red-900 px-4 py-2 text-xs font-bold tracking-widest flex items-center gap-2 transition-colors uppercase">
                                <Square size={14} /> ENCERRAR COMBATE
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ENEMY MANAGEMENT */}
            <div className="border border-orange-900/30 bg-orange-950/10 p-4 flex flex-col gap-3">
                <h3 className="text-sm font-bold tracking-widest text-orange-500 uppercase flex items-center gap-2">
                    <AlertTriangle size={16} /> CONTATOS HOSTIS
                </h3>
                <div className="flex flex-wrap gap-2 items-end">
                    <select
                        value={selectedEnemyPreset}
                        onChange={e => setSelectedEnemyPreset(e.target.value)}
                        className="bg-zinc-950 border border-orange-900/50 text-orange-300 p-2 text-sm outline-none"
                    >
                        {Object.keys(ENEMY_PRESETS).map(key => (
                            <option key={key} value={key}>{key}</option>
                        ))}
                    </select>
                    <button onClick={handleAddEnemy}
                        className="bg-orange-900 text-xs px-4 py-2 text-orange-100 font-bold uppercase transition hover:bg-orange-800">
                        INSERIR INIMIGO
                    </button>
                </div>

                {ship.enemies && Object.entries(ship.enemies).map(([eid, enemy]) => (
                    <div key={eid} className="flex items-center justify-between bg-zinc-950 border border-orange-900/30 px-3 py-2">
                        <div className="flex items-center gap-2">
                            <span>{enemy.icon}</span>
                            <span className="text-xs font-bold text-orange-400 uppercase">{enemy.name}</span>
                            <span className="text-[10px] text-orange-700 font-mono">HP:{enemy.hp.current}/{enemy.hp.max} AR:{enemy.stats.armor} CBT:{enemy.stats.combat}</span>
                        </div>
                        <button onClick={() => removeEnemyShip(roomId, eid)} className="text-red-500 hover:text-red-400">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {/* MANUAL DAMAGE */}
            <div className="flex flex-wrap gap-4">
                <div className="border border-red-900/30 bg-red-950/10 p-4 flex-1 min-w-[250px]">
                    <h3 className="text-xs font-bold tracking-widest text-red-500 uppercase mb-2 flex items-center gap-2">
                        <Zap size={14} /> DANO MANUAL NO CASCO
                    </h3>
                    <div className="flex gap-2">
                        <input type="number" placeholder="Dano" value={manualDamage} onChange={e => setManualDamage(e.target.value)}
                            className="bg-zinc-950 border border-red-900/50 text-red-300 p-2 text-sm outline-none w-20" />
                        <button onClick={handleApplyDamage}
                            className="bg-red-900 text-xs px-4 py-2 text-red-100 font-bold uppercase transition hover:bg-red-800">
                            APLICAR
                        </button>
                    </div>
                </div>

                <div className="border border-amber-900/30 bg-amber-950/10 p-4 flex-1 min-w-[250px]">
                    <h3 className="text-xs font-bold tracking-widest text-amber-500 uppercase mb-2 flex items-center gap-2">
                        <Fuel size={14} /> DRENAR RECURSO
                    </h3>
                    <div className="flex gap-2 items-center flex-wrap">
                        <input type="number" placeholder="Qtd" value={drainAmount} onChange={e => setDrainAmount(e.target.value)}
                            className="bg-zinc-950 border border-amber-900/50 text-amber-300 p-2 text-sm outline-none w-16" />
                        <button onClick={() => handleDrainResource('fuel')} className="bg-amber-900/50 text-[10px] px-3 py-2 text-amber-200 font-bold uppercase hover:bg-amber-800">COMB</button>
                        <button onClick={() => handleDrainResource('oxygen')} className="bg-cyan-900/50 text-[10px] px-3 py-2 text-cyan-200 font-bold uppercase hover:bg-cyan-800">O₂</button>
                        <button onClick={() => handleDrainResource('ammo')} className="bg-red-900/50 text-[10px] px-3 py-2 text-red-200 font-bold uppercase hover:bg-red-800">MUN</button>
                    </div>
                </div>
            </div>

            {/* SYSTEM DAMAGE */}
            <div className="border border-purple-900/30 bg-purple-950/10 p-4">
                <h3 className="text-xs font-bold tracking-widest text-purple-400 uppercase mb-2 flex items-center gap-2">
                    <Wrench size={14} /> DANIFICAR SUBSISTEMA (-40% INTEGRIDADE)
                </h3>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(SYSTEM_NAMES).map(([key, name]) => (
                        <button key={key} onClick={() => damageSystem(roomId, key, 40)}
                            className={`text-[10px] px-3 py-2 font-bold uppercase transition border ${ship.systems[key as keyof typeof ship.systems]?.status === 'offline' ? 'bg-red-950 text-red-500 border-red-900 opacity-50' : 'bg-purple-950/50 text-purple-300 border-purple-800 hover:bg-purple-900'}`}>
                            {name} ({ship.systems[key as keyof typeof ship.systems]?.integrity}%)
                        </button>
                    ))}
                </div>
            </div>

            {/* CRITICAL EVENTS */}
            <div className="border border-red-600/30 bg-red-950/20 p-4">
                <h3 className="text-xs font-bold tracking-widest text-red-400 uppercase mb-2 flex items-center gap-2">
                    <AlertTriangle size={14} /> EVENTOS CRÍTICOS PRÉ-CONFIGURADOS
                </h3>
                <div className="flex flex-wrap gap-2">
                    {CRITICAL_EVENTS.map(({ label, action }) => (
                        <button key={label} onClick={action}
                            className="bg-red-950/50 hover:bg-red-900 text-red-300 border border-red-800 px-3 py-2 text-[10px] font-bold uppercase transition">
                            {label}
                        </button>
                    ))}
                </div>
                <button onClick={handleForceCollectivePanic}
                    className="mt-2 w-full bg-red-800 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest py-2 transition">
                    ☠️ FORÇAR PÂNICO COLETIVO EM TODA A TRIPULAÇÃO
                </button>
            </div>

            {/* CLEAR ALERTS */}
            <button onClick={() => clearAlerts(roomId)}
                className="text-[10px] text-zinc-600 hover:text-zinc-400 uppercase tracking-widest font-bold self-end transition">
                Limpar todos os alertas
            </button>
        </section>
    );
}
