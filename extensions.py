import time
import threading


class SimpleCache:
    def __init__(self, ttl=60):
        self.ttl = ttl
        self.data = {}
        self.lock = threading.Lock()

    def get(self, key):
        with self.lock:
            if key in self.data:
                val, expires = self.data[key]
                if time.time() < expires:
                    return val
                else:
                    del self.data[key]
            return None

    def set(self, key, value):
        with self.lock:
            self.data[key] = (value, time.time() + self.ttl)

    def clear(self):
        with self.lock:
            self.data.clear()

dashboard_cache = SimpleCache(ttl=60)
ai_cache = SimpleCache(ttl=300)


