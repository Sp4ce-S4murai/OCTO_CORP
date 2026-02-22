"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { subscribeToPlayer, updatePlayer, updatePlayerNested, createEmptyCharacter, createPlayer, submitInitiative, nextTurn, addTerminalLog } from "@/lib/database";
import { CharacterSheet, EncounterState } from "@/types/character";
import { Lock, Unlock, User, Upload, Swords, AlertTriangle, Crosshair, Download, UploadCloud, HeartPulse, ChevronDown, ChevronRight } from "lucide-react";
import { DiceCalculator } from "./DiceCalculator";
import { TerminalLog } from "./TerminalLog";
import { ClassSelector } from "./ClassSelector";
import { SkillTreeSelector } from "./SkillTreeSelector";
import { HeartRateMonitor } from "./HeartRateMonitor";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { EnvironmentState, Consequence } from "@/types/character";
import { generatePanicResult, PanicOracleOutput } from "@/lib/panicOracle";

export default function PlayerSheetClient({ roomId, playerId }: { roomId: string; playerId: string }) {
    const [character, setCharacter] = useState<CharacterSheet | null>(null);
    const [isRoomLocked, setIsRoomLocked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [environment, setEnvironment] = useState<EnvironmentState | undefined>(undefined);
    const [encounter, setEncounter] = useState<EncounterState | undefined>(undefined);
    const [localInitiative, setLocalInitiative] = useState("");
    const [activePlayerName, setActivePlayerName] = useState<string>("");

    const [showPanicModal, setShowPanicModal] = useState(false);
    const [manualPanicInput, setManualPanicInput] = useState("");
    const [panicOracleResult, setPanicOracleResult] = useState<PanicOracleOutput | null>(null);
    const [wardenAlert, setWardenAlert] = useState<{ type: 'damage' | 'stress', value: number, text: string } | null>(null);

    // Track other players in the room
    const [activePlayers, setActivePlayers] = useState<Array<{ id: string; name: string; characterClass?: string; avatarUrl?: string; hp: number; maxHp: number; stress: number }>>([]);

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

                // Listen for other players
                onValue(ref(database, `rooms/${roomId}/players`), (snap) => {
                    const playersData = snap.val();
                    if (playersData) {
                        const parsedPlayers = Object.keys(playersData)
                            .filter(id => id !== "placeholder" && id !== playerId)
                            .map(id => ({
                                id,
                                name: playersData[id]?.name || "Desconhecido",
                                characterClass: playersData[id]?.characterClass || null,
                                avatarUrl: playersData[id]?.avatarUrl,
                                hp: playersData[id]?.vitals?.health?.current || 0,
                                maxHp: playersData[id]?.vitals?.health?.max || 10,
                                stress: playersData[id]?.vitals?.stress?.current || 0
                            }));
                        setActivePlayers(parsedPlayers);
                    } else {
                        setActivePlayers([]);
                    }
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

    // Listen for Warden Damage and Stress Logs
    useEffect(() => {
        let cleanup: (() => void) | undefined;
        let initial = true;
        import("@/lib/firebase").then(({ database }) => {
            import("firebase/database").then(({ ref, query, limitToLast, onChildAdded }) => {
                const logsRef = query(ref(database, `rooms/${roomId}/logs`), limitToLast(1));

                const unsubscribe = onChildAdded(logsRef, (snap) => {
                    if (initial) {
                        initial = false;
                        return;
                    }
                    const log = snap.val();
                    if (log && log.playerId === playerId) {
                        if (log.result === 'Warden Damage') {
                            setWardenAlert({ type: 'damage', value: log.statValue, text: "DANO DIRETO RECEBIDO" });
                        } else if (log.result === 'Warden Stress') {
                            setWardenAlert({ type: 'stress', value: log.statValue, text: "ESTRESSE INJETADO" });
                        } else if (log.result === 'Warden Panic') {
                            // Warden manually triggered a panic test
                            setShowPanicModal(true);
                        }
                    }
                });
                cleanup = () => unsubscribe();
            });
        });

        return () => {
            if (cleanup) cleanup();
        };
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

    // Watch for Stress crossing or holding at Panic Threshold (20)
    const prevStressRef = useRef<number | null>(null);
    useEffect(() => {
        if (character) {
            const currentStress = character.vitals.stress.current;
            const prevStress = prevStressRef.current;

            if (prevStress !== null) {
                // Trigger when:
                // a) Stress crosses from < 20 to >= 20
                // b) Stress was already at 20 and gets hit again (same or higher value received from remote)
                const crossedThreshold = currentStress >= 20 && prevStress < 20;
                const hitAgainAtMax = currentStress >= 20 && prevStress >= 20 && currentStress !== prevStress;

                if (crossedThreshold || hitAgainAtMax) {
                    setShowPanicModal(true);
                }
            }
            prevStressRef.current = currentStress;
        }
    }, [character?.vitals.stress.current]);

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

    const handlePanicSubmit = (type: 'roll' | 'manual') => {
        let rolledD20 = 0;
        if (type === 'roll') {
            rolledD20 = Math.floor(Math.random() * 20) + 1;
        } else {
            rolledD20 = parseInt(manualPanicInput);
            if (isNaN(rolledD20)) return;
        }

        const currentStress = character?.vitals.stress.current || 20;

        // Call the Panic Oracle with the specific D20
        const oracleResult = generatePanicResult({
            stress: currentStress,
            panicStat: character?.saves.sanity || 0,
            context: "Stress atingiu Nível Crítico",
            rolledD20
        });

        setPanicOracleResult(oracleResult);
        setShowPanicModal(false);
        setManualPanicInput("");

        addTerminalLog(roomId, {
            timestamp: Date.now(),
            playerName: character?.name || "Desconhecido",
            playerId: playerId,
            statName: "SISTEMA NEURO-SINTÉTICO: TENTATIVA DE ESTABILIZAÇÃO",
            statValue: currentStress,
            roll: rolledD20,
            result: oracleResult.mechanics.is_panic ? "Panic Fail" : "Panic Success"
        });

        // Apply consequences if it failed
        if (oracleResult.mechanics.is_panic) {
            const newConsequences = [...(character?.consequences || []), ...oracleResult.mechanics.consequences_payload];

            // +1 Stress on failure (capped at 20)
            const newStress = Math.min(20, (character?.vitals.stress.current || 0) + 1);

            // Check for Auto-Kill
            const hasFatal = oracleResult.mechanics.consequences_payload.some(c => c.is_fatal);
            if (hasFatal) {
                updatePlayer(roomId, playerId, {
                    consequences: newConsequences,
                    "vitals/health/current": 0,
                    "vitals/wounds/current": character?.vitals.wounds.max || 1,
                    "vitals/stress/current": newStress
                } as any);
            } else {
                updatePlayer(roomId, playerId, {
                    consequences: newConsequences,
                    "vitals/stress/current": newStress
                } as any);
            }

            addTerminalLog(roomId, {
                timestamp: Date.now() + 1,
                playerName: "COMPUTADOR MOTHERSHIP",
                playerId: "sys",
                statName: `CONDIÇÃO: ${oracleResult.mechanics.effect_name}`,
                statValue: oracleResult.mechanics.entropy_score || 0,
                roll: 0,
                result: 'Tabela de Pânico'
            });
        }
    };

    return (
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-8 items-start relative pb-24">
            <main className={`flex-1 w-full min-w-0 border-2 ${activeBorderTheme} p-6 rounded-sm shadow-2xl relative overflow-hidden transition-all duration-500`}>

                {/* PANIC MODAL: INPUT D20 */}
                {!isDead && showPanicModal && !panicOracleResult && (
                    <div className="absolute inset-0 bg-red-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-zinc-950 border-2 border-red-500 p-8 flex flex-col items-center gap-6 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.3)] text-center">
                            <AlertTriangle size={48} className="text-red-500 animate-pulse" />
                            <div>
                                <h2 className="text-2xl font-bold uppercase tracking-widest text-red-500">Teste de Pânico</h2>
                                <p className="text-red-200/70 text-sm mt-2">O estresse de {character.name} atingiu níveis críticos! Tente rolar um D20 <span className="font-bold underline">MENOR</span> que o Stress Atual ({character.vitals.stress.current}) para manter a sanidade.</p>
                            </div>

                            <div className="flex flex-col w-full gap-4 mt-4">
                                <button
                                    onClick={() => handlePanicSubmit('roll')}
                                    className="w-full bg-red-900 border border-red-500 hover:bg-red-800 text-red-100 font-bold uppercase tracking-widest py-4 transition-colors relative overflow-hidden group"
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-2">Rolar D20 Virtual</span>
                                </button>

                                <div className="text-red-500/50 text-xs font-bold uppercase tracking-widest my-2">-- OU --</div>

                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        className="bg-red-950/50 border border-red-500 text-red-400 text-xl text-center p-3 w-24 outline-none focus:border-red-300"
                                        placeholder="Valor"
                                        value={manualPanicInput}
                                        onChange={(e) => setManualPanicInput(e.target.value)}
                                    />
                                    <button
                                        onClick={() => handlePanicSubmit('manual')}
                                        disabled={!manualPanicInput}
                                        className="flex-1 bg-zinc-900 border border-red-500 hover:bg-red-900/50 text-red-400 font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Inserir Manual
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* PANIC TEST OVERLAY (ENTROPY ORACLE) */}
                {!isDead && panicOracleResult && (
                    <div className="absolute inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                        <div
                            className="p-8 flex flex-col items-center justify-center gap-6 max-w-md w-full shadow-2xl text-center animate-in zoom-in-95 duration-300"
                            style={{
                                backgroundColor: panicOracleResult.ui_action.theme.background_color,
                                border: panicOracleResult.ui_action.theme.border,
                                color: panicOracleResult.ui_action.theme.text_color,
                                boxShadow: `0 0 50px ${panicOracleResult.ui_action.theme.border.split(' ')[2]}`
                            }}
                        >
                            <AlertTriangle size={64} className="animate-pulse" style={{ color: panicOracleResult.ui_action.theme.text_color }} />
                            <div>
                                <h2 className="text-2xl font-bold uppercase tracking-widest">{panicOracleResult.ui_action.popup_content.title}</h2>
                                <p className="opacity-80 text-sm mt-2 font-mono uppercase">LOG: {panicOracleResult.ui_action.popup_content.event_log}</p>
                            </div>

                            <div className="bg-black/50 p-6 border border-white/20 text-left w-full my-4">
                                <p className="font-serif italic text-lg leading-relaxed">{panicOracleResult.ui_action.popup_content.player_read_text}</p>
                            </div>

                            <button
                                onClick={() => setPanicOracleResult(null)}
                                className="w-full bg-black/40 hover:bg-black/80 font-bold uppercase tracking-widest py-4 transition-colors border border-white/30"
                            >
                                DIRECIONAR FOCO VITAL (Ciente)
                            </button>
                        </div>
                    </div>
                )}

                {/* WARDEN ALERT POPUP */}
                {wardenAlert && !isDead && (
                    <div
                        className="fixed inset-0 z-[110] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in zoom-in duration-300 bg-black/60 cursor-pointer"
                        onClick={() => setWardenAlert(null)}
                    >
                        <div className={`p-8 border-4 shadow-2xl flex flex-col items-center justify-center max-w-sm w-full text-center ${wardenAlert.type === 'damage' ? 'bg-red-950 border-red-600 shadow-[0_0_100px_rgba(220,38,38,0.6)]' : 'bg-amber-950 border-amber-500 shadow-[0_0_100px_rgba(245,158,11,0.6)]'}`}>
                            <AlertTriangle size={64} className={`mb-4 animate-bounce ${wardenAlert.type === 'damage' ? 'text-red-500' : 'text-amber-500'}`} />
                            <h2 className={`text-2xl font-black uppercase tracking-widest ${wardenAlert.type === 'damage' ? 'text-red-500' : 'text-amber-500'}`}>{wardenAlert.text}</h2>
                            <div className={`text-6xl font-black mt-6 mb-8 ${wardenAlert.type === 'damage' ? 'text-red-500 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]' : 'text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]'}`}>
                                +{wardenAlert.value}
                            </div>
                            <button className="uppercase text-xs tracking-widest font-bold border border-white/20 px-8 py-3 w-full hover:bg-white/10 transition-colors text-white/80">RECONHECIDO</button>
                        </div>
                    </div>
                )}

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
                    {!isDead && (
                        <EnvironmentPanel environment={environment} />
                    )}
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
                            <div className="mt-4 flex flex-col md:flex-row gap-6">
                                <div className="flex-1 flex flex-col gap-4">
                                    <InputGroup label="NOME" value={character.name} onChange={(v) => handleUpdate("name", v)} disabled={isRoomLocked || isDead} uppercase={true} />
                                    <InputGroup label="FUNÇÃO" value={character.characterClass || 'NENHUMA'} onChange={() => { }} disabled={true} uppercase={true} />
                                </div>

                                {/* COMPACT VITALS */}
                                <div className="flex-1 flex flex-col gap-2 min-w-[280px]">
                                    <div className="h-4 w-full mb-1 opacity-80">
                                        <HeartRateMonitor currentHp={character.vitals.health.current} maxHp={character.vitals.health.max} stress={character.vitals.stress.current} isDead={isDead} />
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 border border-emerald-900/30 p-2 bg-emerald-950/10">
                                        {/* SAÚDE */}
                                        <div className="flex justify-between items-center bg-zinc-900/50 p-1 border border-emerald-900">
                                            <span className={`text-[10px] font-bold tracking-widest pl-1 ${isDead ? 'text-red-600' : 'text-emerald-600'}`}>SAÚDE</span>
                                            <div className="flex items-center text-xs pr-1 font-mono">
                                                <input disabled={isRoomLocked || isDead} type="number" className={`w-8 bg-transparent text-right outline-none focus:bg-emerald-900/50 ${isDead ? 'text-red-500 font-bold' : (character.vitals.health.current <= 3 ? 'text-red-500 font-bold animate-pulse' : (character.vitals.health.current <= 6 ? 'text-amber-500 font-bold' : 'text-emerald-300'))}`} value={character.vitals.health.current} onChange={(e) => handleUpdate("vitals/health/current", Number(e.target.value))} />
                                                <span className={isDead ? 'text-red-800 mx-1' : 'text-emerald-800 mx-1'}>/</span>
                                                <input disabled={isRoomLocked || isDead} type="number" className={`w-8 bg-transparent text-left outline-none focus:bg-emerald-900/50 ${isDead ? 'text-red-700 font-bold' : 'text-emerald-700'}`} value={character.vitals.health.max} onChange={(e) => handleUpdate("vitals/health/max", Number(e.target.value))} />
                                            </div>
                                        </div>
                                        {/* FERIDAS */}
                                        <div className={`flex justify-between items-center bg-zinc-900/50 p-1 border ${isDead ? 'border-red-900 bg-red-950/20' : 'border-emerald-900'}`}>
                                            <span className={`text-[10px] font-bold tracking-widest pl-1 ${isDead ? 'text-red-500' : 'text-emerald-600'}`}>FERIDAS</span>
                                            <div className="flex items-center text-xs pr-1 font-mono">
                                                <input disabled={isDead} type="number" className={`w-8 bg-transparent text-right outline-none focus:bg-emerald-900/50 ${isDead ? 'text-red-500 font-bold' : 'text-emerald-300'}`} value={character.vitals.wounds.current || 0} onChange={(e) => handleUpdate("vitals/wounds/current", Number(e.target.value))} />
                                                <span className={isDead ? 'text-red-800 mx-1' : 'text-emerald-800 mx-1'}>/</span>
                                                <input disabled={isRoomLocked || isDead} type="number" className={`w-8 bg-transparent text-left outline-none focus:bg-emerald-900/50 ${isDead ? 'text-red-700 font-bold' : 'text-emerald-700'}`} value={character.vitals.wounds.max} onChange={(e) => handleUpdate("vitals/wounds/max", Number(e.target.value))} />
                                            </div>
                                        </div>
                                        {/* STRESS */}
                                        <div className="flex justify-between items-center bg-amber-950/20 p-1 border border-amber-900/50">
                                            <span className="text-[10px] font-bold tracking-widest pl-1 text-amber-600">STRESS</span>
                                            <div className="flex items-center text-xs pr-1 font-mono">
                                                <input disabled={isRoomLocked || isDead} type="number" className="w-8 bg-transparent text-right outline-none text-amber-400 focus:bg-amber-900/50 font-bold" value={character.vitals.stress.current || 0} onChange={(e) => handleUpdate("vitals/stress/current", Number(e.target.value))} />
                                                <span className="text-amber-800/50 mx-1">/ Mão:</span>
                                                <input disabled={isRoomLocked || isDead} type="number" className="w-8 bg-transparent text-left outline-none text-amber-700/50 focus:bg-amber-900/50" value={character.vitals.stress.min || 0} onChange={(e) => handleUpdate("vitals/stress/min", Number(e.target.value))} title="Limite de Estresse Máximo" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ACTIVE PLAYERS MOVED TO SIDEBAR */}
                </header>

                <ClassSelector roomId={roomId} character={character} />

                {/* STATS & SAVES */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <CollapsibleSection title="ATRIBUTOS">
                        <div className="grid grid-cols-2 gap-4">
                            <StatBox label="FORÇA" value={character.stats.strength} baseValue={character.baseStats.strength} path="baseStats/strength" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                            <StatBox label="RAPIDEZ" value={character.stats.speed} baseValue={character.baseStats.speed} path="baseStats/speed" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                            <StatBox label="INTELECTO" value={character.stats.intellect} baseValue={character.baseStats.intellect} path="baseStats/intellect" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                            <StatBox label="COMBATE" value={character.stats.combat} baseValue={character.baseStats.combat} path="baseStats/combat" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="RESISTÊNCIAS">
                        <div className="grid grid-cols-1 gap-4">
                            <StatBox label="SANIDADE" value={character.saves.sanity} baseValue={character.baseSaves.sanity} path="baseSaves/sanity" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                            <StatBox label="MEDO" value={character.saves.fear} baseValue={character.baseSaves.fear} path="baseSaves/fear" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                            <StatBox label="CORPO" value={character.saves.body} baseValue={character.baseSaves.body} path="baseSaves/body" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                        </div>
                    </CollapsibleSection>
                </section>


                {/* MODULE: TOOLS & LOGS */}
                <SkillTreeSelector roomId={roomId} character={character} isLocked={isRoomLocked || isDead} />

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

            {/* SQUADRON SIDEBAR (ACTIVE PLAYERS) */}
            <aside className="w-full xl:w-72 shrink-0 flex flex-col gap-4 sticky top-6">
                <div className="bg-zinc-950 border border-emerald-900/50 p-4 shadow-xl">
                    <h2 className="text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-2 mb-4">
                        <User size={18} /> ESQUADRÃO ATIVO
                    </h2>

                    {activePlayers.length === 0 ? (
                        <div className="text-emerald-800 text-sm border border-emerald-900/30 p-4 bg-emerald-950/10 text-center uppercase tracking-widest">
                            Sinal Perdido // MOTHERSHIP O.S.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {activePlayers.map(p => {
                                const isDead = p.hp === 0;

                                // Compute avatar filter class (same as main sheet)
                                let avatarFilterClass = 'avatar-filter-normal';
                                if (isDead) avatarFilterClass = 'avatar-filter-critical grayscale opacity-50';
                                else if (p.hp <= 3) avatarFilterClass = 'avatar-filter-critical';
                                else if (p.hp <= 6) avatarFilterClass = 'avatar-filter-warning';

                                return (
                                    <div key={p.id} className="flex flex-col gap-1 bg-zinc-900/50 border border-emerald-900/50 shadow-inner group hover:bg-emerald-950/20 transition-colors overflow-hidden" title={p.name}>
                                        {/* Top: Avatar + Info */}
                                        <div className="flex items-stretch gap-0">
                                            {/* Avatar: narrower/shorter */}
                                            <div className="w-10 h-12 shrink-0 relative">
                                                {p.avatarUrl ? (
                                                    <img src={p.avatarUrl} alt={p.name} className={`w-full h-full object-cover ${avatarFilterClass}`} />
                                                ) : (
                                                    <div className="w-full h-full bg-emerald-950/30 flex items-center justify-center">
                                                        <User size={18} className={`opacity-50 ${isDead ? "text-red-900" : "text-emerald-500"}`} />
                                                    </div>
                                                )}
                                            </div>
                                            {/* Info block */}
                                            <div className="flex flex-col justify-between flex-1 min-w-0 px-2 py-1 border-l border-emerald-900/30">
                                                <span className={`text-[10px] uppercase tracking-widest truncate font-bold leading-tight ${isDead ? 'text-red-600 line-through opacity-70' : 'text-emerald-400'}`}>{p.name}</span>
                                                <span className="text-[9px] text-emerald-700 uppercase tracking-wider truncate">{p.characterClass || 'SEM CLASSE'}</span>
                                                <span className={`text-[9px] font-bold uppercase tracking-widest ${isDead ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    {isDead ? '● SINAL PERDIDO' : '● SINAL ATIVO'}
                                                </span>
                                            </div>
                                        </div>
                                        {/* HeartRateMonitor below */}
                                        <div className="px-0">
                                            <HeartRateMonitor currentHp={p.hp} maxHp={p.maxHp} stress={p.stress} isDead={isDead} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}

// Helpers
function InputGroup({ label, value, onChange, disabled, uppercase = false }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; uppercase?: boolean }) {
    const [local, setLocal] = useState(value);
    const timeoutRef = useRef<any>(null);

    useEffect(() => {
        setLocal(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = uppercase ? e.target.value.toUpperCase() : e.target.value;
        setLocal(val);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => onChange(val), 500);
    };

    return (
        <div className="flex flex-col">
            <label className="text-xs text-emerald-700 mb-1">{label}</label>
            <input
                disabled={disabled}
                type="text"
                value={local}
                onChange={handleChange}
                className="bg-transparent border-b border-emerald-800 text-emerald-300 outline-none focus:border-emerald-400 focus:bg-emerald-950/20 px-1 py-1 uppercase disabled:opacity-50 disabled:cursor-not-allowed"
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

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="flex flex-col">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-xl border-b border-emerald-900/50 pb-2 mb-4 hover:text-emerald-300 transition-colors w-full text-left font-bold"
            >
                {isOpen ? <ChevronDown size={20} className="text-emerald-600" /> : <ChevronRight size={20} className="text-emerald-600" />}
                {title}
            </button>
            {isOpen && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}


