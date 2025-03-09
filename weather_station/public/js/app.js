// DOM Elements
const temperatureElement = document.getElementById("temperature");
const humidityElement = document.getElementById("humidity");
const pressureElement = document.getElementById("pressure");
const timestampElement = document.getElementById("timestamp");
const ctx = document.getElementById("weatherChart").getContext("2d");

// Store latest values
let latestData = {
  temperature: "--",
  humidity: "--",
  pressure: "--",
  timestamp: new Date(),
};

// Initialize Chart
const chart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Temperature (°C)",
        borderColor: "rgb(239, 68, 68)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        data: [],
        yAxisID: "temperature",
      },
      {
        label: "Humidity (%)",
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        data: [],
        yAxisID: "humidity",
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index",
    },
    scales: {
      x: {
        type: "time",
        time: {
          unit: "minute",
          displayFormats: {
            minute: "HH:mm",
          },
        },
        title: {
          display: true,
          text: "Time",
        },
      },
      temperature: {
        type: "linear",
        position: "left",
        title: {
          display: true,
          text: "Temperature (°C)",
        },
      },
      humidity: {
        type: "linear",
        position: "right",
        title: {
          display: true,
          text: "Humidity (%)",
        },
      },
    },
    plugins: {
      title: {
        display: true,
        text: "5-Minute Averages",
      },
    },
  },
});

// Function to format timestamp
const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

// Function to update the UI with new weather data
const updateUI = () => {
  temperatureElement.textContent = latestData.temperature;
  humidityElement.textContent = latestData.humidity;
  pressureElement.textContent = latestData.pressure;
  timestampElement.textContent = formatTimestamp(latestData.timestamp);
};

// Function to update the chart with new averages
const updateChart = async () => {
  try {
    const response = await fetch("/api/averages");
    if (!response.ok) {
      throw new Error("Failed to fetch averages");
    }
    const data = await response.json();

    // Update chart data
    chart.data.labels = data.map((d) => new Date(d.timestamp));
    chart.data.datasets[0].data = data.map((d) => d.avg_temperature);
    chart.data.datasets[1].data = data.map((d) => d.avg_humidity);
    chart.update();
  } catch (error) {
    console.error("Error updating chart:", error);
  }
};

// Connect to MQTT Broker
const mqttClient = mqtt.connect("ws://157.173.101.159:9001");

mqttClient.on("connect", () => {
  console.log("Connected to MQTT via WebSockets");
  mqttClient.subscribe("/work_group_01/room_temp/temperature");
  mqttClient.subscribe("/work_group_01/room_temp/humidity");
});

mqttClient.on("message", (topic, message) => {
  const value = message.toString();
  const timestamp = new Date();
  console.log(`Received: ${topic} → ${value}`);

  if (topic === "/work_group_01/room_temp/temperature") {
    latestData.temperature = parseFloat(value).toFixed(1);
    latestData.timestamp = timestamp;
  } else if (topic === "/work_group_01/room_temp/humidity") {
    latestData.humidity = parseFloat(value).toFixed(1);
    latestData.timestamp = timestamp;
  }

  updateUI();
});

mqttClient.on("error", (error) => {
  console.error("MQTT Error:", error);
});

// Initial UI update and start periodic chart updates
updateUI();
updateChart();
setInterval(updateChart, 60 * 1000); // Update chart every minute
