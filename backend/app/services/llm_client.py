"""
LLM client for calling local LLM runtime.
Supports HTTP endpoints (text-generation-webui) and subprocess (llama.cpp).
"""
import requests
import subprocess
import json
from typing import Optional, Dict, Any
from app.utils.logging import get_logger

logger = get_logger("llm_client")


class LLMClient:
    """Client for local LLM inference."""
    
    def __init__(
        self,
        mode: str = "local_http",
        endpoint: str = "http://localhost:5005/infer",
        timeout: int = 30
    ):
        """
        Initialize LLM client.
        
        Args:
            mode: "local_http" or "subprocess"
            endpoint: HTTP endpoint URL (for local_http mode)
            timeout: Request timeout in seconds
        
        NOTE: For local_http mode, ensure your LLM server is running.
              For text-generation-webui, start with API enabled.
              For subprocess mode, provide path to llama.cpp binary.
        """
        self.mode = mode
        self.endpoint = endpoint
        self.timeout = timeout
        self.available = False
        self._check_availability()
    
    def _check_availability(self):
        """Check if LLM service is available."""
        if self.mode == "local_http":
            try:
                # Try a simple health check or ping
                response = requests.get(self.endpoint.replace("/infer", "/health"), timeout=2)
                if response.status_code == 200:
                    self.available = True
                    logger.info(f"LLM service available at {self.endpoint}")
                else:
                    logger.warning(f"LLM service returned status {response.status_code}")
            except requests.exceptions.RequestException:
                logger.warning(f"LLM service not available at {self.endpoint}")
                logger.warning("Start your LLM server (e.g., text-generation-webui) before using chat endpoint")
        else:
            # For subprocess mode, check if binary exists
            logger.info("Subprocess mode: ensure llama.cpp binary is available")
            self.available = True  # Assume available, will fail on actual call if not
    
    def generate(
        self,
        prompt: str,
        max_tokens: int = 512,
        temperature: float = 0.7,
        stop_sequences: Optional[list[str]] = None
    ) -> str:
        """
        Generate text from prompt.
        
        Args:
            prompt: Input prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            stop_sequences: Optional stop sequences
            
        Returns:
            Generated text
            
        Raises:
            RuntimeError: If LLM service is not available
        """
        if not self.available and self.mode == "local_http":
            # Try once more
            self._check_availability()
        
        if self.mode == "local_http":
            return self._generate_http(prompt, max_tokens, temperature, stop_sequences)
        elif self.mode == "subprocess":
            return self._generate_subprocess(prompt, max_tokens, temperature, stop_sequences)
        else:
            raise ValueError(f"Unknown LLM mode: {self.mode}")
    
    def _generate_http(
        self,
        prompt: str,
        max_tokens: int,
        temperature: float,
        stop_sequences: Optional[list[str]]
    ) -> str:
        """Generate using HTTP endpoint."""
        try:
            # Format for text-generation-webui API
            payload = {
                "prompt": prompt,
                "max_new_tokens": max_tokens,
                "temperature": temperature,
                "stop": stop_sequences or []
            }
            
            response = requests.post(
                self.endpoint,
                json=payload,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            result = response.json()
            # Extract generated text (format may vary by API)
            if isinstance(result, dict):
                return result.get("text", result.get("response", str(result)))
            else:
                return str(result)
                
        except requests.exceptions.Timeout:
            logger.error(f"LLM request timed out after {self.timeout}s")
            raise RuntimeError("LLM service timeout")
        except requests.exceptions.RequestException as e:
            logger.error(f"LLM request failed: {e}")
            raise RuntimeError(f"LLM service error: {e}")
    
    def _generate_subprocess(
        self,
        prompt: str,
        max_tokens: int,
        temperature: float,
        stop_sequences: Optional[list[str]]
    ) -> str:
        """
        Generate using llama.cpp subprocess.
        
        NOTE: This requires llama.cpp binary and model file.
        Example setup:
        1. Download llama.cpp: https://github.com/ggerganov/llama.cpp
        2. Build: make
        3. Download model: place .gguf file in models/
        4. Configure path in this method
        """
        # Example subprocess call (adjust paths as needed)
        llama_path = "models/llama.cpp/main"  # Adjust to your path
        model_path = "models/llama-2-7b-chat.gguf"  # Adjust to your model
        
        try:
            cmd = [
                llama_path,
                "-m", model_path,
                "-p", prompt,
                "-n", str(max_tokens),
                "-t", "4",  # threads
                "--temp", str(temperature)
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout
            )
            
            if result.returncode != 0:
                raise RuntimeError(f"llama.cpp failed: {result.stderr}")
            
            return result.stdout.strip()
            
        except FileNotFoundError:
            logger.error(f"llama.cpp binary not found at {llama_path}")
            raise RuntimeError("llama.cpp not available")
        except subprocess.TimeoutExpired:
            logger.error(f"llama.cpp timed out after {self.timeout}s")
            raise RuntimeError("LLM timeout")
        except Exception as e:
            logger.error(f"llama.cpp error: {e}")
            raise RuntimeError(f"LLM error: {e}")
    
    def generate_chat_response(
        self,
        system_prompt: str,
        messages: list[Dict[str, str]],
        retrieved_context: Optional[str] = None
    ) -> str:
        """
        Generate chat response with context.
        
        Args:
            system_prompt: System instructions
            messages: List of {role: "user"|"assistant", content: "..."}
            retrieved_context: Optional RAG context to include
            
        Returns:
            Assistant response
        """
        # Build prompt
        prompt_parts = [system_prompt]
        
        if retrieved_context:
            prompt_parts.append("\n\n=== Relevant Context ===\n")
            prompt_parts.append(retrieved_context)
            prompt_parts.append("\n=== End Context ===\n")
        
        prompt_parts.append("\n\n=== Conversation ===\n")
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", msg.get("text", ""))
            if role == "user":
                prompt_parts.append(f"User: {content}\n")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}\n")
        
        prompt_parts.append("Assistant:")
        
        full_prompt = "".join(prompt_parts)
        
        # Generate
        response = self.generate(
            prompt=full_prompt,
            max_tokens=512,
            temperature=0.7
        )
        
        return response.strip()


