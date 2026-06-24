#!/usr/bin/env python3
"""
P2P Energy Trading Marketplace - Hardware Control Client
Acts as a switch controller from your laptop, publishing commands to control the ESP32
and monitoring incoming telemetry from the ESP32 smart meter.
"""

import sys
import json
import time
import threading
import paho.mqtt.client as mqtt

# Configuration
MQTT_HOST = "localhost"  # Runs on laptop; connects to docker-exposed MQTT broker
MQTT_PORT = 1883
TOPIC_CONTROL = "p2p/edge/control"
TOPIC_TELEMETRY = "p2p/edge/telemetry"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"\n[Connected] Connected to MQTT broker at {MQTT_HOST}:{MQTT_PORT}")
        # Subscribe to telemetry to print device logs
        client.subscribe(TOPIC_TELEMETRY)
        print(f"[Subscribed] Listening for telemetry on: {TOPIC_TELEMETRY}\n")
    else:
        print(f"[Error] Failed to connect, return code {rc}")

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
        data = json.loads(payload)
        
        # Format and display telemetry received from the ESP32
        if "id" in data:
            print("\n" + "="*45)
            print(f"📡 TELEMETRY RECEIVED FROM: {data.get('id')} ({data.get('name', 'ESP32')})")
            print(f"📍 Location : {data.get('area', 'Unknown')} ({data.get('lat')}, {data.get('lng')})")
            
            # Highlight load status
            status = data.get('load_status', 'UNKNOWN').upper()
            status_color = "\033[92mON\033[0m" if status == "ON" else "\033[91mOFF\033[0m"
            print(f"🔌 Load Status: {status_color}")
            
            print(f"⚡ Voltage    : {data.get('voltage', 0.0)} V")
            print(f"🔌 Current    : {data.get('current', 0.0)} A")
            print(f"📈 Power      : {data.get('power', 0.0)} W")
            print(f"🔋 Cumulative : {data.get('energy', 0.0):.6f} kWh")
            print("="*45)
            print("Enter command (1: ON, 2: OFF, q: QUIT): ", end="", flush=True)
    except Exception as e:
        print(f"\n[Parser Error] Failed to parse message: {e}")

def publish_command(client, status):
    payload = json.dumps({"status": status.lower()})
    client.publish(TOPIC_CONTROL, payload)
    print(f"\n[Command Sent] Published status '{status.upper()}' to {TOPIC_CONTROL}")

def main():
    print("==================================================")
    print("    P2P Energy Marketplace - Switch Control      ")
    print("==================================================")
    
    # Initialize MQTT client
    # Using older client initialization for maximum compatibility with paho-mqtt versions < 2.0 and >= 2.0
    client = mqtt.Client(client_id="switch_control_cli")
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
    except Exception as e:
        print(f"[Connection Error] Could not connect to MQTT broker at {MQTT_HOST}:{MQTT_PORT}.")
        print("Please make sure docker compose is running (specifically the 'mqtt' service).")
        print(f"Detail: {e}")
        sys.exit(1)
        
    # Start MQTT network loop in a background thread to handle message reception asynchronously
    client.loop_start()
    
    # Give it a second to connect and output subscription logs
    time.sleep(1.0)
    
    try:
        while True:
            cmd = input("Enter command (1: ON, 2: OFF, q: QUIT): ").strip()
            if cmd == '1' or cmd.lower() == 'on':
                publish_command(client, "on")
            elif cmd == '2' or cmd.lower() == 'off':
                publish_command(client, "off")
            elif cmd == 'q' or cmd.lower() == 'quit':
                print("\nDisconnecting and exiting...")
                break
            else:
                print("Invalid option. Enter 1 (ON), 2 (OFF), or q (QUIT)")
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nExiting...")
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
