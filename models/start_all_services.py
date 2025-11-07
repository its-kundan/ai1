"""
Start all model services (LLM, Embedding, OCR) in separate processes.

Usage:
    python start_all_services.py

Or start individually:
    python services/llm_service.py
    python services/embedding_service.py
    python services/ocr_service.py
"""
import os
import sys
import subprocess
import signal
import time
from pathlib import Path

# Get the directory of this script
BASE_DIR = Path(__file__).parent
SERVICES_DIR = BASE_DIR / "services"

# Service configurations
SERVICES = [
    {
        "name": "LLM Service",
        "script": "llm_service.py",
        "port": 5005,
        "env": {"LLM_PORT": "5005"}
    },
    {
        "name": "Embedding Service",
        "script": "embedding_service.py",
        "port": 8100,
        "env": {"EMBED_PORT": "8100"}
    },
    {
        "name": "OCR Service",
        "script": "ocr_service.py",
        "port": 8200,
        "env": {"OCR_PORT": "8200"}
    }
]

processes = []


def signal_handler(sig, frame):
    """Handle Ctrl+C to gracefully shutdown all services."""
    print("\n\nShutting down all services...")
    for proc in processes:
        if proc.poll() is None:  # Process still running
            proc.terminate()
    
    # Wait for processes to terminate
    time.sleep(2)
    
    # Force kill if still running
    for proc in processes:
        if proc.poll() is None:
            proc.kill()
    
    print("All services stopped.")
    sys.exit(0)


def start_service(service_config):
    """Start a single service."""
    script_path = SERVICES_DIR / service_config["script"]
    
    if not script_path.exists():
        print(f"Error: Service script not found: {script_path}")
        return None
    
    # Prepare environment
    env = os.environ.copy()
    env.update(service_config.get("env", {}))
    
    # Start process
    print(f"Starting {service_config['name']} on port {service_config['port']}...")
    proc = subprocess.Popen(
        [sys.executable, str(script_path)],
        cwd=BASE_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    return proc


def main():
    """Main entry point."""
    print("=" * 60)
    print("Starting Model Services")
    print("=" * 60)
    print()
    
    # Register signal handler
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start all services
    for service_config in SERVICES:
        proc = start_service(service_config)
        if proc:
            processes.append(proc)
            time.sleep(1)  # Small delay between starts
    
    print()
    print("=" * 60)
    print("All services started!")
    print("=" * 60)
    print("\nServices running:")
    for i, service_config in enumerate(SERVICES):
        status = "✓" if processes[i] and processes[i].poll() is None else "✗"
        print(f"  {status} {service_config['name']} - http://localhost:{service_config['port']}")
    print("\nPress Ctrl+C to stop all services\n")
    
    # Monitor processes
    try:
        while True:
            time.sleep(1)
            # Check if any process died
            for i, proc in enumerate(processes):
                if proc.poll() is not None:
                    print(f"\nWarning: {SERVICES[i]['name']} has stopped (exit code: {proc.returncode})")
                    # Optionally restart
                    # proc = start_service(SERVICES[i])
                    # processes[i] = proc
    except KeyboardInterrupt:
        signal_handler(None, None)


if __name__ == "__main__":
    main()

