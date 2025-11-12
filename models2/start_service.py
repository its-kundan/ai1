#!/usr/bin/env python3
"""
Start the Ollama service.
"""
import subprocess
import sys
import os

if __name__ == "__main__":
    # Change to models2 directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Start the service
    subprocess.run([
        sys.executable, "-m", "services.ollama_service"
    ])

