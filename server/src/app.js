const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const app = express();
require("dotenv").config();

// Database connection
require("./db/conn");

// Import routes
const authRoutes = require("./routes/auth");
const questionRoutes = require("./routes/questions");
const answerRoutes = require("./routes/answers");
const adminRoutes = require("./routes/admin");
const { router: notificationRoutes } = require("./routes/notifications");

const port = process.env.PORT || 8000;
const static_path = path.join(__dirname, "../public");

// Middleware
app.use(cors(
  {
    origin: ["https://stackit-odoo.onrender.com","https://stackit-new.vercel.app/"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }
));
app.use(express.static(static_path));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api", answerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ 
    message: "StackIt API is running!",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      questions: "/api/questions", 
      answers: "/api/questions/:id/answers",
      admin: "/api/admin",
      notifications: "/api/notifications"
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(port, () => {
  console.log(`StackIt API running at http://localhost:${port}/`);
});
