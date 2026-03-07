// Firestore-backed query utility (replaces supabase REST queries)
import { db } from "@/integrations/firebase/client";
import { collection, getDocs, query as fsQuery, orderBy as fsOrderBy, limit as fsLimit, where as fsWhere } from "firebase/firestore";

interface QueryOptions {
  table: string;
  select?: string;
  filters?: Record<string, string>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  accessToken?: string;
}

export async function supabaseQuery<T = any>(options: QueryOptions): Promise<{ data: T[] | null; error: any }> {
  try {
    if (!db) {
      const err = new Error("Firebase not configured. Set VITE_FIREBASE_* env vars.");
      console.error(err.message);
      return { data: null, error: err };
    }
    const { table, filters = {}, order, limit } = options;
    const colRef = collection(db, table);
    const constraints: any[] = [];
    if (order) constraints.push(fsOrderBy(order.column, order.ascending ? "asc" : "desc"));
    if (limit) constraints.push(fsLimit(limit));

    for (const [k, v] of Object.entries(filters || {})) {
      const parts = String(v).split(".");
      if (parts[0] === "eq") {
        constraints.push(fsWhere(k, "==", parts.slice(1).join(".")));
      }
    }

    const q = constraints.length ? fsQuery(colRef, ...constraints) : fsQuery(colRef);
    const snap = await getDocs(q);
    const out: any[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
    return { data: out as any[], error: null };
  } catch (err) {
    console.error("Firestore query failed:", err);
    return { data: null, error: err };
  }
}
