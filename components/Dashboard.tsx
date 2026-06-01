import React, { useState } from "react";
import { SectorBudget, Product } from "../types";
import { 
  PiggyBank, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Edit2, 
  Plus, 
  Trash2, 
  ChevronRight,
  User,
  Activity,
  UserPlus
} from "lucide-react";
import { saveSectorBudgetInDb, deleteSectorBudgetFromDb } from "../firebase";

interface DashboardProps {
  displayName: string;
  pantryId: string;
  budgets: SectorBudget[];
  products: Product[];
  onNavigate: (page: string) => void;
  monthlySpentSum: number;
}

export default function Dashboard({
  displayName,
  pantryId,
  budgets,
  products,
  onNavigate,
  monthlySpentSum,
}: DashboardProps) {
  const [editingBudget, setEditingBudget] = useState<SectorBudget | null>(null);
  const [editBudgetValue, setEditBudgetValue] = useState<string>("");
  const [editNameValue, setEditNameValue] = useState<string>("");
  
  const [isAddingSector, setIsAddingSector] = useState(false);
  const [newSectorName, setNewSectorName] = useState("");
  const [newSectorBudget, setNewSectorBudget] = useState("0");

  // Filter products needing attention (currentQty < minQty)
  const alertProducts = products.filter((p) => p.currentQty < p.minQty);
  
  // Calculate total budget limits
  const totalBudgetLimit = budgets.reduce((sum, b) => sum + (b.budget || 0), 0);
  const totalBudgetSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0);
  const totalBudgetAvailable = Math.max(0, totalBudgetLimit - totalBudgetSpent);

  // Formatter helpers
  const fmt = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);

  const startEditSector = (sector: SectorBudget) => {
    setEditingBudget(sector);
    setEditBudgetValue(sector.budget.toString());
    setEditNameValue(sector.name);
  };

  const handleSaveSector = async () => {
    if (!editingBudget) return;
    const cleanBudget = parseFloat(editBudgetValue) || 0;
    const cleanName = editNameValue.trim() || editingBudget.name;

    await saveSectorBudgetInDb(pantryId, {
      ...editingBudget,
      name: cleanName,
      budget: cleanBudget,
    });
    setEditingBudget(null);
  };

  const handleAddSector = async () => {
    const name = newSectorName.trim();
    if (!name) return;
    const budgetVal = parseFloat(newSectorBudget) || 0;
    const id = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_]/g, "_");

    await saveSectorBudgetInDb(pantryId, {
      id,
      name,
      budget: budgetVal,
      spent: 0,
      isDefault: false,
    });

    setNewSectorName("");
    setNewSectorBudget("0");
    setIsAddingSector(false);
  };

  const handleDeleteSector = async (sectorId: string) => {
    if (confirm("Deseja realmente excluir este setor e seu orçamento?")) {
      await deleteSectorBudgetFromDb(pantryId, sectorId);
    }
  };

  return (
    <div className="flex flex-col gap-6" id="dashboard-component">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <span className="text-xs font-semibold text-emerald-700 tracking-wider uppercase bg-emerald-50 px-2.5 py-1 rounded-full">
            MinhaFeira • Despensa Ativa
          </span>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight mt-2.5">
            Olá, <span className="text-emerald-600">{displayName}</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Gestão inteligente de compras para sua família.
          </p>
        </div>
        <div 
          onClick={() => onNavigate("config")}
          className="w-12 h-12 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 transition-all rounded-full flex items-center justify-center font-bold text-lg cursor-pointer border border-emerald-100"
          title="Ver configurações e convites"
        >
          {displayName ? displayName.charAt(0).toUpperCase() : <User />}
        </div>
      </div>

      {/* METRIC SUMMARIES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Budget limit set */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <PiggyBank className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Orçamento Total Planejado
            </p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">
              {fmt(totalBudgetLimit)}
            </h3>
            <p className="text-xs text-emerald-600 mt-1 font-medium">
              Soma de todos os setores
            </p>
          </div>
        </div>

        {/* Total Budget Spent */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Gasto Acumulado Total
            </p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">
              {fmt(totalBudgetSpent)}
            </h3>
            <p className="text-xs text-amber-600 mt-1 font-medium">
              Dos itens já comprados
            </p>
          </div>
        </div>

        {/* Total Remaining budget */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Saldo Geral Disponível
            </p>
            <h3 className={`text-xl font-bold mt-1 ${totalBudgetAvailable <= 0 ? "text-red-600" : "text-blue-600"}`}>
              {fmt(totalBudgetAvailable)}
            </h3>
            <p className="text-xs text-blue-600 mt-1 font-medium">
              Poupança / disponível de uso
            </p>
          </div>
        </div>
      </div>

      {/* QUICK INVENTORY NOTIFICATION & ACTION TRIGGERS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT & CENTER: SECTOR BUDGETS & CONTROLS */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800 tracking-tight">
              Orçamento por Setor
            </h3>
            <button
              onClick={() => setIsAddingSector(!isAddingSector)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Setor
            </button>
          </div>

          {/* ADD NEW SECTOR FORM */}
          {isAddingSector && (
            <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100 flex flex-col gap-3">
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-widest">
                Novo Setor Personalizado
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nome do Setor (ex: Ração do Totó)"
                  value={newSectorName}
                  onChange={(e) => setNewSectorName(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Orçamento (R$)"
                    value={newSectorBudget}
                    onChange={(e) => setNewSectorBudget(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 flex-1"
                  />
                  <button
                    onClick={handleAddSector}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EDIT SECTOR POPUP/MODAL OVERLAY (INLINE FOR CONVENIENCE) */}
          {editingBudget && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-2xl max-w-sm w-full border border-gray-200 shadow-xl flex flex-col gap-4">
                <div className="flex flex-col">
                  <h3 className="text-md font-bold text-gray-800">
                    Editar Setor e Orçamento
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Defina o valor manualmente.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Nome do Setor
                    </label>
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Limite do Orçamento (R$)
                    </label>
                    <input
                      type="number"
                      value={editBudgetValue}
                      onChange={(e) => setEditBudgetValue(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingBudget(null)}
                    className="flex-1 bg-gray-100 hover:bg-gray-250 text-gray-600 font-bold py-2.5 rounded-lg text-xs transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveSector}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-xs transition-all"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GRID OF SECTOR BUDGET CARDS */}
          {budgets.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-gray-100 text-center flex flex-col items-center gap-3">
              <PiggyBank className="w-12 h-12 text-gray-200" />
              <p className="text-sm text-gray-500">
                Nenhum setor encontrado. Toque em "Adicionar Setor" para começar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {budgets.map((b) => {
                const percentage = b.budget > 0 ? (b.spent / b.budget) * 100 : 0;
                let barColor = "bg-emerald-500";
                let textSpentColor = "text-emerald-700";
                if (percentage >= 100) {
                  barColor = "bg-red-500";
                  textSpentColor = "text-red-700";
                } else if (percentage >= 75) {
                  barColor = "bg-amber-500";
                  textSpentColor = "text-amber-700";
                }

                const availableAmount = Math.max(0, b.budget - b.spent);

                return (
                  <div
                    key={b.id}
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:border-gray-200 transition-all group"
                  >
                    {/* Sector top info */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition-colors">
                          {b.name}
                        </h4>
                        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mt-1 block">
                          Limite: {fmt(b.budget)}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => startEditSector(b)}
                          className="p-1.5 text-gray-350 hover:text-emerald-600 transition-colors bg-gray-50 rounded-lg"
                          title="Ajustar limite ou nome"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSector(b.id)}
                          className="p-1.5 text-gray-350 hover:text-red-600 transition-colors bg-gray-50 rounded-lg"
                          title="Excluir setor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress indicators */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                        <span className={`${textSpentColor}`}>
                          Gasto: {fmt(b.spent)}
                        </span>
                        <span className="text-gray-500">
                          Disponível: {fmt(availableAmount)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${barColor} transition-all duration-500`}
                          style={{ width: `${Math.min(100, percentage)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: CRITICAL REPLENISH ALERTS */}
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold text-gray-800 tracking-tight">
            Necessário Repor ({alertProducts.length})
          </h3>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3 max-h-[420px] overflow-y-auto">
            {alertProducts.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                <p className="text-xs text-gray-500 font-medium">
                  Sua despensa está incrível! Nenhum item com falta.
                </p>
              </div>
            ) : (
              alertProducts.slice(0, 7).map((p) => {
                const delta = Math.max(1, p.minQty - p.currentQty);
                return (
                  <div
                    key={p.id}
                    className="flex justify-between items-center p-3 rounded-xl bg-red-50/40 border border-red-50/70"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-800">{p.name}</p>
                      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mt-0.5">
                        Setor: {p.category}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full block">
                        Falta: {delta} {p.unit}
                      </span>
                      <span className="text-[9px] text-gray-400 font-medium block mt-1">
                        Estoque: {p.currentQty}/{p.minQty}
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {alertProducts.length > 7 && (
              <button
                onClick={() => onNavigate("estoque")}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors py-2 flex items-center justify-center gap-1 border-t border-gray-50 mt-2"
              >
                Ver mais itens em falta <ChevronRight className="w-3 h-3" />
              </button>
            )}

            <button
              onClick={() => onNavigate("compras")}
              className="mt-2 w-full text-center text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 py-3 rounded-xl transition-all"
            >
              Comprar todos no Modo Compras
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
