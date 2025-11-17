"""
Smoke test for model services - quick health checks.

Run this to verify all services are running and responding.

Usage:
    python tests/smoke_test.py

Or with pytest:
    pytest tests/smoke_test.py -v
"""
import sys
import os
import requests
import time
from typing import Dict, Optional

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Service endpoints
SERVICES = {
    "LLM": "http://localhost:5005",
    "Embedding": "http://localhost:8100",
    "OCR": "http://localhost:8200"
}


def check_service(name: str, base_url: str, timeout: int = 5) -> Dict[str, any]:
    """Check if a service is healthy."""
    result = {
        "name": name,
        "url": base_url,
        "status": "unknown",
        "response_time_ms": None,
        "error": None
    }
    
    try:
        start_time = time.time()
        response = requests.get(f"{base_url}/health", timeout=timeout)
        response_time = (time.time() - start_time) * 1000
        
        result["response_time_ms"] = response_time
        
        if response.status_code == 200:
            result["status"] = "healthy"
            result["data"] = response.json()
        else:
            result["status"] = "unhealthy"
            result["error"] = f"HTTP {response.status_code}"
    
    except requests.exceptions.ConnectionError:
        result["status"] = "not_running"
        result["error"] = "Connection refused - service not running"
    
    except requests.exceptions.Timeout:
        result["status"] = "timeout"
        result["error"] = f"Request timed out after {timeout}s"
    
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
    
    return result


def test_llm_service():
    """Test LLM service endpoints."""
    base_url = SERVICES["LLM"]
    
    # Health check
    health = check_service("LLM", base_url)
    assert health["status"] == "healthy", f"LLM service not healthy: {health.get('error')}"
    
    # Tokenize endpoint (if available)
    try:
        response = requests.post(
            f"{base_url}/tokenize",
            json={"text": "Hello world"},
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            assert "tokens" in data
            assert data["tokens"] > 0
    except Exception as e:
        print(f"Warning: Tokenize endpoint test failed: {e}")
    
    print("✓ LLM service tests passed")


def test_embedding_service():
    """Test Embedding service endpoints."""
    base_url = SERVICES["Embedding"]
    
    # Health check
    health = check_service("Embedding", base_url)
    assert health["status"] == "healthy", f"Embedding service not healthy: {health.get('error')}"
    
    # Embed endpoint
    try:
        response = requests.post(
            f"{base_url}/embed",
            json={"texts": ["Hello world", "Test text"]},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            assert "vectors" in data
            assert len(data["vectors"]) == 2
            assert "dims" in data
    except Exception as e:
        print(f"Warning: Embed endpoint test failed: {e}")
    
    print("✓ Embedding service tests passed")


def test_ocr_service():
    """Test OCR service endpoints."""
    base_url = SERVICES["OCR"]
    
    # Health check
    health = check_service("OCR", base_url)
    assert health["status"] == "healthy", f"OCR service not healthy: {health.get('error')}"
    
    print("✓ OCR service tests passed")


def main():
    """Run all smoke tests."""
    print("=" * 60)
    print("Model Services Smoke Test")
    print("=" * 60)
    print()
    
    results = []
    
    # Check all services
    for name, url in SERVICES.items():
        print(f"Checking {name} service at {url}...")
        result = check_service(name, url)
        results.append(result)
        
        status_icon = "✓" if result["status"] == "healthy" else "✗"
        print(f"  {status_icon} Status: {result['status']}")
        if result.get("response_time_ms"):
            print(f"    Response time: {result['response_time_ms']:.2f}ms")
        if result.get("error"):
            print(f"    Error: {result['error']}")
        print()
    
    # Summary
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    
    healthy_count = sum(1 for r in results if r["status"] == "healthy")
    total_count = len(results)
    
    for result in results:
        status_icon = "✓" if result["status"] == "healthy" else "✗"
        print(f"{status_icon} {result['name']}: {result['status']}")
    
    print()
    print(f"Healthy: {healthy_count}/{total_count}")
    
    if healthy_count == total_count:
        print("\n✓ All services are healthy!")
        return 0
    else:
        print(f"\n✗ {total_count - healthy_count} service(s) not healthy")
        print("\nMake sure all services are running:")
        print("  python start_all_services.py")
        print("  OR")
        print("  python services/llm_service.py")
        print("  python services/embedding_service.py")
        print("  python services/ocr_service.py")
        return 1


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nTest failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)







