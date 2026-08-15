import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("1. Importing random, io, urllib.request, json...")
import random
import io
import urllib.request
import json

print("2. Importing Flask, CORS...")
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

print("3. Importing models...")
import models

print("4. Importing socketio...")
from flask_socketio import SocketIO, emit

print("5. Importing routes.auth...")
from routes.auth import auth_bp, get_current_user, limiter

print("6. Importing threading, time...")
import threading
import time

print("7. Done with basic imports!")
