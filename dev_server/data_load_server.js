const http = require('http');
const fs = require('fs');
const path = require('path');


/*
// To use this server, create a data.csv file and put it and along with images in the data subfolder.
 The data.csv images columns should say: "http://localhost:[port]/[subfolder]/[image_name].jpg"  e.g., http://localhost:3000/data/0-20-40-0.jpg
*/

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, req.url);
  const fileExtension = path.extname(filePath);
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

  // Check if the requested file has an allowed image extension
  if (allowedExtensions.includes(fileExtension.toLowerCase())) {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      } else {
        // Set the appropriate content type based on the file extension
        res.setHeader('Content-Type', `image/${fileExtension.substring(1)}`);
        res.end(data);
      }
    });
  } else {
    res.statusCode = 400;
    res.end('Bad Request');
  }
});

const port = 3000; // Specify the port number you want to use
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});