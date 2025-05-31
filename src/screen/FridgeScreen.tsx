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
  StatusBar,
  ScrollView,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

type FridgeItem = {
  id: string;
  name: string;
  quantity: string;
  expiryDate: string;
  category: string;
  dateAdded: string;
};


// Catégories d'aliments avec emojis et couleurs
const FOOD_CATEGORIES = [
  { name: 'Fruits', emoji: '🍎', color: '#FF6B6B' },
  { name: 'Légumes', emoji: '🥕', color: '#4ECDC4' },
  { name: 'Viandes', emoji: '🥩', color: '#FF8A65' },
  { name: 'Poissons', emoji: '🐟', color: '#42A5F5' },
  { name: 'Laitages', emoji: '🥛', color: '#FFEB3B' },
  { name: 'Féculents', emoji: '🍞', color: '#DEB887' },
  { name: 'Condiments', emoji: '🧂', color: '#9CCC65' },
  { name: 'Autres', emoji: '🍽️', color: '#BA68C8' },
];

const FridgeScreen = () => {
  const [items, setItems] = useState<FridgeItem[]>([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(uid)
      .collection('fridge')
      .onSnapshot(snapshot => {
        setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FridgeItem)));
      });
    return unsubscribe;
  }, []);

  const addItem = async () => {
    if (!name || !quantity || !expiryDate || !selectedCategory) {
      Alert.alert('Erreur', 'Tous les champs sont obligatoires.');
      return;
    }

    // Vérification basique du format de date
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(expiryDate)) {
      Alert.alert('Erreur', 'Format de date invalide. Utilisez JJ/MM/AAAA');
      return;
    }

    const uid = auth().currentUser?.uid;
    if (!uid) return;
    await firestore()
      .collection('users')
      .doc(uid)
      .collection('fridge')
      .add({ name, quantity, expiryDate, category: selectedCategory, dateAdded: new Date().toLocaleDateString('fr-FR') });

    setName('');
    setQuantity('');
    setExpiryDate('');
    setSelectedCategory('');
    setSelectedCategoryIndex(null);
  };

  const deleteItem = async (id: string) => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    await firestore()
      .collection('users')
      .doc(uid)
      .collection('fridge')
      .doc(id)
      .delete();
  };

  const selectCategory = (categoryName: string, index: number) => {
    setSelectedCategory(categoryName);
    setSelectedCategoryIndex(index);
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    try {
      const [day, month, year] = expiryDate.split('/');
      const expiry = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const today = new Date();
      const diffTime = expiry.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return 0;
    }
  };

  const getExpiryStatus = (expiryDate: string) => {
    const days = getDaysUntilExpiry(expiryDate);
    if (days < 0) return { status: 'expired', color: '#FF4757', text: 'Expiré' };
    if (days <= 2) return { status: 'warning', color: '#FFA502', text: `${days}j restant` };
    if (days <= 7) return { status: 'soon', color: '#FF6348', text: `${days}j restant` };
    return { status: 'good', color: '#2ED573', text: `${days}j restant` };
  };

  const getCategoryInfo = (categoryName: string) => {
    return FOOD_CATEGORIES.find(cat => cat.name === categoryName) || FOOD_CATEGORIES[FOOD_CATEGORIES.length - 1];
  };

  const getItemsByStatus = () => {
    const expired = items.filter(item => getDaysUntilExpiry(item.expiryDate) < 0);
    const expiringSoon = items.filter(item => {
      const days = getDaysUntilExpiry(item.expiryDate);
      return days >= 0 && days <= 7;
    });
    const fresh = items.filter(item => getDaysUntilExpiry(item.expiryDate) > 7);
    return { expired, expiringSoon, fresh };
  };

  const renderItem = ({ item }: { item: FridgeItem }) => {
    const categoryInfo = getCategoryInfo(item.category);
    const expiryInfo = getExpiryStatus(item.expiryDate);

    return (
      <View style={[styles.itemContainer, { borderLeftColor: categoryInfo.color }]}>
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleRow}>
            <Text style={styles.categoryEmoji}>{categoryInfo.emoji}</Text>
            <View style={styles.itemTitleContainer}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemCategory}>{item.category}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => deleteItem(item.id)}
            style={styles.deleteButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.itemDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Quantité:</Text>
            <Text style={styles.detailValue}>{item.quantity}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Expire le:</Text>
            <Text style={styles.detailValue}>{item.expiryDate}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Ajouté le:</Text>
            <Text style={styles.detailValue}>{item.dateAdded}</Text>
          </View>
        </View>

        <View style={[styles.expiryBadge, { backgroundColor: expiryInfo.color }]}>
          <Text style={styles.expiryText}>{expiryInfo.text}</Text>
        </View>
      </View>
    );
  };

  const renderCategoryButton = (cat: any, index: number) => (
    <TouchableOpacity
      key={index}
      style={[
        styles.categoryButton,
        selectedCategoryIndex === index && {
          backgroundColor: cat.color,
          transform: [{ scale: 1.05 }],
        },
      ]}
      onPress={() => selectCategory(cat.name, index)}
      activeOpacity={0.7}
    >
      <Text style={styles.categoryButtonEmoji}>{cat.emoji}</Text>
      <Text style={[
        styles.categoryButtonText,
        selectedCategoryIndex === index && styles.categoryButtonTextSelected,
      ]}>
        {cat.name}
      </Text>
    </TouchableOpacity>
  );

  const { expired, expiringSoon, fresh } = getItemsByStatus();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00D4AA" />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🧊 Mon Frigo</Text>
        <Text style={styles.headerSubtitle}>Gérez vos aliments intelligemment</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, styles.totalCard]}>
          <Text style={styles.statNumber}>{items.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, styles.expiredCard]}>
          <Text style={styles.statNumber}>{expired.length}</Text>
          <Text style={styles.statLabel}>Expirés</Text>
        </View>
        <View style={[styles.statCard, styles.soonCard]}>
          <Text style={styles.statNumber}>{expiringSoon.length}</Text>
          <Text style={styles.statLabel}>Bientôt</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Form Section */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Ajouter un aliment</Text>
          <Text style={styles.inputLabel}>Nom de l'aliment</Text>
          <TextInput
            placeholder="Ex: Pommes, Lait, Yaourt..."
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor="#999"
          />

          <Text style={styles.inputLabel}>Catégorie</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesScroll}
            contentContainerStyle={styles.categoriesContainer}
          >
            {FOOD_CATEGORIES.map(renderCategoryButton)}
          </ScrollView>

          <Text style={styles.inputLabel}>Quantité</Text>
          <TextInput
            placeholder="Ex: 1kg, 500g, 2 unités..."
            value={quantity}
            onChangeText={setQuantity}
            style={styles.input}
            placeholderTextColor="#999"
          />

          <Text style={styles.inputLabel}>Date d'expiration</Text>
          <TextInput
            placeholder="JJ/MM/AAAA"
            value={expiryDate}
            onChangeText={setExpiryDate}
            style={styles.input}
            placeholderTextColor="#999"
            keyboardType="numeric"
          />

          <TouchableOpacity
            style={[styles.addButton, (!name || !quantity || !expiryDate || !selectedCategory) && styles.addButtonDisabled]}
            onPress={addItem}
            disabled={!name || !quantity || !expiryDate || !selectedCategory}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonText}>➕ Ajouter au frigo</Text>
          </TouchableOpacity>
        </View>

        {/* Items List */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>
            Contenu du frigo ({items.length} aliments)
          </Text>
          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🧊</Text>
              <Text style={styles.emptyStateText}>Votre frigo est vide</Text>
              <Text style={styles.emptyStateSubtext}>
                Ajoutez vos premiers aliments pour commencer le suivi
              </Text>
            </View>
          ) : (
            <>
              {/* Aliments expirés */}
              {expired.length > 0 && (
                <View style={styles.categorySection}>
                  <Text style={[styles.categoryTitle, { color: '#FF4757' }]}>
                    ⚠️ Aliments expirés ({expired.length})
                  </Text>
                  <FlatList
                    data={expired}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    scrollEnabled={false}
                  />
                </View>
              )}

              {/* Aliments bientôt expirés */}
              {expiringSoon.length > 0 && (
                <View style={styles.categorySection}>
                  <Text style={[styles.categoryTitle, { color: '#FFA502' }]}>
                    🔔 À consommer rapidement ({expiringSoon.length})
                  </Text>
                  <FlatList
                    data={expiringSoon}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    scrollEnabled={false}
                  />
                </View>
              )}

              {/* Aliments frais */}
              {fresh.length > 0 && (
                <View style={styles.categorySection}>
                  <Text style={[styles.categoryTitle, { color: '#2ED573' }]}>
                    ✅ Aliments frais ({fresh.length})
                  </Text>
                  <FlatList
                    data={fresh}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    scrollEnabled={false}
                  />
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#00D4AA',
    paddingHorizontal: 20,
    paddingVertical: 25,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -15,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  totalCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#00D4AA',
  },
  expiredCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF4757',
  },
  soonCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FFA502',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  formSection: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
    color: '#495057',
  },
  categoriesScroll: {
    marginBottom: 10,
  },
  categoriesContainer: {
    paddingRight: 20,
  },
  categoryButton: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryButtonEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  categoryButtonTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#00D4AA',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonDisabled: {
    backgroundColor: '#adb5bd',
    shadowOpacity: 0,
    elevation: 0,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemsSection: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  itemContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  itemTitleContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  itemCategory: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  itemDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  detailValue: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  expiryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  expiryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 8,
  },
  deleteIcon: {
    fontSize: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
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

export default FridgeScreen;
