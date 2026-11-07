import { 
  auth,
  db, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy 
} from "./firebase";

export interface Conversation {
  id: string;
  title: string;
  mode: "parent" | "child";
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
  createdAt?: string;
  isHelpful?: boolean | null;
  followUps?: string[];
  groundingMetadata?: any;
  modelUsed?: string;
}

// Helper to verify active Firebase authentication matching the requested user ID
function isUserAuthenticatedFor(uid: string): boolean {
  if (!uid || uid === "guest" || uid.startsWith("guest")) return false;
  const current = auth.currentUser;
  return !!(current && current.uid === uid);
}

// Subscribe to conversation list for a user
export function subscribeConversations(
  uid: string, 
  onUpdate: (conversations: Conversation[]) => void
) {
  if (!isUserAuthenticatedFor(uid)) {
    // Return local storage conversations for guest / unauthenticated mode
    const localKey = uid && uid !== "guest" ? `GUARDIAN_CONVERSATIONS_${uid}` : "GUARDIAN_GUEST_CONVERSATIONS";
    try {
      const saved = localStorage.getItem(localKey);
      if (saved) {
        onUpdate(JSON.parse(saved));
      } else {
        onUpdate([]);
      }
    } catch {
      onUpdate([]);
    }
    return () => {};
  }

  const convsRef = collection(db, "users", uid, "conversations");
  const q = query(convsRef, orderBy("updatedAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const list: Conversation[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as Conversation);
    });
    onUpdate(list);
  }, (err) => {
    console.warn("Firestore conversations snapshot warning/error:", err?.message || err);
    // Fallback to local
    const localKey = `GUARDIAN_CONVERSATIONS_${uid}`;
    try {
      const saved = localStorage.getItem(localKey);
      if (saved) onUpdate(JSON.parse(saved));
    } catch {
      onUpdate([]);
    }
  });
}

// Create new conversation
export async function createConversation(
  uid: string, 
  title: string, 
  mode: "parent" | "child"
): Promise<string> {
  const convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const conv: Conversation = {
    id: convId,
    title: title || "New Conversation",
    mode: mode,
    createdAt: now,
    updatedAt: now,
    lastMessage: ""
  };

  if (!isUserAuthenticatedFor(uid)) {
    const localKey = uid && uid !== "guest" ? `GUARDIAN_CONVERSATIONS_${uid}` : "GUARDIAN_GUEST_CONVERSATIONS";
    const existing = JSON.parse(localStorage.getItem(localKey) || "[]");
    localStorage.setItem(localKey, JSON.stringify([conv, ...existing]));
    return convId;
  }

  try {
    const docRef = doc(db, "users", uid, "conversations", convId);
    await setDoc(docRef, conv);

    // Save local backup
    const localKey = `GUARDIAN_CONVERSATIONS_${uid}`;
    const existing = JSON.parse(localStorage.getItem(localKey) || "[]");
    localStorage.setItem(localKey, JSON.stringify([conv, ...existing]));

    return convId;
  } catch (err: any) {
    console.warn("Error creating conversation in Firestore (using local storage fallback):", err?.message || err);
    const localKey = `GUARDIAN_CONVERSATIONS_${uid}`;
    const existing = JSON.parse(localStorage.getItem(localKey) || "[]");
    localStorage.setItem(localKey, JSON.stringify([conv, ...existing]));
    return convId;
  }
}

// Update conversation title or lastMessage
export async function updateConversation(
  uid: string,
  conversationId: string,
  updates: Partial<Conversation>
) {
  const now = new Date().toISOString();
  const payload = { ...updates, updatedAt: now };

  if (!isUserAuthenticatedFor(uid)) {
    const localKey = uid && uid !== "guest" ? `GUARDIAN_CONVERSATIONS_${uid}` : "GUARDIAN_GUEST_CONVERSATIONS";
    const existing: Conversation[] = JSON.parse(localStorage.getItem(localKey) || "[]");
    const updated = existing.map(c => c.id === conversationId ? { ...c, ...payload } : c);
    localStorage.setItem(localKey, JSON.stringify(updated));
    return;
  }

  try {
    const docRef = doc(db, "users", uid, "conversations", conversationId);
    await updateDoc(docRef, payload);
  } catch (err: any) {
    console.warn("Firestore update conversation warning (using local fallback):", err?.message || err);
    const localKey = `GUARDIAN_CONVERSATIONS_${uid}`;
    const existing: Conversation[] = JSON.parse(localStorage.getItem(localKey) || "[]");
    const updated = existing.map(c => c.id === conversationId ? { ...c, ...payload } : c);
    localStorage.setItem(localKey, JSON.stringify(updated));
  }
}

// Delete conversation and all its messages
export async function deleteConversation(uid: string, conversationId: string) {
  if (!isUserAuthenticatedFor(uid)) {
    const localKey = uid && uid !== "guest" ? `GUARDIAN_CONVERSATIONS_${uid}` : "GUARDIAN_GUEST_CONVERSATIONS";
    const existing: Conversation[] = JSON.parse(localStorage.getItem(localKey) || "[]");
    const filtered = existing.filter(c => c.id !== conversationId);
    localStorage.setItem(localKey, JSON.stringify(filtered));
    localStorage.removeItem(uid && uid !== "guest" ? `GUARDIAN_MSGS_${uid}_${conversationId}` : `GUARDIAN_GUEST_MSGS_${conversationId}`);
    return;
  }

  try {
    const docRef = doc(db, "users", uid, "conversations", conversationId);
    await deleteDoc(docRef);

    // Clean up local
    const localKey = `GUARDIAN_CONVERSATIONS_${uid}`;
    const existing: Conversation[] = JSON.parse(localStorage.getItem(localKey) || "[]");
    const filtered = existing.filter(c => c.id !== conversationId);
    localStorage.setItem(localKey, JSON.stringify(filtered));
    localStorage.removeItem(`GUARDIAN_MSGS_${uid}_${conversationId}`);
  } catch (err: any) {
    console.warn("Firestore delete conversation warning:", err?.message || err);
  }
}

// Subscribe to messages in a conversation
export function subscribeMessages(
  uid: string,
  conversationId: string,
  onUpdate: (messages: ChatMessage[]) => void
) {
  if (!conversationId) {
    onUpdate([]);
    return () => {};
  }

  if (!isUserAuthenticatedFor(uid)) {
    const localKey = uid && uid !== "guest" ? `GUARDIAN_MSGS_${uid}_${conversationId}` : `GUARDIAN_GUEST_MSGS_${conversationId}`;
    try {
      const saved = localStorage.getItem(localKey);
      onUpdate(saved ? JSON.parse(saved) : []);
    } catch {
      onUpdate([]);
    }
    return () => {};
  }

  const msgsRef = collection(db, "users", uid, "conversations", conversationId, "messages");
  const q = query(msgsRef, orderBy("createdAt", "asc"));

  return onSnapshot(q, (snapshot) => {
    const msgs: ChatMessage[] = [];
    snapshot.forEach((docSnap) => {
      msgs.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
    });
    onUpdate(msgs);

    // Save local backup
    const localKey = `GUARDIAN_MSGS_${uid}_${conversationId}`;
    localStorage.setItem(localKey, JSON.stringify(msgs));
  }, (err) => {
    console.warn("Firestore messages snapshot warning, using local fallback:", err?.message || err);
    const localKey = `GUARDIAN_MSGS_${uid}_${conversationId}`;
    try {
      const saved = localStorage.getItem(localKey);
      if (saved) onUpdate(JSON.parse(saved));
    } catch {
      onUpdate([]);
    }
  });
}

// Save message to conversation
export async function saveMessage(
  uid: string,
  conversationId: string,
  msg: ChatMessage
) {
  if (!conversationId) return;

  const now = new Date().toISOString();
  const payload: ChatMessage = {
    ...msg,
    createdAt: msg.createdAt || now
  };

  if (!isUserAuthenticatedFor(uid)) {
    const localKey = uid && uid !== "guest" ? `GUARDIAN_MSGS_${uid}_${conversationId}` : `GUARDIAN_GUEST_MSGS_${conversationId}`;
    const existing: ChatMessage[] = JSON.parse(localStorage.getItem(localKey) || "[]");
    const index = existing.findIndex(m => m.id === msg.id);
    let updated: ChatMessage[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = payload;
    } else {
      updated = [...existing, payload];
    }
    localStorage.setItem(localKey, JSON.stringify(updated));

    // Update last message in conv
    updateConversation(uid, conversationId, { lastMessage: msg.text });
    return;
  }

  try {
    const msgRef = doc(db, "users", uid, "conversations", conversationId, "messages", msg.id);
    await setDoc(msgRef, payload);

    // Update parent conversation document
    await updateConversation(uid, conversationId, { lastMessage: msg.text });
  } catch (err: any) {
    console.warn("Firestore save message warning (saving local backup):", err?.message || err);
    const localKey = `GUARDIAN_MSGS_${uid}_${conversationId}`;
    const existing: ChatMessage[] = JSON.parse(localStorage.getItem(localKey) || "[]");
    const index = existing.findIndex(m => m.id === msg.id);
    let updated: ChatMessage[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = payload;
    } else {
      updated = [...existing, payload];
    }
    localStorage.setItem(localKey, JSON.stringify(updated));
  }
}

// Delete a message
export async function deleteMessage(
  uid: string,
  conversationId: string,
  messageId: string
) {
  if (!conversationId || !messageId) return;

  if (!uid || uid === "guest") {
    const localKey = `GUARDIAN_GUEST_MSGS_${conversationId}`;
    const existing: ChatMessage[] = JSON.parse(localStorage.getItem(localKey) || "[]");
    const filtered = existing.filter(m => m.id !== messageId);
    localStorage.setItem(localKey, JSON.stringify(filtered));
    return;
  }

  try {
    const msgRef = doc(db, "users", uid, "conversations", conversationId, "messages", messageId);
    await deleteDoc(msgRef);
  } catch (err) {
    console.warn("Firestore delete message error:", err);
  }
}
