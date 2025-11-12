"""
Pytest configuration and fixtures.
"""
import pytest
from pathlib import Path
import sys

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))





