import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  imageUrl?: string;
  createdAt?: FirebaseFirestoreTypes.FieldValue;
  createdBy?: string; // UID de l'utilisateur qui a créé la recette
  authorName?: string; // Nom d'affichage de l'auteur
}

const RecipeListScreen: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    description: '',
    ingredients: '',
    steps: '',
    imageUrl: '',
  });
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null); // Nouveau: État pour la recette en cours d'édition
  const [userNames, setUserNames] = useState<{ [uid: string]: string }>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);

  const currentUser = auth().currentUser; // Récupérer l'utilisateur courant une seule fois

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('recipes')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        const fetchedRecipes = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Recipe));
        setRecipes(fetchedRecipes);
        setLoading(false);
      }, error => {
        console.error("Erreur de chargement des recettes:", error);
        Alert.alert('Erreur', 'Impossible de charger les recettes.');
        setLoading(false);
      });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Pour chaque recette sans authorName, récupère le nom depuis Firestore
    const missingNames = recipes.filter(r => !r.authorName && r.createdBy);
    missingNames.forEach(r => {
      if (!userNames[r.createdBy!]) {
        firestore().collection('users').doc(r.createdBy!).get().then(doc => {
          const data = doc.data();
          setUserNames(prev => ({
            ...prev,
            [r.createdBy!]: data?.name || data?.userName || data?.displayName || 'Utilisateur inconnu',
          }));
        });
      }
    });

    const lowercasedQuery = searchQuery.toLowerCase();
    const filtered = recipes.filter(recipe =>
      recipe.name.toLowerCase().includes(lowercasedQuery) ||
      recipe.description.toLowerCase().includes(lowercasedQuery) ||
      recipe.ingredients.some(ingredient => ingredient.toLowerCase().includes(lowercasedQuery))
    );
    setFilteredRecipes(filtered);
  }, [recipes, userNames, searchQuery]);

  // Fonction pour ouvrir le modal en mode ajout ou édition
  const openRecipeModal = (recipeToEdit?: Recipe) => {
    if (recipeToEdit) {
      setEditingRecipe(recipeToEdit);
      setNewRecipe({
        name: recipeToEdit.name,
        description: recipeToEdit.description,
        ingredients: recipeToEdit.ingredients.join('\n'),
        steps: recipeToEdit.steps.join('\n'),
        imageUrl: recipeToEdit.imageUrl || '',
      });
    } else {
      setEditingRecipe(null);
      setNewRecipe({ name: '', description: '', ingredients: '', steps: '', imageUrl: '' });
    }
    setModalVisible(true);
  };

  // Fonction pour ajouter ou modifier une recette
  const handleSaveRecipe = async () => {
    if (!newRecipe.name.trim() || !newRecipe.ingredients.trim() || !newRecipe.steps.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le nom, les ingrédients et les étapes.');
      return;
    }

    if (!currentUser) {
      Alert.alert('Erreur', 'Vous devez être connecté pour ajouter/modifier une recette.');
      return;
    }

    try {
      const recipeData = {
        name: newRecipe.name.trim(),
        description: newRecipe.description.trim() || 'Une délicieuse recette à découvrir !',
        ingredients: newRecipe.ingredients.split('\n').map(i => i.trim()).filter(Boolean),
        steps: newRecipe.steps.split('\n').map(s => s.trim()).filter(Boolean),
        imageUrl: newRecipe.imageUrl.trim() || '',
        createdBy: currentUser.uid,
        authorName: currentUser.displayName || 'Utilisateur inconnu',
      };

      if (editingRecipe) {
        // Mode édition
        await firestore().collection('recipes').doc(editingRecipe.id).update(recipeData);
        Alert.alert('Succès', 'Recette modifiée avec succès !');
      } else {
        // Mode ajout
        await firestore().collection('recipes').add({
          ...recipeData,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
        Alert.alert('Succès', 'Recette ajoutée avec succès !');
      }
      setModalVisible(false);
      setNewRecipe({ name: '', description: '', ingredients: '', steps: '', imageUrl: '' });
      setEditingRecipe(null); // Réinitialiser la recette en édition
    } catch (e) {
      console.error("Erreur lors de l'enregistrement de la recette:", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      Alert.alert('Erreur', `Impossible d'enregistrer la recette: ${errorMessage}`);
    }
  };

  // Fonction pour supprimer une recette
  const handleDeleteRecipe = async (recipeId: string) => {
    if (!currentUser) {
      Alert.alert('Erreur', 'Vous devez être connecté pour supprimer une recette.');
      return;
    }

    Alert.alert(
      'Confirmer la suppression',
      'Êtes-vous sûr de vouloir supprimer cette recette ? Cette action est irréversible.',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          onPress: async () => {
            try {
              await firestore().collection('recipes').doc(recipeId).delete();
              Alert.alert('Succès', 'Recette supprimée avec succès !');
            } catch (e) {
              console.error("Erreur lors de la suppression de la recette:", e);
              const errorMessage = e instanceof Error ? e.message : String(e);
              Alert.alert('Erreur', `Impossible de supprimer la recette: ${errorMessage}`);
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  const renderRecipe = ({ item }: { item: Recipe }) => {
    const isCurrentUserAuthor = currentUser && item.createdBy === currentUser.uid;

    return (
      <TouchableOpacity
        style={styles.recipeCard}
        onPress={() => Alert.alert(
          item.name,
          `Description: ${item.description}\n\nIngrédients:\n${item.ingredients.join('\n')}\n\nÉtapes:\n${item.steps.join('\n')}`
        )}
        activeOpacity={0.8}
      >
        <Image
          source={item.imageUrl ? { uri: item.imageUrl } : require('../assets/recipe-default.png')}
          style={styles.recipeImage}
        />
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.recipeDescription} numberOfLines={2}>{item.description}</Text>
          <View style={styles.recipeMeta}>
            <Text style={styles.recipeIngredientCount}>
              {item.ingredients?.length || 0} ingrédients
            </Text>
            <Text style={styles.recipeStepCount}>
              {item.steps?.length || 0} étapes
            </Text>
          </View>
          {item.authorName && (
            <Text style={styles.authorText}>
              Par {item.authorName || (item.createdBy && userNames[item.createdBy]) || 'Utilisateur inconnu'}
            </Text>
          )}

          {/* Boutons d'édition et de suppression conditionnels */}
          {isCurrentUserAuthor && (
            <View style={styles.authorActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openRecipeModal(item)} // Passer la recette à modifier
              >
                <Text style={styles.editButtonText}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteRecipe(item.id)}
              >
                <Text style={styles.deleteButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#e74c3c" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🍳 KOUISINE</Text>
      </View>

      <View style={styles.searchBarContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une recette..."
          placeholderTextColor="#a0a0a0"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Chargement des recettes...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRecipes}
          keyExtractor={item => item.id}
          renderItem={renderRecipe}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>😔</Text>
              <Text style={styles.emptyStateText}>
                {searchQuery ? "Aucun plat trouvé pour votre recherche." : "Oups ! Aucune recette trouvée."}
              </Text>
              {!searchQuery && (
                <Text style={styles.emptyStateSubtext}>
                  Soyez le premier à partager une délicieuse recette !
                </Text>
              )}
              <TouchableOpacity style={styles.addRecipeButtonEmptyState} onPress={() => openRecipeModal()}>
                <Text style={styles.addRecipeButtonEmptyStateText}>+ Ajouter ma première recette</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.floatingAddButton}
        onPress={() => openRecipeModal()} // Ouvrir en mode ajout
        activeOpacity={0.8}
      >
        <Text style={styles.floatingAddButtonText}>+</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingRecipe ? 'Modifier la Recette' : 'Nouvelle Recette'}
                </Text>
                <TouchableOpacity onPress={() => {setModalVisible(false); setEditingRecipe(null);}} style={styles.modalCloseButton}>
                  <Text style={styles.modalCloseButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {!currentUser ? (
                <View style={styles.notLoggedInContainer}>
                  <Text style={styles.notLoggedInText}>
                    Vous devez être connecté pour ajouter/modifier une recette.
                  </Text>
                  <TouchableOpacity
                    style={styles.loginPromptButton}
                    onPress={() => {
                      setModalVisible(false);
                      Alert.alert("Connexion requise", "Veuillez vous connecter ou vous inscrire pour ajouter des recettes.");
                    }}
                  >
                    <Text style={styles.loginPromptButtonText}>Se connecter / S'inscrire</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.inputLabel}>Nom de la recette *</Text>
                  <TextInput
                    placeholder="Ex: Gratin dauphinois"
                    placeholderTextColor="#a0a0a0"
                    value={newRecipe.name}
                    onChangeText={v => setNewRecipe({ ...newRecipe, name: v })}
                    style={styles.input}
                  />
                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    placeholder="Une brève description de votre plat..."
                    placeholderTextColor="#a0a0a0"
                    value={newRecipe.description}
                    onChangeText={v => setNewRecipe({ ...newRecipe, description: v })}
                    style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                    multiline
                  />
                  <Text style={styles.inputLabel}>Ingrédients (un par ligne) *</Text>
                  <TextInput
                    placeholder="Ex: 500g de pommes de terre&#10;200ml de crème fraîche"
                    placeholderTextColor="#a0a0a0"
                    value={newRecipe.ingredients}
                    onChangeText={v => setNewRecipe({ ...newRecipe, ingredients: v })}
                    style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                    multiline
                  />
                  <Text style={styles.inputLabel}>Étapes de préparation (un par ligne) *</Text>
                  <TextInput
                    placeholder="Ex: 1. Préchauffer le four à 180°C&#10;2. Couper les pommes de terre en rondelles fines"
                    placeholderTextColor="#a0a0a0"
                    value={newRecipe.steps}
                    onChangeText={v => setNewRecipe({ ...newRecipe, steps: v })}
                    style={[styles.input, { height: 150, textAlignVertical: 'top' }]}
                    multiline
                  />
                  <Text style={styles.inputLabel}>URL de l'image (optionnel)</Text>
                  <TextInput
                    placeholder="Ex: https://example.com/ma-recette.jpg"
                    placeholderTextColor="#a0a0a0"
                    value={newRecipe.imageUrl}
                    onChangeText={v => setNewRecipe({ ...newRecipe, imageUrl: v })}
                    style={styles.input}
                  />
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.cancelButton} onPress={() => {setModalVisible(false); setNewRecipe({ name: '', description: '', ingredients: '', steps: '', imageUrl: '' }); setEditingRecipe(null);}}>
                      <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveButton} onPress={handleSaveRecipe}>
                      <Text style={styles.saveButtonText}>
                        {editingRecipe ? 'Modifier la Recette' : 'Ajouter Recette'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default RecipeListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#e74c3c',
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#e74c3c',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? ((StatusBar.currentHeight || 0) + 10) : 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  searchBarContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginHorizontal: 15,
    borderRadius: 25,
    marginTop: 5,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    fontSize: 16,
    color: '#333',
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    paddingHorizontal: 10,
  },
  listContent: {
    paddingVertical: 20,
    paddingHorizontal: 15,
  },
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  recipeImage: {
    width: 100,
    height: 100,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    margin: 15,
  },
  recipeInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 15,
    paddingVertical: 10,
  },
  recipeName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#333',
    marginBottom: 6,
  },
  recipeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  recipeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    marginBottom: 5,
  },
  recipeIngredientCount: {
    fontSize: 13,
    color: '#e74c3c',
    fontWeight: '600',
  },
  recipeStepCount: {
    fontSize: 13,
    color: '#e74c3c',
    fontWeight: '600',
  },
  authorText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 5,
  },
  // Nouveaux styles pour les boutons d'action de l'auteur
  authorActions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  editButton: {
    backgroundColor: '#3498db',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyStateIcon: {
    fontSize: 70,
    marginBottom: 20,
    opacity: 0.6,
  },
  emptyStateText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4a5568',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  addRecipeButtonEmptyState: {
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    paddingHorizontal: 25,
    borderRadius: 25,
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  addRecipeButtonEmptyStateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#e74c3c',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 100,
  },
  floatingAddButtonText: {
    color: '#fff',
    fontSize: 35,
    fontWeight: '300',
    lineHeight: 35,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 25,
    width: '90%',
    maxWidth: 450,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 15,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#e74c3c',
    flex: 1,
    textAlign: 'center',
    marginRight: 20,
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 22,
    color: '#888',
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#f0f2f5',
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 25,
    gap: 15,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 15,
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  cancelButtonText: {
    color: '#dc3545',
    fontWeight: 'bold',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 15,
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  notLoggedInContainer: {
    padding: 20,
    alignItems: 'center',
  },
  notLoggedInText: {
    fontSize: 18,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  loginPromptButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 15,
  },
  loginPromptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
