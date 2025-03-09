// server.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const path = require("path");
const cors = require("cors");
const mqtt = require("mqtt");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Database initialization
const db = new sqlite3.Database("./weather.db", async (err) => {
  if (err) {
    console.error("Error opening database", err);
  } else {
    console.log("Connected to SQLite database");
    try {
      await createTables();
      // Only calculate averages after tables are created
      calculateAndStoreAverages();
    } catch (error) {
      console.error("Error during table creation:", error);
    }
  }
});

function createTables() {
  // Create tables sequentially using promises
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `CREATE TABLE IF NOT EXISTS raw_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        value REAL NOT NULL,
        timestamp TEXT NOT NULL
      )`,
        (err) => {
          if (err) reject(err);
        }
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS avg_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        avg_temperature REAL,
        avg_humidity REAL,
        timestamp TEXT NOT NULL
      )`,
        (err) => {
          if (err) reject(err);
          else {
            console.log("Database tables created or already exist");
            resolve();
          }
        }
      );
    });
  });
}

// MQTT Client setup
const mqttClient = mqtt.connect("ws://157.173.101.159:9001");

mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
  mqttClient.subscribe("/work_group_01/room_temp/temperature");
  mqttClient.subscribe("/work_group_01/room_temp/humidity");
});

mqttClient.on("message", (topic, message) => {
  const value = parseFloat(message.toString());
  const timestamp = new Date().toISOString();
  const type = topic.includes("temperature") ? "temperature" : "humidity";

  // Store raw data
  db.run(
    "INSERT INTO raw_data (type, value, timestamp) VALUES (?, ?, ?)",
    [type, value, timestamp],
    (err) => {
      if (err) {
        console.error("Error storing raw data:", err);
      }
    }
  );
});

// Calculate and store 5-minute averages
function calculateAndStoreAverages() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const currentTime = new Date().toISOString();

  // Calculate temperature average
  db.get(
    `SELECT AVG(value) as avg_value 
     FROM raw_data 
     WHERE type = 'temperature' 
     AND timestamp > ? 
     AND timestamp <= ?`,
    [fiveMinutesAgo, currentTime],
    (err, tempResult) => {
      if (err) {
        return console.error("Error calculating temperature average:", err);
      }

      // Calculate humidity average
      db.get(
        `SELECT AVG(value) as avg_value 
         FROM raw_data 
         WHERE type = 'humidity' 
         AND timestamp > ? 
         AND timestamp <= ?`,
        [fiveMinutesAgo, currentTime],
        (err, humidityResult) => {
          if (err) {
            return console.error("Error calculating humidity average:", err);
          }

          // Store averages
          if (tempResult?.avg_value || humidityResult?.avg_value) {
            db.run(
              "INSERT INTO avg_data (avg_temperature, avg_humidity, timestamp) VALUES (?, ?, ?)",
              [
                tempResult?.avg_value || null,
                humidityResult?.avg_value || null,
                currentTime,
              ],
              (err) => {
                if (err) {
                  console.error("Error storing averages:", err);
                }
              }
            );
          }
        }
      );
    }
  );
}

// Calculate averages every minute
setInterval(calculateAndStoreAverages, 60 * 1000);

// API Endpoints
app.get("/api/weather/current", (req, res) => {
  // Get the most recent temperature and humidity readings
  db.get(
    `SELECT 
      MAX(CASE WHEN type = 'temperature' THEN value END) as temperature,
      MAX(CASE WHEN type = 'humidity' THEN value END) as humidity
    FROM raw_data 
    WHERE timestamp > datetime('now', '-1 minute')`,
    (err, row) => {
      if (err) {
        console.error("Error fetching current readings:", err);
        return res
          .status(500)
          .json({ error: "Failed to fetch current readings" });
      }
      res.json({
        temperature: row?.temperature || null,
        humidity: row?.humidity || null,
      });
    }
  );
});

app.get("/api/weather/history", (req, res) => {
  // Get the last hour of raw data
  db.all(
    `SELECT type, value, timestamp 
     FROM raw_data 
     WHERE timestamp > datetime('now', '-1 hour')
     ORDER BY timestamp ASC`,
    (err, rows) => {
      if (err) {
        console.error("Error fetching history:", err);
        return res.status(500).json({ error: "Failed to fetch history" });
      }
      res.json(rows);
    }
  );
});

app.post("/api/weather/history", (req, res) => {
  const { type, value, timestamp } = req.body;

  // Validate input
  if (!type || !value || !timestamp) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (type !== "temperature" && type !== "humidity") {
    return res.status(400).json({ error: "Invalid type" });
  }

  // Store the reading
  db.run(
    "INSERT INTO raw_data (type, value, timestamp) VALUES (?, ?, ?)",
    [type, value, timestamp],
    (err) => {
      if (err) {
        console.error("Error storing reading:", err);
        return res.status(500).json({ error: "Failed to store reading" });
      }
      res.json({ success: true });
    }
  );
});

// Database Viewer Routes
app.get("/db-viewer", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SQLite Database Viewer</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .container { max-width: 1200px; margin: 0 auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>SQLite Database Viewer</h1>
        <h2>Tables</h2>
        <ul>
          <li><a href="/db-viewer/raw-data">raw_data</a></li>
          <li><a href="/db-viewer/avg-data">avg_data</a></li>
        </ul>
        <p>Click on a table name to view its data.</p>
      </div>
    </body>
    </html>
  `);
});

app.get("/db-viewer/raw-data", (req, res) => {
  db.all(
    "SELECT * FROM raw_data ORDER BY timestamp DESC LIMIT 100",
    (err, rows) => {
      if (err) {
        return res.status(500).send("Error fetching data: " + err.message);
      }

      let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>raw_data Table</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .container { max-width: 1200px; margin: 0 auto; }
        .nav { margin-bottom: 20px; }
      </style>
      <meta http-equiv="refresh" content="30">
    </head>
    <body>
      <div class="container">
        <div class="nav">
          <a href="/db-viewer">← Back to Tables</a>
        </div>
        <h1>raw_data Table</h1>
        <p>Showing latest 100 records (auto-refreshes every 30 seconds)</p>
    `;

      if (rows.length === 0) {
        html += "<p>No data found in this table.</p>";
      } else {
        html += "<table><tr>";
        Object.keys(rows[0]).forEach((key) => {
          html += `<th>${key}</th>`;
        });
        html += "</tr>";

        rows.forEach((row) => {
          html += "<tr>";
          Object.values(row).forEach((value) => {
            html += `<td>${value}</td>`;
          });
          html += "</tr>";
        });
        html += "</table>";
      }

      html += `
        <div class="nav">
          <a href="/db-viewer">← Back to Tables</a>
        </div>
      </div>
    </body>
    </html>
    `;
      res.send(html);
    }
  );
});

app.get("/db-viewer/avg-data", (req, res) => {
  db.all(
    "SELECT * FROM avg_data ORDER BY timestamp DESC LIMIT 100",
    (err, rows) => {
      if (err) {
        return res.status(500).send("Error fetching data: " + err.message);
      }

      let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>avg_data Table</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .container { max-width: 1200px; margin: 0 auto; }
        .nav { margin-bottom: 20px; }
      </style>
      <meta http-equiv="refresh" content="30">
    </head>
    <body>
      <div class="container">
        <div class="nav">
          <a href="/db-viewer">← Back to Tables</a>
        </div>
        <h1>avg_data Table</h1>
        <p>Showing latest 100 records (auto-refreshes every 30 seconds)</p>
    `;

      if (rows.length === 0) {
        html += "<p>No data found in this table.</p>";
      } else {
        html += "<table><tr>";
        Object.keys(rows[0]).forEach((key) => {
          html += `<th>${key}</th>`;
        });
        html += "</tr>";

        rows.forEach((row) => {
          html += "<tr>";
          Object.values(row).forEach((value) => {
            html += `<td>${value}</td>`;
          });
          html += "</tr>";
        });
        html += "</table>";
      }

      html += `
        <div class="nav">
          <a href="/db-viewer">← Back to Tables</a>
        </div>
      </div>
    </body>
    </html>
    `;
      res.send(html);
    }
  );
});

// Serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
