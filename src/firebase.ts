import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  increment,
  writeBatch,
} from "firebase/firestore";
import { Product, SectorBudget, PurchaseRecord, UserProfile, PurchaseItem } from "./types";

// DEFAULT FIREBASE SETTINGS FROM THE USER'S CONFIGURATION
const FIREBASE_CONFIG = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "AIzaSyAt9Qr720-N1zeq9B1yIiXX6CROBcRUbEg",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "minhafeira-a99c8.firebaseapp.com",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "minhafeira-a99c8",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "minhafeira-a99c8.firebasestorage.app",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "604038633025",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "1:604038633025:web:108d3756fb3d9dadbc18c0",
};

export const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

// SETUP GOOGLE AUTH PROVIDER
export const googleProvider = new GoogleAuthProvider();

// Standard default sectors
export const DEFAULT_SECTORS = [
  "Casa",
  "Carro",
  "Assinaturas",
  "Noah", // Child 1
  "Liz", // Child 2
  "Carnes",
  "Mercado",
  "Farmácia",
  "Pets",
  "CNPJ",
  "Dívidas",
  "Passeios",
  "Roupas",
];

// ==========================================
// ERROR HANDLING: Mandatory Firestore JSON wrapper
// ==========================================
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error("Firestore Error logged: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ==========================================
// PROFILE AND REAL-TIME COUPLING
// ==========================================

export async function initUserProfileInDb(user: any): Promise<UserProfile> {
  const userRef = doc(db, "users", user.uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const initialProfile: UserProfile = {
        uid: user.uid,
        displayName: user.displayName || "Usuário",
        email: user.email || "",
        photoURL: user.photoURL || null,
        pantryId: user.uid,
      };
      await setDoc(userRef, {
        ...initialProfile,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        monthlySpent: 0,
      });

      // Ensure standard default sector budgets are saved too
      await initializeDefaultBudgets(user.uid);

      // Increment metrics in background config (if permission or document exists)
      try {
        await updateDoc(doc(db, "config", "metrics"), {
          totalUsers: increment(1),
        });
      } catch (e) {
        // Safe fail block
      }
      return initialProfile;
    } else {
      const data = snap.data();
      // Update last active
      await updateDoc(userRef, { lastActive: serverTimestamp() });
      return {
        uid: user.uid,
        displayName: data.displayName || user.displayName || "Usuário",
        email: data.email || user.email || "",
        photoURL: data.photoURL || user.photoURL || null,
        pantryId: data.pantryId || user.uid,
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

// Initialize default budgets for a pantry
export async function initializeDefaultBudgets(pantryId: string) {
  const batch = writeBatch(db);
  for (const sector of DEFAULT_SECTORS) {
    // Generate simple ID for standard sectors
    const docId = sector.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
    const budgetRef = doc(db, `users/${pantryId}/sectors`, docId);
    batch.set(budgetRef, {
      id: docId,
      name: sector,
      budget: 0,
      spent: 0,
      isDefault: true,
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    // Graceful catch or error handler log
    console.error("Error setting default budgets:", error);
  }
}

export async function joinPantryInDb(uid: string, code: string): Promise<void> {
  if (!code) throw new Error("Código da despensa vazio");
  const targetUserRef = doc(db, "users", code);
  
  try {
    // 1. Check if target pantry/user exists
    const snap = await getDoc(targetUserRef);
    if (!snap.exists()) {
      throw new Error("Pantry code not found. Verifique o código informado.");
    }

    // 2. Update user's pantryId
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { pantryId: code });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

export async function checkPantryExists(code: string): Promise<boolean> {
  const targetUserRef = doc(db, "users", code);
  try {
    const snap = await getDoc(targetUserRef);
    return snap.exists();
  } catch (err) {
    // If permission denies, handle gracefully
    return false;
  }
}

// ==========================================
// PRODUCTS PERSISTENCE
// ==========================================
export function subscribeToProducts(
  pantryId: string,
  onUpdate: (products: Product[]) => void,
  onErr: (err: any) => void
) {
  const colRef = collection(db, `users/${pantryId}/products`);
  const q = query(colRef, orderBy("name"));

  return onSnapshot(
    q,
    (snap) => {
      const products: Product[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Product, "id">),
      }));
      onUpdate(products);
    },
    (err) => {
      onErr(err);
      handleFirestoreError(err, OperationType.LIST, `users/${pantryId}/products`);
    }
  );
}

export async function saveProductInDb(
  pantryId: string,
  productData: Omit<Product, "id">,
  productId?: string
): Promise<void> {
  const colRef = collection(db, `users/${pantryId}/products`);
  try {
    if (productId) {
      const docRef = doc(colRef, productId);
      await updateDoc(docRef, productData);
    } else {
      await addDoc(colRef, {
        ...productData,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      productId ? OperationType.UPDATE : OperationType.CREATE,
      `users/${pantryId}/products/${productId || "new"}`
    );
  }
}

export async function deleteProductFromDb(
  pantryId: string,
  productId: string
): Promise<void> {
  const docRef = doc(db, `users/${pantryId}/products`, productId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${pantryId}/products/${productId}`);
  }
}

// ==========================================
// SECTOR BUDGETS PERSISTENCE
// ==========================================
export function subscribeToBudgets(
  pantryId: string,
  onUpdate: (budgets: SectorBudget[]) => void,
  onErr: (err: any) => void
) {
  const colRef = collection(db, `users/${pantryId}/sectors`);
  return onSnapshot(
    colRef,
    (snap) => {
      const budgets: SectorBudget[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SectorBudget, "id">),
      }));
      onUpdate(budgets);
    },
    (err) => {
      onErr(err);
      handleFirestoreError(err, OperationType.LIST, `users/${pantryId}/sectors`);
    }
  );
}

export async function saveSectorBudgetInDb(
  pantryId: string,
  sectorData: SectorBudget
): Promise<void> {
  const docRef = doc(db, `users/${pantryId}/sectors`, sectorData.id);
  try {
    await setDoc(docRef, sectorData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${pantryId}/sectors/${sectorData.id}`);
  }
}

export async function deleteSectorBudgetFromDb(
  pantryId: string,
  sectorId: string
): Promise<void> {
  const docRef = doc(db, `users/${pantryId}/sectors`, sectorId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${pantryId}/sectors/${sectorId}`);
  }
}

// ==========================================
// SHOPPING HISTORY / PURCHASES
// ==========================================
export function subscribeToPurchases(
  pantryId: string,
  onUpdate: (purchases: PurchaseRecord[]) => void,
  onErr: (err: any) => void
) {
  const colRef = collection(db, `users/${pantryId}/purchases`);
  const q = query(colRef, orderBy("date", "desc"));

  return onSnapshot(
    q,
    (snap) => {
      const records: PurchaseRecord[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PurchaseRecord, "id">),
      }));
      onUpdate(records);
    },
    (err) => {
      onErr(err);
      handleFirestoreError(err, OperationType.LIST, `users/${pantryId}/purchases`);
    }
  );
}

export async function finalizePurchaseInDb(
  pantryId: string,
  purchaseTotal: number,
  items: PurchaseItem[],
  userId: string,
  pantryProducts: Product[],
  currentBudgets: SectorBudget[]
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Process items that were bought
  // Update inventory quantities in products subcollection only for catalog items that exist in our pantry
  const productIdsSet = new Set(pantryProducts.map(p => p.id));
  items.forEach((item) => {
    if (item.productId && item.productId !== "custom" && productIdsSet.has(item.productId)) {
      const prodRef = doc(db, `users/${pantryId}/products`, item.productId);
      batch.update(prodRef, { currentQty: increment(item.qty) });
    }
  });

  // 2. Accumulate spending in sector budgets
  // We compute total spent per sector in this purchase session
  const spentBySector: { [sectorNameOrId: string]: number } = {};
  items.forEach((item) => {
    // Find sector using budget name or category
    const sectorName = item.category;
    spentBySector[sectorName] = (spentBySector[sectorName] || 0) + item.subtotal;
  });

  // Apply sector budget updates
  currentBudgets.forEach((sector) => {
    // Support matching by clean id or display name
    const budgetKeyName = sector.name;
    const extraSpent = spentBySector[budgetKeyName] ?? 0;
    if (extraSpent > 0) {
      const budgetDocRef = doc(db, `users/${pantryId}/sectors`, sector.id);
      batch.update(budgetDocRef, { spent: increment(extraSpent) });
    }
  });

  // 3. Append Purchase Record Log
  const purchaseColRef = collection(db, `users/${pantryId}/purchases`);
  const newPurchaseDoc = doc(purchaseColRef);
  batch.set(newPurchaseDoc, {
    date: serverTimestamp(),
    total: purchaseTotal,
    items,
    userId,
  });

  // 4. Update overall user's monthly Spent
  const userRef = doc(db, "users", userId);
  batch.update(userRef, { monthlySpent: increment(purchaseTotal) });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${pantryId}/purchase_transactions`);
  }
}
