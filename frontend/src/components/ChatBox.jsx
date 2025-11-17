import { useState, useRef, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import ChatBubble from './ChatBubble'
import ChatInput from './ChatInput'
import { useChatStore } from '../store/chatStore'
import { sendChatMessage } from '../utils/api'
import { sendOllamaMessage, streamOllamaMessage } from '../utils/ollamaApi'
import { LLM_MODE } from '../utils/apiConfig'
import { generateId } from '../utils/idGenerator'

const ChatBox = () => {
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [typingMessage, setTypingMessage] = useState(null)
  const [features, setFeatures] = useState({
    ocr: true,
    search: true,
    cdr: false,
    ipdr: false,
    bank: false
  })
  const messagesEndRef = useRef(null)
  const chatInputRef = useRef(null)

  const currentChat = useChatStore(state => state.getCurrentChat())
  const currentChatId = useChatStore(state => state.currentChatId)
  const addMessage = useChatStore(state => state.addMessage)
  const createNewChat = useChatStore(state => state.createNewChat)
  const clearCurrentChat = useChatStore(state => state.clearCurrentChat)

  const messages = currentChat?.messages || []

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingMessage])

  // Focus input when a new chat is created (chat has no messages)
  useEffect(() => {
    // Focus when switching to a chat with no messages (newly created)
    if (currentChatId && currentChat && currentChat.messages.length === 0) {
      // Small delay to ensure the component is fully rendered
      const timer = setTimeout(() => {
        chatInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [currentChatId, currentChat])

  // Load features from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('chatgpt-local-features')
      if (stored) {
        setFeatures(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Error loading features:', error)
    }
  }, [])

  // Save features to localStorage
  const handleFeatureChange = (newFeatures) => {
    setFeatures(newFeatures)
    try {
      localStorage.setItem('chatgpt-local-features', JSON.stringify(newFeatures))
    } catch (error) {
      console.error('Error saving features:', error)
    }
  }

  // Function to add spaces between concatenated words
  const addSpacesToText = (text) => {
    let result = text
    
    // First, handle specific common patterns that appear frequently
    // Add space after common contractions and pronouns (case-insensitive)
    const contractions = ["I'm", "it's", "that's", "you're", "we're", "they're", "I've", "you've", "we've", "they've", "I'll", "you'll", "we'll", "they'll", "don't", "won't", "can't", "isn't", "aren't", "wasn't", "weren't"]
    contractions.forEach(contraction => {
      const regex = new RegExp(`(${contraction.replace("'", "\\'")})([a-z])`, 'gi')
      result = result.replace(regex, '$1 $2')
    })
    
    // Handle common word patterns - add space before and after common words
    const commonWords = [
      'happy', 'to', 'help', 'you', 'stands', 'for', 'amazon', 'web', 'services', 'aws',
      'is', 'are', 'was', 'were', 'the', 'for', 'and', 'which', 'that', 'can', 'will', 'would',
      'should', 'could', 'may', 'might', 'this', 'these', 'those', 'with', 'from', 'about',
      'into', 'onto', 'upon', 'over', 'under', 'through', 'during', 'before', 'after', 'while',
      'when', 'where', 'why', 'how', 'what', 'who', 'whom', 'whose', 'cloud', 'computing',
      'platform', 'offers', 'wide', 'range', 'including', 'storage', 'database', 'management',
      'analytics', 'machine', 'learning', 'security', 'used', 'build', 'deploy', 'manage',
      'applications', 'workloads', 'like', 'know', 'more', 'about', 'provided', 'by'
    ]
    
    // Add space around common words when they appear concatenated
    commonWords.forEach(word => {
      // Pattern: lowercase letter + word + lowercase letter (word in middle)
      const regex1 = new RegExp(`([a-z])(${word})([a-z])`, 'gi')
      result = result.replace(regex1, '$1 $2 $3')
      
      // Pattern: word + lowercase letter (word at start)
      const regex2 = new RegExp(`(^|\\s)(${word})([a-z])`, 'gi')
      result = result.replace(regex2, '$1$2 $3')
      
      // Pattern: lowercase letter + word (word at end, before punctuation or end of string)
      const regex3 = new RegExp(`([a-z])(${word})([.!?,;:]|\\s|$)`, 'gi')
      result = result.replace(regex3, '$1 $2$3')
    })
    
    // Handle specific multi-word patterns
    const patterns = [
      ['happy', 'to', 'help'],
      ['stands', 'for'],
      ['amazon', 'web'],
      ['web', 'services'],
      ['cloud', 'computing'],
      ['computing', 'platform'],
      ['wide', 'range'],
      ['database', 'management'],
      ['machine', 'learning'],
      ['would', 'you', 'like'],
      ['to', 'know', 'more'],
      ['more', 'about']
    ]
    
    patterns.forEach(pattern => {
      const joined = pattern.join('')
      const spaced = pattern.join(' ')
      // Replace the concatenated version with spaced version
      result = result.replace(new RegExp(joined, 'gi'), spaced)
    })
    
    // More aggressive: detect word boundaries in lowercase sequences
    // Add space after common word endings followed by common word beginnings
    const wordEndings = ['y', 'ed', 'ing', 'er', 'ly', 'tion', 'sion', 'ment', 'ness', 'ful', 'less']
    const wordBeginnings = ['to', 'the', 'is', 'are', 'was', 'were', 'can', 'will', 'would', 'should', 'could', 'this', 'that', 'which', 'with', 'from', 'for', 'and', 'or', 'but']
    
    wordEndings.forEach(ending => {
      wordBeginnings.forEach(beginning => {
        const regex = new RegExp(`([a-z]+${ending})(${beginning})([a-z])`, 'gi')
        result = result.replace(regex, '$1 $2 $3')
      })
    })
    
    return result
  }

  const handleSend = async (message, uploadedFiles = []) => {
    if ((!message.trim() && uploadedFiles.length === 0) || isTyping) return

    const userMessage = message.trim() || (uploadedFiles.length > 0 ? `Uploaded ${uploadedFiles.length} file(s)` : '')
    
    if (userMessage) {
      // Add user message
      addMessage('user', userMessage)
    }

    // If no current chat, create one
    if (!currentChat) {
      createNewChat()
    }

    // Get or use current chat ID
    // Backend expects format: chat_1, chat_2, etc.
    const chatId = currentChatId || currentChat?.id || `chat_${Date.now()}`

    // Show typing indicator
    setIsTyping(true)
    setTypingMessage({ 
      role: 'assistant', 
      content: 'Thinking...', 
      timestamp: new Date().toISOString() 
    })

    try {
      let chatResponse
      
      // Check LLM mode: 'ollama' uses Ollama directly, 'backend' uses backend API
      if (LLM_MODE === 'ollama') {
        // Use Ollama API directly (no backend needed)
        console.log('Using Ollama mode (models2)')
        
        // Build prompt with context if needed
        const contextMessages = messages.slice(-4).map(m => 
          `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n')
        
        // Create a prompt that encourages direct answers
        const systemInstruction = "You are a helpful assistant. Provide clear, direct answers to questions. Do not ask follow-up questions unless the user explicitly asks for more information."
        
        const fullPrompt = contextMessages 
          ? `${systemInstruction}\n\n${contextMessages}\n\nUser: ${userMessage}\nAssistant:`
          : `${systemInstruction}\n\nUser: ${userMessage}\nAssistant:`
        
        // Use streaming for better UX
        let fullReply = ''
        await streamOllamaMessage(
          fullPrompt,
          (chunk) => {
            fullReply += chunk
            // Clean the reply in real-time for display (basic cleaning)
            let displayReply = fullReply
            // Remove usage tokens if they appear
            displayReply = displayReply.replace(/\{.*input_tokens.*output_tokens.*\}/g, '')
            // Add spaces between concatenated words
            displayReply = addSpacesToText(displayReply)
            // Basic spacing fixes
            displayReply = displayReply.replace(/([.!?])([A-Za-z])/g, '$1 $2')
            displayReply = displayReply.replace(/([a-z])([A-Z])/g, '$1 $2')
            displayReply = displayReply.replace(/([.,!?;:])([A-Za-z])/g, '$1 $2')
            // Normalize multiple spaces
            displayReply = displayReply.replace(/\s+/g, ' ')
            // Update typing message with streaming content
            setTypingMessage({
              role: 'assistant',
              content: displayReply,
              timestamp: new Date().toISOString()
            })
          },
          {
            temperature: 0.7,
            max_tokens: 512
          }
        )
        
        // Final update - clean and format the reply
        setTypingMessage(null)
        // Clean up the reply: remove any trailing usage data, ensure proper formatting
        let cleanedReply = fullReply.trim()
        // Remove any usage tokens that might have been included (various formats)
        cleanedReply = cleanedReply.replace(/\{'input_tokens':\s*\d+,\s*'output_tokens':\s*\d+\}/g, '')
        cleanedReply = cleanedReply.replace(/\{"input_tokens":\s*\d+,\s*"output_tokens":\s*\d+\}/g, '')
        cleanedReply = cleanedReply.replace(/\{input_tokens:\s*\d+,\s*output_tokens:\s*\d+\}/g, '')
        cleanedReply = cleanedReply.replace(/\{.*input_tokens.*output_tokens.*\}/g, '')
        
        // Add spaces between concatenated words (do this first)
        cleanedReply = addSpacesToText(cleanedReply)
        
        // Fix spacing issues: add space after punctuation if missing
        cleanedReply = cleanedReply.replace(/([.!?])([A-Za-z])/g, '$1 $2')
        // Fix spacing: add space before capital letters after lowercase (e.g., "Hello!It's" -> "Hello! It's")
        cleanedReply = cleanedReply.replace(/([a-z])([A-Z])/g, '$1 $2')
        // Fix spacing: add space after punctuation before lowercase (e.g., "Hello!how" -> "Hello! how")
        cleanedReply = cleanedReply.replace(/([.!?])([a-z])/g, '$1 $2')
        // Add space after punctuation marks
        cleanedReply = cleanedReply.replace(/([.,!?;:])([A-Za-z])/g, '$1 $2')
        // Normalize multiple spaces to single space
        cleanedReply = cleanedReply.replace(/\s+/g, ' ')
        cleanedReply = cleanedReply.trim()
        
        addMessage('assistant', cleanedReply)
        chatResponse = { reply: cleanedReply }
      } else {
        // Use backend API (original behavior)
        console.log('Using Backend mode')
        chatResponse = await sendChatMessage(
          chatId,
          userMessage,
          features.search, // use_retrieval
          3 // top_k
        )

        // Update typing message
        setTypingMessage(null)
        
        // Add assistant response
        addMessage('assistant', chatResponse.reply)
        
        // Log used documents if any
        if (chatResponse.used_docs && chatResponse.used_docs.length > 0) {
          console.log('Used documents:', chatResponse.used_docs)
        }
      }
    } catch (error) {
      console.error('Chat failed:', error)
      setTypingMessage(null)
      
      // Show error message to user
      const errorMsg = LLM_MODE === 'ollama'
        ? `Sorry, I encountered an error: ${error.message}. Please ensure Ollama is running (ollama pull deepseek-chat:7b).`
        : `Sorry, I encountered an error: ${error.message}. Please ensure the LLM service is running.`
      
      addMessage('assistant', errorMsg)
    } finally {
      setIsTyping(false)
      setTypingMessage(null)
      setInput('')
    }
  }

  const handleUpload = async (file, response) => {
    // Mock upload handler
    console.log('File uploaded:', file.name, response)
    // In real app, this would call the backend API
    return response
  }

  const handleRunOCR = async (documentId) => {
    // Mock OCR handler
    console.log('Running OCR for document:', documentId)
    // In real app, this would call the OCR API
  }

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear this chat?')) {
      clearCurrentChat()
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Messages Area */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6"
        style={{
          overflowX: 'hidden',
          wordWrap: 'break-word'
        }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p className="text-lg mb-2 font-medium">Start a conversation</p>
              <p className="text-sm">Type a message below to begin chatting</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map(message => (
              <ChatBubble key={message.id} message={message} />
            ))}
            {typingMessage && (
              <ChatBubble message={typingMessage} isTyping={true} />
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area with ChatInput */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {messages.length > 0 && (
          <div className="px-4 pt-3 pb-1 flex justify-end">
            <button
              onClick={handleClear}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Clear chat
            </button>
          </div>
        )}
        <ChatInput
          ref={chatInputRef}
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          onUpload={handleUpload}
          onRunOCR={handleRunOCR}
          features={features}
          onFeatureChange={handleFeatureChange}
          disabled={isTyping}
        />
      </div>
    </div>
  )
}

export default ChatBox
