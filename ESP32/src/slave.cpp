#include <WiFi.h>
#include <FirebaseESP32.h>
#include <DHT.h>
#include <Wire.h>
#include <BH1750.h>

const char *ssid = "Fathallah zaben";
const char *password = "0595111179";

const char *firebaseHost = "https://mushrrom-4ce90-default-rtdb.europe-west1.firebasedatabase.app";
const char *firebaseAuth = "wdsAWQisSGSCGs1wHEg92FK6kWKZjUbhH6pLzNdF";

const char *roomId = "room1";
int slaveID = 1;

DHT dht(25, DHT11);
BH1750 lightMeter;

const int mqSensorPin = 34;

FirebaseData fbdo;

void updateFirebase(const char *path, String value)
{
    if (Firebase.setString(fbdo, path, value))
    {
        Serial.println("Firebase updated: " + String(path) + " = " + value);
    }
    else
    {
        Serial.println("Failed to update Firebase: " + fbdo.errorReason());
    }
}

void setup()
{
    Serial.begin(115200);
    dht.begin();
    Wire.begin();
    if (!lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE))
    {
        Serial.println("Error initializing BH1750");
    }

    WiFi.begin(ssid, password);
    Serial.println();

    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }

    Serial.println("");
    Serial.print("Connected to ");
    Serial.println(ssid);
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());

    Firebase.begin(firebaseHost, firebaseAuth);
    Firebase.reconnectWiFi(true);
}

void loop()
{
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();
    float lux = lightMeter.readLightLevel();
    int mqValue = analogRead(mqSensorPin);

    if (isnan(temperature) || isnan(humidity))
    {
        Serial.println("Failed to read from DHT sensor!");
        return;
    }

    Serial.print("Temperature: ");
    Serial.println(temperature);
    Serial.print("Humidity: ");
    Serial.println(humidity);
    Serial.print("Light: ");
    Serial.println(lux);
    Serial.print("MQ Sensor: ");
    Serial.println(mqValue);

    String basePath = "/rooms/" + String(roomId) + "/slaves/slave" + String(slaveID);
    updateFirebase((basePath + "/temperature").c_str(), String(temperature));
    updateFirebase((basePath + "/humidity").c_str(), String(humidity));
    updateFirebase((basePath + "/light").c_str(), String(lux));
    updateFirebase((basePath + "/mq_value").c_str(), String(mqValue));

    delay(2000);
}
