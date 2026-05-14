"use client";

import { useState } from "react";
import { addGlobalItem, deleteGlobalItem } from "@/lib/database";
import { Item, Weapon, ItemType } from "@/types/character";
import { Package, Plus, Trash2, Edit2, Save, X } from "lucide-react";

interface Props {
    roomId: string;
    globalInventory: Record<string, Item | Weapon> | undefined;
}

export function GlobalInventoryEditor({ roomId, globalInventory }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<Weapon & Item> & { type: ItemType }>({
        id: "",
        name: "",
        description: "",
        type: "gear",
        weight: 1,
        quantity: 1,
        damage: "",
        range: 1,
        baseStat: "combat",
        bonus: 0
    });

    const itemsList = Object.values(globalInventory || {});

    const handleEdit = (item: Item | Weapon) => {
        setEditingId(item.id);
        setFormData(item as any);
        setIsOpen(true);
    };

    const handleNew = () => {
        setEditingId(null);
        setFormData({
            id: `item_${Date.now()}`,
            name: "",
            description: "",
            type: "gear",
            weight: 1,
            quantity: 1,
            damage: "",
            range: 1,
            baseStat: "combat",
            bonus: 0
        });
        setIsOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name) return;
        
        const finalItem: any = {
            id: formData.id || `item_${Date.now()}`,
            name: formData.name,
            description: formData.description || "",
            type: formData.type || "gear",
            weight: Number(formData.weight) || 0,
            quantity: Number(formData.quantity) || 1
        };

        if (formData.type === 'weapon') {
            finalItem.damage = formData.damage || "1d10";
            finalItem.range = Number(formData.range) || 1;
            finalItem.baseStat = formData.baseStat || "combat";
            finalItem.bonus = Number(formData.bonus) || 0;
        }

        await addGlobalItem(roomId, finalItem);
        setIsOpen(false);
    };

    return (
        <section className="bg-zinc-950/80 border border-emerald-900/50 p-6 flex flex-col gap-4 mt-8">
            <div className="flex justify-between items-center border-b border-emerald-900/50 pb-2">
                <h2 className="text-xl font-bold tracking-widest text-emerald-500 flex items-center gap-2 uppercase">
                    <Package size={24} /> EDITOR DE INVENTÁRIO GLOBAL
                </h2>
                <button onClick={handleNew} className="bg-emerald-950/50 hover:bg-emerald-900 text-emerald-400 border border-emerald-800 px-4 py-1 font-bold text-sm flex items-center gap-2">
                    <Plus size={16} /> NOVO ITEM
                </button>
            </div>

            {isOpen && (
                <div className="bg-zinc-900/50 border border-emerald-800 p-4 flex flex-col gap-4">
                    <h3 className="text-emerald-400 font-bold uppercase">{editingId ? 'EDITAR ITEM' : 'CRIAR NOVO ITEM'}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <label className="flex flex-col">
                            <span className="text-xs text-emerald-600 mb-1">Nome</span>
                            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-zinc-950 border border-emerald-900/50 text-emerald-300 p-2" />
                        </label>
                        <label className="flex flex-col">
                            <span className="text-xs text-emerald-600 mb-1">Tipo</span>
                            <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as ItemType })} className="bg-zinc-950 border border-emerald-900/50 text-emerald-300 p-2">
                                <option value="gear">Equipamento</option>
                                <option value="tool">Ferramenta / Médico</option>
                                <option value="weapon">Arma</option>
                            </select>
                        </label>
                        <label className="flex flex-col col-span-2">
                            <span className="text-xs text-emerald-600 mb-1">Descrição / Imagem URL</span>
                            <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="bg-zinc-950 border border-emerald-900/50 text-emerald-300 p-2" />
                        </label>
                        <label className="flex flex-col">
                            <span className="text-xs text-emerald-600 mb-1">Peso</span>
                            <input type="number" value={formData.weight} onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })} className="bg-zinc-950 border border-emerald-900/50 text-emerald-300 p-2" />
                        </label>
                    </div>

                    {formData.type === 'weapon' && (
                        <div className="grid grid-cols-2 gap-4 border-t border-emerald-900/30 pt-4 mt-2">
                            <label className="flex flex-col">
                                <span className="text-xs text-emerald-600 mb-1">Dano (Ex: 2d10)</span>
                                <input type="text" value={formData.damage} onChange={e => setFormData({ ...formData, damage: e.target.value })} className="bg-zinc-950 border border-emerald-900/50 text-emerald-300 p-2" />
                            </label>
                            <label className="flex flex-col">
                                <span className="text-xs text-emerald-600 mb-1">Alcance (Casas)</span>
                                <input type="number" value={formData.range} onChange={e => setFormData({ ...formData, range: Number(e.target.value) })} className="bg-zinc-950 border border-emerald-900/50 text-emerald-300 p-2" />
                            </label>
                            <label className="flex flex-col">
                                <span className="text-xs text-emerald-600 mb-1">Atributo Base</span>
                                <select value={formData.baseStat} onChange={e => setFormData({ ...formData, baseStat: e.target.value as any })} className="bg-zinc-950 border border-emerald-900/50 text-emerald-300 p-2">
                                    <option value="combat">Combat</option>
                                    <option value="strength">Strength</option>
                                    <option value="speed">Speed</option>
                                </select>
                            </label>
                            <label className="flex flex-col">
                                <span className="text-xs text-emerald-600 mb-1">Bônus de Mira (+X)</span>
                                <input type="number" value={formData.bonus} onChange={e => setFormData({ ...formData, bonus: Number(e.target.value) })} className="bg-zinc-950 border border-emerald-900/50 text-emerald-300 p-2" />
                            </label>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 mt-2">
                        <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-emerald-600 hover:text-emerald-400">CANCELAR</button>
                        <button onClick={handleSave} className="bg-emerald-600 text-zinc-950 font-bold px-6 py-2 hover:bg-emerald-500">SALVAR ITEM</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {itemsList.map(item => (
                    <div key={item.id} className="bg-zinc-950 border border-emerald-900/30 p-3 flex flex-col justify-between group hover:border-emerald-500 transition-colors">
                        <div>
                            <div className="flex justify-between items-start">
                                <span className="font-bold text-emerald-400 uppercase text-sm">{item.name}</span>
                                <span className="text-[10px] text-emerald-700 bg-emerald-950/30 px-1 border border-emerald-900">{item.type}</span>
                            </div>
                            <span className="text-xs text-emerald-600/70 block mt-1">{item.description}</span>
                            {item.type === 'weapon' && (
                                <div className="text-[10px] text-red-400 mt-2 font-mono uppercase">
                                    DANO: {(item as Weapon).damage} | ALCANCE: {(item as Weapon).range}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(item)} className="text-blue-500 hover:text-blue-400"><Edit2 size={14} /></button>
                            <button onClick={() => { if(confirm('Excluir do banco global?')) deleteGlobalItem(roomId, item.id); }} className="text-red-500 hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
