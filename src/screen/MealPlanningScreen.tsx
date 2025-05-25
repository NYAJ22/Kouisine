import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Animated,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Meal {
  breakfast: string;
  lunch: string;
  dinner: string;
}

const daysOfWeek = [
  { name: 'Lundi', short: 'LUN' },
  { name: 'Mardi', short: 'MAR' },
  { name: 'Mercredi', short: 'MER' },
  { name: 'Jeudi', short: 'JEU' },
  { name: 'Vendredi', short: 'VEN' },
  { name: 'Samedi', short: 'SAM' },
  { name: 'Dimanche', short: 'DIM' },
];

const STORAGE_KEY = 'meal_planning_data';

const MealPlanningScreen: React.FC = () => {
  const [planning, setPlanning] = useState<{ [key: string]: Meal }>(() =>
    Object.fromEntries(daysOfWeek.map(day => [day.name, { breakfast: '', lunch: '', dinner: '' }]))
  );

  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Animations
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const slideAnim = useMemo(() => new Animated.Value(50), []);
  const modalAnim = useMemo(() => new Animated.Value(0), []);

  const savePlanning = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(planning));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  }, [planning]);

  useEffect(() => {
    loadPlanning();
    // Animation d'entrée
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

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
    setIsEditModalVisible(true);
    Animated.timing(modalAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
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

    handleCloseModal();
  };

  const handleCloseModal = () => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsEditModalVisible(false);
      setEditingDay(null);
      setMealType(null);
      setInputValue('');
      Keyboard.dismiss();
    });
  };

  const handleClearMeal = (day: string, type: 'breakfast' | 'lunch' | 'dinner') => {
    Alert.alert(
      'Supprimer ce repas ?',
      `Voulez-vous vraiment supprimer ce repas ?`,
      [
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
      ]
    );
  };

  const getMealIcon = (type: 'breakfast' | 'lunch' | 'dinner') => {
    switch (type) {
      case 'breakfast': return '🌅';
      case 'lunch': return '☀️';
      case 'dinner': return '🌙';
      default: return '🍽️';
    }
  };

  const getMealLabel = (type: 'breakfast' | 'lunch' | 'dinner') => {
    switch (type) {
      case 'breakfast': return 'Petit-déjeuner';
      case 'lunch': return 'Déjeuner';
      case 'dinner': return 'Dîner';
      default: return '';
    }
  };

  const getWeekProgress = () => {
    const totalMeals = daysOfWeek.length * 3;
    const plannedMeals = daysOfWeek.reduce((count, day) => {
      const dayMeals = planning[day.name];
      return count + (dayMeals.breakfast ? 1 : 0) + (dayMeals.lunch ? 1 : 0) + (dayMeals.dinner ? 1 : 0);
    }, 0);
    return Math.round((plannedMeals / totalMeals) * 100);
  };

  const getCurrentWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    return daysOfWeek.map((_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index + (currentWeekOffset * 7));
      return date.getDate();
    });
  };

  const weekDates = getCurrentWeekDates();
  const weekProgress = getWeekProgress();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A5D4A" />
      {/* Header amélioré */}
      <View style={styles.headerGradient}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>📅 Planning des repas</Text>
            <Text style={styles.headerSubtitle}>Organisez votre semaine</Text>
          </View>
          {/* Indicateur de progression */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${weekProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{weekProgress}% planifié</Text>
          </View>
        </View>
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Navigation semaine */}
          <View style={styles.weekNavigation}>
            <TouchableOpacity
              style={styles.weekNavButton}
              onPress={() => setCurrentWeekOffset(currentWeekOffset - 1)}
            >
              <Text style={styles.weekNavButtonText}>←</Text>
            </TouchableOpacity>
            <View style={styles.weekInfo}>
              <Text style={styles.weekTitle}>
                {currentWeekOffset === 0 ? 'Cette semaine' :
                 currentWeekOffset === 1 ? 'Semaine prochaine' :
                 currentWeekOffset === -1 ? 'Semaine dernière' :
                 `Semaine ${currentWeekOffset > 0 ? '+' : ''}${currentWeekOffset}`}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.weekNavButton}
              onPress={() => setCurrentWeekOffset(currentWeekOffset + 1)}
            >
              <Text style={styles.weekNavButtonText}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Grille des jours */}
          {daysOfWeek.map((day, dayIndex) => (
            <View key={day.name} style={styles.dayCard}>
              {/* Header du jour */}
              <View style={styles.dayHeader}>
                <View style={styles.dayTitleContainer}>
                  <Text style={styles.dayTitle}>{day.name}</Text>
                  <Text style={styles.dayDate}>{weekDates[dayIndex]}</Text>
                </View>
                <View style={styles.dayProgress}>
                  <Text style={styles.dayProgressText}>
                    {Object.values(planning[day.name]).filter(meal => meal !== '').length}/3
                  </Text>
                </View>
              </View>

              {/* Repas du jour */}
              <View style={styles.mealsContainer}>
                {(['breakfast', 'lunch', 'dinner'] as const).map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.mealCard,
                      planning[day.name][type] ? styles.mealCardFilled : styles.mealCardEmpty,
                    ]}
                    onPress={() => handleEditMeal(day.name, type)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.mealHeader}>
                      <Text style={styles.mealIcon}>{getMealIcon(type)}</Text>
                      <Text style={styles.mealTypeLabel}>{getMealLabel(type)}</Text>
                    </View>
                    <View style={styles.mealContent}>
                      <Text style={[
                        styles.mealText,
                        planning[day.name][type] ? styles.mealTextFilled : styles.mealTextEmpty,
                      ]} numberOfLines={2}>
                        {planning[day.name][type] || 'Ajouter un repas'}
                      </Text>
                    </View>

                    {planning[day.name][type] && (
                      <TouchableOpacity
                        style={styles.clearButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleClearMeal(day.name, type);
                        }}
                      >
                        <Text style={styles.clearButtonText}>×</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Actions rapides */}
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity style={styles.quickActionButton}>
              <Text style={styles.quickActionIcon}>🎲</Text>
              <Text style={styles.quickActionText}>Repas aléatoire</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton}>
              <Text style={styles.quickActionIcon}>📋</Text>
              <Text style={styles.quickActionText}>Copier la semaine</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Modal d'édition moderne */}
      <Modal
        visible={isEditModalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={handleCloseModal}
          />
          <Animated.View
            style={[
              styles.modalContent,
              {
                opacity: modalAnim,
                transform: [
                  {
                    scale: modalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {mealType && getMealIcon(mealType)} {mealType && getMealLabel(mealType)}
              </Text>
              <Text style={styles.modalSubtitle}>{editingDay}</Text>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="Ex: Salade César, Pâtes carbonara..."
                placeholderTextColor="#999"
                style={styles.modalInput}
                multiline={true}
                numberOfLines={3}
                autoFocus={true}
                onSubmitEditing={handleSaveMeal}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={handleCloseModal}
                >
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={handleSaveMeal}
                >
                  <Text style={styles.modalSaveText}>Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerGradient: {
    backgroundColor: '#1A5D4A',
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '400',
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: 200,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ECDC4',
    borderRadius: 3,
  },
  progressText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  weekNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekNavButtonText: {
    fontSize: 18,
    color: '#1A5D4A',
    fontWeight: 'bold',
  },
  weekInfo: {
    flex: 1,
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  dayCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dayTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginRight: 12,
  },
  dayDate: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: '600',
  },
  dayProgress: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dayProgressText: {
    color: '#1A5D4A',
    fontSize: 12,
    fontWeight: '700',
  },
  mealsContainer: {
    gap: 12,
  },
  mealCard: {
    borderRadius: 12,
    padding: 16,
    position: 'relative',
    borderWidth: 2,
  },
  mealCardEmpty: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E9ECEF',
    borderStyle: 'dashed',
  },
  mealCardFilled: {
    backgroundColor: 'white',
    borderColor: '#E8F5E8',
    borderStyle: 'solid',
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  mealTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  mealContent: {
    flex: 1,
  },
  mealText: {
    fontSize: 15,
    lineHeight: 20,
  },
  mealTextEmpty: {
    color: '#999',
    fontStyle: 'italic',
  },
  mealTextFilled: {
    color: '#333',
    fontWeight: '500',
  },
  clearButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  quickActionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A5D4A',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  modalHeader: {
    backgroundColor: '#1A5D4A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  modalBody: {
    padding: 20,
  },
  modalInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    textAlignVertical: 'top',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#1A5D4A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalSaveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default MealPlanningScreen;
