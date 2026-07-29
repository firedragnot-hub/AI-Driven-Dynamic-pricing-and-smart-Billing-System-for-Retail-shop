import os
import urllib.request
import json

api_key = os.getenv("GROQ_API_KEY", "")
url = "https://api.groq.com/openai/v1/chat/completions"

print("Testing Llama-3.3-70b-versatile with User-Agent...")
body = {
    "model": "llama-3.3-70b-versatile",
    "messages": [{"role": "user", "content": "Hello"}],
}
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

try:
    req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'), headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=10) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        print("Success!", res_data['choices'][0]['message']['content'])
except Exception as e:
    print("Error with llama-3.3-70b-versatile:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())

print("\nTesting llama3-8b-8192 with User-Agent...")
body_8b = {
    "model": "llama3-8b-8192",
    "messages": [{"role": "user", "content": "Hello"}],
}
try:
    req = urllib.request.Request(url, data=json.dumps(body_8b).encode('utf-8'), headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=10) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        print("Success!", res_data['choices'][0]['message']['content'])
except Exception as e:
    print("Error with llama3-8b-8192:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
