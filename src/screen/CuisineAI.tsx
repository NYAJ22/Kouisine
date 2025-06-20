import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  Animated,
  Clipboard,
  Dimensions,
} from 'react-native';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Markdown from 'react-native-markdown-display'; // Make sure this is installed: npm install react-native-markdown-display


const { height } = Dimensions.get('window');

// IMPORTANT: Never expose your API key directly in production code.
// Use environment variables (e.g., `process.env.GEMINI_API_KEY`)
// or a secure backend service to manage API keys.
const API_KEY = 'AIzaSyDvLm1P8PPIuYyPZOBo_ssK40NXJMd9rtY'; // <<<<<<< REMPLACEZ PAR VOTRE VRAIE CLÉ API >>>>>>>

// Interface pour un message dans l'historique du chat
interface ChatMessage {
  from: 'user' | 'ai' | 'loading'; // 'loading' pour l'indicateur de saisie de l'IA
  id: string; // Pour keyExtractor dans FlatList/ScrollView
  text: string; // Le texte complet du message
  ingredients?: string; // Ingrédients extraits pour les recettes AI
  preparation?: string; // Préparation extraite pour les recettes AI
}

const CuisineIA = () => {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  // L'historique des messages pour le chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Ref pour scroller automatiquement en bas
  const scrollViewRef = useRef<ScrollView>(null);

  // Animation pour le bouton d'envoi (pulse effect)
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialisation de l'animation pour le bouton d'envoi
  useEffect(() => {
    if (!isLoading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        { iterations: -1 }
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1); // Réinitialise l'animation quand ça charge
    }
  }, [isLoading, pulseAnim]);

  // Scroll automatique en bas des messages
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // Fonction pour interagir avec Gemini API
  const generateContent = async (chatHistory: { role: string; parts: { text: string }[] }[]) => {
    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      // Utilisation de gemini-1.5-flash comme précédemment
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent({ contents: chatHistory }); // Passer l'historique ici
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      let userFriendlyMessage = 'Une erreur inconnue est survenue. Veuillez réessayer plus tard.';

      if (error.message.includes('503') || error.message.includes('overloaded')) {
        userFriendlyMessage = 'Le service est actuellement surchargé. Veuillez réessayer dans un instant.';
      } else if (error.message.includes('400') || error.message.includes('API key')) {
        userFriendlyMessage = 'Erreur d\'API. Veuillez vérifier votre clé API ou le format de la requête.';
      } else if (error.message.includes('Network request failed')) {
        userFriendlyMessage = 'Problème de connexion réseau. Veuillez vérifier votre internet.';
      }
      throw new Error(userFriendlyMessage);
    }
  };

  // Fonction utilitaire pour parser les sections de la recette
  const parseRecipeSections = (fullText: string) => {
    // Les regex pour capturer les sections Ingrédients et Préparation
    const ingredientsMatch = fullText.match(/INGR[ÉE]DIENTS[\s\S]*?(?:\n|:)\s*([\s\S]*?)(?=\n\S|$)/i);
    const preparationMatch = fullText.match(/PR[ÉE]PARATION[\s\S]*?(?:\n|:)\s*([\s\S]*?)(?=\n\S|$)/i);

    let ingredients = '';
    let preparation = '';

    if (ingredientsMatch && ingredientsMatch[1]) {
      ingredients = ingredientsMatch[1].trim();
    }
    if (preparationMatch && preparationMatch[1]) {
      preparation = preparationMatch[1].trim();
    }

    return { ingredients, preparation };
  };

  // Handler pour obtenir la recette et gérer la conversation
  const handleGetRecipe = async () => {
    if (!userInput.trim()) {
      setErrorMessage("Oups ! Veuillez entrer votre demande.");
      return;
    }

    const userMessageText = userInput.trim();
    const userMessage: ChatMessage = { from: 'user', id: `user-${Date.now()}`, text: userMessageText };

    // Ajoute le message de l'utilisateur à l'historique
    setMessages(prev => [...prev, userMessage]);
    setUserInput(''); // Efface l'input

    setIsLoading(true);
    setErrorMessage('');

    // Ajoute un message temporaire "en attente de l'IA"
    const loadingMessageId = `loading-${Date.now()}`;
    setMessages(prev => [...prev, { from: 'loading', id: loadingMessageId, text: '' }]);

    try {
      // Construire l'historique de chat pour l'API Gemini
      const chatHistory = messages.filter(msg => msg.from !== 'loading').map(msg => ({
        role: msg.from === 'user' ? 'user' : 'model', // 'model' pour les réponses de l'IA
        parts: [{ text: msg.text }],
      }));

      // Ajouter le message actuel de l'utilisateur au prompt pour l'API
      chatHistory.push({ role: 'user', parts: [{ text: userMessageText }] });

      // Spécifier le format de la réponse souhaité dans le prompt initial pour guider l'IA
      // Prompt initial pour guider l'IA (à n'ajouter qu'une fois, si besoin)
      if (chatHistory.length === 1) {
        chatHistory.unshift({
          role: 'user',
          parts: [{
            text:
              "Tu es un assistant culinaire expert. Lorsque tu donnes une recette, structure ta réponse en utilisant les sections suivantes avec des emojis et du Markdown :\n\n" +
              "📝 **INGRÉDIENTS**\n- ...\n\n👨‍🍳 **PRÉPARATION**\n1. ...\n\n⏰ **TEMPS DE PRÉPARATION**\n...\n\n🍽️ **CONSEILS**\n...\n\n" +
              "Sois concis, clair et adapte la recette à la demande. Si la question n'est pas une recette, réponds normalement."
          }],
        });
      }

      // Appel à l'API Gemini
      const aiResponseText = await generateContent(chatHistory);

      // Retirer le message de chargement
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));

      // Extraire les sections si c'est une recette
      const { ingredients, preparation } = parseRecipeSections(aiResponseText);

      // Ajoute la réponse de l'IA à l'historique
      setMessages(prev => [
        ...prev,
        {
          from: 'ai',
          id: `ai-${Date.now()}`,
          text: aiResponseText,
          ingredients: ingredients || undefined,
          preparation: preparation || undefined,
        },
      ]);
    } catch (error: any) {
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));
      setErrorMessage(error.message || "Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour copier la préparation d'un message spécifique
  const handleCopyPreparation = (preparation: string) => {
    if (preparation) {
      Clipboard.setString(preparation);
      Alert.alert('Copié ! 👨‍🍳', 'La préparation a été copiée dans le presse-papiers.');
    } else {
      Alert.alert('Rien à copier', 'Il n\'y a pas d\'étapes de préparation à copier pour ce message.');
    }
  };

  // Fonction pour copier les ingrédients d'un message spécifique
  const handleCopyIngredients = (ingredients: string) => {
    if (ingredients) {
      Clipboard.setString(ingredients);
      Alert.alert('Copié ! 📋', 'Les ingrédients ont été copiés dans le presse-papiers.');
    } else {
      Alert.alert('Rien à copier', 'Il n\'y a pas d\'ingrédients à copier pour ce message.');
    }
  };

  // Composant pour afficher une bulle de message
  interface MessageBubbleProps {
    message: ChatMessage;
    styles: any;
    handleCopyPreparation: (preparation: string) => void;
    handleCopyIngredients: (ingredients: string) => void; // Ajout ici
  }

  const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    styles,
    handleCopyPreparation,
    handleCopyIngredients, // Ajout ici
  }) => {
    const isUser = message.from === 'user';
    const isLoadingMessage = message.from === 'loading';

    return (
      <View
        style={[
          styles.chatBubble,
          isUser ? styles.userBubble : styles.aiBubble,
          isLoadingMessage && styles.loadingBubble,
        ]}
      >
        {isLoadingMessage ? (
          <View style={styles.loadingMessageContainer}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.loadingMessageText}>L'IA est en train de taper...</Text>
          </View>
        ) : (
          <>
            {isUser ? (
              <Text style={styles.userText}>{message.text}</Text>
            ) : (
              <>
                <Markdown
                  style={{
                    body: { ...styles.aiText, color: '#ccd6f6' },
                    heading1: { color: '#ff6b35', fontSize: 20, marginBottom: 10 },
                    heading2: { color: '#ff6b35', fontSize: 18, marginBottom: 8 },
                    listItem: { color: '#ccd6f6', fontSize: 16, lineHeight: 24 },
                    bullet_list: { marginBottom: 10 },
                    ordered_list: { marginBottom: 10 },
                    strong: { fontWeight: 'bold', color: '#fff' },
                    em: { fontStyle: 'italic', color: '#a0aec0' },
                    paragraph: { color: '#ccd6f6', fontSize: 16, lineHeight: 24, marginBottom: 5 },
                  }}
                >
                  {message.text}
                </Markdown>
                {(message.ingredients || message.preparation) && (
                  <View style={styles.copyButtonsContainer}>
                    {(message.ingredients && message.ingredients.trim()) && (
                      <TouchableOpacity
                        style={styles.copyActionButton}
                        onPress={() => handleCopyIngredients(message.ingredients!)}
                      >
                        <Text style={styles.copyActionEmoji}>📋</Text>
                        <Text style={styles.copyActionText}>Ingrédients</Text>
                      </TouchableOpacity>
                    )}
                    {(message.preparation && message.preparation.trim()) && (
                      <TouchableOpacity
                        style={styles.copyActionButton}
                        onPress={() => handleCopyPreparation(message.preparation!)}
                      >
                        <Text style={styles.copyActionEmoji}>👨‍🍳</Text>
                        <Text style={styles.copyActionText}>Préparation</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </View>
    );
  };

  function handleClearChat() {
    Alert.alert(
      "Effacer le chat",
      "Voulez-vous vraiment effacer l'historique de la conversation ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Effacer",
          style: "destructive",
          onPress: () => {
            setMessages([]);
            setErrorMessage('');
          },
        },
      ]
    );
  }
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e2139" />

      {/* Simplified Chat Header */}
      <View style={styles.chatHeader}>
        <Text style={styles.chatHeaderTitle}>Cuisine IA 👨‍🍳</Text>
        <TouchableOpacity style={styles.clearButton} onPress={handleClearChat}>
          <Text style={styles.clearButtonText}>Effacer le chat</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        // Ajustez le keyboardVerticalOffset si le clavier couvre toujours l'input sur iOS
        keyboardVerticalOffset={Platform.OS === 'ios' ? (Number(Platform.Version) >= 11 ? 0 : 0) : 0}
      >
        {/* ScrollView pour l'historique des messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderEmoji}>👋</Text>
              <Text style={styles.placeholderText}>
                Bonjour, je suis votre assistant culinaire !
              </Text>
              <View style={styles.suggestionContainer}>
                <Text style={styles.suggestionTitle}>💡 Suggestions :</Text>
                <Text style={styles.suggestionText}>
                  "Recette de poulet yassa" {"\n"}
                  "Comment faire une pâte à crêpes ?" {"\n"}
                  "Idée de dessert rapide ?" {"\n"}
                  "Recette végétarienne simple"
                </Text>
              </View>
            </View>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                styles={styles}
                handleCopyPreparation={handleCopyPreparation}
                handleCopyIngredients={handleCopyIngredients} // Ajout ici
              />
            ))
          )}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorEmoji}>⚠️</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Barre de saisie fixe en bas */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.inputChat}
            placeholder="Votre plat ou question..."
            placeholderTextColor="#8892b0"
            value={userInput}
            onChangeText={setUserInput}
            editable={!isLoading}
            onSubmitEditing={handleGetRecipe} // Envoyer quand on appuie sur Entrée
            blurOnSubmit={false} // Ne pas masquer le clavier après l'envoi
          />
          <Animated.View style={{ transform: [{ scale: isLoading ? 1 : pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.sendButton, (isLoading || !userInput.trim()) && styles.buttonDisabled]}
              onPress={handleGetRecipe}
              disabled={isLoading || !userInput.trim()}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendButtonText}>Envoyer</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default CuisineIA;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b14', // Fond sombre
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  // Simplified Chat Header
  chatHeader: {
    backgroundColor: '#1e2139', // Couleur d'en-tête sombre
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight! + 10 : 50,
    paddingBottom: 15,
    flexDirection: 'row', // Permet d'aligner le titre et le bouton Effacer
    alignItems: 'center',
    justifyContent: 'space-between', // Espacement entre les éléments
    paddingHorizontal: 20, // Ajout de padding horizontal
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
  },
  chatHeaderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6b35', // Couleur d'accentuation
    letterSpacing: 0.8,
    textShadowColor: 'rgba(255, 107, 53, 0.2)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  clearButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },

  // Messages Container (ScrollView for chat history)
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 15, // Padding pour les bulles
  },
  messagesContentContainer: {
    flexGrow: 1, // Permet à la ScrollView de grandir
    justifyContent: 'flex-end', // Aligne les messages en bas
    paddingVertical: 15, // Espacement vertical
  },

  // Chat Bubbles
  chatBubble: {
    maxWidth: '85%',
    borderRadius: 18,
    padding: 14,
    marginVertical: 6, // Espace entre les bulles
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#ff6b35', // Couleur accent pour l'utilisateur
    alignSelf: 'flex-end', // Aligné à droite
    borderBottomRightRadius: 4, // Petite pointe pour l'utilisateur
  },
  aiBubble: {
    backgroundColor: '#23263a', // Couleur sombre pour l'IA
    alignSelf: 'flex-start', // Aligné à gauche
    borderBottomLeftRadius: 4, // Petite pointe pour l'IA
  },
  loadingBubble: {
    backgroundColor: '#4a4a5a', // Couleur pour le message de chargement
    alignSelf: 'flex-start',
  },
  userText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
  },
  aiText: {
    color: '#ccd6f6', // Texte de l'IA
    fontSize: 16,
    lineHeight: 24,
  },
  loadingMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingMessageText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontStyle: 'italic',
  },

  // Copy Action Buttons within AI bubble
  copyButtonsContainer: {
    flexDirection: 'row',
    marginTop: 15,
    justifyContent: 'flex-start',
    flexWrap: 'wrap', // Permet le retour à la ligne si trop de boutons
    gap: 10, // Espace entre les boutons
  },
  copyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Fond translucide
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  copyActionEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  copyActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },

  // Input Bar (fixed at the bottom)
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e2139', // Fond de la barre de saisie
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
    paddingBottom: Platform.OS === 'ios' ? 25 : 10, // Ajustement pour iOS safe area
  },
  inputChat: {
    flex: 1,
    backgroundColor: '#2d3748', // Fond de l'input
    borderRadius: 25,
    color: '#ccd6f6',
    fontSize: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10, // Ajustement padding input
    paddingHorizontal: 18,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#3a415a',
  },
  sendButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff6b35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonDisabled: {
    backgroundColor: '#4a4a5a',
    opacity: 0.7,
    shadowOpacity: 0,
  },

  // Placeholder styles (reused but adapted)
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    minHeight: height * 0.6, // S'assurer que le placeholder est visible
  },
  placeholderEmoji: {
    fontSize: 60,
    marginBottom: 20,
    opacity: 0.8,
  },
  placeholderText: {
    color: '#ccd6f6',
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  placeholderSubtext: {
    color: '#8892b0',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  suggestionContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(30, 33, 57, 0.4)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    width: '100%',
  },
  suggestionTitle: {
    fontSize: 16,
    color: '#ff6b35',
    fontWeight: '600',
    marginBottom: 10,
  },
  suggestionText: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
    lineHeight: 22,
  },
  // Error Box (reused)
  errorBox: {
    backgroundColor: 'rgba(245, 101, 101, 0.1)',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 101, 101, 0.3)',
    shadowColor: '#f56565',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginVertical: 10,
  },
  errorEmoji: {
    fontSize: 20,
    marginBottom: 5,
  },
  errorText: {
    color: '#fc8181',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
