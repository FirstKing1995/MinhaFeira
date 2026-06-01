/**
 * Type declarations for MinhaFeira
 */

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  pantryId: string;
  createdAt?: any; // Firestore serverTimestamp
  lastActive?: any; // Firestore serverTimestamp
}

export interface Product {
  id: string;
  name: string;
  category: string; // Belongs to a sector name
  unit: string;
  currentQty: number;
  minQty: number;
  createdAt?: any;
}

export interface SectorBudget {
  id: string; // Document ID (usually same as initial name or random for custom)
  name: string; // Customizable name (e.g. "Noah - Filho 1", "Noah (Escola)")
  budget: number; // Manual input
  spent: number; // Sum of purchased items belonging to this sector
  isDefault?: boolean;
}

export interface PurchaseItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  subtotal: number;
  category: string; // The sector it belongs to
  unit?: string;
}

export interface PurchaseRecord {
  id: string;
  date: any; // Firestore serverTimestamp
  total: number;
  items: PurchaseItem[];
  userId: string; // UID of user who performed purchase
}

export interface FirestoreConfigState {
  adsActive: boolean;
  publisherId: string;
}
