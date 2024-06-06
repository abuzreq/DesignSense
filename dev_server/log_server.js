const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors'); // Import CORS


const app = express();
const PORT = 3001;

app.use(cors()); // Use CORS middleware


// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Endpoint to receive action and state
app.post('/log', (req, res) => {
  const { action, payload } = req.body;

  const logEntry = {
    action,
    payload,
    timestamp: new Date().toISOString()
  };

  const logFilePath = path.join(__dirname, 'logs.json');

  // Append log entry to the log file
  fs.readFile(logFilePath, (err, data) => {
    let logs = [];
    if (!err) {
      logs = JSON.parse(data);
    }
    logs.push(logEntry);
    fs.writeFile(logFilePath, JSON.stringify(logs, null, 2), (err) => {
      if (err) {
        console.error('Error writing log file', err);
        res.status(500).send('Internal Server Error');
        return;
      }
      res.status(200).send('Log entry saved');
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});