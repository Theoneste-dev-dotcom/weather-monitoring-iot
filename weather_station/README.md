# Weather Station Dashboard

A simple and modern weather station dashboard built with Express.js and vanilla JavaScript. The dashboard displays real-time weather data including temperature, humidity, and pressure readings.

## Features

- Real-time weather data display
- Responsive design using Tailwind CSS
- Modern UI with intuitive cards layout
- Automatic updates every 5 seconds

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd weather-station
```

2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
node server.js
```

The application will be available at `http://localhost:3000`

## Project Structure

```
weather-station/
├── public/
│   ├── js/
│   │   └── app.js
├── views/
│   └── index.html
├── server.js
├── package.json
└── README.md
```

## Technology Stack

- Express.js - Backend server
- Vanilla JavaScript - Frontend functionality
- Tailwind CSS - Styling
- Font Awesome - Icons

## API Endpoints

- `GET /api/weather` - Returns current weather data
  - Response format:
    ```json
    {
      "temperature": "23.5",
      "humidity": "45.2",
      "pressure": "1013.2",
      "timestamp": "2024-03-20T12:00:00.000Z"
    }
    ```

## License

MIT
