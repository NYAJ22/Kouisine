import React, { useState, useEffect,  useMemo } from 'react';
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
  Dimensions,
  Platform,
  ActivityIndicator, // Ajouté pour l'indicateur de chargement
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const { width: screenWidth } = Dimensions.get('window');

interface Meal {
  breakfast: string;
  lunch: string;
  dinner: string;
}

// Interface pour l'état du planning
interface PlanningState {
  [key: string]: Meal; // Clé est le nom du jour (ex: "Lundi")
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

function getCurrentWeekId(offset: number = 0): string {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (Dimanche) - 6 (Samedi)
  // Ajuster pour que Lundi soit le premier jour de la semaine (dayOfWeek - 1, ou 6 si Dimanche)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday + (offset * 7));
  monday.setHours(0, 0, 0, 0); // Normaliser au début du jour

  const year = monday.getFullYear();
  // Calcul du numéro de semaine ISO 8601
  const firstJan = new Date(year, 0, 1);
  const daysOffset = (monday.getTime() - firstJan.getTime()) / (24 * 60 * 60 * 1000);
  // Le jour de la semaine du 1er janvier (0 pour Dimanche, 1 pour Lundi, ..., 6 pour Samedi)
  // Ajuster pour que Lundi soit 1, ..., Dimanche soit 7
  const firstJanDayOfWeek = (firstJan.getDay() === 0) ? 7 : firstJan.getDay();
  const weekNumber = Math.ceil((daysOffset + firstJanDayOfWeek -1 ) / 7);

  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}


const MealPlanningScreen: React.FC = () => {
  const [planning, setPlanning] = useState<PlanningState>({});
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true); // État de chargement

  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const slideAnim = useMemo(() => new Animated.Value(30), []);
  const modalAnim = useMemo(() => new Animated.Value(0), []);
  const headerAnim = useMemo(() => new Animated.Value(0), []);

  // Chargement des données depuis Firestore
  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) {
      Alert.alert("Utilisateur non connecté", "Veuillez vous connecter pour accéder au planning.");
      setPlanning({}); // Réinitialiser le planning local
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const weekId = getCurrentWeekId(currentWeekOffset);
    const ref = firestore().collection('users').doc(uid).collection('mealPlanning').doc(weekId);

    const unsubscribe = ref.onSnapshot(docSnapshot => {
      if (docSnapshot.exists()) {
        setPlanning(docSnapshot.data()?.planning || {});
      } else {
        // Si le document n'existe pas, initialiser un planning vide localement
        const emptyPlanningForWeek: PlanningState = {};
        daysOfWeek.forEach(dayInfo => {
          emptyPlanningForWeek[dayInfo.name] = { breakfast: '', lunch: '', dinner: '' };
        });
        setPlanning(emptyPlanningForWeek);
      }
      setIsLoading(false);
    }, error => {
      console.error("Erreur lors du chargement du planning:", error);
      Alert.alert("Erreur de chargement", "Impossible de récupérer le planning.");
      setPlanning({}); // Réinitialiser en cas d'erreur
      setIsLoading(false);
    });

    return () => unsubscribe(); // Nettoyage de l'abonnement
  }, [currentWeekOffset]); // Se réexécute si currentWeekOffset change

  // Animations d'entrée
  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fadeAnim, slideAnim, headerAnim]);


  const saveCurrentPlanning = async (updatedPlanning: PlanningState) => {
    const uid = auth().currentUser?.uid;
    if (!uid) {
      Alert.alert("Erreur", "Utilisateur non connecté. Impossible de sauvegarder.");
      return;
    }
    const weekId = getCurrentWeekId(currentWeekOffset);
    try {
      await firestore()
        .collection('users')
        .doc(uid)
        .collection('mealPlanning')
        .doc(weekId)
        .set({ planning: updatedPlanning }, { merge: true }); // Utiliser merge:true pour ne pas écraser d'autres champs potentiels
      console.log('Planning sauvegardé pour la semaine:', weekId);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du planning:", error);
      Alert.alert('Erreur de sauvegarde', 'La sauvegarde du planning a échoué.');
    }
  };

  const handleEditMeal = (day: string, type: 'breakfast' | 'lunch' | 'dinner') => {
    setEditingDay(day);
    setMealType(type);
    const dayMeals = planning[day] || { breakfast: '', lunch: '', dinner: '' };
    setInputValue(dayMeals[type]);
    setIsEditModalVisible(true);
    Animated.spring(modalAnim, {
      toValue: 1,
      tension: 100,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const handleSaveMeal = () => {
    if (!editingDay || !mealType) return;

    const updatedPlanning = {
      ...planning,
      [editingDay]: {
        ...(planning[editingDay] || { breakfast: '', lunch: '', dinner: '' }), // S'assurer que planning[editingDay] existe
        [mealType]: inputValue.trim(),
      },
    };
    setPlanning(updatedPlanning); // Met à jour l'état local
    saveCurrentPlanning(updatedPlanning); // Sauvegarde dans Firestore

    handleCloseModal();
  };

  const handleCloseModal = () => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 250,
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
      'Voulez-vous vraiment supprimer ce repas ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            const updatedPlanning = {
              ...planning,
              [day]: {
                ...(planning[day] || { breakfast: '', lunch: '', dinner: '' }),
                [type]: '',
              },
            };
            setPlanning(updatedPlanning);
            saveCurrentPlanning(updatedPlanning);
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

  const getMealColor = (type: 'breakfast' | 'lunch' | 'dinner') => {
    switch (type) {
      case 'breakfast': return '#FFB84D';
      case 'lunch': return '#4ECDC4';
      case 'dinner': return '#6C5CE7';
      default: return '#74B9FF';
    }
  };

  const getWeekProgress = () => {
    const totalMeals = daysOfWeek.length * 3;
    if (totalMeals === 0) return 0; // Éviter la division par zéro
    const plannedMeals = daysOfWeek.reduce((count, day) => {
      const dayMeals = planning[day.name];
      if (!dayMeals) return count;
      return count + (dayMeals.breakfast ? 1 : 0) + (dayMeals.lunch ? 1 : 0) + (dayMeals.dinner ? 1 : 0);
    }, 0);
    return Math.round((plannedMeals / totalMeals) * 100);
  };

  const getCurrentWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 (Dimanche) - 6 (Samedi)
    const monday = new Date(today);
    // Ajuster pour que Lundi soit le premier jour de la semaine
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    return daysOfWeek.map((_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index + (currentWeekOffset * 7));
      return date.getDate();
    });
  };

  const getWeekRange = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + (currentWeekOffset * 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${monday.toLocaleDateString('fr-FR', options)} - ${sunday.toLocaleDateString('fr-FR', options)}`;
  };

  const weekDates = getCurrentWeekDates();
  const weekProgress = getWeekProgress();

  if (isLoading && Object.keys(planning).length === 0) { // Afficher le loader seulement au premier chargement
    return (
        <SafeAreaView style={[styles.container, styles.loadingContainer]}>
            <ActivityIndicator size="large" color="#ebc665" />
            <Text style={styles.loadingText}>Chargement du planning...</Text>
        </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#ebc665" />

      <Animated.View
        style={[
          styles.headerGradient,
          {
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerContent}>
              <Text style={styles.headerEmoji}>📅</Text>
              <View>
                <Text style={styles.headerTitle}>Planning Repas</Text>
                <Text style={styles.headerSubtitle}>Organisez votre semaine</Text>
              </View>
            </View>
            <View style={styles.progressCircle}>
              <Text style={styles.progressPercentage}>{weekProgress}%</Text>
              <Text style={styles.progressLabel}>planifié</Text>
            </View>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: `${weekProgress}%`,
                    backgroundColor: weekProgress > 75 ? '#00b894' : weekProgress > 50 ? '#fdcb6e' : '#e17055'
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </Animated.View>

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
          <View style={styles.weekNavigation}>
            <TouchableOpacity
              style={styles.weekNavButton}
              onPress={() => setCurrentWeekOffset(currentWeekOffset - 1)}
              activeOpacity={0.7}
            >
              <Text style={styles.weekNavButtonText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.weekInfo}>
              <Text style={styles.weekTitle}>
                {currentWeekOffset === 0 ? 'Cette semaine' :
                 currentWeekOffset === 1 ? 'Semaine prochaine' :
                 currentWeekOffset === -1 ? 'Semaine dernière' :
                 `Semaine ${currentWeekOffset > 0 ? '+' : ''}${currentWeekOffset}`}
              </Text>
              <Text style={styles.weekRange}>{getWeekRange()}</Text>
            </View>
            <TouchableOpacity
              style={styles.weekNavButton}
              onPress={() => setCurrentWeekOffset(currentWeekOffset + 1)}
              activeOpacity={0.7}
            >
              <Text style={styles.weekNavButtonText}>›</Text>
            </TouchableOpacity>
          </View>

          {isLoading && <ActivityIndicator style={{marginVertical: 20}} size="small" color="#ebc665" />}

          {!isLoading && daysOfWeek.map((day, dayIndex) => {
            const dayMeals = planning[day.name] || { breakfast: '', lunch: '', dinner: '' };
            const todayDate = new Date();
            todayDate.setHours(0,0,0,0);
            const currentDayDate = new Date(todayDate);
            currentDayDate.setDate(todayDate.getDate() - (todayDate.getDay() === 0 ? 6 : todayDate.getDay() -1) + dayIndex + (currentWeekOffset * 7));
            const isToday = currentDayDate.getTime() === todayDate.getTime();


            return (
              <Animated.View
                key={day.name}
                style={[
                  styles.dayCard,
                  isToday && styles.todayCard,
                  {
                    transform: [
                      {
                        scale: fadeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.9, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.dayHeader}>
                  <View style={styles.dayTitleContainer}>
                    <Text style={[styles.dayTitle, isToday && styles.todayTitle]}>
                      {day.name}
                    </Text>
                    <View style={[styles.dayDateBadge, isToday && styles.todayDateBadge]}>
                      <Text style={[styles.dayDate, isToday && styles.todayDate]}>
                        {weekDates[dayIndex]}
                      </Text>
                    </View>
                    {isToday && <View style={styles.todayIndicator} />}
                  </View>
                  <View style={styles.dayProgressContainer}>
                    <View style={[styles.dayProgress, {
                      backgroundColor: Object.values(dayMeals).filter(meal => meal !== '').length === 3 
                        ? '#e8f5e8' : '#fff5e6',
                    }]}>
                      <Text style={[styles.dayProgressText, {
                        color: Object.values(dayMeals).filter(meal => meal !== '').length === 3
                          ? '#27ae60' : '#f39c12',
                      }]}>
                        {Object.values(dayMeals).filter(meal => meal !== '').length}/3
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.mealsContainer}>
                  {(['breakfast', 'lunch', 'dinner'] as const).map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.mealCard,
                        dayMeals[type] ?
                          [styles.mealCardFilled, { borderLeftColor: getMealColor(type) }] :
                          styles.mealCardEmpty,
                      ]}
                      onPress={() => handleEditMeal(day.name, type)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.mealHeader}>
                        <View style={[styles.mealIconContainer, { backgroundColor: getMealColor(type) + '20' }]}>
                          <Text style={styles.mealIcon}>{getMealIcon(type)}</Text>
                        </View>
                        <Text style={styles.mealTypeLabel}>{getMealLabel(type)}</Text>
                      </View>
                      <View style={styles.mealContent}>
                        <Text style={[
                          styles.mealText,
                          dayMeals[type] ? styles.mealTextFilled : styles.mealTextEmpty,
                        ]} numberOfLines={2}>
                          {dayMeals[type] || 'Toucher pour ajouter'}
                        </Text>
                      </View>
                      {!dayMeals[type] && (
                        <View style={styles.addIndicator}>
                          <Text style={styles.addIndicatorText}>+</Text>
                        </View>
                      )}
                      {dayMeals[type] && (
                        <TouchableOpacity
                          style={styles.clearButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleClearMeal(day.name, type);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.clearButtonText}>×</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>
            );
          })}

          {!isLoading && (
            <View style={styles.quickActionsContainer}>
                <TouchableOpacity style={styles.quickActionButton} activeOpacity={0.8} onPress={() => Alert.alert("Prochainement", "Cette fonctionnalité sera bientôt disponible.")}>
                <View style={[styles.quickActionIconContainer, { backgroundColor: '#e74c3c20' }]}>
                  <Text style={styles.quickActionIcon}>🎲</Text>
                </View>
                <Text style={styles.quickActionText}>Suggestion aléatoire</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickActionButton} activeOpacity={0.8} onPress={() => Alert.alert("Prochainement", "Cette fonctionnalité sera bientôt disponible.")}>
                <View style={[styles.quickActionIconContainer, { backgroundColor: '#3498db20' }]}>
                  <Text style={styles.quickActionIcon}>📋</Text>
                </View>
                <Text style={styles.quickActionText}>Dupliquer semaine</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </Animated.View>

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
                  {
                    translateY: modalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.modalHeader, { backgroundColor: mealType ? getMealColor(mealType) : '#1A5D4A' }]}>
              <View style={styles.modalIconContainer}>
                <Text style={styles.modalIcon}>{mealType && getMealIcon(mealType)}</Text>
              </View>
              <Text style={styles.modalTitle}>
                {mealType && getMealLabel(mealType)}
              </Text>
              <Text style={styles.modalSubtitle}>{editingDay}</Text>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="Ex: Salade César, Pâtes carbonara..."
                placeholderTextColor="#a0a0a0"
                style={styles.modalInput}
                multiline={true}
                numberOfLines={4}
                autoFocus={true}
                onSubmitEditing={handleSaveMeal} // Permet de sauvegarder avec la touche "Entrée"
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={handleCloseModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveButton, { backgroundColor: mealType ? getMealColor(mealType) : '#1A5D4A' }]}
                  onPress={handleSaveMeal}
                  activeOpacity={0.8}
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
    backgroundColor: '#f8f9fb', // Un gris très clair pour le fond général
  },
  loadingContainer: { // Ajouté
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { // Ajouté
    marginTop: 10,
    fontSize: 16,
    color: '#ebc665',
  },
  headerGradient: {
    backgroundColor: '#ebc665', // Vert foncé pour le header
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 32, // Légèrement plus grand
    marginRight: 16,
    color: '#fff', // Assurez-vous que l'emoji est visible
  },
  headerTitle: {
    color: 'white',
    fontSize: 26, // Plus grand pour plus d'impact
    fontWeight: '800', // Plus gras
    marginBottom: 2,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '400', // Normal
  },
  progressCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3, // Plus visible
    borderColor: 'rgba(255,255,255,0.3)',
  },
  progressPercentage: {
    color: 'white',
    fontSize: 16, // Lisible
    fontWeight: '800',
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: screenWidth - 48, // Prend presque toute la largeur
    height: 8, // Plus subtil
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 4, // Pour que la barre soit visible même à 0%
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40, // Espace en bas
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white', // Carte blanche
    borderRadius: 20, // Plus arrondi
    padding: 20,
    marginBottom: 24,
    elevation: 4, // Ombre subtile
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  weekNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22, // Cercle parfait
    backgroundColor: '#f8f9fb', // Fond clair
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef', // Bordure discrète
  },
  weekNavButtonText: {
    fontSize: 24,
    color: '#0D4F3C', // Couleur du header
    fontWeight: 'bold',
  },
  weekInfo: {
    flex: 1,
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 20, // Plus grand
    fontWeight: '800',
    color: '#2d3436', // Gris foncé
    marginBottom: 4,
  },
  weekRange: {
    fontSize: 14,
    color: '#636e72', // Gris moyen
    fontWeight: '500',
  },
  dayCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  todayCard: {
    borderWidth: 2,
    borderColor: '#00b894', // Vert pour aujourd'hui
    backgroundColor: '#f1fff7', // Fond très clair vert
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dayTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2d3436',
    marginRight: 12,
  },
  todayTitle: {
    color: '#00b894', // Vert
  },
  dayDateBadge: {
    backgroundColor: '#f8f9fb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12, // Plus arrondi
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  todayDateBadge: {
    backgroundColor: '#00b894', // Vert
    borderColor: '#00b894',
  },
  dayDate: {
    fontSize: 14,
    color: '#636e72',
    fontWeight: '700',
  },
  todayDate: {
    color: 'white', // Texte blanc sur fond vert
  },
  todayIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00b894', // Vert
    marginLeft: 8,
  },
  dayProgressContainer: {
    alignItems: 'flex-end',
  },
  dayProgress: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16, // Plus arrondi
  },
  dayProgressText: {
    fontSize: 14,
    fontWeight: '800',
  },
  mealsContainer: {
    gap: 16, // Espace entre les cartes de repas
  },
  mealCard: {
    borderRadius: 16,
    padding: 18,
    position: 'relative', // Pour le bouton de suppression
  },
  mealCardEmpty: {
    backgroundColor: '#f8f9fb',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed', // Style pour vide
  },
  mealCardFilled: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderLeftWidth: 4, // Indicateur coloré à gauche
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mealIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18, // Cercle
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mealIcon: {
    fontSize: 18,
  },
  mealTypeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2d3436',
  },
  mealContent: {
    flex: 1,
    paddingLeft: 48, // Pour aligner avec le texte sous l'icône
  },
  mealText: {
    fontSize: 15,
    lineHeight: 22,
  },
  mealTextEmpty: {
    color: '#a0a0a0', // Gris clair pour placeholder
    fontStyle: 'italic',
  },
  mealTextFilled: {
    color: '#2d3436', // Gris foncé pour contenu
    fontWeight: '500',
  },
  addIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#74b9ff', // Bleu clair
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIndicatorText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ff6b6b', // Rouge pour supprimer
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: Platform.OS === 'ios' ? 16 : undefined, // Ajustement pour Android
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12, // Espacement après la liste des jours
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  quickActionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickActionIcon: {
    fontSize: 20,
  },
  quickActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2d3436',
    flex: 1, // Pour que le texte prenne l'espace disponible
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)', // Fond semi-transparent plus sombre
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    borderRadius: 24, // Plus arrondi
    width: '100%',
    maxWidth: 420, // Limite la largeur sur les grands écrans
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    overflow: 'hidden', // Pour que le header arrondi s'affiche correctement
  },
  modalHeader: {
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)', // Bordure subtile si header coloré
  },
  modalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalIcon: {
    fontSize: 28,
  },
  modalTitle: {
    color: 'white', // Assumant un fond coloré pour le header du modal
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBody: {
    padding: 24,
  },
  modalInput: {
    backgroundColor: '#f8f9fb',
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    color: '#2d3436',
    textAlignVertical: 'top', // Pour multiline
    marginBottom: 24,
    borderWidth: 2, // Bordure plus visible
    borderColor: '#e9ecef',
    minHeight: 100, // Hauteur minimale
    ...Platform.select({ // Ajustement padding pour iOS
      ios: {
        paddingTop: 18,
      },
    }),
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16, // Espace entre les boutons
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fb',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  modalCancelText: {
    color: '#636e72',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modalSaveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default MealPlanningScreen;
