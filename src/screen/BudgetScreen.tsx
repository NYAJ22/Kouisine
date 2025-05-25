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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Expense {
  id: string;
  category: string;
  amount: number;
  note?: string;
  date: string;
}

const STORAGE_KEY = '@budget_expenses';

// Catégories prédéfinies avec emojis
const CATEGORIES = [
  { name: 'Alimentation', emoji: '🛒', color: '#FF6B6B' },
  { name: 'Transport', emoji: '🚗', color: '#4ECDC4' },
  { name: 'Loisirs', emoji: '🎬', color: '#45B7D1' },
  { name: 'Santé', emoji: '🏥', color: '#96CEB4' },
  { name: 'Vêtements', emoji: '👕', color: '#FFEAA7' },
  { name: 'Logement', emoji: '🏠', color: '#DDA0DD' },
  { name: 'Autre', emoji: '💼', color: '#74B9FF' },
];

const BudgetScreen = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);

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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(expenses)).catch((err) =>
      console.error('Erreur de sauvegarde du budget :', err)
    );
  }, [expenses]);

  const addExpense = () => {
    const parsedAmount = parseFloat(amount);
    if (!category || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Erreur', 'Veuillez saisir une catégorie et un montant valide.');
      return;
    }

    const newExpense: Expense = {
      id: Date.now().toString(),
      category,
      amount: parsedAmount,
      note,
      date: new Date().toLocaleDateString('fr-FR'),
    };

    setExpenses((prev) => [newExpense, ...prev]);
    setCategory('');
    setAmount('');
    setNote('');
    setSelectedCategoryIndex(null);
  };

  const deleteExpense = (id: string) => {
    Alert.alert('Supprimer la dépense', 'Êtes-vous sûr de vouloir supprimer cette dépense ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          setExpenses((prev) => prev.filter((e) => e.id !== id));
        },
      },
    ]);
  };

  const selectCategory = (categoryName: string, index: number) => {
    setCategory(categoryName);
    setSelectedCategoryIndex(index);
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

  const renderExpenseItem = ({ item }: { item: Expense }) => {
    const categoryInfo = getCategoryInfo(item.category);
    return (
      <View style={[styles.expenseItem, { borderLeftColor: categoryInfo.color }]}>
        <View style={styles.expenseHeader}>
          <View style={styles.categoryContainer}>
            <Text style={styles.categoryEmoji}>{categoryInfo.emoji}</Text>
            <View>
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
          <Text style={styles.expenseNote}>{item.note}</Text>
        ) : null}
        <Text style={[styles.expenseAmount, { color: categoryInfo.color }]}>
          -{item.amount.toFixed(2)} €
        </Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C63FF" />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💰 Mon Budget</Text>
        <Text style={styles.headerSubtitle}>Gérez vos dépenses facilement</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, styles.totalCard]}>
          <Text style={styles.statLabel}>Total général</Text>
          <Text style={styles.statValue}>{total.toFixed(2)} €</Text>
        </View>
        <View style={[styles.statCard, styles.monthlyCard]}>
          <Text style={styles.statLabel}>Ce mois</Text>
          <Text style={styles.statValue}>{monthlyTotal.toFixed(2)} €</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Form Section */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Ajouter une dépense</Text>
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
            <Text style={styles.inputLabel}>Montant</Text>
            <TextInput
              placeholder="0.00"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              style={styles.input}
              placeholderTextColor="#999"
            />

            {/* Note Input */}
            <Text style={styles.inputLabel}>Note (optionnel)</Text>
            <TextInput
              placeholder="Ajouter une description..."
              value={note}
              onChangeText={setNote}
              style={styles.input}
              placeholderTextColor="#999"
              multiline
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
        </View>

        {/* Expenses List */}
        <View style={styles.expensesSection}>
          <Text style={styles.sectionTitle}>
            Historique des dépenses ({expenses.length})
          </Text>
          {expenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📊</Text>
              <Text style={styles.emptyStateText}>Aucune dépense enregistrée</Text>
              <Text style={styles.emptyStateSubtext}>
                Commencez par ajouter votre première dépense
              </Text>
            </View>
          ) : (
            <FlatList
              data={expenses}
              keyExtractor={(item) => item.id}
              renderItem={renderExpenseItem}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
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
    backgroundColor: '#6C63FF',
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
    padding: 20,
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
    borderLeftColor: '#FF6B6B',
  },
  monthlyCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  statLabel: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
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
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#dee2e6',
    color: '#495057',
  },
  addButton: {
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#28a745',
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
  expensesSection: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  expenseItem: {
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
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  expenseDate: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  expenseNote: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
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

export default BudgetScreen;
