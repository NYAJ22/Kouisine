import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/Navigation';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const { width } = Dimensions.get('window');

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'FamilySetup'>;
};

type Gender = 'male' | 'female';

type FamilyMember = {
  id: string;
  name: string;
  age: string;
  gender: Gender;
  emoji: string;
};

// Emojis intelligents basés sur l'âge et le sexe
const getSmartEmoji = (age: number, gender: Gender): string => {
  if (age <= 2) {
    return '👶'; // Bébé
  } else if (age <= 12) {
    return gender === 'male' ? '👦' : '👧'; // Enfant
  } else if (age <= 17) {
    return gender === 'male' ? '🧒' : '👧'; // Adolescent
  } else if (age <= 59) {
    return gender === 'male' ? '👨' : '👩'; // Adulte
  } else {
    return gender === 'male' ? '👴' : '👵'; // Personne âgée
  }
};

const FamilySetup: React.FC<Props> = ({ navigation }) => {
  // États pour l'étape 1 (nom d'utilisateur)
  const [currentStep, setCurrentStep] = useState(1);
  const [userName, setUserName] = useState('');

  // États pour l'étape 2 (membres de la famille)
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [selectedGender, setSelectedGender] = useState<Gender>('male');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const stepTransition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, headerSlideAnim, slideAnim]);

  // Animation de transition entre les étapes
  const animateStepTransition = () => {
    Animated.sequence([
      Animated.timing(stepTransition, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(stepTransition, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleUserNameContinue = () => {
    if (!userName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre nom');
      return;
    }
    animateStepTransition();
    setTimeout(() => setCurrentStep(2), 300);
  };

  const addMember = (): void => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un prénom');
      return;
    }
    if (!age.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un âge');
      return;
    }
    if (isNaN(Number(age)) || Number(age) < 0 || Number(age) > 120) {
      Alert.alert('Erreur', 'Veuillez entrer un âge valide (0-120)');
      return;
    }

    const newMember: FamilyMember = {
      id: Date.now().toString(),
      name: name.trim(),
      age: age.trim(),
      gender: selectedGender,
      emoji: getSmartEmoji(Number(age), selectedGender),
    };

    setMembers([...members, newMember]);
    setName('');
    setAge('');
    setSelectedGender('male');

    // Animation pour le nouveau membre
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  const removeMember = (id: string): void => {
    Alert.alert(
      'Supprimer le membre',
      'Êtes-vous sûr de vouloir supprimer ce membre de la famille ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setMembers(members.filter(member => member.id !== id));
          },
        },
      ]
    );
  };

  const handleContinue = async (): Promise<void> => {
    if (members.length === 0) {
      Alert.alert('Information', 'Ajoutez au moins un membre de la famille pour continuer');
      return;
    }

    setIsLoading(true);
    const uid = auth().currentUser?.uid;

    if (!uid) {
      setIsLoading(false);
      Alert.alert('Erreur', 'Problème d\'authentification');
      return;
    }

    try {
      // Met à jour le nom d'utilisateur
      await firestore().collection('users').doc(uid).update({
        userName: userName,
      });

      // Ajoute chaque membre dans la sous-collection familyMembers
      const batch = firestore().batch();
      const familyMembersRef = firestore().collection('users').doc(uid).collection('familyMembers');
      // Supprime d'abord les anciens membres (optionnel mais recommandé)
      const existing = await familyMembersRef.get();
      existing.forEach(doc => batch.delete(doc.ref));
      // Ajoute les nouveaux membres
      members.forEach(member => {
        const docRef = familyMembersRef.doc(member.id);
        batch.set(docRef, member);
      });
      await batch.commit();

      setTimeout(() => {
        setIsLoading(false);
        navigation.replace('Home');
      }, 1500);
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Erreur', 'Impossible de sauvegarder les informations');
    }
  };

  const renderGenderSelector = () => (
    <View style={styles.genderContainer}>
      <Text style={styles.inputLabel}>Sexe</Text>
      <View style={styles.genderButtonsContainer}>
        <TouchableOpacity
          style={[
            styles.genderButton,
            selectedGender === 'male' && styles.genderButtonSelected,
          ]}
          onPress={() => setSelectedGender('male')}
          activeOpacity={0.7}
        >
          <Text style={styles.genderEmoji}>👨</Text>
          <Text style={[
            styles.genderText,
            selectedGender === 'male' && styles.genderTextSelected,
          ]}>
            Homme
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.genderButton,
            selectedGender === 'female' && styles.genderButtonSelected,
          ]}
          onPress={() => setSelectedGender('female')}
          activeOpacity={0.7}
        >
          <Text style={styles.genderEmoji}>👩</Text>
          <Text style={[
            styles.genderText,
            selectedGender === 'female' && styles.genderTextSelected,
          ]}>
            Femme
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMemberItem = ({ item, index }: { item: FamilyMember; index: number }) => (
    <Animated.View
      style={[
        styles.memberCard,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 10 * index],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.memberInfo}>
        <View style={[
          styles.memberAvatarContainer,
          { backgroundColor: item.gender === 'male' ? '#E3F2FD' : '#FCE4EC' }
        ]}>
          <Text style={styles.memberEmoji}>{item.emoji}</Text>
        </View>
        <View style={styles.memberDetails}>
          <Text style={styles.memberName}>{item.name}</Text>
          <Text style={styles.memberAge}>{item.age} ans</Text>
          <Text style={styles.memberGender}>
            {item.gender === 'male' ? 'Homme' : 'Femme'}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeMember(item.id)}
        activeOpacity={0.7}
      >
        <Text style={styles.removeIcon}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStep1 = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { translateX: stepTransition.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -width],
            })},
          ],
        },
      ]}
    >

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Comment vous appelez-vous ?</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Votre prénom</Text>
          <View style={[
            styles.inputWrapper,
            focusedField === 'userName' && styles.inputWrapperFocused,
          ]}>
            <Text style={styles.inputIcon}>😊</Text>
            <TextInput
              placeholder="Entrez votre prénom"
              placeholderTextColor="#A0A0A0"
              style={styles.textInput}
              value={userName}
              onChangeText={setUserName}
              onFocus={() => setFocusedField('userName')}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="words"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            !userName.trim() && styles.continueButtonDisabled,
          ]}
          onPress={handleUserNameContinue}
          disabled={!userName.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Continuer</Text>
          <Text style={styles.continueButtonIcon}>→</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { translateX: stepTransition.interpolate({
              inputRange: [0, 1],
              outputRange: [currentStep === 1 ? width : 0, 0],
            })},
          ],
        },
      ]}
    >
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Salutation personnalisée */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingText}>
            Bonjour {userName} ! 👋
          </Text>
          <Text style={styles.greetingSubtext}>
            Maintenant, parlez-moi de votre famille
          </Text>
        </View>

        {/* Formulaire d'ajout */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Ajouter un membre de la famille</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Prénom</Text>
            <View style={[
              styles.inputWrapper,
              focusedField === 'name' && styles.inputWrapperFocused,
            ]}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                placeholder="Ex: Marie, Paul..."
                placeholderTextColor="#A0A0A0"
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Âge</Text>
            <View style={[
              styles.inputWrapper,
              focusedField === 'age' && styles.inputWrapperFocused,
            ]}>
              <Text style={styles.inputIcon}>🎂</Text>
              <TextInput
                placeholder="Ex: 25, 8..."
                placeholderTextColor="#A0A0A0"
                keyboardType="numeric"
                style={styles.textInput}
                value={age}
                onChangeText={setAge}
                onFocus={() => setFocusedField('age')}
                onBlur={() => setFocusedField(null)}
                maxLength={3}
              />
            </View>
          </View>

          {renderGenderSelector()}

          <TouchableOpacity
            style={styles.addButton}
            onPress={addMember}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonIcon}>➕</Text>
            <Text style={styles.addButtonText}>Ajouter à la famille</Text>
          </TouchableOpacity>
        </View>

        {/* Liste des membres */}
        {members.length > 0 && (
          <View style={styles.familyListContainer}>
            <Text style={styles.familyListTitle}>
              Votre famille ({members.length} membre{members.length > 1 ? 's' : ''})
            </Text>
            <FlatList
              data={members}
              keyExtractor={item => item.id}
              renderItem={renderMemberItem}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Message d'encouragement si pas de membres */}
        {members.length === 0 && (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateEmoji}>👨‍👩‍👧‍👦</Text>
            <Text style={styles.emptyStateTitle}>Créez votre famille !</Text>
            <Text style={styles.emptyStateText}>
              Ajoutez les membres de votre famille pour des menus personnalisés
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bouton Continuer */}
      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={[
            styles.finalContinueButton,
            members.length === 0 && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={members.length === 0 || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Configuration...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.continueButtonText}>Terminer la configuration</Text>
              <Text style={styles.continueButtonIcon}>✓</Text>
            </>
          )}
        </TouchableOpacity>

        {members.length === 0 && (
          <Text style={styles.continueHint}>
            Ajoutez au moins un membre pour continuer
          </Text>
        )}
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#ebc665" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header avec progression */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: headerSlideAnim }],
            },
          ]}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerEmoji}>
              {currentStep === 1 ? '👋' : '👨‍👩‍👧‍👦'}
            </Text>
            <Text style={styles.title}>
              {currentStep === 1 ? 'Bienvenue !' : 'Votre famille'}
            </Text>
            <Text style={styles.subtitle}>
              {currentStep === 1
                ? 'Commençons par faire connaissance'
                : 'Qui mange avec vous ?'
              }
            </Text>
          </View>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              Étape {currentStep} sur 2
            </Text>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: currentStep === 1 ? '50%' : '100%' }
                ]}
              />
            </View>
          </View>
        </Animated.View>

        {/* Contenu des étapes */}
        {currentStep === 1 ? renderStep1() : renderStep2()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: '#ebc665',
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
    fontWeight: '500',
  },
  progressBar: {
    width: 120,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffd700',
    borderRadius: 2,
  },
  stepContainer: {
    flex: 1,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  welcomeEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: 'black',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: 'rgba(0, 0, 0, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
  },
  greetingContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '700',
    color: 'black',
    textAlign: 'center',
    marginBottom: 8,
  },
  greetingSubtext: {
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.8)',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 20,
    marginBottom: 24,
    marginTop: 50,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputWrapperFocused: {
    borderColor: '#ebc665',
    backgroundColor: '#F1F8E9',
  },
  inputIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 16,
    fontWeight: '500',
  },
  genderContainer: {
    marginBottom: 24,
  },
  genderButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonSelected: {
    backgroundColor: '#E8F5E8',
    borderColor: '#ebc665',
  },
  genderEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  genderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  genderTextSelected: {
    color: '#ebc665',
  },
  addButton: {
    backgroundColor: '#ebc665',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  familyListContainer: {
    marginBottom: 24,
  },
  familyListTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'black',
    marginBottom: 16,
    textAlign: 'center',
  },
  memberCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  memberEmoji: {
    fontSize: 28,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  memberAge: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginBottom: 2,
  },
  memberGender: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  removeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIcon: {
    fontSize: 18,
    color: '#F44336',
    fontWeight: '600',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'black',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  footerContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 30,
  },
  continueButton: {
    backgroundColor: '#ebc665',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#ebc665',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  finalContinueButton: {
    backgroundColor: '#ebc665',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  continueButtonDisabled: {
    opacity: 0.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    marginRight: 8,
  },
  continueButtonIcon: {
    fontSize: 20,
    color: 'white',
  },
  continueHint: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.7)',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ebc665',
  },
});

export default FamilySetup;
