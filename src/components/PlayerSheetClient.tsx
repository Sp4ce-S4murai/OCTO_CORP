"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { subscribeToPlayer, updatePlayer, updatePlayerNested, createEmptyCharacter, createPlayer, submitInitiative, nextTurn } from "@/lib/database";
import { CharacterSheet, EncounterState } from "@/types/character";
import { Lock, Unlock, User, Upload, Swords, AlertTriangle, Crosshair, Download, UploadCloud } from "lucide-react";
import { DiceCalculator } from "./DiceCalculator";
import { TerminalLog } from "./TerminalLog";
import { ClassSelector } from "./ClassSelector";
import { SkillTreeSelector } from "./SkillTreeSelector";
import { HeartRateMonitor } from "./HeartRateMonitor";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { EnvironmentState } from "@/types/character";

export default function PlayerSheetClient({ roomId, playerId }: { roomId: string; playerId: string }) {
    const [character, setCharacter] = useState<CharacterSheet | null>(null);
    const [isRoomLocked, setIsRoomLocked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [environment, setEnvironment] = useState<EnvironmentState | undefined>(undefined);
    const [encounter, setEncounter] = useState<EncounterState | undefined>(undefined);
    const [localInitiative, setLocalInitiative] = useState("");
    const [activePlayerName, setActivePlayerName] = useState<string>("");

    useEffect(() => {
        const unsubscribe = subscribeToPlayer(roomId, playerId, (data) => {
            if (data) {
                setCharacter(data);
            } else {
                // Auto-create if not exists based on URL parameter topology constraint
                const newChar = createEmptyCharacter(playerId, playerId);
                createPlayer(roomId, newChar).then(() => {
                    setCharacter(newChar);
                });
            }
            setLoading(false);
        });

        // Listen for Room Lockdown State & Environment Telemetry
        import("@/lib/firebase").then(({ database }) => {
            import("firebase/database").then(({ ref, onValue }) => {
                onValue(ref(database, `rooms/${roomId}/isLocked`), (snap) => {
                    setIsRoomLocked(snap.val() || false);
                });

                onValue(ref(database, `rooms/${roomId}/environment`), (snap) => {
                    setEnvironment(snap.val());
                });

                onValue(ref(database, `rooms/${roomId}/encounter`), (snap) => {
                    setEncounter(snap.val());
                });
            });
        });

        return () => unsubscribe();
    }, [roomId, playerId]);

    // Fetch active player name during combat
    useEffect(() => {
        let unsubscribeName: (() => void) | undefined;

        if (encounter?.isActive && encounter.status === 'active' && encounter.turnOrder?.length > 0) {
            const activeId = encounter.turnOrder[encounter.currentTurnIndex];

            if (activeId === playerId && character?.name) {
                setActivePlayerName(character.name);
            } else {
                import("@/lib/firebase").then(({ database }) => {
                    import("firebase/database").then(({ ref, onValue }) => {
                        const nameRef = ref(database, `rooms/${roomId}/players/${activeId}/name`);
                        unsubscribeName = onValue(nameRef, (snap) => {
                            setActivePlayerName(snap.val() || "Desconhecido");
                        });
                    });
                });
            }
        }

        return () => {
            if (unsubscribeName) unsubscribeName();
        };
    }, [roomId, playerId, character?.name, encounter?.isActive, encounter?.status, encounter?.turnOrder, encounter?.currentTurnIndex]);

    const handleUpdate = (path: string, value: any) => {
        if (!character || isRoomLocked) return;

        if (path.startsWith("baseStats/") || path.startsWith("baseSaves/")) {
            const updates: any = { [path]: value };

            if (path.startsWith("baseStats/")) {
                const stat = path.split("/")[1] as keyof typeof character.stats;
                updates[`stats/${stat}`] = Number(value) + (character.classMods?.[stat] || 0);
            } else if (path.startsWith("baseSaves/")) {
                const save = path.split("/")[1] as keyof typeof character.saves;
                updates[`saves/${save}`] = Number(value) + (character.classSaveMods?.[save] || 0);
            }

            updatePlayer(roomId, playerId, updates);
        } else {
            updatePlayerNested(roomId, playerId, path, value);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isRoomLocked || isDead) return;
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 300;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Compress heavily into WebP to save Firebase Realtime DB Bandwidth
                const dataUrl = canvas.toDataURL("image/webp", 0.7);
                handleUpdate("avatarUrl", dataUrl);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleExport = () => {
        if (!character) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(character, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${character.name || 'Ficha'}_${playerId}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);

                // Preserve the ID of this room's slot to avoid sync issues
                parsed.id = playerId;

                // Sync the entirely new character to Firebase
                createPlayer(roomId, parsed).then(() => {
                    alert("Ficha importada com sucesso!");
                });
            } catch (error) {
                console.error("Failed to parse JSON file", error);
                alert("O arquivo não é uma ficha válida do O.C.T.O. VTT.");
            }
        };
        reader.readAsText(file);

        // Clear input to allow re-importing same file if desired
        e.target.value = "";
    };

    if (loading || !character) {
        return <div className="animate-pulse flex p-4 text-emerald-500/50">Carregando Conexão Neural...</div>;
    }

    const isDead = character.vitals.wounds.current >= character.vitals.wounds.max;

    // Combat / Encounter Logic
    const isEncounterActive = encounter?.isActive;
    const isRollingInitiative = isEncounterActive && encounter?.status === 'rolling';
    const hasRolledInitiative = isRollingInitiative && encounter?.initiatives?.[playerId] !== undefined;

    const isMyTurn = isEncounterActive && encounter?.status === 'active' && encounter.turnOrder[encounter.currentTurnIndex] === playerId;

    const handleSubmitInitiative = () => {
        const val = parseInt(localInitiative);
        if (!isNaN(val)) {
            submitInitiative(roomId, playerId, val);
        }
    };

    const handleEndTurn = () => {
        if (!encounter) return;
        nextTurn(roomId, encounter);
    };

    const getAvatarFilterState = () => {
        if (isDead) return 'avatar-filter-critical grayscale opacity-50';
        if (character.vitals.health.current <= 3) return 'avatar-filter-critical';
        if (character.vitals.health.current <= 6) return 'avatar-filter-warning';
        return 'avatar-filter-normal';
    };

    // Global Theme Override based on Combat Turn
    const activeBorderTheme = isMyTurn ? 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]' : (isDead ? 'border-red-900 bg-red-950/20' : 'border-emerald-900 bg-zinc-950/80');

    return (
        <main className={`max-w-4xl mx-auto border-2 ${activeBorderTheme} p-6 rounded-sm shadow-2xl relative overflow-hidden transition-all duration-500`}>
            {/* INITIATIVE POPUP OVERLAY */}
            {!isDead && isRollingInitiative && !hasRolledInitiative && (
                <div className="absolute inset-0 bg-zinc-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-blue-950/30 border-2 border-blue-500 p-8 flex flex-col items-center gap-6 max-w-md w-full shadow-[0_0_50px_rgba(59,130,246,0.2)]">
                        <AlertTriangle size={48} className="text-blue-500 animate-pulse" />
                        <h2 className="text-2xl font-bold uppercase tracking-widest text-blue-400 text-center">Protocolo de Combate Iniciado</h2>
                        <p className="text-blue-200/70 text-center text-sm">Insira seu valor de iniciativa rolado nos dados para entrar na fila de turnos.</p>

                        <input
                            type="number"
                            className="bg-zinc-950 border-2 border-blue-500 text-blue-400 text-4xl text-center p-4 w-32 outline-none focus:border-blue-300 focus:bg-blue-950/50"
                            placeholder="0"
                            value={localInitiative}
                            onChange={(e) => setLocalInitiative(e.target.value)}
                            autoFocus
                        />

                        <button
                            onClick={handleSubmitInitiative}
                            disabled={!localInitiative}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest py-4 border-2 border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Confirmar Iniciativa
                        </button>
                    </div>
                </div>
            )}

            {isDead && (
                <div className="absolute inset-0 bg-red-950/40 z-10 pointer-events-none flex items-center justify-center">
                    <div className="text-red-500 font-bold text-6xl md:text-9xl opacity-20 rotate-[-15deg] uppercase tracking-widest border-y-8 border-red-500/20 py-4 mix-blend-overlay">
                        O B I T O
                    </div>
                </div>
            )}

            {isRoomLocked && !isDead && (
                <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-red-950/80 border border-red-900 text-red-500 px-3 py-1 text-xs font-bold tracking-widest animate-pulse">
                    <Lock size={14} /> FICHAS TRAVADAS PELO DIRETOR
                </div>
            )}

            {!isDead && (
                <EnvironmentPanel environment={environment} vitals={character.vitals} isDead={isDead} />
            )}

            {/* MY TURN BANNER */}
            {isMyTurn && (
                <div className="bg-blue-600 text-white font-bold p-3 text-center uppercase tracking-[0.3em] shadow-[0_0_20px_rgba(59,130,246,0.5)] animate-pulse flex items-center justify-center gap-4 mb-6">
                    <Crosshair size={24} /> É O SEU TURNO <Crosshair size={24} />
                </div>
            )}

            {/* ENCOUNTER STATUS BAR (NOT MY TURN) */}
            {!isMyTurn && isEncounterActive && encounter.status === 'active' && !isDead && (
                <div className="bg-blue-950/50 border border-blue-900/50 text-blue-400 p-2 text-center text-xs tracking-widest uppercase mb-6 flex items-center justify-center gap-2">
                    <Swords size={14} /> Combate Ativo - Aguarde seu turno (Rodada {encounter.round}) - Turno de: {activePlayerName}
                </div>
            )}

            <header className={`border-b-2 ${isMyTurn ? 'border-blue-500' : (isDead ? 'border-red-900' : 'border-emerald-900')} pb-4 mb-6 relative z-20`}>
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* AVATAR BOX (3x4 aspect ratio aprox) */}
                    <div className="w-32 h-40 shrink-0 border border-emerald-900 bg-zinc-950 flex flex-col items-center justify-center relative group overflow-hidden scanline-overlay">
                        {character.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={character.avatarUrl} alt="Avatar" className={`w-full h-full object-cover ${getAvatarFilterState()}`} />
                        ) : (
                            <User size={48} className={`opacity-20 ${isDead ? 'text-red-500' : 'text-emerald-500'}`} />
                        )}

                        {/* Hover Overlay for Upload */}
                        {!isRoomLocked && !isDead && (
                            <label className="absolute inset-0 bg-zinc-950/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                                <Upload size={24} className="text-emerald-500 mb-2" />
                                <span className="text-[10px] text-emerald-500 text-center font-bold tracking-widest uppercase px-2 hover:text-emerald-300">
                                    Substituir ID
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                />
                            </label>
                        )}
                    </div>

                    {/* IDENTITY INFO */}
                    <div className="flex-1 w-full">
                        <div className="flex justify-between items-start gap-4 flex-col sm:flex-row">
                            <h1 className={`text-2xl font-bold uppercase tracking-widest ${isMyTurn ? 'text-blue-400' : (isDead ? 'text-red-500' : 'text-emerald-400')}`}>
                                Terminal MOTHERSHIP // {roomId} {isDead && "[ SINAL PERDIDO ]"}
                            </h1>
                            {!isRoomLocked && !isDead && (
                                <div className="flex gap-2 self-end sm:self-start">
                                    <label className="cursor-pointer bg-zinc-900 border border-emerald-900/50 p-2 hover:bg-emerald-950/50 hover:text-emerald-300 text-emerald-600 transition-colors" title="Importar Ficha do Computador">
                                        <UploadCloud size={18} />
                                        <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                                    </label>
                                    <button onClick={handleExport} className="bg-zinc-900 border border-emerald-900/50 p-2 hover:bg-emerald-950/50 hover:text-emerald-300 text-emerald-600 transition-colors" title="Exportar Ficha para o Computador">
                                        <Download size={18} />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InputGroup label="NOME" value={character.name} onChange={(v) => handleUpdate("name", v)} disabled={isRoomLocked || isDead} />
                            <InputGroup label="PRONOMES" value={character.pronouns} onChange={(v) => handleUpdate("pronouns", v)} disabled={isRoomLocked || isDead} />
                        </div>
                    </div>
                </div>
            </header>

            <ClassSelector roomId={roomId} character={character} />

            {/* STATS & SAVES */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                    <h2 className="text-xl border-b border-emerald-900/50 pb-2 mb-4">ATRIBUTOS</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <StatBox label="FORÇA" value={character.stats.strength} baseValue={character.baseStats.strength} path="baseStats/strength" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                        <StatBox label="RAPIDEZ" value={character.stats.speed} baseValue={character.baseStats.speed} path="baseStats/speed" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                        <StatBox label="INTELECTO" value={character.stats.intellect} baseValue={character.baseStats.intellect} path="baseStats/intellect" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                        <StatBox label="COMBATE" value={character.stats.combat} baseValue={character.baseStats.combat} path="baseStats/combat" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                    </div>
                </div>
                <div>
                    <h2 className="text-xl border-b border-emerald-900/50 pb-2 mb-4">RESISTÊNCIAS</h2>
                    <div className="grid grid-cols-1 gap-4">
                        <StatBox label="SANIDADE" value={character.saves.sanity} baseValue={character.baseSaves.sanity} path="baseSaves/sanity" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                        <StatBox label="MEDO" value={character.saves.fear} baseValue={character.baseSaves.fear} path="baseSaves/fear" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                        <StatBox label="CORPO" value={character.saves.body} baseValue={character.baseSaves.body} path="baseSaves/body" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                    </div>
                </div>
            </section>

            {/* VITALS */}
            <section className="mb-8 relative z-20">
                <div className="flex justify-between items-end border-b border-emerald-900/50 pb-2 mb-4">
                    <h2 className="text-xl">VITAIS</h2>
                    <div className="w-48 lg:w-64">
                        <HeartRateMonitor currentHp={character.vitals.health.current} maxHp={character.vitals.health.max} stress={character.vitals.stress.current} isDead={isDead} />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <VitalBox
                        label="SAÚDE"
                        current={character.vitals.health.current}
                        max={character.vitals.health.max}
                        path="vitals/health"
                        onUpdate={handleUpdate}
                        type="health"
                        disabled={isRoomLocked || isDead}
                    />
                    <VitalBox
                        label="FERIDAS"
                        current={character.vitals.wounds.current}
                        max={character.vitals.wounds.max}
                        path="vitals/wounds"
                        onUpdate={handleUpdate}
                        type="wounds"
                        disabled={isRoomLocked || isDead}
                    />
                    <div className="bg-zinc-900/50 border border-emerald-900/50 p-4">
                        <div className="text-sm text-emerald-600 mb-2">STRESS</div>
                        <div className="flex gap-2 items-center">
                            <input
                                disabled={isRoomLocked || isDead}
                                type="number"
                                className="w-16 bg-transparent border-b border-emerald-800 text-xl text-amber-500 outline-none text-center disabled:opacity-50"
                                value={character.vitals.stress.current || 0}
                                onChange={(e) => handleUpdate("vitals/stress/current", Number(e.target.value))}
                            />
                            <span className="text-emerald-800">/ Mão:</span>
                            <input
                                disabled={isRoomLocked || isDead}
                                type="number"
                                className="w-16 bg-transparent border-b border-emerald-800 text-xl outline-none text-center disabled:opacity-50"
                                value={character.vitals.stress.min || 0}
                                onChange={(e) => handleUpdate("vitals/stress/min", Number(e.target.value))}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* MODULE: TOOLS & LOGS */}
            <SkillTreeSelector roomId={roomId} character={character} />

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <DiceCalculator roomId={roomId} character={character} />
                <TerminalLog roomId={roomId} />
            </section>

            {/* END TURN STICKY BUTTON */}
            {isMyTurn && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950/90 border-t-2 border-blue-500 flex justify-center z-[100] backdrop-blur-sm">
                    <button
                        onClick={handleEndTurn}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-4 font-bold uppercase tracking-widest text-lg border-2 border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.6)]"
                    >
                        ENCERRAR MEU TURNO
                    </button>
                </div>
            )}
        </main>
    );
}

// Helpers
function InputGroup({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
    const [local, setLocal] = useState(value);
    const timeoutRef = useRef<any>(null);

    useEffect(() => {
        setLocal(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocal(e.target.value);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => onChange(e.target.value), 500);
    };

    return (
        <div className="flex flex-col">
            <label className="text-xs text-emerald-700 mb-1">{label}</label>
            <input
                disabled={disabled}
                type="text"
                value={local}
                onChange={handleChange}
                className="bg-transparent border-b border-emerald-800 text-emerald-300 outline-none focus:border-emerald-400 focus:bg-emerald-950/20 px-1 py-1 uppercase disabled:opacity-50"
            />
        </div>
    );
}

function StatBox({ label, value, baseValue, path, onUpdate, disabled }: { label: string; value: number; baseValue: number; path: string; onUpdate: (p: string, v: number) => void; disabled?: boolean }) {
    const isModified = value !== baseValue;
    const [isComponentLocked, setIsComponentLocked] = useState(true);

    const isLocked = isComponentLocked || disabled;

    return (
        <div className="bg-zinc-900/50 border border-emerald-900/50 p-2 flex flex-col group hover:border-emerald-500 transition-colors relative">
            {disabled && <div className="absolute inset-0 z-10 cursor-not-allowed"></div>}
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-emerald-600 group-hover:text-emerald-400">{label}</span>
                <button onClick={() => setIsComponentLocked(!isComponentLocked)} className={`text-emerald-800 transition-colors ${disabled ? 'opacity-50' : 'hover:text-amber-500'}`} disabled={disabled}>
                    {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
            </div>
            <div className="flex justify-between items-center w-full">
                <div className="flex flex-col">
                    <span className="text-[10px] text-emerald-700/50 uppercase leading-none mb-1">Base</span>
                    <input
                        type="number"
                        value={baseValue || 0}
                        onChange={(e) => onUpdate(path, Number(e.target.value))}
                        disabled={isLocked}
                        className={`w-14 bg-zinc-950 border border-emerald-900 text-center text-sm outline-none font-mono focus:border-emerald-500 ${isLocked ? 'text-emerald-800/50 cursor-not-allowed' : 'text-amber-400'} disabled:bg-zinc-900/10`}
                        title="Atributo Base (S/ Classe)"
                    />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-emerald-700/50 uppercase leading-none mb-1">Total</span>
                    <div className={`text-2xl font-bold pr-2 ${isModified ? 'text-emerald-300' : 'text-emerald-500'}`} title="Resultado Modificado pela Classe">
                        {value || 0}
                    </div>
                </div>
            </div>
        </div>
    );
}

function VitalBox({ label, current, max, path, onUpdate, type, disabled }: { label: string; current: number; max: number; path: string; onUpdate: (p: string, v: number) => void; type?: 'health' | 'wounds'; disabled?: boolean }) {
    // Pulse logic for health
    let pulseClass = "";
    if (type === 'health') {
        if (current <= 3 && current > 0) {
            pulseClass = "animate-pulse border-red-500 bg-red-950/20";
        } else if (current <= 6 && current > 3) {
            pulseClass = "animate-pulse border-amber-500 bg-amber-950/20";
        }
    }

    // Death logic styling
    const isDead = type === 'wounds' && current >= max;
    if (isDead) {
        pulseClass = "border-red-600 bg-red-950/40 text-red-500";
    }

    return (
        <div className={`border p-4 transition-colors relative ${pulseClass ? pulseClass : 'bg-zinc-900/50 border-emerald-900/50'}`}>
            {disabled && <div className="absolute inset-0 z-10 cursor-not-allowed"></div>}
            <div className={`text-sm mb-2 ${pulseClass && type === 'health' ? (current <= 3 ? 'text-red-500 font-bold' : 'text-amber-500 font-bold') : isDead ? 'text-red-500 font-bold' : 'text-emerald-600'}`}>{label} {isDead && "(CRÍTICO)"}</div>
            <div className="flex gap-2 items-center">
                <input
                    disabled={disabled}
                    type="number"
                    className={`w-16 bg-transparent border-b text-xl outline-none text-center disabled:opacity-50 ${pulseClass && type === 'health' ? (current <= 3 ? 'border-red-800 text-red-400' : 'border-amber-800 text-amber-400') : isDead ? 'border-red-800 text-red-400 font-bold' : 'border-emerald-800 text-emerald-400'}`}
                    value={current || 0}
                    onChange={(e) => onUpdate(`${path}/current`, Number(e.target.value))}
                />
                <span className={pulseClass ? (current <= 3 || isDead ? 'text-red-800' : 'text-amber-800') : "text-emerald-800"}>/</span>
                <input
                    disabled={disabled}
                    type="number"
                    className={`w-16 bg-transparent border-b text-xl outline-none text-center disabled:opacity-50 ${pulseClass ? (current <= 3 || isDead ? 'border-red-800 text-red-700' : 'border-amber-800 text-amber-700') : 'border-emerald-800 text-emerald-700'}`}
                    value={max || 0}
                    onChange={(e) => onUpdate(`${path}/max`, Number(e.target.value))}
                />
            </div>
        </div>
    );
}
