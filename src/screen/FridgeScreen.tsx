import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';

// Définition du type pour un aliment du frigo
type FridgeItem = {
  id: string;
  name: string;
  quantity: string;
  expiryDate: string;
};

const STORAGE_KEY = '@fridge_items';

const FridgeScreen = () => {
  const [items, setItems] = useState<FridgeItem[]>([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
          setItems(JSON.parse(json));
        }
      } catch (err) {
        console.error('Erreur de chargement :', err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const saveData = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (err) {
        console.error('Erreur de sauvegarde :', err);
      }
    };
    saveData();
  }, [items]);

  const addItem = () => {
    if (!name || !quantity || !expiryDate) {
      Alert.alert('Erreur', 'Tous les champs sont obligatoires.');
      return;
    }

    const newItem: FridgeItem = {
      id: uuid.v4() as string,
      name,
      quantity,
      expiryDate,
    };

    setItems((prev) => [newItem, ...prev]);
    setName('');
    setQuantity('');
    setExpiryDate('');
  };

  const deleteItem = (id: string) => {
    Alert.alert('Supprimer', 'Supprimer cet aliment ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => setItems((prev) => prev.filter((item) => item.id !== id)),
      },
    ]);
  };

  const renderItem = ({ item }: { item: FridgeItem }) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemDetail}>Quantité : {item.quantity}</Text>
        <Text style={styles.itemDetail}>Date d'expiration : {item.expiryDate}</Text>
      </View>
      <TouchableOpacity onPress={() => deleteItem(item.id)}>
        <Text style={styles.deleteButton}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Mon Frigo 🧊</Text>

      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Nom de l'aliment"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
        <TextInput
          placeholder="Quantité"
          value={quantity}
          onChangeText={setQuantity}
          style={styles.input}
        />
        <TextInput
          placeholder="Date d'expiration (JJ/MM/AAAA)"
          value={expiryDate}
          onChangeText={setExpiryDate}
          style={styles.input}
        />
        <TouchableOpacity style={styles.addButton} onPress={addItem}>
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucun aliment ajouté.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f2e7',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2d7d5e',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 12,
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  input: {
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: '#2d7d5e',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#2d7d5e',
  },
  itemDetail: {
    fontSize: 14,
    color: '#555',
  },
  deleteButton: {
    fontSize: 20,
    color: '#d9534f',
    paddingHorizontal: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },
});

export default FridgeScreen;
