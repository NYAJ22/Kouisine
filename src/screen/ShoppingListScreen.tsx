import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  Alert,
  StatusBar,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface ShoppingItem {
  id: string;
  name: string;
  completed?: boolean;
}

interface ShoppingListScreenProps {
  navigation: NavigationProp<any>;
}

const ShoppingListScreen: React.FC<ShoppingListScreenProps> = ({ navigation: _navigation }) => {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(uid)
      .collection('shoppingList')
      .onSnapshot(snapshot => {
        setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShoppingItem)));
      });
    return unsubscribe;
  }, []);

  const addItem = async () => {
    const trimmed = newItem.trim();
    if (!trimmed) {
      return;
    }

    const exists = items.some(item => item.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      Alert.alert('Doublon', 'Cet article est déjà dans la liste.');
      return;
    }

    const uid = auth().currentUser?.uid;
    if (!uid) return;
    await firestore()
      .collection('users')
      .doc(uid)
      .collection('shoppingList')
      .add({ name: newItem.trim(), completed: false });
    setNewItem('');
    Keyboard.dismiss();
  };

  const toggleItem = async (id: string, completed: boolean) => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    await firestore()
      .collection('users')
      .doc(uid)
      .collection('shoppingList')
      .doc(id)
      .update({ completed: !completed });
  };

  const removeItem = async (id: string) => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    await firestore()
      .collection('users')
      .doc(uid)
      .collection('shoppingList')
      .doc(id)
      .delete();
  };

  const completedCount = items.filter(item => item.completed).length;
  const totalCount = items.length;

  const renderItem = ({ item }: { item: ShoppingItem }) => (
    <TouchableOpacity
      style={[styles.itemRow, item.completed && styles.itemRowCompleted]}
      onPress={() => toggleItem(item.id, item.completed ?? false)}
      activeOpacity={0.7}
    >
      <View style={styles.itemContent}>
        <View style={[styles.checkbox, item.completed && styles.checkboxCompleted]}>
          {item.completed && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.itemText, item.completed && styles.itemTextCompleted]}>
          {item.name}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => removeItem(item.id)}
        style={styles.deleteButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.deleteButtonText}>🗑️</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A5D4A" />
      {/* Header avec gradient effect */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🛒 Ma Liste de Courses</Text>
        <Text style={styles.headerSubtitle}>
          {completedCount}/{totalCount} articles complétés
        </Text>
      </View>

      {/* Section d'ajout */}
      <View style={styles.inputSection}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newItem}
            onChangeText={setNewItem}
            placeholder="Ajouter un nouvel article..."
            placeholderTextColor="#999"
            returnKeyType="done"
            onSubmitEditing={addItem}
          />
          <TouchableOpacity
            onPress={addItem}
            style={styles.addButton}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Liste des articles */}
      <View style={styles.listSection}>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📝</Text>
            <Text style={styles.emptyStateText}>Votre liste est vide</Text>
            <Text style={styles.emptyStateSubtext}>Ajoutez votre premier article ci-dessus</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#1A5D4A',
    paddingHorizontal: 20,
    paddingVertical: 25,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    textAlign: 'center',
  },
  inputSection: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  addButton: {
    backgroundColor: '#28a745',
    marginLeft: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  itemRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#4a90e2',
  },
  itemRowCompleted: {
    backgroundColor: '#f8f9fa',
    borderLeftColor: '#28a745',
    opacity: 0.8,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#dee2e6',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  checkboxCompleted: {
    backgroundColor: '#28a745',
    borderColor: '#28a745',
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  itemTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#6c757d',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#6c757d',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
});

export default ShoppingListScreen;
