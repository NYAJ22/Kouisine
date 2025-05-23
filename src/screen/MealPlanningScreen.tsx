import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Keyboard,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Meal {
  breakfast: string;
  lunch: string;
  dinner: string;
}

const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const STORAGE_KEY = 'meal_planning_data';

const MealPlanningScreen: React.FC = () => {
  const [planning, setPlanning] = useState<{ [key: string]: Meal }>(() =>
    Object.fromEntries(daysOfWeek.map(day => [day, { breakfast: '', lunch: '', dinner: '' }]))
  );

  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [inputValue, setInputValue] = useState('');

  const savePlanning = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(planning));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  }, [planning]);

  // Charger les données au démarrage
  useEffect(() => {
    loadPlanning();
  }, []);

  // Sauvegarder automatiquement à chaque modification
  useEffect(() => {
    savePlanning();
  }, [planning, savePlanning]);

  const loadPlanning = async () => {
    try {
      const savedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setPlanning(parsedData);
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    }
  };

  const handleEditMeal = (day: string, type: 'breakfast' | 'lunch' | 'dinner') => {
    setEditingDay(day);
    setMealType(type);
    setInputValue(planning[day][type]);
  };

  const handleSaveMeal = () => {
    if (!editingDay || !mealType) {
      return;
    }

    setPlanning(prev => ({
      ...prev,
      [editingDay]: {
        ...prev[editingDay],
        [mealType]: inputValue.trim(),
      },
    }));

    setEditingDay(null);
    setMealType(null);
    setInputValue('');
    Keyboard.dismiss();
  };

  const handleClearMeal = (day: string, type: 'breakfast' | 'lunch' | 'dinner') => {
    Alert.alert('Supprimer ce repas ?', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          setPlanning(prev => ({
            ...prev,
            [day]: {
              ...prev[day],
              [type]: '',
            },
          }));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2d7d5e" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📅 Planning des repas</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {daysOfWeek.map(day => (
          <View key={day} style={styles.dayBlock}>
            <Text style={styles.dayTitle}>{day}</Text>

            {(['breakfast', 'lunch', 'dinner'] as const).map(type => (
              <View key={type} style={styles.mealRow}>
                <Text style={styles.mealLabel}>
                  {type === 'breakfast' ? 'Petit-déj.' : type === 'lunch' ? 'Déjeuner' : 'Dîner'}
                </Text>

                <View style={styles.mealActions}>
                  <Text style={styles.mealText}>
                    {planning[day][type] || '—'}
                  </Text>

                  <TouchableOpacity onPress={() => handleEditMeal(day, type)}>
                    <Text style={styles.actionText}>✏️</Text>
                  </TouchableOpacity>

                  {planning[day][type] !== '' && (
                    <TouchableOpacity onPress={() => handleClearMeal(day, type)}>
                      <Text style={styles.actionText}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {editingDay && mealType && (
        <View style={styles.editContainer}>
          <Text style={styles.editTitle}>
            Modifier {mealType === 'breakfast' ? 'le petit-déj.' : mealType === 'lunch' ? 'le déjeuner' : 'le dîner'} du {editingDay}
          </Text>
          <TextInput
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Ex: Omelette, salade, pâtes..."
            placeholderTextColor="#aaa"
            style={styles.input}
            onSubmitEditing={handleSaveMeal}
          />
          <TouchableOpacity onPress={handleSaveMeal} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f2e7',
  },
  header: {
    backgroundColor: '#2d7d5e',
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  dayBlock: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 2,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  mealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealLabel: {
    fontSize: 15,
    color: '#555',
    width: 90,
  },
  mealActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    justifyContent: 'flex-end',
  },
  mealText: {
    fontSize: 15,
    color: '#333',
    flexShrink: 1,
    marginRight: 10,
  },
  actionText: {
    fontSize: 16,
    marginLeft: 10,
  },
  editContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    elevation: 10,
  },
  editTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2d7d5e',
  },
  input: {
    backgroundColor: '#f1f1f1',
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#2d7d5e',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MealPlanningScreen;
