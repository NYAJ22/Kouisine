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
    return gender === 'male' ? '🧑‍🦱' : '👩‍🦱'; // Adolescent
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

    // Animation pour le nouveau membre (optionnel, peut être ajusté)
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
      // Supprime d'abord les anciens membres (optionnel mais recommandé pour éviter les doublons lors des re-runs)
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
          { backgroundColor: item.gender === 'male' ? '#E3F2FD' : '#FCE4EC' } // Couleurs plus douces
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
              contentContainerStyle={styles.memberListContent} // Nouveau style pour la FlatList
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
      <StatusBar barStyle="light-content" backgroundColor="#FF6B6B" />

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
    backgroundColor: '#F8F8F8', // Arrière-plan général plus doux
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 30, // Plus d'espace en haut
    paddingBottom: 28, // Plus d'espace en bas
    backgroundColor: '#FF6B6B', // Couleur primaire vibrante
    borderBottomLeftRadius: 30, // Coins arrondis en bas
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 12,
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerEmoji: {
    fontSize: 56, // Emoji plus grand
    marginBottom: 16,
  },
  title: {
    fontSize: 32, // Titre plus grand
    fontWeight: '800',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17, // Texte plus lisible
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  progressContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  progressText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 8,
    fontWeight: '600',
  },
  progressBar: {
    width: 150, // Barre de progression plus large
    height: 6, // Plus épaisse
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFE66D', // Couleur secondaire
    borderRadius: 3,
  },
  stepContainer: {
    flex: 1,
  },
  welcomeContainer: { // Conservé pour référence si jamais utilisé
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  welcomeEmoji: { // Conservé pour référence
    fontSize: 64,
    marginBottom: 20,
  },
  welcomeTitle: { // Conservé pour référence
    fontSize: 32,
    fontWeight: '800',
    color: 'black',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: { // Conservé pour référence
    fontSize: 18,
    color: 'rgba(0, 0, 0, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
  },
  greetingContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 25, // Plus de padding
  },
  greetingText: {
    fontSize: 26, // Plus grand
    fontWeight: '700',
    color: '#333333', // Couleur de texte plus foncée
    textAlign: 'center',
    marginBottom: 10,
  },
  greetingSubtext: {
    fontSize: 17,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 10, // Marges latérales réduites pour prendre plus de place
    marginBottom: 24,
    marginTop: 20, // Moins de marge en haut
    elevation: 10, // Ombre plus prononcée
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 15,
  },
  formTitle: {
    fontSize: 24, // Titre plus grand
    fontWeight: '700',
    color: '#333333',
    marginBottom: 28, // Plus d'espace en bas
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 22, // Plus d'espace entre les inputs
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6', // Un gris clair plus doux
    borderRadius: 18, // Coins plus arrondis
    paddingHorizontal: 18, // Plus de padding horizontal
    paddingVertical: 2, // Ajustement vertical
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputWrapperFocused: {
    borderColor: '#FF6B6B', // Couleur primaire au focus
    backgroundColor: '#FFFDE7', // Arrière-plan jaune très clair au focus
  },
  inputIcon: {
    fontSize: 22, // Icône plus grande
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 17, // Texte plus grand
    color: '#333333',
    paddingVertical: 14, // Ajustement du padding vertical
    fontWeight: '500',
  },
  genderContainer: {
    marginBottom: 24,
  },
  genderButtonsContainer: {
    flexDirection: 'row',
    gap: 15, // Plus d'espace entre les boutons
  },
  genderButton: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Arrière-plan doux
    borderRadius: 18,
    paddingVertical: 18, // Plus de padding
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonSelected: {
    backgroundColor: '#FFE66D', // Couleur secondaire
    borderColor: '#FF6B6B', // Bordure avec couleur primaire
  },
  genderEmoji: {
    fontSize: 30, // Emoji plus grand
    marginBottom: 8,
  },
  genderText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#666666',
  },
  genderTextSelected: {
    color: '#333333', // Texte plus foncé au focus
  },
  addButton: {
    backgroundColor: '#FF6B6B', // Couleur primaire
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8, // Ombre plus forte
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    marginTop: 10,
  },
  addButtonIcon: {
    fontSize: 22, // Icône plus grande
    marginRight: 10,
    color: 'white',
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  familyListContainer: {
    marginBottom: 24,
    marginHorizontal: 10, // Alignement avec les cartes
  },
  familyListTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 18,
    textAlign: 'center',
  },
  memberListContent: {
    paddingBottom: 20, // Ajoute un peu de padding en bas de la liste
  },
  memberCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15, // Plus d'espace entre les membres
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 6, // Ombre plus douce
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatarContainer: {
    width: 60, // Avatar plus grand
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18, // Plus d'espace
  },
  memberEmoji: {
    fontSize: 32, // Emoji plus grand
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 20, // Nom plus grand
    fontWeight: '700',
    color: '#333333',
    marginBottom: 6,
  },
  memberAge: {
    fontSize: 15,
    color: '#666666',
    fontWeight: '500',
    marginBottom: 4,
  },
  memberGender: {
    fontSize: 13,
    color: '#999999',
    fontWeight: '500',
  },
  removeButton: {
    width: 48, // Bouton plus grand
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFEBEE', // Fond rouge très clair
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIcon: {
    fontSize: 20,
    color: '#F44336',
    fontWeight: '600',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 50, // Plus de padding
    paddingHorizontal: 24,
    marginHorizontal: 10,
    backgroundColor: 'white',
    borderRadius: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  emptyStateEmoji: {
    fontSize: 70, // Emoji plus grand
    marginBottom: 25,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 17,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  footerContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: Platform.OS === 'ios' ? 35 : 20, // Ajustement pour iOS bottom safe area
    backgroundColor: '#F8F8F8', // Correspond au fond pour une transition fluide
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  continueButton: {
    backgroundColor: '#FF6B6B', // Couleur primaire
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  finalContinueButton: {
    backgroundColor: '#FF6B6B', // Couleur primaire
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  continueButtonDisabled: {
    opacity: 0.6, // Moins d'opacité pour le bouton désactivé
    elevation: 0,
    shadowOpacity: 0,
  },
  continueButtonText: {
    fontSize: 19, // Texte plus grand
    fontWeight: '700',
    color: 'white',
    marginRight: 10,
  },
  continueButtonIcon: {
    fontSize: 22, // Icône plus grande
    color: 'white',
  },
  continueHint: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 19,
    fontWeight: '700',
    color: 'white', // Texte blanc pour le chargement sur le bouton
  },
});

export default FamilySetup;
