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

interface Ingredient {
  name: string;
  price?: number;
  // Les champs 'quantity' et 'unit' ont été retirés car non utilisés dans les TextInputs actuels
  // Si vous voulez les réintégrer, il faudra adapter la saisie et le stockage
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: Ingredient[];
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
    ingredients: '', // String pour la saisie des noms d'ingrédients
    ingredientPrices: '', // String pour la saisie des prix
    steps: '',
    imageUrl: '',
  });
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [userNames, setUserNames] = useState<{ [uid: string]: string }>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  // 'ingredients' n'est plus utilisé pour la saisie dynamique car nous utilisons des TextInputs multi-lignes
  // const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', quantity: '', unit: '', price: undefined }]);

  const currentUser = auth().currentUser;

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('recipes')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        const fetchedRecipes = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Assurez-vous que ingredients est bien un tableau d'objets Ingredient
          ingredients: (doc.data().ingredients || []).map((ing: any) => {
            // Si l'ingrédient est une chaîne, convertissez-le en objet { name: string }
            // Si c'est déjà un objet avec 'name' et 'price', utilisez-le tel quel
            return typeof ing === 'string' ? { name: ing } : ing;
          }),
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
      recipe.ingredients.some(ingredient => ingredient.name.toLowerCase().includes(lowercasedQuery))
    );
    setFilteredRecipes(filtered);
  }, [recipes, userNames, searchQuery]);

  const openRecipeModal = (recipeToEdit?: Recipe) => {
    if (recipeToEdit) {
      setEditingRecipe(recipeToEdit);
      setNewRecipe({
        name: recipeToEdit.name,
        description: recipeToEdit.description,
        ingredients: recipeToEdit.ingredients.map(i => i.name).join('\n'),
        ingredientPrices: recipeToEdit.ingredients.map(i => i.price !== undefined ? i.price.toString() : '').join('\n'),
        steps: recipeToEdit.steps.join('\n'),
        imageUrl: recipeToEdit.imageUrl || '',
      });
    } else {
      setEditingRecipe(null);
      setNewRecipe({ name: '', description: '', ingredients: '', ingredientPrices: '', steps: '', imageUrl: '' });
    }
    setModalVisible(true);
  };

  const handleSaveRecipe = async () => {
    // Validation des champs obligatoires
    if (!newRecipe.name.trim() || !newRecipe.description.trim() || !newRecipe.ingredients.trim() || !newRecipe.steps.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le nom, la description, les ingrédients et les étapes.');
      return;
    }

    if (!currentUser) {
      Alert.alert('Erreur', 'Vous devez être connecté pour ajouter/modifier une recette.');
      return;
    }

    try {
      const ingredientNames = newRecipe.ingredients.split('\n').map(i => i.trim()).filter(Boolean);
      const ingredientPricesInput = newRecipe.ingredientPrices.split('\n').map(p => p.trim());

      // Validation pour les prix (Option 3: chaque ingrédient doit avoir un prix valide)
      if (ingredientNames.length > 0 && ingredientNames.length !== ingredientPricesInput.length) {
          Alert.alert('Erreur', 'Le nombre de prix doit correspondre au nombre d\'ingrédients. Laissez le champ des prix vide si aucun prix n\'est connu ou si certains ingrédients n\'ont pas de prix.');
          return;
      }

      const parsedIngredientPrices: (number | undefined)[] = ingredientPricesInput.map(priceStr => {
        const parsedPrice = parseFloat(priceStr);
        return isNaN(parsedPrice) ? undefined : parsedPrice;
      });

      // Vérifier si des prix sont invalides ou <= 0 (si non autorisé)
      const hasInvalidPrice = parsedIngredientPrices.some((price, index) => {
          // Si un ingrédient existe et son prix est défini mais n'est pas un nombre valide ou est 0 ou moins (si 0 n'est pas autorisé)
          return ingredientNames[index] && price !== undefined && (isNaN(price) || price <= 0);
      });

      if (hasInvalidPrice) {
          Alert.alert('Erreur', 'Veuillez saisir un prix numérique valide (supérieur à 0) pour chaque ingrédient ayant un prix.');
          return;
      }
      
      // Créer un tableau d'objets Ingredient
      const combinedIngredients: Ingredient[] = ingredientNames.map((name, index) => ({
        name,
        price: parsedIngredientPrices[index], // Associe le prix ou undefined
      }));

      const recipeData = {
        name: newRecipe.name.trim(),
        description: newRecipe.description.trim(), // description est maintenant obligatoire
        ingredients: combinedIngredients, // Utilisez le nouveau tableau d'objets Ingredient
        steps: newRecipe.steps.split('\n').map(s => s.trim()).filter(Boolean),
        imageUrl: newRecipe.imageUrl.trim() || '',
        createdBy: currentUser.uid,
        authorName: currentUser.displayName || 'Utilisateur inconnu',
      };

      if (editingRecipe) {
        await firestore().collection('recipes').doc(editingRecipe.id).update(recipeData);
        Alert.alert('Succès', 'Recette modifiée avec succès !');
      } else {
        await firestore().collection('recipes').add({
          ...recipeData,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
        Alert.alert('Succès', 'Recette ajoutée avec succès !');
      }
      setModalVisible(false);
      setNewRecipe({ name: '', description: '', ingredients: '', ingredientPrices: '', steps: '', imageUrl: '' }); // Réinitialiser
      setEditingRecipe(null);
    } catch (e) {
      console.error("Erreur lors de l'enregistrement de la recette:", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      Alert.alert('Erreur', `Impossible d'enregistrer la recette: ${errorMessage}`);
    }
  };

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
          `Description: ${item.description}\n\nIngrédients:\n${item.ingredients.map(ing => `${ing.name}${ing.price !== undefined ? ` (${ing.price} FCFA)` : ''}`).join('\n')}\n\nÉtapes:\n${item.steps.join('\n')}`
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

          {isCurrentUserAuthor && (
            <View style={styles.authorActions}>
              <TouchableOpacity style={styles.editButton} onPress={() => openRecipeModal(item)}>
                <Text style={styles.editButtonText}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteRecipe(item.id)}>
                <Text style={styles.deleteButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bouton pour ajouter à la liste de courses */}
          <TouchableOpacity
            style={{
              backgroundColor: '#ffd700',
              borderRadius: 10,
              paddingVertical: 7,
              paddingHorizontal: 15,
              alignSelf: 'flex-start',
              marginTop: 8,
              marginBottom: 4,
            }}
            onPress={async () => {
              if (!currentUser) {
                Alert.alert('Erreur', 'Vous devez être connecté pour ajouter à la liste de courses.');
                return;
              }
              try {
                const uid = currentUser.uid;
                const shoppingListRef = firestore()
                  .collection('users')
                  .doc(uid)
                  .collection('shoppingList');

                await Promise.all(
                  item.ingredients.map(async (ingredient) => {
                    await shoppingListRef.add({
                      name: ingredient.name,
                      completed: false,
                      fromRecipe: item.name,
                      price: ingredient.price || null, // Ajoute le prix ou null s'il n'existe pas
                    });
                  })
                );
                Alert.alert('Succès', 'Ingrédients ajoutés à la liste de courses !');
              } catch (e) {
                Alert.alert('Erreur', "Impossible d'ajouter à la liste de courses.");
              }
            }}
          >
            <Text style={{ color: '#333', fontWeight: 'bold' }}>Ajouter à la liste de courses</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#e74c3c" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🍳 KOUISINE</Text>
        <TextInput
          style={styles.searchBar}
          placeholder="Rechercher une recette..."
          placeholderTextColor="#a0a0a0"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.addButton} onPress={() => openRecipeModal()}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Chargement des recettes...</Text>
        </View>
      ) : filteredRecipes.length > 0 ? (
        <FlatList
          data={filteredRecipes}
          renderItem={renderRecipe}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Aucune recette trouvée.</Text>
          <Text style={styles.emptyStateSubtext}>
            Ajoutez votre première recette ou ajustez votre recherche !
          </Text>
        </View>
      )}

      {/* Modal d'ajout/édition de recette */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Nouveau style appliqué ici */}
          <ScrollView contentContainerStyle={styles.scrollViewContentContainer}>
            <View style={styles.cardModal}> {/* cardModal modifié sans maxHeight */}
              <Text style={styles.modalTitle}>
                {editingRecipe ? 'Modifier la recette' : 'Ajouter une nouvelle recette'}
              </Text>

              {/* Image du plat */}
              <Text style={styles.inputLabel}>Image du plat (URL):</Text>
              <TextInput
                style={styles.input}
                placeholder="https://exemple.com/image.jpg"
                value={newRecipe.imageUrl}
                onChangeText={text => setNewRecipe({ ...newRecipe, imageUrl: text })}
              />

              <Text style={styles.inputLabel}>Nom de la recette:</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Poulet Yassa"
                value={newRecipe.name}
                onChangeText={text => setNewRecipe({ ...newRecipe, name: text })}
              />

              <Text style={styles.inputLabel}>Description:</Text>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                placeholder="Décrivez votre recette en quelques mots..."
                multiline
                value={newRecipe.description}
                onChangeText={text => setNewRecipe({ ...newRecipe, description: text })}
              />

              <Text style={styles.inputLabel}>Ingrédients (un par ligne):</Text>
              <TextInput
                style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                placeholder="Ex: 2 cuisses de poulet&#10;1 oignon&#10;..."
                multiline
                value={newRecipe.ingredients}
                onChangeText={text => setNewRecipe({ ...newRecipe, ingredients: text })}
              />

              {/* Champ pour les prix des ingrédients */}
              <Text style={styles.inputLabel}>Prix des ingrédients (un par ligne, dans le même ordre que les ingrédients, laisser vide si inconnu):</Text>
              <TextInput
                style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                placeholder="Ex: 1500 (pour le poulet)&#10;200 (pour l'oignon)&#10;..."
                keyboardType="numeric"
                multiline
                value={newRecipe.ingredientPrices}
                onChangeText={text => setNewRecipe({ ...newRecipe, ingredientPrices: text })}
              />

              <Text style={styles.inputLabel}>Étapes (une par ligne):</Text>
              <TextInput
                style={[styles.input, { height: 150, textAlignVertical: 'top' }]}
                placeholder="Ex: 1. Coupez le poulet en morceaux.&#10;2. Faites mariner le poulet.&#10;..."
                multiline
                value={newRecipe.steps}
                onChangeText={text => setNewRecipe({ ...newRecipe, steps: text })}
              />

              {/* Les anciens champs d'ingrédients dynamiques ont été supprimés pour simplifier l'UI */}
              {/* Si vous souhaitez cette fonctionnalité, il faudra revoir l'approche complète */}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveRecipe}>
                  <Text style={styles.saveButtonText}>Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default RecipeListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#e74c3c',
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  searchBar: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
  },
  addButton: {
    backgroundColor: '#2ecc71',
    width: 45,
    height: 45,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2ecc71',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 18,
    color: '#666',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingVertical: 20,
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    flexDirection: 'row', // Pour aligner image et info
  },
  recipeImage: {
    width: 120,
    height: '100%', // Prendre toute la hauteur de la carte
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
    resizeMode: 'cover',
  },
  recipeInfo: {
    flex: 1,
    padding: 15,
  },
  recipeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  recipeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  recipeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  recipeIngredientCount: {
    fontSize: 13,
    color: '#888',
    backgroundColor: '#f0f0f0',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  recipeStepCount: {
    fontSize: 13,
    color: '#888',
    backgroundColor: '#f0f0f0',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  authorText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 5,
  },
  authorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 10,
  },
  editButton: {
    backgroundColor: '#007bff',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 20,
    color: '#666',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  // NOUVEAU STYLE POUR LE CONTENEUR DE CONTENU DE LA SCROLLVIEW
  scrollViewContentContainer: {
    flexGrow: 1, // Permet à la ScrollView de grandir pour s'adapter au contenu
    justifyContent: 'center', // Centre le contenu à l'intérieur de la ScrollView verticalement
  },
  cardModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '95%',
    // maxHeight: '90%', <-- CETTE LIGNE EST SUPPRIMÉE
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 20,
    marginVertical: 20, // Ajout d'une marge verticale pour un meilleur espacement
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 25,
    textAlign: 'center',
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
  // Ces styles ne sont plus utilisés pour la saisie directe dans ce code,
  // car nous utilisons des TextInputs multi-lignes pour ingrédients et prix.
  // Ils sont gardés au cas où vous les réutilisiez pour autre chose.
  ingredientField: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
  },
  ingredientInput: {
    flex: 1,
    marginRight: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  removeIngredientButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#dc3545',
  },
  removeIngredientButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addIngredientButton: {
    backgroundColor: '#28a745',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  addIngredientButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
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
});
