// Mock API utilities for simulating bot responses

import mockResponses from '../data/mockResponses.json'

// Simulate typing delay
const TYPING_DELAY = 1000 // 1 second
const MIN_TYPING_TIME = 500
const MAX_TYPING_TIME = 2000

export const generateMockResponse = async (userMessage) => {
  // Simulate thinking time
  const thinkingTime = Math.random() * (MAX_TYPING_TIME - MIN_TYPING_TIME) + MIN_TYPING_TIME
  await new Promise(resolve => setTimeout(resolve, thinkingTime))

  // Get a random response
  const responses = mockResponses.responses
  const randomResponse = responses[Math.floor(Math.random() * responses.length)]

  // Simulate typing effect
  const words = randomResponse.split(' ')
  let typedText = ''
  
  for (const word of words) {
    await new Promise(resolve => setTimeout(resolve, TYPING_DELAY / words.length))
    typedText += (typedText ? ' ' : '') + word
  }

  return typedText
}

export const simulateTyping = async (callback) => {
  const thinkingPhrases = mockResponses.thinking
  const randomPhrase = thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)]
  
  callback(randomPhrase)
  await new Promise(resolve => setTimeout(resolve, 1500))
  callback(null)
}

