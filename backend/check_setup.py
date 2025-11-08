#!/usr/bin/env python
"""
Quick setup verification script.
Checks if all required dependencies and directories are in place.
"""
import sys
from pathlib import Path

def check_python_version():
    """Check Python version."""
    if sys.version_info < (3, 10):
        print("❌ Python 3.10+ required. Current:", sys.version)
        return False
    print(f"✅ Python version: {sys.version.split()[0]}")
    return True

def check_dependencies():
    """Check if required packages are installed."""
    required = [
        "fastapi",
        "uvicorn",
        "sqlmodel",
        "sentence_transformers",
        "faiss",
        "easyocr",
        "pytesseract",
        "Pillow"
    ]
    
    missing = []
    for package in required:
        try:
            if package == "sentence_transformers":
                __import__("sentence_transformers")
            elif package == "faiss":
                __import__("faiss")
            else:
                __import__(package)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package} not installed")
            missing.append(package)
    
    return len(missing) == 0

def check_directories():
    """Check if data directories exist."""
    base_dir = Path(__file__).parent
    required_dirs = [
        base_dir / "data" / "uploads",
        base_dir / "data" / "ocr_results",
        base_dir / "data" / "faiss_index",
        base_dir / "data" / "logs"
    ]
    
    all_exist = True
    for dir_path in required_dirs:
        if dir_path.exists():
            print(f"✅ {dir_path}")
        else:
            print(f"⚠️  {dir_path} (will be created on first run)")
            dir_path.mkdir(parents=True, exist_ok=True)
    
    return all_exist

def check_database():
    """Check if database can be initialized."""
    try:
        from app.db.init_db import init_db
        init_db()
        print("✅ Database initialized")
        return True
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        return False

def main():
    """Run all checks."""
    print("=" * 50)
    print("Backend Setup Verification")
    print("=" * 50)
    print()
    
    checks = [
        ("Python Version", check_python_version),
        ("Dependencies", check_dependencies),
        ("Directories", check_directories),
        ("Database", check_database)
    ]
    
    results = []
    for name, check_func in checks:
        print(f"\n{name}:")
        print("-" * 30)
        result = check_func()
        results.append((name, result))
        print()
    
    print("=" * 50)
    print("Summary:")
    print("=" * 50)
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{name}: {status}")
    
    all_passed = all(result for _, result in results)
    if all_passed:
        print("\n🎉 All checks passed! You're ready to run the server.")
        print("   Run: python run.py or uvicorn app.main:app --reload")
    else:
        print("\n⚠️  Some checks failed. Please install missing dependencies.")
        print("   Run: pip install -r requirements.txt")

if __name__ == "__main__":
    main()


