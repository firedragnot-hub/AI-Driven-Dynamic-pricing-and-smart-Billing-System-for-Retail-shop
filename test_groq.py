import os
import urllib.request
import json
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv('GROQ_API_KEY')
payload = {'model': 'llama-3.3-70b-versatile', 'messages': [{'role': 'user', 'content': 'test'}]}
req = urllib.request.Request('https://api.groq.com/openai/v1/chat/completions', data=json.dumps(payload).encode('utf-8'), headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}, method='POST')
try:
    urllib.request.urlopen(req)
    print("Success!")
except Exception as e:
    print(e)
    try:
        print(e.read().decode('utf-8'))
    except:
        pass
