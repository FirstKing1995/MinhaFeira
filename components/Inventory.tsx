import React, { useState } from "react";
import { Product, SectorBudget } from "../types";
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Edit, 
  FileCheck, 
  Package, 
  Filter 
} from "lucide-react";
import { saveProductInDb, deleteProductFromDb } from "../firebase";

interface InventoryProps {
  pantryId: string;
  products: Product[];
  budgets: SectorBudget[]; // Used to list sectors in selection
}

export default function Inventory({
  pantryId,
  products,
  budgets,
}: InventoryProps) {
  const [search, setSearch] = useState("");
  const [selectedSector, setSelectedSector] = useState("Todos");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productSector, setProductSector] = useState("");
  const [productUnit, setProductUnit] = useState("un");
  const [productCurrent, setProductCurrent] = useState("0");
  const [productMin, setProductMin] = useState("1");

  // Filter lists
  const sectorsList = ["Todos", ...budgets.map((b) => b.name)];

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesSector =
      selectedSector === "Todos" || p.category === selectedSector;
    return matchesSearch && matchesSector;
  });

  const getStatus = (current: number, min: number) => {
    if (current > min) return { label: "Normal", color: "text-emerald-700 bg-emerald-50 border-emerald-100" };
    if (current === min) return { label: "Alerta", color: "text-amber-700 bg-amber-50 border-amber-100" };
    return { label: "Em falta", color: "text-red-700 bg-red-50 border-red-100" };
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setProductName("");
    // Default to first budget sector if available
    setProductSector(budgets[0]?.name || "Mercado");
    setProductUnit("un");
    setProductCurrent("0");
    setProductMin("1");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingId(p.id);
    setProductName(p.name);
    setProductSector(p.category);
    setProductUnit(p.unit);
    setProductCurrent(p.currentQty.toString());
    setProductMin(p.minQty.toString());
    setIsModalOpen(true);
  };

  const handleSaveProduct = async () => {
    const name = productName.trim();
    if (!name) return alert("Por favor insira o nome do produto");
    const currentQty = parseInt(productCurrent) || 0;
    const minQty = parseInt(productMin) || 1;

    try {
      await saveProductInDb(
        pantryId,
        {
          name,
          category: productSector,
          unit: productUnit,
          currentQty,
          minQty,
        },
        editingId || undefined
      );
      setIsModalOpen(false);
    } catch (e) {
      alert("Erro ao salvar produto");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm("Remover este produto do estoque permanente?")) {
      await deleteProductFromDb(pantryId, id);
    }
  };

  const updateQtyInstant = async (p: Product, delta: number) => {
    const targetQty = Math.max(0, p.currentQty + delta);
    try {
      await saveProductInDb(
        pantryId,
        {
          ...p,
          currentQty: targetQty,
        },
        p.id
      );
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-6" id="inventory-component">
      {/* SEARCH AND ADD CONTROL HEADERN BAR */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-sm my-input focus:border-emerald-500 outline-none"
          />
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" /> Adicionar Produto
        </button>
      </div>

      {/* FILTER CHIPS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <div className="text-gray-400 p-1 flex-shrink-0">
          <Filter className="w-4 h-4" />
        </div>
        {sectorsList.map((sector) => (
          <button
            key={sector}
            onClick={() => setSelectedSector(sector)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer ${
              selectedSector === sector
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-white text-gray-600 border-gray-150 hover:bg-gray-50"
            }`}
          >
            {sector}
          </button>
        ))}
      </div>

      {/* PRODUCTS LISTING GRID */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center flex flex-col items-center gap-4">
          <Package className="w-12 h-12 text-gray-200" />
          <p className="text-sm text-gray-500">
            Nenhum item localizado no filtro atual. Toque em "Adicionar Produto"
            para catalogar novos mantimentos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((p) => {
            const st = getStatus(p.currentQty, p.minQty);
            return (
              <div
                key={p.id}
                className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:border-gray-200 transition-all gap-4"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 text-sm truncate">
                    {p.name}
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5 font-medium">
                    {p.category} • {p.unit}
                  </p>
                  <span
                    className={`inline-block text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border mt-2 ${st.color}`}
                  >
                    {st.label}
                  </span>
                </div>

                {/* Counter Increments */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateQtyInstant(p, -1)}
                    className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-sm transition-all"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center text-sm font-extrabold text-gray-850">
                    {p.currentQty}
                  </span>
                  <button
                    onClick={() => updateQtyInstant(p, 1)}
                    className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Operations tools */}
                <div className="flex gap-1">
                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="p-2 bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition-all"
                    title="Editar produto"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(p.id)}
                    className="p-2 bg-red-50 text-red-500 hover:text-red-700 rounded-xl transition-all"
                    title="Apagar permanente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* POPUP: ADD / EDIT PRODUCT MODAL OVERLAY */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full border border-gray-150 shadow-2xl flex flex-col gap-5">
            <div>
              <h3 className="text-lg font-extrabold text-gray-800">
                {editingId ? "Editar Produto" : "Adicionar Produto"}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Alimente a despensa preenchendo as informações obrigatórias.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {/* Product name */}
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                  Nome do Item
                </label>
                <input
                  type="text"
                  placeholder="Ex: Alcatra fatiada, Arroz Integral, Cerveja"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Product Category / Sector */}
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                  Setor / Categoria
                </label>
                <select
                  value={productSector}
                  onChange={(e) => setProductSector(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 outline-none"
                >
                  {budgets.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                  {budgets.length === 0 && (
                    <option value="Mercado">Mercado</option>
                  )}
                </select>
              </div>

              {/* Custom specs */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                    Unidade
                  </label>
                  <select
                    value={productUnit}
                    onChange={(e) => setProductUnit(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 outline-none"
                  >
                    <option value="un">Un (un)</option>
                    <option value="kg">Kg (kg)</option>
                    <option value="g">G (g)</option>
                    <option value="L">L (L)</option>
                    <option value="ml">Ml (ml)</option>
                    <option value="pct">Pct (pct)</option>
                    <option value="cx">Cx (cx)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                    Qtd Atual
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={productCurrent}
                    onChange={(e) => setProductCurrent(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                    Qtd Mínima
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={productMin}
                    onChange={(e) => setProductMin(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-650 font-bold py-2.5 rounded-xl text-xs transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProduct}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
