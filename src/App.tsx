import React, { useState, useEffect } from "react";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signInWithPopup, 
  signOut,
  deleteUser
} from "firebase/auth";
import { 
  auth, 
  db, 
  googleProvider, 
  initUserProfileInDb, 
  initializeDefaultBudgets,
  subscribeToProducts, 
  subscribeToBudgets,
  subscribeToPurchases 
} from "./firebase";
import { 
  UserProfile, 
  Product, 
  SectorBudget, 
  PurchaseRecord 
} from "./types";
import Dashboard from "./components/Dashboard";
import Inventory from "./components/Inventory";
import Shopping from "./components/Shopping";
import Config from "./components/Config";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  User, 
  Sparkles, 
  Lock, 
  Loader2, 
  LogOut,
  AlertCircle
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Real-time synchronization states
  const [products, setProducts] = useState<Product[]>([]);
  const [budgets, setBudgets] = useState<SectorBudget[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);

  // Navigation page views
  const [activePage, setActivePage] = useState<string>("dashboard");

  // AUTH CORNER FOR EMAIL/PASSWORD SIGN IN
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [emailInput, setEmailInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [nameInput, setNameInput] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [authStatusText, setAuthStatusText] = useState<string>("");

  // DEMO MODE STATE
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // MONITORE AUTHENTICATION LIFECYCLE
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setAuthError("");
      
      if (currentUser) {
        try {
          setIsDemoMode(false);
          const loadedProfile = await initUserProfileInDb(currentUser);
          setProfile(loadedProfile);
          setUser(currentUser);
        } catch (e) {
          console.error("Erro no login ou configuração de perfil:", e);
        }
      } else {
        setUser(null);
        setProfile(null);
        setProducts([]);
        setBudgets([]);
        setPurchases([]);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  // START LISTENERS FOR USER RECEPTACLE IN REAL TIME
  useEffect(() => {
    if (isDemoMode) return;
    if (!user || !profile) return;

    const pantryId = profile.pantryId;

    // 1. Sync permanent catalog products
    const unsubProducts = subscribeToProducts(
      pantryId,
      (prods) => setProducts(prods),
      (err) => console.error("Snapshot Products Error: ", err)
    );

    // 2. Sync budgets
    const unsubBudgets = subscribeToBudgets(
      pantryId,
      (budgetsList) => {
        setBudgets(budgetsList);
        // If the user's pantry budgets are non-existent yet (brand-new accounts hook), initialize them
        if (budgetsList.length === 0) {
          initializeDefaultBudgets(pantryId);
        }
      },
      (err) => console.error("Snapshot Budgets Error: ", err)
    );

    // 3. Sync finished purchases
    const unsubPurchases = subscribeToPurchases(
      pantryId,
      (purchaseList) => setPurchases(purchaseList),
      (err) => console.error("Snapshot Purchases Error: ", err)
    );

    return () => {
      unsubProducts();
      unsubBudgets();
      unsubPurchases();
    };
  }, [user, profile, isDemoMode]);

  // SETUP REFRESH TRIGGERS FOR THE CONFIG ELEMENT
  const handleRefreshProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const refreshedProfile = await initUserProfileInDb(user);
      setProfile(refreshedProfile);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // HANDLERS FOR BASIC EMAIL/PASSWORD AUTHENTICATION
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthStatusText("");

    const email = emailInput.trim();
    const password = passwordInput;
    const name = nameInput.trim();

    if (!email || !password) {
      setAuthError("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      if (authTab === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!name) {
          setAuthError("Informe seu nome para criar a conta");
          setLoading(false);
          return;
        }
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name });
        // Force state update by initializing profile
        const loadedProfile = await initUserProfileInDb(credential.user);
        setProfile(loadedProfile);
        setUser(credential.user);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setAuthError("Este e-mail já está cadastrado.");
      } else if (err.code === "auth/weak-password") {
        setAuthError("A senha precisa ter pelo menos 6 caracteres.");
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setAuthError("E-mail ou senha incorretos.");
      } else {
        setAuthError("Erro na autenticação: " + (err.message || err.code));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError("");
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error(err);
      if (err.code !== "auth/popup-closed-by-user") {
        setAuthError("Erro ao fazer login com Google: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (isDemoMode) {
      setIsDemoMode(false);
      setUser(null);
      setProfile(null);
      return;
    }

    if (confirm("Deseja realmente sair de sua conta?")) {
      setLoading(true);
      await signOut(auth);
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (confirm("Tem certeza absoluta? Todos os seus dados de despensa e histórico serão excluídos permanentemente.")) {
      if (confirm("Confirmação final: Deseja apagar sua conta do MinhaFeira AGORA?")) {
        setLoading(true);
        try {
          await deleteUser(user);
          alert("Conta excluída com sucesso.");
        } catch (e) {
          alert("Por segurança, faça login novamente no app antes de apagar sua conta.");
        } finally {
          setLoading(false);
        }
      }
    }
  };

  // ENABLE DEMO MODE FOR AI STUDIO PREVIEW WITHOUT LOGIN
  const handleEnableDemoMode = () => {
    setIsDemoMode(true);
    setProducts([
      { id: "p1", name: "Alcatra bovino", category: "Carnes", unit: "kg", currentQty: 1, minQty: 3 },
      { id: "p2", name: "Detergente de Maçã", category: "Casa", unit: "un", currentQty: 2, minQty: 2 },
      { id: "p3", name: "Fralda Huggies", category: "Noah", unit: "pct", currentQty: 0, minQty: 1 },
      { id: "p4", name: "Leite Integral", category: "Mercado", unit: "L", currentQty: 0, minQty: 4 },
      { id: "p5", name: "Shampoo Liz", category: "Liz", unit: "un", currentQty: 1, minQty: 1 },
    ]);
    setBudgets([
      { id: "carnes", name: "Carnes", budget: 400, spent: 150, isDefault: true },
      { id: "casa", name: "Casa", budget: 150, spent: 40, isDefault: true },
      { id: "noah", name: "Noah", budget: 300, spent: 220, isDefault: true },
      { id: "liz", name: "Liz", budget: 300, spent: 110, isDefault: true },
      { id: "mercado", name: "Mercado", budget: 600, spent: 210, isDefault: true },
    ]);
    setPurchases([
      {
        id: "rec1",
        date: { seconds: Date.now() / 1000 - 86400 * 2 },
        total: 120,
        items: [
          { productId: "p3", name: "Fralda Huggies", qty: 1, price: 80, subtotal: 80, category: "Noah" },
          { productId: "p1", name: "Alcatra bovino", qty: 1, price: 40, subtotal: 40, category: "Carnes" },
        ],
        userId: "demo_user",
      },
    ]);
    setProfile({
      uid: "demo_uid",
      displayName: "Pessoa de Demonstração",
      email: "demo@minhafeira.com",
      photoURL: null,
      pantryId: "DEMO_PANTRY_CODE",
    });
    setUser({ uid: "demo_uid", displayName: "Pessoa de Demonstração" });
    setActivePage("dashboard");
  };

  // LOADING SHIELD SCREEN
  if (loading) {
    return (
      <div className="fixed inset-0 bg-emerald-700 flex flex-col items-center justify-center text-white z-50">
        <Loader2 className="w-10 h-10 animate-spin text-white opacity-90" />
        <h1 className="font-extrabold text-2xl tracking-tighter mt-4">
          Minha<span className="opacity-70">Feira</span>
        </h1>
        <p className="text-xs text-emerald-150 mt-1 opacity-75">
          Conectando ao banco de dados Firestore...
        </p>
      </div>
    );
  }

  // AUTH SCREEN LOGIN IF NOT SIGNED IN
  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-sm w-full p-8 rounded-3xl border border-gray-150 shadow-md flex flex-col gap-6">
          <div className="text-center">
            <div className="inline-flex p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl mb-4 shadow-sm border border-emerald-100">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-gray-950 tracking-tight">
              Minha<span className="text-emerald-650 text-emerald-600">Feira</span>
            </h1>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              Gestão automatizada de estoque, orçamentos familiares e despensa compartilhada.
            </p>
          </div>

          {/* TAB BUTTONS */}
          <div className="bg-gray-50 border border-gray-100 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setAuthTab("login")}
              className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg tracking-wide uppercase transition-all whitespace-nowrap cursor-pointer ${
                authTab === "login"
                  ? "bg-white text-gray-800 font-bold shadow-sm"
                  : "text-gray-400 hover:text-gray-650"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setAuthTab("register")}
              className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg tracking-wide uppercase transition-all whitespace-nowrap cursor-pointer ${
                authTab === "register"
                  ? "bg-white text-gray-800 font-bold shadow-sm"
                  : "text-gray-400 hover:text-gray-650"
              }`}
            >
              Criar Conta
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
            {authTab === "register" && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Nome Completo
                </span>
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                E-mail
              </span>
              <input
                type="email"
                placeholder="seu@e-mail.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Senha
              </span>
              <input
                type="password"
                placeholder="Sua senha secreta"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs font-medium rounded-lg border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs tracking-wider uppercase transition-all shadow-md shadow-emerald-700/10 cursor-pointer"
            >
              {authTab === "login" ? "Acessar Sistema" : "Registrar Conta Grátis"}
            </button>
          </form>

          <div className="flex items-center gap-2.5">
            <div className="flex-1 h-[1px] bg-gray-150"></div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ou</span>
            <div className="flex-1 h-[1px] bg-gray-150"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 hover:bg-slate-50 transition-colors text-gray-700 font-bold py-3 rounded-xl text-xs tracking-wide uppercase cursor-pointer"
          >
            <svg viewBox="0 0 48 48" className="w-4.5 h-4.5 flex-shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Entrar com Google
          </button>

          <button
            onClick={handleEnableDemoMode}
            className="w-full text-center text-[11px] font-bold text-gray-500 hover:text-emerald-700 underline tracking-wide uppercase transition-colors"
          >
            Explorar em modo de testes (Demo)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between" id="full-app-root">
      
      {/* BRANDING TOP BAR */}
      <header className="sticky top-0 bg-white border-b border-gray-100 p-4 shrink-0 z-30 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg text-white flex items-center justify-center font-bold text-sm">
            MF
          </div>
          <h1 className="font-black text-gray-900 tracking-tight text-md">
            Minha<span className="text-emerald-600">Feira</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {isDemoMode ? (
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
              MODO DEMO ACTIVE
            </span>
          ) : (
            <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
              CONECTADO
            </span>
          )}
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors flex items-center gap-1 font-bold text-xs cursor-pointer"
            title="Sair do aplicativo"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* CORE ACTIVE ACTIVE SUBPAGE COMPONENT CONTAINER */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 overflow-y-auto mb-20">
        {activePage === "dashboard" && (
          <Dashboard
            displayName={profile.displayName}
            pantryId={profile.pantryId}
            budgets={budgets}
            products={products}
            onNavigate={(pg) => setActivePage(pg)}
            monthlySpentSum={purchases.reduce((t, p) => t + p.total, 0)}
          />
        )}

        {activePage === "estoque" && (
          <Inventory
            pantryId={profile.pantryId}
            products={products}
            budgets={budgets}
          />
        )}

        {activePage === "compras" && (
          <Shopping
            pantryId={profile.pantryId}
            userId={profile.uid}
            products={products}
            budgets={budgets}
            purchases={purchases}
          />
        )}

        {activePage === "config" && (
          <Config
            userProfile={profile}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
            onRefreshProfileAndPantry={handleRefreshProfile}
          />
        )}
      </main>

      {/* BOTTOM FLOATING NAV BAR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-150 py-3 px-6 z-40 shadow-xl flex justify-around max-w-4xl mx-auto rounded-t-3xl md:border-x">
        <button
          onClick={() => setActivePage("dashboard")}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activePage === "dashboard"
              ? "text-emerald-600 scale-105"
              : "text-gray-400 hover:text-gray-550"
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Início</span>
        </button>

        <button
          onClick={() => setActivePage("estoque")}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer relative ${
            activePage === "estoque"
              ? "text-emerald-600 scale-105"
              : "text-gray-400 hover:text-gray-550"
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Estoque</span>
          {products.filter((p) => p.currentQty < p.minQty).length > 0 && (
            <span className="absolute -top-1 -right-2 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-extrabold flex items-center justify-center">
              {products.filter((p) => p.currentQty < p.minQty).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActivePage("compras")}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activePage === "compras"
              ? "text-emerald-600 scale-105"
              : "text-gray-400 hover:text-gray-550"
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Compras</span>
        </button>

        <button
          onClick={() => setActivePage("config")}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activePage === "config"
              ? "text-emerald-600 scale-105"
              : "text-gray-400 hover:text-gray-550"
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Perfil</span>
        </button>
      </nav>
    </div>
  );
}
