/*
 * ESP32 Smart Switch & Smart Meter Firmware
 * 
 * This firmware connects an ESP32 to Wi-Fi and subscribes to the laptop's
 * MQTT broker to act as a switch for a circuit load (e.g., relay or onboard LED).
 * It also periodically publishes telemetry (voltage, current, power, energy, load status).
 * 
 * Required libraries (install via Arduino Library Manager):
 * - PubSubClient (by Nick O'Leary)
 * 
 * Pin Configuration:
 * - Built-in LED / Relay Pin: GPIO 2 (most ESP32 dev boards have a blue LED on GPIO 2)
 */

#include <WiFi.h>
#include <PubSubClient.h>

// ==================== CONFIGURATION ====================
// Replace with your local Wi-Fi credentials
const char* ssid = "Galaxy M14 5G 4851";
const char* password = "wu4hqresjk7yfb7";

// Replace with your laptop's local IP address (run ipconfig on Windows or ifconfig on Linux/macOS)
// Note: Do NOT use "localhost" or "127.0.0.1" since this runs on the ESP32!
const char* mqtt_server = "10.104.136.87"; 
const int mqtt_port = 1883;

// MQTT Topics
const char* topic_control = "p2p/edge/control";
const char* topic_telemetry = "p2p/edge/telemetry";

// Hardware Settings
const int loadPin = 26; // GPIO 26 (relay pin)
// ==========================================6=============

WiFiClient espClient;
PubSubClient client(espClient);
unsigned long lastMsgTime = 0;
const unsigned long telemetryInterval = 5000; // Publish telemetry every 5 seconds

// Simulated energy stats
bool loadStatus = false;
float voltage = 230.0;       // Grid voltage (V)
float current = 0.0;         // Current (A)
float power = 0.0;           // Power (W)
float cumulativeEnergy = 0.0; // Cumulative energy (kWh)
unsigned long lastEnergyCalcTime = 0;

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to Wi-Fi network: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("Wi-Fi connected successfully!");
  Serial.print("ESP32 IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived on topic [");
  Serial.print(topic);
  Serial.print("]: ");
  
  String msg = "";
  for (int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }
  Serial.println(msg);

  // Parse control message: looking for {"status": "on"} or {"status": "off"}
  // Using zero-dependency string searching to keep flashing simple
  msg.toLowerCase();
  if (msg.indexOf("on") >= 0) {
    loadStatus = true;
    digitalWrite(loadPin, HIGH); // Active-High: HIGH = ON
    Serial.println(">>> LOAD SWITCH: ON <<<");
    sendTelemetry(); // Publish updated state immediately
  } else if (msg.indexOf("off") >= 0) {
    loadStatus = false;
    digitalWrite(loadPin, LOW); // Active-High: LOW = OFF
    Serial.println(">>> LOAD SWITCH: OFF <<<");
    sendTelemetry(); // Publish updated state immediately
  }
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("Wi-Fi disconnected. Reconnecting...");
      WiFi.disconnect();
      WiFi.begin(ssid, password);
      while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
      }
      Serial.println("\nWi-Fi reconnected!");
    }

    Serial.print("Attempting MQTT connection to ");
    Serial.print(mqtt_server);
    Serial.print("...");
    
    // Attempt to connect with a unique client ID
    String clientId = "ESP32Client-" + String(random(0, 0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println("connected!");
      // Once connected, subscribe to the control topic
      client.subscribe(topic_control);
      Serial.print("Subscribed to control topic: ");
      Serial.println(topic_control);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" trying again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void sendTelemetry() {
  // Calculate power based on load status
  if (loadStatus) {
    // When load is ON, simulate active power consumption (e.g. 1500W to 2000W)
    current = 6.5 + ((float)random(-50, 50) / 100.0); // 6.0A to 7.0A
    power = voltage * current; 
  } else {
    // When load is OFF, idle consumption is near 0
    current = 0.02; 
    power = voltage * current;
  }

  // Update cumulative energy (kWh) = power(kW) * time(hours)
  unsigned long now = millis();
  float timeDeltaHours = (float)(now - lastEnergyCalcTime) / 3600000.0;
  lastEnergyCalcTime = now;
  cumulativeEnergy += (power / 1000.0) * timeDeltaHours;

  // Build JSON telemetry packet (dependency-free string builder)
  char jsonBuffer[512];
  snprintf(jsonBuffer, sizeof(jsonBuffer),
    "{"
      "\"id\":\"ESP32_METER_01\","
      "\"name\":\"ESP32 Smart Switch\","
      "\"area\":\"Local Grid\","
      "\"energy\":%.4f,"
      "\"power\":%.2f,"
      "\"voltage\":%.1f,"
      "\"current\":%.3f,"
      "\"role\":\"producer\","
      "\"kind\":\"solar\","
      "\"lat\":12.9237,"
      "\"lng\":77.4987,"
      "\"load_status\":\"%s\""
    "}",
    cumulativeEnergy,
    power,
    voltage,
    current,
    loadStatus ? "ON" : "OFF"
  );

  Serial.print("Publishing telemetry: ");
  Serial.println(jsonBuffer);
  client.publish(topic_telemetry, jsonBuffer);
}

void setup() {
  Serial.begin(9600);
  digitalWrite(loadPin, LOW); // Start OFF (LOW for active-high)
  pinMode(loadPin, OUTPUT);
  
  setup_wifi();
  
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  
  lastEnergyCalcTime = millis();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  if (now - lastMsgTime > telemetryInterval) {
    lastMsgTime = now;
    sendTelemetry();
  }
}
