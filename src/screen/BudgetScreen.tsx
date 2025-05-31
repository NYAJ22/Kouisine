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
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface Expense {
  id: string;
  category: string;
  amount: number;
  note?: string;
  date: string;
}

const STORAGE_KEY = '@budget_expenses';

// Catégories prédéfinies avec emojis et couleurs améliorées
const CATEGORIES = [
  { name: 'Alimentation', emoji: '🛒', color: '#FF6B6B', lightColor: '#FFE5E5' },
  { name: 'Transport', emoji: '🚗', color: '#4ECDC4', lightColor: '#E5F9F7' },
  { name: 'Loisirs', emoji: '🎬', color: '#45B7D1', lightColor: '#E5F3FB' },
  { name: 'Santé', emoji: '🏥', color: '#96CEB4', lightColor: '#F0F9F5' },
  { name: 'Vêtements', emoji: '👕', color: '#FFEAA7', lightColor: '#FFFBF0' },
  { name: 'Logement', emoji: '🏠', color: '#DDA0DD', lightColor: '#F7F0F7' },
  { name: 'Éducation', emoji: '📚', color: '#A8E6CF', lightColor: '#F0FBF5' },
  { name: 'Autre', emoji: '💼', color: '#74B9FF', lightColor: '#E8F4FF' },
];

const BudgetScreen = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const loadExpenses = async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          setExpenses(JSON.parse(data));
        }
      } catch (err) {
        console.error('Erreur de chargement du budget :', err);
      }
    };
    loadExpenses();
  }, []);

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) {
      return;
    }
    const unsubscribe = firestore()
      .collection('users')
      .doc(uid)
      .collection('budget')
      .onSnapshot(snapshot => {
        setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
      });
    return unsubscribe;
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(expenses)).catch((err) =>
      console.error('Erreur de sauvegarde du budget :', err)
    );
  }, [expenses]);

  const addExpense = async () => {
    const parsedAmount = parseFloat(amount);
    if (!category || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Erreur', 'Veuillez saisir une catégorie et un montant valide.');
      return;
    }

    const uid = auth().currentUser?.uid;
    if (!uid) return;
    await firestore()
      .collection('users')
      .doc(uid)
      .collection('budget')
      .add({ category, amount: parsedAmount, note, date: new Date().toLocaleDateString('fr-FR') });

    setExpenses((prev) => [
      { id: Date.now().toString(), category, amount: parsedAmount, note, date: new Date().toLocaleDateString('fr-FR') },
      ...prev,
    ]);
    setCategory('');
    setAmount('');
    setNote('');
    setSelectedCategoryIndex(null);

    // Animation de succès
    Alert.alert('✅ Succès', 'Dépense ajoutée avec succès !');
  };

  const deleteExpense = async (id: string) => {
    Alert.alert(
      'Confirmation',
      'Êtes-vous sûr de vouloir supprimer cette dépense ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const uid = auth().currentUser?.uid;
            if (!uid) return;
            await firestore()
              .collection('users')
              .doc(uid)
              .collection('budget')
              .doc(id)
              .delete();
          },
        },
      ]
    );
  };

  const selectCategory = (categoryName: string, index: number) => {
    setCategory(categoryName);
    setSelectedCategoryIndex(index);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const monthlyExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.date.split('/').reverse().join('-'));
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
  });
  const monthlyTotal = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

  const getCategoryInfo = (categoryName: string) => {
    return CATEGORIES.find(cat => cat.name === categoryName) || CATEGORIES[CATEGORIES.length - 1];
  };

  const renderExpenseItem = ({ item, index: _index }: { item: Expense; index: number }) => {
    const categoryInfo = getCategoryInfo(item.category);
    return (
      <Animated.View
        style={[
          styles.expenseItem,
          { borderLeftColor: categoryInfo.color, backgroundColor: categoryInfo.lightColor },
          { opacity: fadeAnim },
        ]}
      >
        <View style={styles.expenseHeader}>
          <View style={styles.categoryContainer}>
            <View style={[styles.emojiContainer, { backgroundColor: categoryInfo.color }]}>
              <Text style={styles.categoryEmoji}>{categoryInfo.emoji}</Text>
            </View>
            <View style={styles.expenseInfo}>
              <Text style={styles.categoryName}>{item.category}</Text>
              <Text style={styles.expenseDate}>{item.date}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => deleteExpense(item.id)}
            style={styles.deleteButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
        {item.note ? (
          <View style={styles.noteContainer}>
            <Text style={styles.expenseNote}>{item.note}</Text>
          </View>
        ) : null}
        <View style={styles.amountContainer}>
          <Text style={[styles.expenseAmount, { color: categoryInfo.color }]}>
            -{formatAmount(item.amount)} FCFA
          </Text>
        </View>
      </Animated.View>
    );
  };

  const renderCategoryButton = (cat: any, index: number) => (
    <TouchableOpacity
      key={index}
      style={[
        styles.categoryButton,
        { borderColor: cat.color },
        selectedCategoryIndex === index && {
          backgroundColor: cat.color,
          transform: [{ scale: 1.05 }],
          shadowColor: cat.color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      
      {/* Header avec gradient */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>💰 Mon Budget</Text>
          <Text style={styles.headerSubtitle}>Gérez vos finances intelligemment</Text>
        </View>
      </View>

      {/* Stats Cards améliorées */}
      <Animated.View style={[styles.statsContainer, { opacity: fadeAnim }]}>
        <View style={[styles.statCard, styles.totalCard]}>
          <View style={styles.statIcon}>
            <Text style={styles.statIconText}>💳</Text>
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>Total général</Text>
            <Text style={styles.statValue}>{formatAmount(total)} FCFA</Text>
          </View>
        </View>
        <View style={[styles.statCard, styles.monthlyCard]}>
          <View style={styles.statIcon}>
            <Text style={styles.statIconText}>📊</Text>
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>Ce mois</Text>
            <Text style={styles.statValue}>{formatAmount(monthlyTotal)} FCFA</Text>
          </View>
        </View>
      </Animated.View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Form Section améliorée */}
        <Animated.View style={[styles.formSection, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>✨ Ajouter une dépense</Text>
          
          {/* Category Selection */}
          <Text style={styles.inputLabel}>Catégorie</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesScroll}
            contentContainerStyle={styles.categoriesContainer}
          >
            {CATEGORIES.map(renderCategoryButton)}
          </ScrollView>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Amount Input */}
            <Text style={styles.inputLabel}>Montant (FCFA)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="0"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                style={styles.input}
                placeholderTextColor="#999"
              />
              <Text style={styles.currencyLabel}>FCFA</Text>
            </View>

            {/* Note Input */}
            <Text style={styles.inputLabel}>Note (optionnel)</Text>
            <TextInput
              placeholder="Ajouter une description..."
              value={note}
              onChangeText={setNote}
              style={[styles.input, styles.noteInput]}
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.addButton, (!category || !amount) && styles.addButtonDisabled]}
              onPress={addExpense}
              disabled={!category || !amount}
              activeOpacity={0.8}
            >
              <Text style={styles.addButtonText}>✨ Ajouter la dépense</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </Animated.View>

        {/* Expenses List */}
        <View style={styles.expensesSection}>
          <Text style={styles.sectionTitle}>
            📋 Historique ({expenses.length} dépense{expenses.length > 1 ? 's' : ''})
          </Text>
          {expenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📊</Text>
              <Text style={styles.emptyStateText}>Aucune dépense enregistrée</Text>
              <Text style={styles.emptyStateSubtext}>
                Commencez par ajouter votre première dépense pour suivre vos finances
              </Text>
            </View>
          ) : (
            <FlatList
              data={expenses}
              keyExtractor={(item) => item.id}
              renderItem={renderExpenseItem}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
          )}
        </View>
        
        {/* Espacement en bas */}
        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -20,
    marginBottom: 20,
    gap: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  totalCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#FF6B6B',
  },
  monthlyCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#4ECDC4',
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  statIconText: {
    fontSize: 20,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  content: {
    flex: 1,
  },
  formSection: {
    backgroundColor: 'white',
    margin: 20,
    padding: 25,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 25,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
    marginTop: 20,
  },
  categoriesScroll: {
    marginBottom: 15,
  },
  categoriesContainer: {
    paddingRight: 20,
  },
  categoryButton: {
    backgroundColor: 'white',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 15,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 85,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  categoryButtonEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  categoryButtonTextSelected: {
    color: 'white',
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 15,
  },
  input: {
    flex: 1,
    padding: 18,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  noteInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  currencyLabel: {
    paddingRight: 18,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#10b981',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  addButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  expensesSection: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  expenseItem: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emojiContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  categoryEmoji: {
    fontSize: 20,
    color: 'white',
  },
  expenseInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  expenseDate: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  noteContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  expenseNote: {
    fontSize: 14,
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  deleteButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteIcon: {
    fontSize: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: 'white',
    borderRadius: 20,
    marginTop: 10,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 20,
    opacity: 0.5,
  },
  emptyStateText: {
    fontSize: 20,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 10,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 24,
  },
});

export default BudgetScreen;
