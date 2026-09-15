"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Group, Line, Rect, Text, Circle } from "react-konva";
import type Konva from "konva";
import { CharacterSheet, GridObstacle, GridToken, NpcData } from "@/types/character";
import {
    TILE_W, TILE_H, gridToScreen, screenToCell, diamondPoints,
    boardOffset, boardPixelSize, depth, tailwindToHex,
} from "@/lib/isoUtils";

export interface IsometricGridProps {
    gridSize: number;
    tokens: Record<string, GridToken>;
    obstacles: Record<string, GridObstacle>;
    players: Record<string, CharacterSheet>;
    npcs: Record<string, NpcData>;
    currentTurnId: string | null;
    selectedTokenId: string | null;
    targetedTokenId: string | null;
    /** Token cujo alcance de movimento e de ataque deve ser destacado. */
    activeToken: GridToken | null;
    activeTokenMaxRange: number;
    canHighlight: boolean;
    onCellClick: (x: number, y: number) => void;
    onTokenClick: (tokenId: string) => void;
}

const chebyshev = (ax: number, ay: number, bx: number, by: number) =>
    Math.max(Math.abs(ax - bx), Math.abs(ay - by));

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;

export default function IsometricGrid(props: IsometricGridProps) {
    const {
        gridSize, tokens, obstacles, players, npcs, currentTurnId,
        selectedTokenId, targetedTokenId, activeToken,
        activeTokenMaxRange, canHighlight, onCellClick, onTokenClick,
    } = props;

    const wrapperRef = useRef<HTMLDivElement>(null);
    const groupRef = useRef<Konva.Group>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const didFit = useRef(false);

    const offset = useMemo(() => boardOffset(gridSize), [gridSize]);
    const board = useMemo(() => boardPixelSize(gridSize), [gridSize]);

    // O palco acompanha o tamanho real do container. Num celular ele e estreito
    // e o tabuleiro isometrico espalha na diagonal, entao sem medir isto o mapa
    // nasce cortado.
    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        measure();
        return () => ro.disconnect();
    }, []);

    const fitToScreen = () => {
        if (!size.width || !size.height) return;
        const fit = Math.min(size.width / board.width, size.height / board.height) * 0.9;
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fit));
        setScale(next);
        setPos({
            x: (size.width - board.width * next) / 2,
            y: (size.height - board.height * next) / 2,
        });
    };

    // Enquadra o tabuleiro inteiro uma unica vez. Reenquadrar a cada render
    // tiraria o mapa do lugar no meio do turno de alguem.
    useEffect(() => {
        if (didFit.current || !size.width || !size.height) return;
        fitToScreen();
        didFit.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size, board]);

    /** Ponto da tela para celula do tabuleiro, desfazendo pan e zoom. */
    const pointerToCell = (stage: Konva.Stage) => {
        const pointer = stage.getPointerPosition();
        const group = groupRef.current;
        if (!pointer || !group) return null;
        const local = group.getAbsoluteTransform().copy().invert().point(pointer);
        const cell = screenToCell(local.x, local.y);
        if (cell.x < 0 || cell.y < 0 || cell.x >= gridSize || cell.y >= gridSize) return null;
        return cell;
    };

    // Arrastar o mapa termina em mouseup, que o Konva tambem reporta como
    // clique. Sem isto, so de dar pan o jogador moveria o proprio token para
    // onde soltou o dedo.
    const didDrag = useRef(false);

    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (didDrag.current) {
            didDrag.current = false;
            return;
        }
        // Tokens tratam o proprio clique; aqui so chegam cliques no chao.
        // O alvo do evento e a forma interna (o pino, a base), nao o Group —
        // por isso a checagem tem que subir a arvore, senao clicar num inimigo
        // para mira-lo disparava tambem o clique de chao e movia o token.
        if (e.target.findAncestor(".token", true)) return;
        const stage = e.target.getStage();
        if (!stage) return;
        const cell = pointerToCell(stage);
        if (cell) onCellClick(cell.x, cell.y);
    };

    const zoomAround = (pointer: { x: number; y: number }, factor: number) => {
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
        if (next === scale) return;
        // Mantem sob o dedo o mesmo ponto do mapa durante o zoom.
        setPos({
            x: pointer.x - (pointer.x - pos.x) * (next / scale),
            y: pointer.y - (pointer.y - pos.y) * (next / scale),
        });
        setScale(next);
    };

    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const pointer = e.target.getStage()?.getPointerPosition();
        if (!pointer) return;
        zoomAround(pointer, e.evt.deltaY > 0 ? 0.92 : 1.08);
    };

    // Pinch-zoom: essencial porque um mapa 20x20 em isometrico ja tem 1280px de
    // largura e nao cabe inteiro em celular nenhum.
    const lastPinch = useRef<number | null>(null);
    const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
        const t = e.evt.touches;
        if (t.length !== 2) return;
        e.evt.preventDefault();
        const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
        const rect = wrapperRef.current?.getBoundingClientRect();
        const center = {
            x: (t[0].clientX + t[1].clientX) / 2 - (rect?.left ?? 0),
            y: (t[0].clientY + t[1].clientY) / 2 - (rect?.top ?? 0),
        };
        if (lastPinch.current) zoomAround(center, dist / lastPinch.current);
        lastPinch.current = dist;
    };
    const endPinch = () => { lastPinch.current = null; };

    // O chao inteiro e nao-interativo: o clique e resolvido uma vez no palco,
    // convertendo a posicao do ponteiro em celula. Com listeners por celula, um
    // mapa 100x100 teria 10 mil alvos de hit-test.
    const cells = useMemo(() => {
        const obsByCell = new Map<string, GridObstacle>();
        Object.values(obstacles || {}).forEach(o =>
            obsByCell.set(`${Number(o.x)},${Number(o.y)}`, o)
        );

        const pts = diamondPoints();
        const out: React.ReactElement[] = [];

        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const s = gridToScreen(x, y);
                const obs = obsByCell.get(`${x},${y}`);

                let fill = "#0a0f0d";
                let stroke = "rgba(16,185,129,0.14)";

                if (activeToken && canHighlight) {
                    const dist = chebyshev(activeToken.x, activeToken.y, x, y);
                    if (dist > 0 && dist <= activeToken.movementPoints.current) {
                        fill = "rgba(16,185,129,0.18)";
                        stroke = "rgba(16,185,129,0.45)";
                    } else if (dist > 0 && dist <= activeTokenMaxRange) {
                        fill = "rgba(239,68,68,0.13)";
                        stroke = "rgba(239,68,68,0.35)";
                    }
                }

                if (obs) {
                    fill = tailwindToHex(obs.color);
                    stroke = "#000";
                }

                out.push(
                    <Line
                        key={`c${x}_${y}`}
                        points={pts}
                        x={s.x}
                        y={s.y}
                        closed
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={1}
                        opacity={obs?.type === "cover" ? 0.7 : 1}
                        listening={false}
                        perfectDrawEnabled={false}
                    />
                );
            }
        }
        return out;
    }, [gridSize, obstacles, activeToken, activeTokenMaxRange, canHighlight]);

    const tokenNodes = useMemo(() => {
        return Object.entries(tokens || {})
            // Quem esta mais a frente no tabuleiro cobre quem esta atras.
            .sort(([, a], [, b]) => depth(a.x, a.y) - depth(b.x, b.y))
            .map(([id, token]) => {
                const s = gridToScreen(token.x, token.y);
                const isNpc = id.startsWith("npc_");
                const npc = isNpc ? npcs?.[id] : null;
                const isCorpse = isNpc && (npc?.isDead || (npc?.hp ?? 1) <= 0);
                const isTurn = currentTurnId === id;
                const isHighlighted = selectedTokenId === id || targetedTokenId === id;
                const hpPct = npc && npc.maxHp > 0 ? Math.max(0, npc.hp / npc.maxHp) : 1;

                const base = isCorpse
                    ? "#3f3f46"
                    : isNpc
                        ? tailwindToHex(npc?.color, "#ef4444")
                        : tailwindToHex(token.color, "#10b981");

                const label = isCorpse
                    ? "💀"
                    : isNpc
                        ? (npc?.icon || "👾")
                        : (players?.[id]?.name?.substring(0, 2).toUpperCase() || "??");

                const outline = isTurn ? "#fbbf24" : isHighlighted ? "#ffffff" : "rgba(0,0,0,0.7)";
                const outlineW = isTurn || isHighlighted ? 2.5 : 1;

                return (
                    <Group
                        key={id}
                        x={s.x}
                        y={s.y}
                        name="token"
                        onClick={() => onTokenClick(id)}
                        onTap={() => onTokenClick(id)}
                    >
                        {/* Base no chao, para o token nao parecer flutuando sobre o losango */}
                        <Line
                            points={diamondPoints(TILE_W * 0.7, TILE_H * 0.7)}
                            closed
                            fill={base}
                            opacity={isCorpse ? 0.45 : 0.85}
                            stroke={outline}
                            strokeWidth={outlineW}
                            perfectDrawEnabled={false}
                        />
                        {/* Corpo: um pino vertical, na escala aproximada de uma pessoa no tile */}
                        <Circle
                            y={-TILE_H * 0.75}
                            radius={TILE_W * 0.22}
                            fill={base}
                            opacity={isCorpse ? 0.5 : 1}
                            stroke={outline}
                            strokeWidth={outlineW}
                            perfectDrawEnabled={false}
                        />
                        <Text
                            y={-TILE_H * 0.75 - 8}
                            x={-TILE_W * 0.35}
                            width={TILE_W * 0.7}
                            align="center"
                            text={label}
                            fontSize={isNpc || isCorpse ? 15 : 11}
                            fontStyle="bold"
                            fill={isCorpse ? "#a1a1aa" : "#09090b"}
                            listening={false}
                        />

                        {isNpc && npc && !isCorpse && (
                            <>
                                <Rect x={-16} y={-TILE_H * 1.55} width={32} height={4} fill="#000" opacity={0.85} listening={false} />
                                <Rect
                                    x={-16}
                                    y={-TILE_H * 1.55}
                                    width={32 * hpPct}
                                    height={4}
                                    fill={hpPct > 0.5 ? "#34d399" : hpPct > 0.25 ? "#facc15" : "#f87171"}
                                    listening={false}
                                />
                            </>
                        )}

                        {!isNpc && (
                            <Text
                                y={TILE_H * 0.45}
                                x={-TILE_W * 0.35}
                                width={TILE_W * 0.7}
                                align="center"
                                text={`${token.movementPoints.current}/${token.movementPoints.max}`}
                                fontSize={9}
                                fill="#34d399"
                                listening={false}
                            />
                        )}
                    </Group>
                );
            });
    }, [tokens, npcs, players, currentTurnId, selectedTokenId, targetedTokenId, onTokenClick]);

    return (
        <div ref={wrapperRef} className="w-full h-full relative bg-black touch-none">
            <Stage
                width={size.width || 1}
                height={size.height || 1}
                scaleX={scale}
                scaleY={scale}
                x={pos.x}
                y={pos.y}
                draggable
                onDragStart={() => { didDrag.current = true; }}
                onDragEnd={(e) => setPos({ x: e.target.x(), y: e.target.y() })}
                onClick={handleStageClick}
                onTap={handleStageClick}
                onWheel={handleWheel}
                onTouchMove={handleTouchMove}
                onTouchEnd={endPinch}
            >
                <Layer>
                    <Group ref={groupRef} x={offset.x} y={offset.y}>
                        {cells}
                        {tokenNodes}
                    </Group>
                </Layer>
            </Stage>

            <div className="absolute bottom-2 right-2 flex gap-1 z-10">
                <button
                    onClick={() => zoomAround({ x: size.width / 2, y: size.height / 2 }, 1.25)}
                    className="bg-zinc-950/90 border border-emerald-900 text-emerald-400 w-8 h-8 text-lg leading-none"
                >+</button>
                <button
                    onClick={() => zoomAround({ x: size.width / 2, y: size.height / 2 }, 0.8)}
                    className="bg-zinc-950/90 border border-emerald-900 text-emerald-400 w-8 h-8 text-lg leading-none"
                >−</button>
                <button
                    onClick={fitToScreen}
                    className="bg-zinc-950/90 border border-emerald-900 text-emerald-400 px-2 h-8 text-[10px] uppercase tracking-widest"
                >Centrar</button>
            </div>
        </div>
    );
}
