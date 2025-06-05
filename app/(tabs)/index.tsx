import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
// import ChatItem from '@/components/ChatItem';
// import { db, CONTACTS_COLLECTION, USERS_COLLECTION, CHATS_COLLECTION } from '@/lib/firebase';

// import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
// import { auth } from '@/lib/firebase';

export default function ChatsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
//   const [chats, setChats] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [archivedChats, setArchivedChats] = useState([]);
  
  // useEffect(() => {
  //   loadChats();
  // }, []);

//   const loadChats = async () => {
//     try {
//       const currentUser = auth.currentUser;
//       if (!currentUser) return;

//       const chatsRef = collection(db, CHATS_COLLECTION);
//       const q = query(chatsRef, where('participants', 'array-contains', currentUser.uid));
//       const querySnapshot = await getDocs(q);
      
//       const activeChats = [];
//       const archived = [];

//       querySnapshot.docs.forEach(doc => {
//         const chatData = { id: doc.id, ...doc.data() };
//         if (chatData.isArchived) {
//           archived.push(chatData);
//         } else {
//           activeChats.push(chatData);
//         }
//       });

//       setChats(activeChats);
//       setArchivedChats(archived);
//     } catch (error) {
//       console.error('Error loading chats:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleChatPress = (chatId: string) => {
//     router.push(`/chat/${chatId}`);
//   };

//   const handleNewContact = () => {
//     router.push('/new-contact');
//   };

//   const handleArchiveChat = async (chatId: string) => {
//     try {
//       const chatRef = doc(db, CHATS_COLLECTION, chatId);
//       await updateDoc(chatRef, {
//         isArchived: true,
//         archivedAt: new Date().toISOString()
//       });
//       await loadChats();
//     } catch (error) {
//       console.error('Error archiving chat:', error);
//     }
//   };

//   const handleMuteChat = async (chatId: string) => {
//     try {
//       const chatRef = doc(db, CHATS_COLLECTION, chatId);
//       const chat = chats.find(c => c.id === chatId);
//       await updateDoc(chatRef, {
//         isMuted: !chat.isMuted
//       });
//       await loadChats();
//     } catch (error) {
//       console.error('Error muting chat:', error);
//     }
//   };

//   const handleDeleteChat = async (chatId: string) => {
//     try {
//       const chatRef = doc(db, CHATS_COLLECTION, chatId);
//       await deleteDoc(chatRef);
//       await loadChats();
//     } catch (error) {
//       console.error('Error deleting chat:', error);
//     }
//   };

//   const filteredChats = [...chats, ...archivedChats].filter(chat => 
//     chat.name.toLowerCase().includes(searchQuery.toLowerCase())
//   );

//   const renderSectionHeader = (title: string) => (
//     <View style={styles.sectionHeader}>
//       <Text style={styles.sectionTitle}>{title}</Text>
//     </View>
//   );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
        <Feather name="search" size={20} color="white" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ask QuickTalk or Search"
            value={searchQuery}
            placeholderTextColor="white"
            onChangeText={setSearchQuery}
          />
        </View>
      </View>
      
      {/* <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatItem
            chat={item}
            onPress={() => handleChatPress(item.id)}
            onArchive={handleArchiveChat}
            onMute={handleMuteChat}
            onDelete={handleDeleteChat}
          />
        )}
        ListHeaderComponent={() => archivedChats.length > 0 ? renderSectionHeader('Archived') : null}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      /> */}
      
      {/* <TouchableOpacity 
        style={styles.newChatButton}
        onPress={handleNewContact}
      >
        <Plus size={24} color="white" />
      </TouchableOpacity> */}
    </View>
  
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3A805B',
  },
  searchContainer: {
    padding: 16,
    // backgroundColor: '#6A5ACD',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6eba96',
    borderRadius: 50,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    outlineStyle: 'none',
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 80,
  },
  newChatButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6A5ACD',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sectionHeader: {
    backgroundColor: '#F0F0F0',
    padding: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
});