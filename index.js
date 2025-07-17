require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

// User Schema (since you're importing User model)
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
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err.message));

// UI Render
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Create a new user
app.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    
    const user = new User({ username });
    await user.save();
    
    res.status(201).json({ 
      username: user.username, 
      _id: user._id 
    });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username _id');
    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add an exercise
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
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
    
    const exerciseDate = date ? new Date(date) : new Date();
    const exercise = { 
      description, 
      duration: Number(duration), 
      date: exerciseDate 
    };
    
    user.log.push(exercise);
    await user.save();
    
    res.status(201).json({
      _id: user._id,
      username: user.username,
      description,
      duration: Number(duration),
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
      logs = logs.filter(exercise => exercise.date >= fromDate);
    }
    
    if (to) {
      const toDate = new Date(to);
      logs = logs.filter(exercise => exercise.date <= toDate);
    }
    
    // Apply limit
    if (limit) {
      logs = logs.slice(0, Number(limit));
    }
    
    // Format the response
    const formattedLogs = logs.map(exercise => ({
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString()
    }));
    
    res.json({
      _id: user._id,
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
