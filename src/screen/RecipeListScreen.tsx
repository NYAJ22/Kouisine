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
  Share,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import * as ImagePicker from 'react-native-image-picker';

interface Ingredient {
  name: string;
  price?: number;
  quantity?: string;
  unit?: string;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: Ingredient[];
  steps: string[];
  imageUrl?: string;
  createdAt?: FirebaseFirestoreTypes.FieldValue;
  createdBy?: string;
  authorName?: string;
}

const RecipeListScreen: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    description: '',
    ingredients: '',
    ingredientPrices: '',
    ingredientQuantities: '',
    ingredientUnits: '',
    steps: '',
    imageUrl: '',
  });
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [userNames, setUserNames] = useState<{ [uid: string]: string }>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const currentUser = auth().currentUser;

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('recipes')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        const fetchedRecipes = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          ingredients: (doc.data().ingredients || []).map((ing: any) => {
            return typeof ing === 'string' ? { name: ing } : ing;
          }),
        } as Recipe));
        setRecipes(fetchedRecipes);
        setLoading(false);
      }, error => {
        console.error('Erreur de chargement des recettes:', error);
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
        ingredientQuantities: recipeToEdit.ingredients.map(i => i.quantity || '').join('\n'),
        ingredientUnits: recipeToEdit.ingredients.map(i => i.unit || '').join('\n'),
        steps: recipeToEdit.steps.join('\n'),
        imageUrl: recipeToEdit.imageUrl || '',
      });
    } else {
      setEditingRecipe(null);
      setNewRecipe({
        name: '',
        description: '',
        ingredients: '',
        ingredientPrices: '',
        ingredientQuantities: '',
        ingredientUnits: '',
        steps: '',
        imageUrl: '',
      });
    }
    setModalVisible(true);
  };

  const handlePickImage = () => {
    setImageLoading(true);
    ImagePicker.launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      maxHeight: 800,
      maxWidth: 800,
      quality: 0.7,
    }, (response) => {
      setImageLoading(false);
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorCode) {
        console.log('ImagePicker Error: ', response.errorMessage);
        Alert.alert('Erreur', "Impossible de charger l'image");
      } else if (response.assets && response.assets[0].uri) {
        const source = `data:image/jpeg;base64,${response.assets[0].base64}`;

        // Vérifier la taille de l'image
        const base64Length = source.length - (source.indexOf(',') + 1);
        const sizeInBytes = 4 * Math.ceil(base64Length / 3) * 0.5624896334383812;
        const sizeInMB = sizeInBytes / (1024 * 1024);

        if (sizeInMB > 0.5) {
          Alert.alert('Erreur', 'L\'image est trop grande (max 0.5MB). Veuillez choisir une image plus petite.');
          return;
        }

        setNewRecipe({ ...newRecipe, imageUrl: source });
      }
    });
  };

  const handleSaveRecipe = async () => {
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
      const ingredientQuantitiesInput = newRecipe.ingredientQuantities.split('\n').map(q => q.trim());
      const ingredientUnitsInput = newRecipe.ingredientUnits.split('\n').map(u => u.trim());

      if (ingredientNames.length > 0 &&
          (ingredientNames.length !== ingredientPricesInput.length ||
           ingredientNames.length !== ingredientQuantitiesInput.length ||
           ingredientNames.length !== ingredientUnitsInput.length)) {
        Alert.alert('Erreur', 'Le nombre de prix, quantités et unités doit correspondre au nombre d\'ingrédients.');
        return;
      }

      const parsedIngredientPrices: (number | undefined)[] = ingredientPricesInput.map(priceStr => {
        const parsedPrice = parseFloat(priceStr);
        return isNaN(parsedPrice) ? undefined : parsedPrice;
      });

      // Création des ingrédients avec gestion des valeurs undefined
      const combinedIngredients: Ingredient[] = ingredientNames.map((name, index) => {
        const ingredient: Ingredient = { name };

        if (parsedIngredientPrices[index] !== undefined) {
          ingredient.price = parsedIngredientPrices[index];
        }

        if (ingredientQuantitiesInput[index] && ingredientQuantitiesInput[index].trim() !== '') {
          ingredient.quantity = ingredientQuantitiesInput[index].trim();
        }

        if (ingredientUnitsInput[index] && ingredientUnitsInput[index].trim() !== '') {
          ingredient.unit = ingredientUnitsInput[index].trim();
        }

        return ingredient;
      });

      // Préparation des données pour Firestore
      const recipeData = {
        name: newRecipe.name.trim(),
        description: newRecipe.description.trim(),
        ingredients: combinedIngredients,
        steps: newRecipe.steps.split('\n').map(s => s.trim()).filter(Boolean),
        imageUrl: newRecipe.imageUrl.trim() || null, // Utiliser null au lieu de chaîne vide
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
      setNewRecipe({
        name: '',
        description: '',
        ingredients: '',
        ingredientPrices: '',
        ingredientQuantities: '',
        ingredientUnits: '',
        steps: '',
        imageUrl: '',
      });
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
              console.error('Erreur lors de la suppression de la recette:', e);
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

  const handleShareRecipe = async (recipe: Recipe) => {
    try {
      const ingredientsText = recipe.ingredients.map(ing =>
        `- ${ing.name}${ing.quantity ? ` (${ing.quantity}${ing.unit ? ` ${ing.unit}` : ''})` : ''}${ing.price ? ` - ${ing.price} FCFA` : ''}`
      ).join('\n');

      const stepsText = recipe.steps.map((step, index) => `${index + 1}. ${step}`).join('\n');

      const message = `🍳 ${recipe.name}\n\n${recipe.description}\n\nIngrédients:\n${ingredientsText}\n\nÉtapes:\n${stepsText}\n\nRecette partagée via KOUISINE`;

      await Share.share({
        message,
        title: recipe.name,
      });
    } catch (error) {
      console.error('Error sharing recipe:', error);
      Alert.alert('Erreur', 'Impossible de partager la recette');
    }
  };


  const handleAddToShoppingList = async (recipe: Recipe) => {
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
        recipe.ingredients.map(async (ingredient) => {
          await shoppingListRef.add({
            name: ingredient.name,
            completed: false,
            fromRecipe: recipe.name,
            price: ingredient.price || null,
            quantity: ingredient.quantity || null,
            unit: ingredient.unit || null,
          });
        })
      );
      Alert.alert('Succès', 'Ingrédients ajoutés à la liste de courses !');
    } catch (e) {
      console.error("Erreur lors de l'ajout à la liste de courses:", e);
      Alert.alert('Erreur', "Impossible d'ajouter à la liste de courses.");
    }
  };

  const renderRecipe = ({ item }: { item: Recipe }) => {
    const isCurrentUserAuthor = currentUser && item.createdBy === currentUser.uid;

    return (
      <TouchableOpacity
        style={styles.recipeCard}
        onPress={() => {
          setSelectedRecipe(item);
          setDetailModalVisible(true);
        }}
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

      {/* Modal pour les détails de la recette */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <ScrollView style={styles.detailContainer}>
          {selectedRecipe && (
            <>
              <Image
                source={selectedRecipe.imageUrl ? { uri: selectedRecipe.imageUrl } : require('../assets/recipe-default.png')}
                style={styles.detailImage}
              />

              <View style={styles.detailContent}>
                <Text style={styles.detailTitle}>{selectedRecipe.name}</Text>

                <Text style={styles.detailSectionTitle}>Description</Text>
                <Text style={styles.detailText}>{selectedRecipe.description}</Text>

                <Text style={styles.detailSectionTitle}>Ingrédients</Text>
                {selectedRecipe.ingredients.map((ingredient, index) => (
                  <Text key={index} style={styles.detailText}>
                    - {ingredient.name}
                    {ingredient.quantity && ` (${ingredient.quantity}`}
                    {ingredient.unit && ` ${ingredient.unit})`}
                    {ingredient.price && ` - ${ingredient.price} FCFA`}
                  </Text>
                ))}

                <Text style={styles.detailSectionTitle}>Étapes de préparation</Text>
                {selectedRecipe.steps.map((step, index) => (
                  <Text key={index} style={styles.detailText}>
                    {index + 1}. {step}
                  </Text>
                ))}

                <View style={styles.detailActions}>
                  <TouchableOpacity
                    style={styles.detailActionButton}
                    onPress={() => handleAddToShoppingList(selectedRecipe)}
                  >
                    <Text style={styles.detailActionText}>Liste de courses</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.detailActionButton}
                    onPress={() => handleShareRecipe(selectedRecipe)}
                  >
                    <Text style={styles.detailActionText}>Partager</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.detailCloseButton}
                    onPress={() => setDetailModalVisible(false)}
                  >
                    <Text style={styles.detailCloseText}>Fermer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </Modal>

      {/* Modal d'édition/ajout de recette */}
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
          <ScrollView contentContainerStyle={styles.scrollViewContentContainer}>
            <View style={styles.cardModal}>
              <Text style={styles.modalTitle}>
                {editingRecipe ? 'Modifier la recette' : 'Ajouter une nouvelle recette'}
              </Text>

              <Text style={styles.inputLabel}>Image du plat:</Text>
              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={handlePickImage}
                disabled={imageLoading}
              >
                {imageLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.imagePickerButtonText}>
                    {newRecipe.imageUrl ? 'Changer l\'image' : 'Sélectionner une image'}
                  </Text>
                )}
              </TouchableOpacity>
              {newRecipe.imageUrl ? (
                <Image
                  source={{ uri: newRecipe.imageUrl }}
                  style={styles.imagePreview}
                />
              ) : null}

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
                placeholder="Ex: 2 cuisses de poulet\n1 oignon\n..."
                multiline
                value={newRecipe.ingredients}
                onChangeText={text => setNewRecipe({ ...newRecipe, ingredients: text })}
              />

              <Text style={styles.inputLabel}>Prix des ingrédients (un par ligne, dans le même ordre):</Text>
              <TextInput
                style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                placeholder="Ex: 1500 (pour le poulet)\n200 (pour l'oignon)\n..."
                keyboardType="numeric"
                multiline
                value={newRecipe.ingredientPrices}
                onChangeText={text => setNewRecipe({ ...newRecipe, ingredientPrices: text })}
              />

              <Text style={styles.inputLabel}>Quantités des ingrédients (une par ligne, dans le même ordre):</Text>
              <TextInput
                style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                placeholder="Ex: 2\n1\n..."
                multiline
                value={newRecipe.ingredientQuantities}
                onChangeText={text => setNewRecipe({ ...newRecipe, ingredientQuantities: text })}
              />

              <Text style={styles.inputLabel}>Unités des ingrédients (une par ligne, dans le même ordre):</Text>
              <TextInput
                style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                placeholder="Ex: cuisses\noignon\n..."
                multiline
                value={newRecipe.ingredientUnits}
                onChangeText={text => setNewRecipe({ ...newRecipe, ingredientUnits: text })}
              />

              <Text style={styles.inputLabel}>Étapes (une par ligne):</Text>
              <TextInput
                style={[styles.input, { height: 150, textAlignVertical: 'top' }]}
                placeholder="Ex: 1. Coupez le poulet en morceaux.\n2. Faites mariner le poulet.\n..."
                multiline
                value={newRecipe.steps}
                onChangeText={text => setNewRecipe({ ...newRecipe, steps: text })}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveRecipe}
                  disabled={imageLoading}
                >
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
    flexDirection: 'row',
  },
  recipeImage: {
    width: 120,
    height: '100%',
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
  scrollViewContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  cardModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '95%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 20,
    marginVertical: 20,
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
  imagePickerButton: {
    backgroundColor: '#3498db',
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 15,
  },
  imagePickerButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    marginBottom: 15,
    resizeMode: 'cover',
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
  // Styles pour la vue détaillée
  detailContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  detailImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  detailContent: {
    padding: 20,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 20,
    textAlign: 'center',
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 5,
  },
  detailText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 8,
    lineHeight: 22,
  },
  detailActions: {
    marginTop: 30,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  detailActionButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  detailActionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  detailCloseButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  detailCloseText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default RecipeListScreen;
