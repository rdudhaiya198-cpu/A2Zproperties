import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth, db } from "@/integrations/firebase/client";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User as FbUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

interface AuthContextType {
  user: { id: string; email?: string | null; full_name?: string | null } | null;
  session: null;
  isAdmin: boolean;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<{ id: string; email?: string | null; full_name?: string | null } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdmin = async (uid: string) => {
    try {
      const roleDoc = await getDoc(doc(db, "roles", uid));
      if (roleDoc.exists()) {
        const data = roleDoc.data();
        setIsAdmin(data?.role === "admin");
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      setIsAdmin(false);
    }
  };

  const refreshRole = async () => {
    if (!auth || !auth.currentUser) return;
    try {
      await checkAdmin(auth.currentUser.uid);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    if (!auth) {
      console.warn('Firebase auth not initialized. Skipping auth listener.');
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (fbUser: FbUser | null) => {
      if (fbUser) {
        setUser({ id: fbUser.uid, email: fbUser.email ?? null, full_name: fbUser.displayName ?? null });
        await checkAdmin(fbUser.uid);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!auth) return { error: new Error('Auth not initialized') };
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: fullName });
        setUser({ id: userCredential.user.uid, email: userCredential.user.email ?? null, full_name: fullName });
        try {
          // Create a roles document so new users default to role 'user'
          await setDoc(doc(db, "roles", userCredential.user.uid), {
            role: "user",
            email,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          // Non-fatal: role document creation failed
          console.warn("Failed to write role document:", err);
        }
      }
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!auth) return { error: new Error('Auth not initialized') };
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    if (!auth) {
      console.warn('Auth not initialized; signOut skipped');
      setUser(null);
      setIsAdmin(false);
      return;
    }
    await fbSignOut(auth);
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session: null, isAdmin, loading, signUp, signIn, refreshRole, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
