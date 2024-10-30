import requests
import threading
import time

# Configuration
url = "http://localhost:8888/"  # Target URL
num_threads = 100                    # Number of concurrent threads
requests_per_thread = 1000          # Number of requests per thread

def send_requests():
    for _ in range(requests_per_thread):
        try:
            response = requests.get(url)
            print(f"Status Code: {response.status_code}")
        except requests.RequestException as e:
            print(f"Request failed: {e}")

def start_stress_test():
    threads = []
    start_time = time.time()

    for _ in range(num_threads):
        thread = threading.Thread(target=send_requests)
        thread.start()
        threads.append(thread)

    for thread in threads:
        thread.join()

    end_time = time.time()
    print(f"Stress test completed in {end_time - start_time:.2f} seconds")

if __name__ == "__main__":
    start_stress_test()
