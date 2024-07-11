#include <WiFi.h>
#include <FirebaseESP32.h>
#include <DHT.h>
#include <SPIFFS.h>
#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <IRrecv.h>
#include <vector>

const char *ssid = "Fathallah zaben";
const char *password = "0595111179";

const char *firebaseHost = "https://mushrrom-4ce90-default-rtdb.europe-west1.firebasedatabase.app";
const char *firebaseAuth = "wdsAWQisSGSCGs1wHEg92FK6kWKZjUbhH6pLzNdF";

const char *roomId = "room1";
String queuePath = "/rooms/" + String(roomId) + "/air_condition_actions/actionQueue";

DHT dht(25, DHT11);
IRrecv irrecv(15);
IRsend irsend(21);
decode_results results;

const int mqSensorPin = 34;

FirebaseData fbdo;
FirebaseData fbdoSlave;
String mode = "automatic";
String stage = "incubation";

int fanPin = 18;
int lampPin = 5;
int humidityMisterPin = 19;

int maxTempreature = 25;
int minTempreature = 24;

int maxHumidity = 95;
int minHumidity = 100;

int maxMqSensor = 800;

bool airConditionState = false;
bool fanState = false;
bool lampState = false;
bool humidityMisterState = false;

struct SlaveData
{
  String id;
  float temperature;
  float humidity;
  float mqValue;
};

const int numSlaves = 2;
SlaveData slavesData[numSlaves] = {{"slave1", NAN, NAN, NAN}, {"slave2", NAN, NAN, NAN}};

int readingsCount = 0;
SlaveData cumulativeData[numSlaves] = {{"slave1", 0, 0, 0}, {"slave2", 0, 0, 0}};

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

void getMode()
{
  String path = "/rooms/" + String(roomId) + "/mode";
  if (Firebase.getString(fbdo, path.c_str()))
  {
    mode = fbdo.stringData();
    Serial.println("Mode: " + mode);
  }
  else
  {
    Serial.println("Failed to get mode: " + fbdo.errorReason());
  }
}

void getStage()
{
  String path = "/rooms/" + String(roomId) + "/stage";
  if (Firebase.getString(fbdo, path.c_str()))
  {
    stage = fbdo.stringData();
    Serial.println("Stage: " + stage);
  }
  else
  {
    Serial.println("Failed to get stage: " + fbdo.errorReason());
  }
}

void getActuatorStates()
{
  String basePath = "/rooms/" + String(roomId) + "/actuators";
  if (Firebase.getJSON(fbdo, basePath.c_str()))
  {
    FirebaseJson &json = fbdo.jsonObject();
    FirebaseJsonData jsonData;

    json.get(jsonData, "air_condition");
    airConditionState = jsonData.boolValue;
    Serial.println("Air condition " + String(airConditionState ? "ON" : "OFF"));

    json.get(jsonData, "fan");
    fanState = jsonData.boolValue;
    digitalWrite(fanPin, fanState ? LOW : HIGH);
    Serial.println("Fan " + String(fanState ? "ON" : "OFF"));

    json.get(jsonData, "lamp");
    lampState = jsonData.boolValue;
    digitalWrite(lampPin, lampState ? LOW : HIGH);
    Serial.println("Lamp " + String(lampState ? "ON" : "OFF"));

    json.get(jsonData, "humidity_mister");
    humidityMisterState = jsonData.boolValue;
    digitalWrite(humidityMisterPin, humidityMisterState ? LOW : HIGH);
    Serial.println("Humidity mister " + String(humidityMisterState ? "ON" : "OFF"));
  }
  else
  {
    Serial.println("Failed to get JSON data: " + fbdo.errorReason());
  }
}

void getSlaveData(const char *slaveId, SlaveData &slaveData)
{
  String basePath = "/rooms/" + String(roomId) + "/slaves/" + String(slaveId);
  if (Firebase.getJSON(fbdoSlave, basePath.c_str()))
  {
    FirebaseJson &json = fbdoSlave.jsonObject();
    FirebaseJsonData jsonData;

    json.get(jsonData, "temperature");
    slaveData.temperature = jsonData.floatValue;

    json.get(jsonData, "humidity");
    slaveData.humidity = jsonData.floatValue;

    json.get(jsonData, "mq_value");
    slaveData.mqValue = jsonData.intValue;

    slaveData.id = slaveId;
  }
  else
  {
    Serial.println("Failed to get JSON data for slave " + String(slaveId) + ": " + fbdoSlave.errorReason());
  }
}

void getSlaves()
{
  for (int i = 0; i < numSlaves; ++i)
  {
    getSlaveData(slavesData[i].id.c_str(), slavesData[i]);
    cumulativeData[i].temperature += slavesData[i].temperature;
    cumulativeData[i].humidity += slavesData[i].humidity;
    cumulativeData[i].mqValue += slavesData[i].mqValue;
  }

  readingsCount++;

  if (readingsCount >= 10)
  {
    for (int i = 0; i < numSlaves; ++i)
    {
      slavesData[i].temperature = cumulativeData[i].temperature / 10;
      slavesData[i].humidity = cumulativeData[i].humidity / 10;
      slavesData[i].mqValue = cumulativeData[i].mqValue / 10;

      String basePath = "/rooms/" + String(roomId) + "/slaves/" + String(slavesData[i].id);
      updateFirebase((basePath + "/temperature").c_str(), String(slavesData[i].temperature));
      updateFirebase((basePath + "/humidity").c_str(), String(slavesData[i].humidity));
      updateFirebase((basePath + "/mq_value").c_str(), String(slavesData[i].mqValue));

      cumulativeData[i].temperature = 0;
      cumulativeData[i].humidity = 0;
      cumulativeData[i].mqValue = 0;
    }
    readingsCount = 0;
  }

  for (int i = 0; i < numSlaves; ++i)
  {
    Serial.println("Processing data for slave: " + slavesData[i].id);
    Serial.print("Temperature: ");
    Serial.println(slavesData[i].temperature);
    Serial.print("Humidity: ");
    Serial.println(slavesData[i].humidity);
    Serial.print("MQ Sensor: ");
    Serial.println(slavesData[i].mqValue);
  }
}

void updateConditions()
{
  if (stage == "incubation")
  {
    maxTempreature = 25;
    minTempreature = 24;

    maxHumidity = 100;
    minHumidity = 95;
  }
  else if (stage == "fruiting")
  {
    maxTempreature = 20;
    minTempreature = 18;

    maxHumidity = 90;
    minHumidity = 85;
  }
}

void sendAction(const String &action)
{
  Serial.print("Action : ");
  Serial.println(action);

  uint64_t actionValue = strtoull(action.c_str(), nullptr, 16);
  irsend.sendNEC(actionValue);
  delay(150);
  irrecv.resume();
  delay(150);
}

void controlActuators(float avgTemperature, float avgHumidity, float avgMqValue)
{
  if (mode == "manual")
  {
    return;
  }
  String basePath = "/rooms/" + String(roomId) + "/actuators";
  if (avgTemperature > maxTempreature)
  {
    if (airConditionState == true)
    {
      sendAction("0xFF10EF");
    }
    else
    {
      Firebase.setBool(fbdo, basePath + "/air_condition", true);
      sendAction("0xFFA05F");
    }
    sendAction("0xFF50AF");
    sendAction("0xFF48B7");
    sendAction("0xFF48B7");
  }
  else if (avgTemperature < minTempreature)
  {
    if (airConditionState == true)
    {
      sendAction("0xFFA05F");
    }
    else
    {
      Firebase.setBool(fbdo, basePath + "/air_condition", true);
      sendAction("0xFFA05F");
    }
    sendAction("0xFF10EF");
  }
  if (avgHumidity < minHumidity)
  {
    digitalWrite(humidityMisterPin, LOW);
    Serial.println("Humidity mister ON");
  }
  else if (avgHumidity > maxHumidity)
  {
    digitalWrite(humidityMisterPin, HIGH);
    Serial.println("Humidity mister OFF");
  }

  if (avgMqValue > maxMqSensor)
  {
    digitalWrite(fanPin, LOW);
    Serial.println("Fan ON");
  }
  else
  {
    digitalWrite(fanPin, HIGH);
    Serial.println("Fan OFF");
  }
}

void readSensors(float &temperature, float &humidity, int &mqValue)
{
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();
  mqValue = analogRead(mqSensorPin);

  if (isnan(temperature) || isnan(humidity))
  {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }

  Serial.printf("Temperature: %.2f\nHumidity: %.2f\nMQ Sensor: %d\n", temperature, humidity, mqValue);

  String basePath = "/rooms/" + String(roomId) + "/master";
  updateFirebase((basePath + "/temperature").c_str(), String(temperature));
  updateFirebase((basePath + "/humidity").c_str(), String(humidity));
  updateFirebase((basePath + "/mq_value").c_str(), String(mqValue));
}

void calculateAverages(float &avgTemperature, float &avgHumidity, float &avgMqValue)
{
  float totalTemperature = 0;
  float totalHumidity = 0;
  float totalMqValue = 0;

  for (int i = 0; i < numSlaves; ++i)
  {
    totalTemperature += slavesData[i].temperature;
    totalHumidity += slavesData[i].humidity;
    totalMqValue += slavesData[i].mqValue;
  }

  totalTemperature += dht.readTemperature();
  totalHumidity += dht.readHumidity();
  totalMqValue += analogRead(mqSensorPin);

  avgTemperature = totalTemperature / (numSlaves + 1);
  avgHumidity = totalHumidity / (numSlaves + 1);
  avgMqValue = totalMqValue / (numSlaves + 1);

  Serial.printf("Average Temperature: %.2f\nAverage Humidity: %.2f\nAverage MQ Sensor: %.2f\n", avgTemperature, avgHumidity, avgMqValue);
}

void updateStage()
{
  int incubationDays = 0;
  int fruitingDays = 0;

  String incubationPath = "/rooms/" + String(roomId) + "/incubationDays";
  if (Firebase.getInt(fbdo, incubationPath.c_str()))
  {
    incubationDays = fbdo.intData();
  }

  String fruitingPath = "/rooms/" + String(roomId) + "/fruitingDays";
  if (Firebase.getInt(fbdo, fruitingPath.c_str()))
  {
    fruitingDays = fbdo.intData();
  }

  if (stage == "incubation" && incubationDays >= 14)
  {
    stage = "fruiting";
    String stagePath = "/rooms/" + String(roomId) + "/stage";
    updateFirebase(stagePath.c_str(), stage);
  }
}

void testIR()
{
  if (irrecv.decode(&results))
  {
    Serial.println("Coming infrared : ");
    Serial.println(results.value, HEX);
    irrecv.resume();
    delay(150);
  }

  irsend.sendNEC(0xFF6897);
  delay(170);
}
void serveAirCondition()
{
  if (Firebase.getJSON(fbdo, queuePath.c_str()))
  {
    FirebaseJson &json = fbdo.jsonObject();
    FirebaseJsonData jsonData;

    size_t queueSize = json.iteratorBegin();
    if (queueSize > 0)
    {
      String firstElementKey = "";
      int elementType;
      String elementValue;

      for (size_t i = 0; i < queueSize; i++)
      {
        json.iteratorGet(i, elementType, firstElementKey, elementValue);
        break;
      }
      json.iteratorEnd();

      if (json.get(jsonData, firstElementKey + "/action"))
      {
        String action = jsonData.stringValue;
        sendAction(action);

        if (Firebase.deleteNode(fbdo, queuePath + "/" + firstElementKey))
        {
          Serial.println("Queue element removed successfully");
        }
        else
        {
          Serial.println("Failed to remove queue element: " + fbdo.errorReason());
        }
      }
      else
      {
        Serial.println("Failed to get action from the first queue element");
      }
    }
    else
    {
      json.iteratorEnd();
      Serial.println("Queue is empty");
    }
  }
  else
  {
    Serial.println("Failed to get the queue: " + fbdo.errorReason());
  }
}

void setup()
{
  Serial.begin(115200);
  dht.begin();
  irsend.begin();
  irrecv.enableIRIn();

  WiFi.begin(ssid, password);
  Serial.println();

  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConnected to ");
  Serial.println(ssid);
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  pinMode(fanPin, OUTPUT);
  pinMode(lampPin, OUTPUT);
  pinMode(humidityMisterPin, OUTPUT);

  if (!SPIFFS.begin(true))
  {
    Serial.println("An Error has occurred while mounting SPIFFS");
    return;
  }

  Firebase.begin(firebaseHost, firebaseAuth);
  Firebase.reconnectWiFi(true);

  getActuatorStates();
  getMode();
  getStage();
}

void loop()
{
  float temperature, humidity;
  int mqValue;

  float avgTemperature, avgHumidity, avgMqValue;

  readSensors(temperature, humidity, mqValue);

  getActuatorStates();

  getSlaves();

  getMode();

  getStage();

  updateStage();

  calculateAverages(avgTemperature, avgHumidity, avgMqValue);

  controlActuators(avgTemperature, avgHumidity, avgMqValue);

  serveAirCondition();
}
