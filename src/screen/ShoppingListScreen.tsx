import React, { useState } from 'react';
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

interface ShoppingItem {
  id: string;
  name: string;
}

interface ShoppingListScreenProps {
  navigation: NavigationProp<any>;
}

const ShoppingListScreen: React.FC<ShoppingListScreenProps> = ({ navigation: _navigation }) => {
  const [items, setItems] = useState<ShoppingItem[]>([
    { id: '1', name: 'Pommes' },
    { id: '2', name: 'Pain' },
    { id: '3', name: 'Œufs' },
  ]);
  const [newItem, setNewItem] = useState<string>('');

  const addItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed) {
      return;
    }

    const exists = items.some(item => item.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      Alert.alert('Doublon', 'Cet article est déjà dans la liste.');
      return;
    }

    const item: ShoppingItem = {
      id: Date.now().toString(),
      name: trimmed,
    };

    setItems([...items, item]);
    setNewItem('');
    Keyboard.dismiss();
  };

  const removeItem = (id: string) => {
    Alert.alert(
      'Supprimer',
      'Voulez-vous supprimer cet article ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => setItems(items.filter(item => item.id !== id)),
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: ShoppingItem }) => (
    <View style={styles.itemRow}>
      <Text style={styles.itemText}>• {item.name}</Text>
      <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.deleteButton}>
        <Text style={styles.deleteButtonText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2d7d5e" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📝 Ma Liste de Courses</Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          value={newItem}
          onChangeText={setNewItem}
          placeholder="Ajouter un article..."
          placeholderTextColor="#aaa"
          style={styles.input}
          onSubmitEditing={addItem}
        />
        <TouchableOpacity onPress={addItem} style={styles.addButton}>
          <Text style={styles.addButtonText}>＋</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f2e7',
  },
  header: {
    backgroundColor: '#2d7d5e',
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 16,
    elevation: 2,
  },
  addButton: {
    backgroundColor: '#2d7d5e',
    marginLeft: 10,
    padding: 12,
    borderRadius: 8,
    elevation: 2,
  },
  addButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  itemRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
  },
  itemText: {
    fontSize: 16,
    color: '#333',
  },
  deleteButton: {
    padding: 5,
  },
  deleteButtonText: {
    fontSize: 18,
  },
});

export default ShoppingListScreen;
