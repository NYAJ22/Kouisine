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
}

interface ShoppingListScreenProps {
  navigation: NavigationProp<any>;
}

const ShoppingListScreen: React.FC<ShoppingListScreenProps> = ({ navigation: _navigation }) => {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');
  // Nouveau state pour le titre/catégorie de l'article manuel
  const [newItemTitle, setNewItemTitle] = useState('');

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
    const trimmedTitle = newItemTitle.trim(); // Trim le titre aussi

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

    // Ajoute le champ 'fromRecipe' (qui servira de titre/catégorie)
    await firestore()
      .collection('users')
      .doc(uid)
      .collection('shoppingList')
      .add({
        name: trimmedItem,
        completed: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
        fromRecipe: trimmedTitle || null, // Utilise trimmedTitle ou null si vide pour 'Autres articles'
      });

    setNewItem('');
    setNewItemTitle(''); // Réinitialise le titre après l'ajout
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

  // Regroupe les items par plat (fromRecipe) et trie les plats
  const groupedItems = items.reduce((acc, item) => {
    const key = item.fromRecipe || 'Autres articles'; // Renommer 'Autres' pour plus de clarté
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as { [plat: string]: ShoppingItem[] });

  // Trie les groupes (ex: "Autres articles" en dernier)
  const sortedGroupKeys = Object.keys(groupedItems).sort((a, b) => {
    if (a === 'Autres articles') return 1;
    if (b === 'Autres articles') return -1;
    return a.localeCompare(b);
  });


  const completedCount = items.filter(item => item.completed).length;
  const totalCount = items.length;


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#7b1fa2" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ma Liste de Courses 🛒</Text>
        <Text style={styles.headerSubtitle}>
          {completedCount} / {totalCount} articles complétés
        </Text>
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
            returnKeyType="next" // Change pour passer au champ titre
            onSubmitEditing={() => { /* Optionnel: focus sur le champ titre si nécessaire */ }}
          />
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newItemTitle}
            onChangeText={setNewItemTitle}
            placeholder="Titre/Catégorie (ex: Petit Déjeuner, Dîner, Maison)..."
            placeholderTextColor="#888"
            returnKeyType="done"
            onSubmitEditing={addItem}
          />
          <TouchableOpacity
            onPress={addItem}
            style={styles.addButton}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Liste des articles */}
      <View style={styles.listSection}>
        {totalCount === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📝</Text>
            <Text style={styles.emptyStateText}>Votre liste est vide</Text>
            <Text style={styles.emptyStateSubtext}>Ajoutez votre premier article ci-dessus pour commencer vos achats !</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent}>
            {sortedGroupKeys.map(plat => (
              <View key={plat} style={styles.groupContainer}>
                <Text style={styles.groupTitle}>
                  {plat}
                </Text>
                {groupedItems[plat].map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.itemRow, item.completed && styles.itemRowCompleted]}
                    onPress={() => toggleItem(item.id, item.completed ?? false)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemContent}>
                      <View style={[styles.checkbox, item.completed && styles.checkboxCompleted]}>
                        {item.completed && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={[styles.itemText, item.completed && styles.itemTextCompleted]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeItem(item.id)}
                      style={styles.deleteButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.deleteButtonText}>✖</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  header: {
    backgroundColor: '#7b1fa2',
    paddingHorizontal: 25,
    paddingVertical: 35,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#4a148c',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'AvenirNext-Bold' : 'Roboto-Bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'AvenirNext-Medium' : 'Roboto-Medium',
  },
  inputSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: -30,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    zIndex: 1,
    paddingVertical: 10, // Ajout de padding vertical pour espacer les deux champs
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 18, // Garde le padding horizontal
    paddingVertical: 8, // Réduit le padding vertical pour les deux champs
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#eef3f7',
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === 'ios' ? 15 : 12,
    borderRadius: 12,
    fontSize: 17,
    color: '#333',
    borderWidth: 1,
    borderColor: '#dde8f0',
    fontFamily: Platform.OS === 'ios' ? 'AvenirNext-Regular' : 'Roboto-Regular',
  },
  addButton: {
    backgroundColor: '#ffc107',
    marginLeft: 15,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffc107',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '300',
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  listContent: {
    paddingBottom: 30,
  },
  groupContainer: {
    marginBottom: 25,
  },
  groupTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 12,
    color: '#4a148c',
    fontFamily: Platform.OS === 'ios' ? 'AvenirNext-DemiBold' : 'Roboto-Bold',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 5,
  },
  itemRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 15,
    marginBottom: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderLeftWidth: 5,
    borderLeftColor: '#8e24aa',
  },
  itemRowCompleted: {
    backgroundColor: '#eef3f7',
    borderLeftColor: '#ffc107',
    opacity: 0.9,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#bdbdbd',
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
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
  deleteButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#ffebee',
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
    opacity: 0.7,
  },
  emptyStateText: {
    fontSize: 20,
    color: '#607d8b',
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'AvenirNext-Bold' : 'Roboto-Bold',
  },
  emptyStateSubtext: {
    fontSize: 15,
    color: '#90a4ae',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'AvenirNext-Regular' : 'Roboto-Regular',
  },
});

export default ShoppingListScreen;
