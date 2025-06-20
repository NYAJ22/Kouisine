import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Keyboard,
  Alert,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface ShoppingItem {
  id: string;
  name: string;
  completed?: boolean;
  fromRecipe?: string; // Renommé pour être plus générique (catégorie/titre)
  price?: number; // --- NOUVEAU: Ajout du champ price ---
}

interface ShoppingListScreenProps {
  navigation: NavigationProp<any>;
}

const ShoppingListScreen: React.FC<ShoppingListScreenProps> = ({ navigation: _navigation }) => {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [newItemTitle, setNewItemTitle] = useState('');
  // --- NOUVEAU: State pour le prix de l'article manuel ---
  const [newItemPrice, setNewItemPrice] = useState('');

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
    const trimmedItem = newItem.trim();
    const trimmedTitle = newItemTitle.trim();
    const parsedPrice = parseFloat(newItemPrice.trim()); // Parse le prix

    if (!trimmedItem) {
      Alert.alert('Attention', 'Veuillez saisir un article.');
      return;
    }

    const exists = items.some(item => item.name.toLowerCase() === trimmedItem.toLowerCase() && (item.fromRecipe === trimmedTitle || (!item.fromRecipe && !trimmedTitle)));
    if (exists) {
      Alert.alert('Doublon', 'Cet article est déjà dans votre liste sous ce titre (ou sans titre).');
      return;
    }

    const uid = auth().currentUser?.uid;
    if (!uid) {
      Alert.alert('Erreur', 'Vous devez être connecté pour ajouter des articles.');
      return;
    }

    await firestore()
      .collection('users')
      .doc(uid)
      .collection('shoppingList')
      .add({
        name: trimmedItem,
        completed: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
        fromRecipe: trimmedTitle || null,
        price: isNaN(parsedPrice) ? null : parsedPrice, // --- Enregistre le prix ou null si non valide ---
      });

    setNewItem('');
    setNewItemTitle('');
    setNewItemPrice(''); // --- Réinitialise le prix ---
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

    Alert.alert(
      "Supprimer l'article",
      "Êtes-vous sûr de vouloir supprimer cet article de votre liste ?",
      [
        {
          text: "Annuler",
          style: "cancel"
        },
        {
          text: "Supprimer",
          onPress: async () => {
            try {
              await firestore()
                .collection('users')
                .doc(uid)
                .collection('shoppingList')
                .doc(id)
                .delete();
            } catch (error) {
              console.error("Erreur lors de la suppression de l'article:", error);
              Alert.alert("Erreur", "Impossible de supprimer l'article.");
            }
          },
          style: "destructive"
        },
      ]
    );
  };

  const groupedItems = items.reduce((acc, item) => {
    const key = item.fromRecipe || 'Autres articles';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as { [plat: string]: ShoppingItem[] });

  const sortedGroupKeys = Object.keys(groupedItems).sort((a, b) => {
    if (a === 'Autres articles') return 1;
    if (b === 'Autres articles') return -1;
    return a.localeCompare(b);
  });

  const completedCount = items.filter(item => item.completed).length;
  const totalCount = items.length;

  // --- NOUVEAU: Calcul du coût total ---
  const totalCost = items.reduce((sum, item) => {
    return sum + (item.price && !item.completed ? item.price : 0); // N'inclut que les articles non complétés avec un prix
  }, 0);

  // --- NOUVEAU: Calcul du coût total de tous les articles (complétés ou non)
  const grandTotalCost = items.reduce((sum, item) => {
    return sum + (item.price || 0);
  }, 0);


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#7b1fa2" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ma Liste de Courses 🛒</Text>
        <Text style={styles.headerSubtitle}>
          {completedCount} / {totalCount} articles complétés
        </Text>
        {/* --- NOUVEAU: Affichage du coût total --- */}
        {grandTotalCost > 0 && (
          <Text style={styles.totalCostText}>
            Coût estimé: {grandTotalCost.toFixed(0)} FCFA ({totalCost.toFixed(0)} restant)
          </Text>
        )}
      </View>

      {/* Section d'ajout modifiée */}
      <View style={styles.inputSection}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newItem}
            onChangeText={setNewItem}
            placeholder="Nom de l'article (ex: Lait)..."
            placeholderTextColor="#888"
            returnKeyType="next"
          />
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newItemTitle}
            onChangeText={setNewItemTitle}
            placeholder="Titre/Catégorie (ex: Dîner de Noël - optionnel)..."
            placeholderTextColor="#888"
            returnKeyType="next"
          />
        </View>
        {/* --- NOUVEAU CHAMP POUR LE PRIX MANUEL --- */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newItemPrice}
            onChangeText={setNewItemPrice}
            placeholder="Prix unitaire (optionnel)..."
            placeholderTextColor="#888"
            keyboardType="numeric"
            returnKeyType="done"
            onSubmitEditing={addItem}
          />
        </View>

        <TouchableOpacity style={styles.addButton} onPress={addItem}>
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {sortedGroupKeys.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📝</Text>
            <Text style={styles.emptyStateText}>Votre liste de courses est vide !</Text>
            <Text style={styles.emptyStateSubtext}>
              Ajoutez des articles manuellement ou depuis une recette.
            </Text>
          </View>
        ) : (
          sortedGroupKeys.map(groupKey => (
            <View key={groupKey} style={styles.groupContainer}>
              <Text style={styles.groupTitle}>{groupKey}</Text>
              {groupedItems[groupKey].map(item => (
                <View
                  key={item.id}
                  style={[
                    styles.itemContainer,
                    item.completed && styles.itemContainerCompleted,
                  ]}
                >
                  <TouchableOpacity
                    style={[styles.checkbox, item.completed && styles.checkboxCompleted]}
                    onPress={() => toggleItem(item.id, item.completed || false)}
                  >
                    {item.completed && <Text style={styles.checkmark}>✔</Text>}
                  </TouchableOpacity>
                  <Text
                    style={[styles.itemText, item.completed && styles.itemTextCompleted]}
                  >
                    {item.name}
                  </Text>
                  {/* --- NOUVEAU: Affichage du prix de l'article --- */}
                  {item.price !== undefined && item.price !== null && (
                    <Text style={[styles.itemPrice, item.completed && styles.itemTextCompleted]}>
                      {item.price.toFixed(0)} FCFA
                    </Text>
                  )}
                  <TouchableOpacity style={styles.deleteButton} onPress={() => removeItem(item.id)}>
                    <Text style={styles.deleteButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ShoppingListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  header: {
    backgroundColor: '#8e24aa', // Violet
    paddingVertical: 20,
    paddingHorizontal: 25,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e0e0e0',
    marginBottom: 10,
  },
  totalCostText: { // Nouveau style pour le coût total
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  inputSection: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  input: {
    fontSize: 17,
    paddingVertical: 15,
    paddingHorizontal: 20,
    color: '#333',
  },
  addButton: {
    backgroundColor: '#4caf50', // Vert éclatant
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#4caf50',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 19,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  groupContainer: {
    marginBottom: 25,
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingVertical: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#8e24aa', // Violet
    marginBottom: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 0, // Enlevé le séparateur pour ne pas avoir de double ligne
    borderBottomColor: '#eee',
  },
  itemContainerCompleted: {
    backgroundColor: '#f8f8f8', // Légère couleur pour les éléments complétés
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#8e24aa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  checkboxCompleted: {
    backgroundColor: '#8e24aa',
    borderColor: '#8e24aa',
  },
  checkmark: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemText: {
    fontSize: 17,
    color: '#333',
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'AvenirNext-Medium' : 'Roboto-Medium',
  },
  itemTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#888',
    fontFamily: Platform.OS === 'ios' ? 'AvenirNext-Regular' : 'Roboto-Regular',
  },
  itemPrice: { // Nouveau style pour le prix de l'article
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
    marginLeft: 10,
  },
  deleteButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#ffebee',
    marginLeft: 10,
  },
  deleteButtonText: {
    fontSize: 20,
    color: '#e53935',
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyStateIcon: {
    fontSize: 60,
    marginBottom: 20,
    opacity: 0.6,
  },
  emptyStateText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});
