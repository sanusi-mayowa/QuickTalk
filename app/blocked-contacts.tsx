import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { auth, db, COLLECTIONS } from "@/lib/firebase";
import { collection, doc, getDocs, onSnapshot, query } from "firebase/firestore";
import Toast from "react-native-toast-message";
import FirebaseService from "@/lib/firebase";

interface BlockedEntry {
  id: string; // blocked profile id (doc id)
  blockedProfileId: string;
  blockedAt?: string;
  profile?: {
    username?: string;
    phone?: string;
    profile_picture_url?: string | null;
  } | null;
  savedDisplayName?: string | null;
}

export default function BlockedContactsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [myProfileId, setMyProfileId] = useState<string>("");
  const [items, setItems] = useState<BlockedEntry[]>([]);

  // Resolve current user profile id (by auth_user_id)
  useEffect(() => {
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const q = query(collection(db, COLLECTIONS.USER_PROFILES),);
        // app elsewhere queries by auth_user_id; do the same
        const { where } = await import("firebase/firestore");
        const q2 = query(collection(db, COLLECTIONS.USER_PROFILES), where("auth_user_id", "==", user.uid));
        const snap = await getDocs(q2);
        const me = snap.docs[0];
        if (me) setMyProfileId(me.id);
      } catch {}
    })();
  }, []);

  // Subscribe to blocked list and hydrate with profile data
  useEffect(() => {
    if (!myProfileId) return;
    const blockedCol = collection(db, COLLECTIONS.USER_PROFILES, myProfileId, "blocked");
    const unsub = onSnapshot(blockedCol, async (qs) => {
      const base: BlockedEntry[] = qs.docs
        .map((d) => {
          const data: any = d.data();
          return {
            id: d.id,
            blockedProfileId: data.blockedProfileId || d.id,
            blockedAt: (data.blockedAt?.toDate?.() || new Date()).toISOString?.() || undefined,
            profile: null,
            savedDisplayName: null,
            // mark active based on fields
            ...(data || {}),
          } as any;
        })
        // Only include active blocks (no unblockedAt and not explicitly blocked=false)
        .filter((e: any) => e.blocked !== false && !e.unblockedAt);
      // Fetch minimal profile info for each blocked id
      const hydrated = await Promise.all(
        base.map(async (b) => {
          try {
            const ref = doc(db, COLLECTIONS.USER_PROFILES, b.blockedProfileId);
            const { getDoc } = await import("firebase/firestore");
            const snap = await getDoc(ref);
            if (snap.exists()) {
              const p: any = snap.data();
              // Try to load saved contact name
              let savedDisplayName: string | null = null;
              try {
                const contactRef = doc(db, COLLECTIONS.USER_PROFILES, myProfileId, 'contacts', b.blockedProfileId);
                const contactSnap = await getDoc(contactRef);
                if (contactSnap.exists()) {
                  const c: any = contactSnap.data();
                  const first = (c.first_name || '').toString().trim();
                  const last = (c.last_name || '').toString().trim();
                  savedDisplayName = (c.displayName || `${first} ${last}`.trim() || '').trim() || null;
                }
              } catch {}
              return {
                ...b,
                profile: {
                  username: p.username,
                  phone: p.phone,
                  profile_picture_url: p.profile_picture_url || p.profile_picture_data || null,
                },
                savedDisplayName,
              } as BlockedEntry;
            }
          } catch {}
          return b;
        })
      );
      setItems(hydrated);
      setLoading(false);
    });
    return () => unsub();
  }, [myProfileId]);

  const onUnblock = useCallback(async (blockedProfileId: string) => {
    try {
      if (!myProfileId) return;
      // Optimistically remove from list
      setItems((prev) => prev.filter((x) => x.blockedProfileId !== blockedProfileId));
      await FirebaseService.unblockUser(myProfileId, blockedProfileId);
      Toast.show({ type: 'success', text1: 'User unblocked' });
    } catch (e: any) {
      // Rollback on failure
      setItems((prev) => prev);
      Toast.show({ type: 'error', text1: 'Failed to unblock', text2: e?.message || '' });
    }
  }, [myProfileId]);

  const renderItem = ({ item }: { item: BlockedEntry }) => {
    return (
      <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
        {item.profile?.profile_picture_url ? (
          <Image source={{ uri: item.profile.profile_picture_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.border }]}>
            <Feather name="user" size={20} color={theme.colors.mutedText} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {item.savedDisplayName || item.profile?.username || item.profile?.phone || item.blockedProfileId}
          </Text>
          {!!item.profile?.phone && (
            <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>{item.profile.phone}</Text>
          )}
        </View>
        <TouchableOpacity style={[styles.unblockBtn, { borderColor: '#E53935' }]} onPress={() => onUnblock(item.blockedProfileId)}>
          <Feather name="unlock" size={16} color="#E53935" />
          <Text style={[styles.unblockText, { color: '#E53935' }]}>Unblock</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#3A805B" }}>
      <View style={[styles.container]}>
        <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="chevron-left" size={24} color={theme.colors.primaryText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.primaryText }]}>Blocked contacts</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={styles.center}> 
            <ActivityIndicator size="small" color="#3A805B" />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Feather name="slash" size={24} color={theme.colors.mutedText} />
            <Text style={{ marginTop: 8, color: theme.colors.mutedText }}>No blocked contacts</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#3A805B",
    paddingTop: 40,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 12 },
  unblockBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderRadius: 8 },
  unblockText: { fontSize: 12, fontWeight: '600' },
});


