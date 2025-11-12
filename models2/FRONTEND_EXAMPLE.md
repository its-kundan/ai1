# Frontend Integration Examples

## Option 1: Direct Ollama API (Simplest - No Service Needed)

Your frontend can call Ollama directly without any service:

```javascript
// Direct Ollama API call
async function chatWithOllama(prompt) {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat:7b',
      prompt: prompt,
      stream: false
    })
  });
  
  const data = await response.json();
  return data.response;
}

// Usage
const reply = await chatWithOllama("What is AI?");
console.log(reply);
```

### Streaming Response

```javascript
async function* streamChat(prompt) {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat:7b',
      prompt: prompt,
      stream: true
    })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const json = JSON.parse(line);
        if (json.response) {
          yield json.response;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }
}

// Usage
for await (const chunk of streamChat("Tell me a story")) {
  console.log(chunk); // Print each chunk as it arrives
}
```

## Option 2: Using the Service (Compatible API)

If you want to use the service for compatibility with existing code:

```javascript
// Using the service
async function chatWithService(prompt) {
  const response = await fetch('http://localhost:5006/infer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: prompt,
      max_tokens: 200,
      temperature: 0.7,
      stream: false
    })
  });
  
  const data = await response.json();
  return data.reply;
}
```

## React Example Component

```jsx
import { useState } from 'react';

function ChatComponent() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-chat:7b',
          prompt: message,
          stream: false
        })
      });
      
      const data = await res.json();
      setResponse(data.response);
    } catch (error) {
      console.error('Error:', error);
      setResponse('Error: Could not connect to Ollama. Make sure it is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message..."
      />
      <button onClick={sendMessage} disabled={loading}>
        {loading ? 'Sending...' : 'Send'}
      </button>
      {response && <div>{response}</div>}
    </div>
  );
}
```

## React Streaming Example

```jsx
import { useState } from 'react';

function StreamingChat() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    setLoading(true);
    setResponse('');
    
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-chat:7b',
          prompt: message,
          stream: true
        })
      });
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.response) {
              fullResponse += json.response;
              setResponse(fullResponse);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setResponse('Error: Could not connect to Ollama.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message..."
      />
      <button onClick={sendMessage} disabled={loading}>
        {loading ? 'Sending...' : 'Send'}
      </button>
      {response && <div style={{ whiteSpace: 'pre-wrap' }}>{response}</div>}
    </div>
  );
}
```

## CORS Configuration

If calling Ollama directly from a browser, you may need to configure CORS. Ollama allows all origins by default, but if you have issues:

1. **Option A**: Use the service (port 5006) which has CORS enabled
2. **Option B**: Configure Ollama CORS (if needed)

## Error Handling

```javascript
async function safeChat(prompt) {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat:7b',
        prompt: prompt,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      return 'Error: Cannot connect to Ollama. Make sure Ollama is running on localhost:11434';
    }
    throw error;
  }
}
```

## Environment Variables

For production, use environment variables:

```javascript
const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'deepseek-chat:7b';

// In .env file:
// VITE_OLLAMA_URL=http://localhost:11434
// VITE_OLLAMA_MODEL=deepseek-chat:7b
```

