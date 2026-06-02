import React, { useState } from "react";
import { UserProfile } from "../types";
import { 
  User, 
  Share2, 
  Users, 
  Copy, 
  LogOut, 
  Trash2, 
  CheckCircle,
  HelpCircle,
  Database
} from "lucide-react";
import { joinPantryInDb, checkPantryExists } from "../firebase";

interface ConfigProps {
  userProfile: UserProfile;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onRefreshProfileAndPantry: () => void;
}

export default function Config({
  userProfile,
  onLogout,
  onDeleteAccount,
  onRefreshProfileAndPantry,
}: ConfigProps) {
  const [joinCode, setJoinCode] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [joinStatus, setJoinStatus] = useState<{
    text: string;
    type: "success" | "error" | "info" | null;
  }>({ text: "", type: null });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(userProfile.pantryId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleJoinPantry = async () => {
    const code = joinCode.trim();
    if (!code) {
      return setJoinStatus({
        text: "Por favor insira um código válido.",
        type: "error",
      });
    }

    if (code === userProfile.pantryId) {
      return setJoinStatus({
        text: "Você já está conectado a esta despensa.",
        type: "info",
      });
    }

    setJoinStatus({ text: "Verificando código de despensa...", type: "info" });

    try {
      const exists = await checkPantryExists(code);
      if (!exists) {
        setJoinStatus({
          text: "Código de despensa não localizado no banco de dados. Verifique o ID informado.",
          type: "error",
        });
        return;
      }

      await joinPantryInDb(userProfile.uid, code);
      setJoinStatus({
        text: "Conectado com sucesso! Você e o proprietário estão compartilhando o mesmo estoque.",
        type: "success",
      });
      setJoinCode("");
      
      // Notify parent to refresh states
      onRefreshProfileAndPantry();
    } catch (e) {
      setJoinStatus({
        text: "Erro ao conectar a despensa compartilhada. Tente novamente.",
        type: "error",
      });
    }
  };

  const handleSplitPantry = async () => {
    if (confirm("Deseja sair da despensa compartilhada e retornar para sua própria despensa individual?")) {
      try {
        await joinPantryInDb(userProfile.uid, userProfile.uid);
        onRefreshProfileAndPantry();
        setJoinStatus({ text: "Retornou para sua despensa individual.", type: "success" });
      } catch (err) {
        alert("Erro ao dissociar despensa.");
      }
    }
  };

  return (
    <div className="flex flex-col gap-6" id="config-component">
      {/* USER PROFILE INFO SUMMARY */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center gap-4">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center border-2 border-emerald-100 shadow-sm text-3xl font-extrabold overflow-hidden">
          {userProfile.photoURL ? (
            <img 
              src={userProfile.photoURL} 
              alt="Avatar" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            userProfile.displayName ? userProfile.displayName.charAt(0).toUpperCase() : <User />
          )}
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
            {userProfile.displayName}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{userProfile.email}</p>
        </div>
      </div>

      {/* PANTRY SHARING PANEL - SOLVES "COMPARTILHAR DESPENSA" REQUIREMENT */}
      <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm flex flex-col gap-5">
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <Share2 className="w-5 h-5" />
            <h3 className="font-extrabold text-gray-900 text-[15px]">
              Compartilhar Despensa
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            Permite que outra pessoa acesse, edite e acompanhe os mesmos produtos,
            historicos e orçamentos que você em tempo real.
          </p>
        </div>

        {/* Displaying own pantry code to share */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-sans">
            Seu Código de Compartilhamento
          </span>
          <div className="flex items-center justify-between gap-3 bg-white px-3.5 py-2.5 rounded-lg border border-gray-150">
            <span className="text-xs font-mono font-bold text-gray-800 break-all select-all">
              {userProfile.pantryId}
            </span>
            <button
              onClick={handleCopyCode}
              className={`flex-shrink-0 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-md border transition-all ${
                isCopied
                  ? "bg-emerald-50 text-emerald-750 border-emerald-100"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Copy className="w-3 h-3" /> {isCopied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex-1 h-[1px] bg-gray-100"></div>
          <span className="text-[10px] font-bold text-gray-350 uppercase">ou</span>
          <div className="flex-1 h-[1px] bg-gray-100"></div>
        </div>

        {/* Joining an existent pantry */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Entrar em uma Despensa Existente
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Insira o código do seu parceiro"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-xs text-gray-800 focus:border-emerald-500 outline-none"
              />
              <button
                onClick={handleJoinPantry}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 rounded-lg text-xs leading-none tracking-wide transition-all uppercase flex-shrink-0"
              >
                Conectar
              </button>
            </div>
          </div>

          {/* Feedback messages for Pantry sharing integrations */}
          {joinStatus.text && (
            <div
              className={`p-3 rounded-lg text-xs font-medium border ${
                joinStatus.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : joinStatus.type === "error"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-blue-50 border-blue-250 text-blue-800"
              }`}
            >
              {joinStatus.text}
            </div>
          )}

          {/* If shared, option to split */}
          {userProfile.pantryId !== userProfile.uid && (
            <div className="mt-2 text-center">
              <button
                onClick={handleSplitPantry}
                className="text-[11px] font-bold text-red-600 hover:text-red-750 underline"
              >
                Desconectar Despensa Compartilhada e Usar Individual
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SESSION & DELETION ACTIONS */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-between p-5 text-gray-700 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2 bg-gray-105 bg-gray-50 text-gray-500 rounded-lg">
              <LogOut className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-gray-900">Sair da Conta</span>
              <p className="text-[10px] text-gray-400 font-medium">Termina a sessão atual</p>
            </div>
          </div>
        </button>

        <button
          onClick={onDeleteAccount}
          className="w-full flex items-center justify-between p-5 text-red-650 hover:bg-red-50/20 transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2 bg-red-50 text-red-500 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-red-600">Apagar Minha Conta</span>
              <p className="text-[10px] text-red-400 font-medium">Deleta dados permanentemente do Firebase</p>
            </div>
          </div>
        </button>
      </div>

      {/* INFRASTRUCTURE INFO */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex gap-3 text-xs text-slate-500 leading-relaxed max-w-lg">
        <Database className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-700">Nota de Integração Planilha:</span> No menu de ajuda localizado no final resumo, explicamos detalhadamente por que e como sincronizar seus dados do Firestore com o Google Sheets usando o script Google Apps Script fornecido e corrigido.
        </div>
      </div>
    </div>
  );
}
