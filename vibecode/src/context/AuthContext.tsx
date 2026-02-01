import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { auth } from '../firebaseConfig';
import { onAuthStateChanged, type User, signInWithEmailAndPassword, signOut } from 'firebase/auth';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, pass: string) => Promise<void>;
    logout: () => Promise<void>;
    verifyPasscode: (code: string) => Promise<boolean>;
    isOwner: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hardcoded owner email for simple "Owner" check
// In a real app, you'd use Custom Claims or a Firestore "roles" collection.
// const OWNER_EMAIL = "owner@vibecode.com"; // Unused for now

// SHA-256 Hash of "044036"
const PASSCODE_HASH = "26a7af75b54847dc0ccbd965c552469eae06314f732af768aaf4b8287c9ef00e";

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const login = async (email: string, pass: string) => {
        await signInWithEmailAndPassword(auth, email, pass);
    };

    const logout = async () => {
        setIsAuthenticated(false);
        await signOut(auth);
    };

    const verifyPasscode = async (code: string): Promise<boolean> => {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(code);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            if (hashHex === PASSCODE_HASH) {
                setIsAuthenticated(true);
                return true;
            }
            return false;
        } catch (e) {
            console.error("Crypto error", e);
            return false;
        }
    };

    // Owner if Firebase user exists OR passcode verified
    const isOwner = !!user || isAuthenticated;

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, isOwner, verifyPasscode }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};
