require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  log: [{
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    date: { type: Date, required: true }
  }]
});

const User = mongoose.model('User', userSchema);

// Middlewares
const app = express();
app.use(cors());
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Connect to MongoDB with better error handling
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch(err => {
  console.error("❌ MongoDB connection error:", err.message);
  process.exit(1);
});

// Handle MongoDB connection events
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// UI Render
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Create a new user
app.post('/api/users', async (req, res) => {
  try {
    console.log('POST /api/users - Request body:', req.body);
    
    const { username } = req.body;
    
    if (!username || username.trim() === '') {
      return res.status(400).json({ error: "Username is required" });
    }
    
    const user = new User({ username: username.trim() });
    const savedUser = await user.save();
    
    console.log('User created:', savedUser);
    
    res.json({ 
      username: savedUser.username, 
      _id: savedUser._id.toString()
    });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    console.log('GET /api/users - Fetching all users');
    
    const users = await User.find({}).select('username _id');
    
    console.log('Users found:', users);
    
    const userArray = users.map(user => ({
      username: user.username,
      _id: user._id.toString()
    }));
    
    res.json(userArray);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add an exercise
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    console.log('POST /api/users/:_id/exercises - Params:', req.params);
    console.log('POST /api/users/:_id/exercises - Body:', req.body);
    
    const { description, duration, date } = req.body;
    const userId = req.params._id;
    
    // Validate required fields
    if (!description || !duration) {
      return res.status(400).json({ error: "Description and duration are required" });
    }
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const exerciseDate = date && date.trim() !== '' ? new Date(date) : new Date();
    
    // Validate date
    if (isNaN(exerciseDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    
    const exercise = { 
      description: description.toString(), 
      duration: parseInt(duration), 
      date: exerciseDate 
    };
    
    user.log.push(exercise);
    await user.save();
    
    console.log('Exercise added for user:', user.username);
    
    res.json({
      _id: user._id.toString(),
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: exerciseDate.toDateString()
    });
  } catch (err) {
    console.error("Error adding exercise:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get user logs (with optional query params)
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    console.log('GET /api/users/:_id/logs - Params:', req.params);
    console.log('GET /api/users/:_id/logs - Query:', req.query);
    
    const { from, to, limit } = req.query;
    const userId = req.params._id;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    let logs = [...user.log];
    
    // Filter by date range
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        logs = logs.filter(exercise => exercise.date >= fromDate);
      }
    }
    
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        logs = logs.filter(exercise => exercise.date <= toDate);
      }
    }
    
    // Apply limit
    if (limit && !isNaN(parseInt(limit))) {
      logs = logs.slice(0, parseInt(limit));
    }
    
    // Format the response
    const formattedLogs = logs.map(exercise => ({
      description: exercise.description.toString(),
      duration: parseInt(exercise.duration),
      date: exercise.date.toDateString()
    }));
    
    console.log('Returning logs for user:', user.username, 'Count:', formattedLogs.length);
    
    res.json({
      _id: user._id.toString(),
      username: user.username,
      count: formattedLogs.length,
      log: formattedLogs
    });
  } catch (err) {
    console.error("Error fetching logs:", err);
    res.status(500).json({ error: err.message });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
