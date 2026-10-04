require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware Setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve Static Files (CSS)
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection Pool using .env
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test Database Connection
db.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err.stack);
  } else {
    console.log('Connected to MySQL Database.');
    connection.release();
  }
});

// Helper Validation Function
function validateStudentData(data) {
  const { student_id, first_name, last_name, course, year_level, email } = data;
  
  if (!student_id || !first_name || !last_name || !course || !year_level || !email) {
    return 'All fields are required.';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Invalid email format.';
  }

  const validYearLevels = ['1', '2', '3', '4', 1, 2, 3, 4];
  if (!validYearLevels.includes(year_level)) {
    return 'Year level must be between 1 and 4.';
  }

  return null;
}

// ================= ROUTES ================= //

// 1. READ & SEARCH STUDENTS (Student List & Search)
app.get('/', (req, res) => {
  const searchQuery = req.query.search;
  let sql = 'SELECT * FROM students';
  let params = [];

  if (searchQuery) {
    sql += ' WHERE student_id LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR course LIKE ?';
    const term = `%${searchQuery}%`;
    params = [term, term, term, term];
  }

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching students:', err);
      return res.status(500).send('Database error.');
    }
    res.render('index', { students: results, search: searchQuery || '' });
  });
});

// 2. RENDER ADD STUDENT FORM
app.get('/add', (req, res) => {
  res.render('add', { error: null, student: {} });
});

// 3. CREATE STUDENT (Add Student with Validation & Unique ID check)
app.post('/add', (req, res) => {
  const { student_id, first_name, last_name, course, year_level, email } = req.body;

  // Input Validation
  const validationError = validateStudentData(req.body);
  if (validationError) {
    return res.status(400).render('add', { error: validationError, student: req.body });
  }

  // Check Unique Student ID
  db.query('SELECT * FROM students WHERE student_id = ?', [student_id], (err, results) => {
    if (err) {
      console.error('Error checking ID:', err);
      return res.status(500).send('Database error.');
    }
    if (results.length > 0) {
      return res.status(400).render('add', { error: 'Student ID already exists.', student: req.body });
    }

    // Insert into Database
    const insertSql = 'INSERT INTO students (student_id, first_name, last_name, course, year_level, email) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(insertSql, [student_id, first_name, last_name, course, year_level, email], (err) => {
      if (err) {
        console.error('Error adding student:', err);
        return res.status(500).send('Database error.');
      }
      res.redirect('/');
    });
  });
});

// 4. RENDER EDIT STUDENT FORM
app.get('/edit/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM students WHERE id = ?', [id], (err, results) => {
    if (err || results.length === 0) {
      return res.status(444).send('Student not found.');
    }
    res.render('edit', { student: results[0], error: null });
  });
});

// 5. UPDATE STUDENT RECORD
app.post('/edit/:id', (req, res) => {
  const { id } = req.params;
  const { student_id, first_name, last_name, course, year_level, email } = req.body;

  const validationError = validateStudentData(req.body);
  if (validationError) {
    return res.status(400).render('edit', { student: { ...req.body, id }, error: validationError });
  }

  const updateSql = 'UPDATE students SET student_id = ?, first_name = ?, last_name = ?, course = ?, year_level = ?, email = ? WHERE id = ?';
  db.query(updateSql, [student_id, first_name, last_name, course, year_level, email, id], (err) => {
    if (err) {
      console.error('Error updating student:', err);
      return res.status(500).send('Database error.');
    }
    res.redirect('/');
  });
});

// 6. DELETE STUDENT RECORD
app.post('/delete/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM students WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting student:', err);
      return res.status(500).send('Database error.');
    }
    res.redirect('/');
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});