const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { google } = require('googleapis');
const readline = require('readline');
//const pdfHTML = require('html-pdf');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const puppeteer = require('puppeteer');
var output = "<html><body><h1>No data generated</h1></body></html>";
var flag = 0;

// Load credentials from the JSON file
const credentials = require('./credentials.json');
//console.log(credentials);

async function openBrowser(port) {
  const url = `http://localhost:${port}`;
  const open = await import('open');
  await open.default(url);
}

// Configure the client object
const { client_email, private_key } = credentials;
const client = new google.auth.JWT(
  client_email,
  null,
  private_key,
  ['https://www.googleapis.com/auth/spreadsheets']
);

// Function to save contact information to Google Sheets
async function saveToGoogleSheets(name, email, phone, message) {
  const spreadsheetId = '1jCbYWXJKD0cZvPxhsoUOeddo5g1NLhCzK-C5z79c1pY';
  const sheetName = 'contact';

  try {
    // Authorize the client
    await client.authorize();

    // Create instance of Google Sheets API
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Get the existing values from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:B`,
    });

    const values = response.data.values || [];

    // Append the new contact information to the sheet
    const resource = {
      values: [[name, email, phone, message]],
    };

    const result = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:B`,
      valueInputOption: 'USER_ENTERED',
      resource,
    });

    console.log(`${result.data.updates.updatedCells} cells appended.`);

    return true;
  } catch (error) {
    console.error('Error occurred while saving to Google Sheets:', error);
    return false;
  }
}

// Create MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'jashanniranjan',
  database: 'new',
});
const generateTable = (rowPacket) => {
  let tableHTML = '<table class="output">';

  // Generate table header
  tableHTML += '<thead class="output-thead"><tr>';
  const fields = Object.keys(rowPacket[0]);
  for (let field of fields) {
    tableHTML += '<th>' + field + '</th>';
  }
  tableHTML += '</tr></thead>';

  // Generate table body
  tableHTML += '<tbody>';
  for (let row of rowPacket) {
    tableHTML += '<tr>';
    for (let field of fields) {
      tableHTML += '<td>' + row[field] + '</td>';
    }
    tableHTML += '</tr>';
  }
  tableHTML += '</tbody>';

  tableHTML += '</table>';

  return tableHTML;
};

db.connect((err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
  console.log('Database connected');
});

const app = express();
const port = 3000;
// Middleware to parse JSON data in the request body
app.use(bodyParser.json());
// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
// Serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));

  //res.render('admin_panel.ejs')
});

app.post('/contact', (req, res) => {
  const { name, email, phone, message } = req.body;
  saveToGoogleSheets(name, email, phone, message);
  res.redirect('/contactpage');
})

app.get('/generate-pdf', async (req, res) => {
  try {
    const imageFile = fs.readFileSync('public/img/smvec.png');
    const html = `
      <html>
        <head>
          <style>
          .output {
            font-size: 100%;
            padding: 6px 16px;
            font-family: Arial, Helvetica, sans-serif;
            border-radius: 35px;
            font-weight: 500;
            padding-left: 135px;
            margin: 0 auto;
  width: 50%;
  border-collapse: collapse;
  border: 2px solid black;
}

.output th, .output td {
  border: 1px solid black;
  padding: 8px;
  text-align: center;
}
          .output th {
  text-transform: uppercase;
  font-weight: bold;
}

          .header {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 20px;
          }

          .header img {
            max-width: 100%;
            height: auto;
          }
          body {
            margin: 0;
            padding: 0;
          }
          
          .content {
            margin-bottom: 50px; /* Adjust the bottom margin to accommodate the footer */
          }
          
          .footer {
            background-color: rgba(0, 0, 0, 0.1); /* Slight black background */
            color: white; /* Text color for better contrast */
            padding: 10px;
            text-align: center;
            position: fixed;
            left: 0;
            bottom: 0;
            width: 100%;
          }
        </style>
        </head>
        <body>
          <div class="header">
            <img src="data:image/png;base64,${imageFile.toString('base64')}" alt="Header Image">
          </div>
          <br>
          ${output}
          <footer class="footer">
          <p>Sri Manakula Vinayagar Engineering College</p>
        </footer>
        </body>
      </html>`;

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html);

    const pdf = await page.pdf({ format: 'A4' });
    await browser.close();

    res.setHeader('Content-Disposition', 'attachment; filename="Marklist.pdf"');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdf);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Error generating PDF');
  }
});

app.get('/logout', (req, res) => {
  flag = 0;
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
})

app.post('/uploadData', (req, res) => {
  console.log(req.body.data)
  console.log("Connected! in addDataExcel");
  var sql = `INSERT INTO ${req.body.dept} (batch,reqno,sname,syear,semester,course,mark) VALUES ?`;
  db.query(sql, [req.body.data], function (err, result) {
    if (err) throw err;
    console.log("record inserted");
    return res.json({ data: req.body.data })
  });
})

app.post('/search', (req, res) => {

  //console.log(req.body);
  var sqlQuery;
  if (req.body.batch == "select" && req.body.year == "select" && req.body.semester == "select") {
    sqlQuery = "SELECT * FROM " + req.body.dept + ";";
  }
  else if(req.body.batch == "select" && req.body.year == "select" && req.body.semester != "select"){
    sqlQuery = "SELECT * FROM " + req.body.dept + " where semester= '" + req.body.semester + "';";
  }
  else if(req.body.batch == "select" && req.body.year != "select" && req.body.semester == "select"){
    sqlQuery = "SELECT * FROM " + req.body.dept + " where syear= '" + req.body.year + "';";
  }
  else if(req.body.batch != "select" && req.body.year == "select" && req.body.semester == "select"){
    sqlQuery = "SELECT * FROM " + req.body.dept + " where batch= '" + req.body.batch + "';";
  }
  else if(req.body.batch != "select" && req.body.year != "select" && req.body.semester == "select"){
    sqlQuery = "SELECT * FROM " + req.body.dept + " where batch= '" + req.body.batch +"'and syear='"+ req.body.year+"';";
  }
  else if(req.body.batch == "select" && req.body.year != "select" && req.body.semester != "select"){
    sqlQuery = "SELECT * FROM " + req.body.dept + " where semester= '" + req.body.semester +"'and syear='"+ req.body.year+"';";
  }
  else if(req.body.batch != "select" && req.body.year == "select" && req.body.semester != "select"){
    sqlQuery = "SELECT * FROM " + req.body.dept + " where batch= '" + req.body.batch +"'and semester='"+ req.body.semester+"';";
  }
  else{
    sqlQuery = "SELECT * FROM " + req.body.dept + " where batch= '" + req.body.batch + "' and syear = '" + req.body.year + "' and semester='" + req.body.semester + "';";
    //console.log(sqlQuery);
  }
  console.log(sqlQuery);
  db.query(sqlQuery, (error, results, fields) => {
    if (error) {
      //console.error('Error executing MySQL query:', error);
      //return;
      res.send("<pre>Select Department to view</pre>");
    }
    // console.log(results);
    //console.log('Query results:', results);
    // Assuming `result` is your RowDataPacket
    else if (results.length === 0) {
      res.send("No Data Available");
    }
    else {
      output = generateTable(results);
      res.send(output);
    }
  });
})

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  openBrowser(port);
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.get('/admin', (req, res) => {
  if (flag == 1)
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  else
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  //res.render('admin_panel.ejs')
});

app.get('/contactpage', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
  //res.render('admin_panel.ejs')
});

// Login route
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  // Query the database for the user with the given email
  db.query('SELECT * FROM trainer WHERE temail = ?;', [email], (err, results) => {
    if (err) throw err;
    // If user is not found
    //console.log(results);
    if (results.length === 0) {
      res.status(401).json({ message: 'Invalid email or password' });
    } else {
      // Compare the entered password with the stored hash
      const user = results[0];
      //console.log(user);
      if (password == user.tpassword) {
        //res.status(200).json({ message: 'Login successful' });
        flag = 1;
        res.redirect('/admin')
      } else {
        res.status(401).json({ message: 'Invalid email or password' });
      }
    }
  });
});