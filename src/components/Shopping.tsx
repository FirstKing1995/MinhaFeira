import React, { useState, useEffect } from "react";
import { Product, SectorBudget, PurchaseRecord, PurchaseItem } from "../types";
import { 
  ShoppingCart, 
  History, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle, 
  DollarSign, 
  Calendar, 
  Tag 
} from "lucide-react";
import { finalizePurchaseInDb } from "../firebase";

interface ShoppingProps {
  pantryId: string;
  userId: string;
  products: Product[];
  budgets: SectorBudget[];
  purchases: PurchaseRecord[];
}

export default function Shopping({
  pantryId,
  userId,
  products,
  budgets,
  purchases,
}: ShoppingProps) {
  const [activeTab, setActiveTab] = useState<"cart" | "history">("cart");

  // Local state for the current shopping items
  // Pre-load items that need replenishment (currentQty < minQty)
  interface CartItem {
    id: string; // Product ID or temporary ID
    name: string;
    category: string; // Sector Name
    unit: string;
    qty: number;
    price: string; // unit price
    isBought: boolean; // "Já comprado" checkbox state
    isCustom?: boolean; // Added directly to cart
  }

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customSector, setCustomSector] = useState("");
  const [customUnit, setCustomUnit] = useState("un");
  const [customQty, setCustomQty] = useState("1");
  const [customPrice, setCustomPrice] = useState("");

  // Sync low-inventory products to the cart on mounting or when products change (only for empty cart)
  useEffect(() => {
    const lowStock = products.filter((p) => p.currentQty < p.minQty);
    
    // Merge or set initial cart
    const initialItems: CartItem[] = lowStock.map((p) => {
      // Propose quantity needed
      const defaultQtyNeeded = p.minQty - p.currentQty;
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        qty: defaultQtyNeeded > 0 ? defaultQtyNeeded : 1,
        price: "",
        isBought: true, // Default to checked for purchase
      };
    });
    setCart(initialItems);
    
    if (budgets.length > 0) {
      setCustomSector(budgets[0].name);
    }
  }, [products, budgets]);

  // Calculations for active checked items
  const checkedItems = cart.filter((item) => item.isBought);
  
  // Total cost calculation for checked status items
  const totalCost = checkedItems.reduce((acc, item) => {
    const unitPrice = parseFloat(item.price) || 0;
    return acc + (item.qty * unitPrice);
  }, 0);

  const fmt = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);

  const handleToggleBought = (id: string) => {
    setCart(
      cart.map((item) =>
        item.id === id ? { ...item, isBought: !item.isBought } : item
      )
    );
  };

  const handleQtyChange = (id: string, delta: number) => {
    setCart(
      cart.map((item) =>
        item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item
      )
    );
  };

  const handlePriceChange = (id: string, value: string) => {
    setCart(
      cart.map((item) => (item.id === id ? { ...item, price: value } : item))
    );
  };

  const handleDeleteItem = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const handleAddCustomToCart = () => {
    const name = customName.trim();
    if (!name) return alert("Por favor insira o nome do item adicional");
    const qtyVal = parseInt(customQty) || 1;
    const priceVal = customPrice;

    const newItem: CartItem = {
      id: "custom_" + Date.now(),
      name,
      category: customSector,
      unit: customUnit,
      qty: qtyVal,
      price: priceVal,
      isBought: true,
      isCustom: true,
    };

    setCart([...cart, newItem]);
    setCustomName("");
    setCustomQty("1");
    setCustomPrice("");
    setIsAddingCustom(false);
  };

  const handleFinalizePurchase = async () => {
    if (checkedItems.length === 0) {
      return alert("Nenhum item marcado como comprado para finalizar.");
    }

    // Verify if checking some items without set prices
    const missingPrices = checkedItems.filter((i) => !i.price || parseFloat(i.price) <= 0);
    if (missingPrices.length > 0) {
      if (!confirm("Existem itens marcados sem preço ou com preço zero. Deseja finalizar assim mesmo?")) {
        return;
      }
    }

    // Prepare purchased details
    const purchaseItems: PurchaseItem[] = checkedItems.map((item) => ({
      productId: item.isCustom ? "custom" : item.id,
      name: item.name,
      qty: item.qty,
      price: parseFloat(item.price) || 0,
      subtotal: item.qty * (parseFloat(item.price) || 0),
      category: item.category,
    }));

    try {
      await finalizePurchaseInDb(
        pantryId,
        totalCost,
        purchaseItems,
        userId,
        products,
        budgets
      );
      
      alert("Compra finalizada com sucesso! Seus estoques e orçamentos setoriais foram atualizados.");
      
      // Clear cart or list remaining unchecked items
      const unchecked = cart.filter((item) => !item.isBought);
      setCart(unchecked);
    } catch (e) {
      alert("Erro ao finalizar compra no Firebase. Por favor, tente novamente.");
    }
  };

  return (
    <div className="flex flex-col gap-6" id="shopping-component">
      {/* TABS SELECTOR */}
      <div className="bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm flex gap-2">
        <button
          onClick={() => setActiveTab("cart")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer ${
            activeTab === "cart"
              ? "bg-emerald-600 text-white font-bold shadow-sm"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          }`}
        >
          <ShoppingCart className="w-4 h-4" /> Carrinho Ativo ({cart.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer ${
            activeTab === "history"
              ? "bg-emerald-600 text-white font-bold shadow-sm"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          }`}
        >
          <History className="w-4 h-4" /> Histórico de Compras ({purchases.length})
        </button>
      </div>

      {/* TAB CONTENT: ACTIVE CART */}
      {activeTab === "cart" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                Lista de Compras Atual
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Marque como "Comprado" e adicione preços para deduzir dos orçamentos automaticamente.
              </p>
            </div>

            <button
              onClick={() => setIsAddingCustom(!isAddingCustom)}
              className="flex items-center gap-1.5 text-xs font-bold bg-emerald-55 bg-emerald-50 text-emerald-700 border border-emerald-100 px-4 py-2 rounded-xl hover:bg-emerald-100 transition-all justify-center"
            >
              <Plus className="w-4 h-4" /> Item Avulso
            </button>
          </div>

          {/* ADD OUT-OF-CATALOG ITEM IN CART */}
          {isAddingCustom && (
            <div className="bg-emerald-50/40 p-5 rounded-2xl border border-emerald-100/70 flex flex-col gap-4">
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-widest">
                Adicionar Item Adicional no Carrinho
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">
                    Nome do Item
                  </span>
                  <input
                    type="text"
                    placeholder="Ex: Alcatra fatiada"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">
                    Setor do Orçamento
                  </span>
                  <select
                    value={customSector}
                    onChange={(e) => setCustomSector(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  >
                    {budgets.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">
                      Qtd
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={customQty}
                      onChange={(e) => setCustomQty(e.target.value)}
                      className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">
                      Medida
                    </span>
                    <select
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                      className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    >
                      <option value="un">Un</option>
                      <option value="kg">Kg</option>
                      <option value="L">L</option>
                      <option value="pct">Pct</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">
                      Preço Unitário (R$)
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <button
                    onClick={handleAddCustomToCart}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs tracking-wide uppercase transition-all flex-shrink-0"
                  >
                    Inserir
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SHOPPING LIST ITEMS */}
          {cart.length === 0 ? (
            <div className="bg-white p-16 rounded-2xl border border-gray-100 text-center flex flex-col items-center gap-4">
              <CheckCircle className="w-12 h-12 text-emerald-400 animate-pulse" />
              <div>
                <p className="font-bold text-gray-800 text-sm">
                  Seu carrinho está vazio!
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Todos os mantimentos cadastrados estão com estoque acima do limite mínimo.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3.5">
                {cart.map((item) => {
                  const unitPrice = parseFloat(item.price) || 0;
                  const itemSubtotal = item.qty * unitPrice;

                  return (
                    <div
                      key={item.id}
                      className={`p-5 rounded-2xl border shadow-sm transition-all flex flex-col sm:flex-row gap-4 justify-between sm:items-center bg-white ${
                        item.isBought
                          ? "border-emerald-100 bg-emerald-50/5"
                          : "border-gray-100 opacity-60"
                      }`}
                    >
                      {/* Checkbox and Name info */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={item.isBought}
                          onChange={() => handleToggleBought(item.id)}
                          className="w-5 h-5 rounded border-gray-200 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <h4 className="font-bold text-gray-950 text-sm truncate">
                            {item.name}
                          </h4>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mt-0.5 block">
                            Setor: {item.category} • Medida: {item.unit}
                          </span>
                        </div>
                      </div>

                      {/* Interactive multipliers */}
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleQtyChange(item.id, -1)}
                            className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-650 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center font-extrabold text-sm text-gray-850">
                            {item.qty}
                          </span>
                          <button
                            onClick={() => handleQtyChange(item.id, 1)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Price Input and Subtotal */}
                        <div className="flex items-center gap-3">
                          <div className="relative w-28">
                            <span className="absolute left-2.5 top-2.5 text-[10px] font-bold text-gray-400">
                              R$
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Preso unit"
                              value={item.price}
                              onChange={(e) =>
                                handlePriceChange(item.id, e.target.value)
                              }
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-2 py-2 text-xs focus:border-emerald-500 outline-none font-bold text-emerald-700"
                            />
                          </div>

                          <div className="text-right min-w-[70px]">
                            <span className="text-[9px] font-bold text-gray-400 block uppercase">
                              Subtotal
                            </span>
                            <span className="text-xs font-bold text-gray-900 block mt-0.5">
                              {fmt(itemSubtotal)}
                            </span>
                          </div>

                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-2 text-gray-350 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CART CHECKOUT FOOTER */}
              <div className="mt-4 bg-white p-6 rounded-2xl border border-gray-150 shadow-md flex flex-col md:flex-row gap-5 items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Previsão para Itens Selecionados
                  </p>
                  <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">
                    {fmt(totalCost)}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 font-medium">
                    {checkedItems.length} de {cart.length} itens marcados como comprado
                  </p>
                </div>

                <button
                  onClick={handleFinalizePurchase}
                  disabled={checkedItems.length === 0}
                  className={`w-full md:w-auto px-8 py-4 rounded-xl text-sm font-extrabold tracking-wide uppercase transition-all cursor-pointer ${
                    checkedItems.length > 0
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-650/20"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Finalizar Compra
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: PURCHASE HISTORY LOGS */}
      {activeTab === "history" && (
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              Histórico de Compras Realizadas
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Registro estático de sessões de compras anteriores realizadas por você ou membros da despensa.
            </p>
          </div>

          {purchases.length === 0 ? (
            <div className="bg-white p-16 rounded-2xl border border-gray-100 text-center flex flex-col items-center gap-4">
              <History className="w-12 h-12 text-gray-200" />
              <p className="text-sm text-gray-500">
                Nenhum registro de compras finalizadas encontrado nesta despensa.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {purchases.map((rec) => {
                const dateStr = rec.date?.seconds
                  ? new Date(rec.date.seconds * 1000).toLocaleString("pt-BR")
                  : "Dinâmico / Agora";

                return (
                  <div
                    key={rec.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    {/* Record header info */}
                    <div className="p-4 bg-gray-50/50 border-b border-gray-50 flex flex-col sm:flex-row gap-3 sm:items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-gray-500 font-semibold">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Sessão: {dateStr}</span>
                      </div>
                      <div className="text-right font-bold text-emerald-700 text-sm">
                        Total compra: {fmt(rec.total)}
                      </div>
                    </div>

                    {/* Bought items listed */}
                    <div className="p-4 flex flex-col divide-y divide-gray-50">
                      {rec.items?.map((item, idx) => (
                        <div
                          key={idx}
                          className="py-2.5 flex items-center justify-between text-xs hover:bg-gray-50/30 transition-colors"
                        >
                          <div>
                            <span className="font-bold text-gray-800">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium ml-2 uppercase">
                              #{item.category}
                            </span>
                          </div>
                          <div className="text-gray-600 font-medium">
                            {item.qty} {item.unit || "un"} • {fmt(item.price)} ={" "}
                            <span className="font-bold text-gray-900">
                              {fmt(item.subtotal)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
