"""
Prompt templates for RAG (Retrieval-Augmented Generation) and chat.
Includes system instructions, context formatting, and chat history management.
"""
from typing import List, Dict, Optional
# Import PII masking utilities
try:
    from .pii_masking import mask_pii
except ImportError:
    try:
        from models.utils.pii_masking import mask_pii
    except ImportError:
        # Fallback: define a simple mask function
        def mask_pii(text: str) -> str:
            return text


class PromptTemplate:
    """Template builder for RAG prompts."""
    
    def __init__(self, 
                 system_instruction: Optional[str] = None,
                 max_context_tokens: int = 200,
                 max_history_tokens: int = 1000,
                 mask_pii_in_context: bool = True):
        """
        Initialize prompt template.
        
        Args:
            system_instruction: System instruction text
            max_context_tokens: Max tokens per retrieved snippet
            max_history_tokens: Max tokens for chat history
            mask_pii_in_context: Whether to mask PII in retrieved contexts
        """
        self.system_instruction = system_instruction or self._default_system_instruction()
        self.max_context_tokens = max_context_tokens
        self.max_history_tokens = max_history_tokens
        self.mask_pii_in_context = mask_pii_in_context
    
    def _default_system_instruction(self) -> str:
        """Default system instruction for financial/telecom document Q&A."""
        return """You are a helpful AI assistant that answers questions about user documents.

When answering:
1. Always cite source documents using [doc: <document_id>] format
2. For financial data, mask account numbers except last 4 digits (e.g., ****1234)
3. Be precise and factual - only use information from provided context
4. If information is not in the context, say so clearly
5. Format numbers clearly (e.g., ₹10,234.50 for currency)
6. For dates, use clear format (e.g., September 1, 2025)

Do not:
- Make up information not in the documents
- Share full account numbers or sensitive PII
- Provide financial advice beyond factual reporting"""
    
    def build_rag_prompt(self,
                        user_query: str,
                        retrieved_contexts: List[Dict[str, str]],
                        chat_history: Optional[List[Dict[str, str]]] = None,
                        tokenizer=None) -> str:
        """
        Build RAG prompt with system instruction, context, history, and query.
        
        Args:
            user_query: User's question
            retrieved_contexts: List of dicts with 'text', 'doc_id', 'page' (optional)
            chat_history: List of dicts with 'role' ('user'/'assistant') and 'content'
            tokenizer: Tokenizer instance for truncation (optional)
            
        Returns:
            Complete prompt string
        """
        parts = []
        
        # System instruction
        parts.append(f"SYSTEM: {self.system_instruction}\n")
        
        # Retrieved contexts
        if retrieved_contexts:
            parts.append("CONTEXT (from documents):\n")
            for i, ctx in enumerate(retrieved_contexts[:10], 1):  # Limit to top 10
                text = ctx.get('text', '')
                doc_id = ctx.get('doc_id', 'unknown')
                page = ctx.get('page', '')
                
                # Mask PII if enabled
                if self.mask_pii_in_context:
                    text = mask_pii(text)
                
                # Truncate if tokenizer provided
                if tokenizer:
                    text = tokenizer.truncate_to_tokens(text, self.max_context_tokens)
                
                page_str = f" (page {page})" if page else ""
                parts.append(f"[doc: {doc_id}{page_str}] {text}\n")
            parts.append("\n")
        
        # Chat history (sliding window)
        if chat_history:
            parts.append("CONVERSATION HISTORY:\n")
            history_text = self._format_history(chat_history)
            
            # Truncate history if needed
            if tokenizer:
                history_tokens = tokenizer.count_tokens(history_text)
                if history_tokens > self.max_history_tokens:
                    # Keep most recent messages
                    history_text = self._truncate_history(chat_history, tokenizer, self.max_history_tokens)
            
            parts.append(history_text)
            parts.append("\n")
        
        # User query
        parts.append(f"USER: {user_query}\n")
        parts.append("ASSISTANT:")
        
        return "".join(parts)
    
    def _format_history(self, chat_history: List[Dict[str, str]]) -> str:
        """Format chat history into text."""
        lines = []
        for msg in chat_history:
            role = msg.get('role', 'user').upper()
            content = msg.get('content', '')
            lines.append(f"{role}: {content}\n")
        return "".join(lines)
    
    def _truncate_history(self, 
                         chat_history: List[Dict[str, str]], 
                         tokenizer,
                         max_tokens: int) -> str:
        """Truncate chat history to fit token limit, keeping most recent."""
        # Start from most recent and work backwards
        result = []
        current_tokens = 0
        
        for msg in reversed(chat_history):
            role = msg.get('role', 'user').upper()
            content = msg.get('content', '')
            msg_text = f"{role}: {content}\n"
            msg_tokens = tokenizer.count_tokens(msg_text)
            
            if current_tokens + msg_tokens > max_tokens:
                break
            
            result.insert(0, msg_text)
            current_tokens += msg_tokens
        
        return "".join(result)
    
    def build_simple_prompt(self, user_query: str, system_instruction: Optional[str] = None) -> str:
        """
        Build simple prompt without RAG context.
        
        Args:
            user_query: User's question
            system_instruction: Optional custom system instruction
            
        Returns:
            Simple prompt string
        """
        instruction = system_instruction or self.system_instruction
        return f"SYSTEM: {instruction}\n\nUSER: {user_query}\n\nASSISTANT:"


def load_system_template(template_name: str) -> str:
    """
    Load system instruction template from prompts directory.
    
    Args:
        template_name: Name of template file (e.g., 'finance', 'telecom')
        
    Returns:
        Template content
    """
    import os
    template_path = os.path.join(
        os.path.dirname(__file__),
        '..',
        'prompts',
        'system_templates',
        f'{template_name}.txt'
    )
    
    if os.path.exists(template_path):
        with open(template_path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    else:
        # Return default if template not found
        return PromptTemplate()._default_system_instruction()

