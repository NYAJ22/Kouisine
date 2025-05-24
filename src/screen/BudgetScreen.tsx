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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Expense {
  id: string;
  category: string;
  amount: number;
  note?: string;
}

const STORAGE_KEY = '@budget_expenses';

const BudgetScreen = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

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
    if (!category || isNaN(parsedAmount)) {
      Alert.alert('Erreur', 'Veuillez saisir une catégorie et un montant valide.');
      return;
    }

    const newExpense: Expense = {
      id: Date.now().toString(),
      category,
      amount: parsedAmount,
      note,
    };

    setExpenses((prev) => [newExpense, ...prev]);
    setCategory('');
    setAmount('');
    setNote('');
  };

  const deleteExpense = (id: string) => {
    Alert.alert('Supprimer', 'Supprimer cette dépense ?', [
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

  const total = expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2);

  const renderItem = ({ item }: { item: Expense }) => (
    <View style={styles.item}>
      <View style={{ flex: 1 }}>
        <Text style={styles.category}>{item.category}</Text>
        <Text style={styles.note}>{item.note}</Text>
        <Text style={styles.amount}>{item.amount.toFixed(2)} €</Text>
      </View>
      <TouchableOpacity onPress={() => deleteExpense(item.id)}>
        <Text style={styles.delete}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>💰 Mon Budget Alimentaire</Text>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inputContainer}
      >
        <TextInput
          placeholder="Catégorie"
          value={category}
          onChangeText={setCategory}
          style={styles.input}
        />
        <TextInput
          placeholder="Montant (€)"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          style={styles.input}
        />
        <TextInput
          placeholder="Note (facultatif)"
          value={note}
          onChangeText={setNote}
          style={styles.input}
        />
        <TouchableOpacity style={styles.addButton} onPress={addExpense}>
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      <Text style={styles.total}>Total : {total} €</Text>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>Aucune dépense ajoutée.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f2e7', padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#2d7d5e' },
  inputContainer: { marginBottom: 20 },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
    borderColor: '#ddd',
    borderWidth: 1,
  },
  addButton: {
    backgroundColor: '#2d7d5e',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  item: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  category: { fontWeight: 'bold', fontSize: 16, color: '#333' },
  note: { color: '#666' },
  amount: { fontWeight: 'bold', marginTop: 5, color: '#2d7d5e' },
  delete: { fontSize: 20, color: '#d9534f', marginLeft: 10 },
  total: { fontSize: 18, fontWeight: 'bold', marginVertical: 10, textAlign: 'center', color: '#2d7d5e' },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});

export default BudgetScreen;
